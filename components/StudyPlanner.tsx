"use client";
import { useEffect, useState, useRef, type FormEvent } from "react";

import {
  PLANNER_KEY,
  plannerStudySchema,
  plannerSearchSchema,
  emptyPlanner,
  parsePlanner,
  plannerSchema,
  savedSchema,
  taskSchema,
  mergePlanner,
  calendar,
  overdue,
  type Planner,
  type PlanTask,
  type SavedStudy,
} from "@/lib/planner";
import "@/app/planner.css";
function download(name: string, text: string, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const display = (v: string) => v.replaceAll("_", " ").toLowerCase();
const blankTask = () => ({ title: "", owner: "", due: "", notes: "" });
export default function StudyPlanner({
  account,
}: {
  account?: { initialPlan: Planner; onChange: (plan: Planner) => void };
}) {
  const [plan, setPlan] = useState<Planner>(emptyPlanner),
    [ready, setReady] = useState(false),
    [blocked, setBlocked] = useState(false),
    [unsaved, setUnsaved] = useState(false),
    [corrupt, setCorrupt] = useState(false),
    [notice, setNotice] = useState("");
  const [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [location, setLocation] = useState(""),
    [results, setResults] = useState<SavedStudy["study"][]>([]),
    [searching, setSearching] = useState(false),
    [searchError, setSearchError] = useState(""),
    [showSearch, setShowSearch] = useState(false);
  const [pageToken, setPageToken] = useState<string | null>(null),
    [submitted, setSubmitted] = useState({ query: "", location: "" }),
    [refreshing, setRefreshing] = useState(false);
  const [task, setTask] = useState(blankTask),
    [editing, setEditing] = useState<string | null>(null),
    [filter, setFilter] = useState("open"),
    [showArchive, setShowArchive] = useState(false);
  const planRef = useRef<Planner>(emptyPlanner()),
    blockedRef = useRef(false);
  blockedRef.current = blocked;
  const backupInput = useRef<HTMLInputElement>(null),
    recovery = useRef<string | null>(null),
    request = useRef<AbortController | null>(null);
  useEffect(() => {
    if (account) {
      setPlan(account.initialPlan);
      planRef.current = account.initialPlan;
      setSelected(
        account.initialPlan.studies.find((s) => !s.archived)?.study.id || "",
      );
      setReady(true);
      return () => request.current?.abort();
    }
    try {
      const raw = localStorage.getItem(PLANNER_KEY);
      if (raw) {
        recovery.current = raw;
        const value = parsePlanner(raw);
        setPlan(value);
        planRef.current = value;
        setSelected(value.studies.find((s) => !s.archived)?.study.id || "");
      }
    } catch {
      setBlocked(true);
      setCorrupt(true);
      setNotice(
        "Saved data could not be read safely. Download a recovery copy before starting again.",
      );
    }
    setReady(true);
    const changed = (e: StorageEvent) => {
      if (e.key === PLANNER_KEY) {
        setBlocked(true);
        setNotice(
          "This workspace changed in another tab. Export any unsaved work, then reload to use the latest version.",
        );
      }
    };
    window.addEventListener("storage", changed);
    return () => {
      window.removeEventListener("storage", changed);
      request.current?.abort();
    };
  }, []);
  const active = plan.studies.find((s) => s.study.id === selected),
    visibleStudies = plan.studies.filter((s) => showArchive || !s.archived),
    allTasks = plan.studies.filter((s) => !s.archived).flatMap((s) => s.tasks);
  const canEdit = ready && !blocked;
  function save(next: Planner, message = "Saved on this browser.") {
    if (!ready || blockedRef.current) return;
    const valid = plannerSchema.safeParse(next);
    if (!valid.success) {
      setNotice(
        "This change exceeds the workspace limits. Export a backup before reducing the workspace.",
      );
      return;
    }
    setPlan(valid.data);
    planRef.current = valid.data;
    if (account) {
      account.onChange(valid.data);
      setNotice("Draft updated. Choose Save to account above.");
      return;
    }
    try {
      localStorage.setItem(PLANNER_KEY, JSON.stringify(valid.data));
      setUnsaved(false);
      setNotice(message);
    } catch {
      setUnsaved(true);
      setNotice(
        "Not saved: browser storage is unavailable or full. Download a backup before leaving this page.",
      );
    }
  }
  function update(
    id: string,
    fn: (s: SavedStudy) => SavedStudy,
    message?: string,
  ) {
    save(
      {
        ...planRef.current,
        studies: planRef.current.studies.map((s) =>
          s.study.id === id ? fn(s) : s,
        ),
      },
      message,
    );
  }
  function pick(id: string) {
    setSelected(id);
    setEditing(null);
    setTask(blankTask());
    setFilter("open");
  }
  async function search(e?: FormEvent, more = false) {
    e?.preventDefault();
    const q = (more ? submitted.query : query).trim();
    if (!q) {
      setSearchError("Enter a condition or an NCT ID.");
      return;
    }
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setSearching(true);
    setSearchError("");
    if (!more) {
      setResults([]);
      setPageToken(null);
    }
    const loc = more ? submitted.location : location.trim();
    try {
      const isId = /^NCT\d{8}$/i.test(q),
        params = new URLSearchParams({ condition: q, location: loc });
      if (more && pageToken) params.set("pageToken", pageToken);
      const response = await fetch(
        isId ? `/api/study/${q.toUpperCase()}` : `/api/studies?${params}`,
        { signal: controller.signal },
      );
      if (!response.ok)
        throw Error(
          "The registry could not complete this request. Please retry.",
        );
      const payload = isId
        ? {
            studies: [plannerStudySchema.parse(await response.json())],
            nextPageToken: null,
          }
        : plannerSearchSchema.parse(await response.json());
      if (controller.signal.aborted) return;
      const rows = payload.studies;
      if (!Array.isArray(rows))
        throw Error("The registry returned an unexpected response.");
      setResults((old) =>
        more
          ? [...old, ...rows.filter((s) => !old.some((o) => o.id === s.id))]
          : rows,
      );
      setPageToken(isId ? null : payload.nextPageToken || null);
      setSubmitted({ query: q, location: loc });
      if (!rows.length)
        setSearchError(
          "No recruiting studies found. Try a broader condition or location.",
        );
    } catch (error) {
      if (!controller.signal.aborted)
        setSearchError(
          error instanceof Error ? error.message : "Search failed.",
        );
    } finally {
      if (!controller.signal.aborted) setSearching(false);
    }
  }
  function addStudy(study: SavedStudy["study"]) {
    if (plan.studies.some((s) => s.study.id === study.id)) {
      pick(study.id);
      setShowSearch(false);
      return;
    }
    const now = new Date().toISOString();
    const entry = savedSchema.safeParse({
      study,
      savedAt: now,
      checkedAt: now,
      notes: "",
      archived: false,
      tasks: [],
    });
    if (!entry.success) {
      setNotice(
        "This registry record could not be saved safely. Open its source record instead.",
      );
      return;
    }
    if (plan.studies.length >= 100) {
      setNotice(
        "This workspace has reached its 100-study limit. Export a backup first.",
      );
      return;
    }
    save(
      { ...plan, studies: [...plan.studies, entry.data] },
      "Study added. Add the first next action below.",
    );
    pick(study.id);
    setShowSearch(false);
  }
  function saveTask(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!active) return;
    const now = new Date().toISOString(),
      old = active.tasks.find((t) => t.id === editing);
    const candidate = taskSchema.safeParse({
      ...task,
      due: String(new FormData(e.currentTarget).get("due") || ""),
      id: editing || crypto.randomUUID(),
      done: old?.done || false,
      createdAt: old?.createdAt || now,
      updatedAt: now,
    });
    if (!candidate.success) {
      setNotice("Check the task title, date and text lengths.");
      return;
    }
    update(
      active.study.id,
      (s) => ({
        ...s,
        tasks: editing
          ? s.tasks.map((t) => (t.id === editing ? candidate.data : t))
          : [...s.tasks, candidate.data],
      }),
      "Task saved.",
    );
    setEditing(null);
    setTask(blankTask());
  }
  async function refresh() {
    if (!active) return;
    const id = active.study.id;
    setRefreshing(true);
    try {
      const r = await fetch(`/api/study/${id}?refresh=1`, {
        cache: "no-store",
      });
      if (!r.ok) throw Error();
      const next = plannerStudySchema.parse(await r.json());
      const previous = active.study;
      const parsed = savedSchema.safeParse({
        ...active,
        study: next,
        checkedAt: new Date().toISOString(),
      });
      if (!parsed.success || parsed.data.study.id !== id) throw Error();
      update(
        id,
        (s) => ({
          ...s,
          study: parsed.data.study,
          checkedAt: parsed.data.checkedAt,
        }),
        previous.status !== next.status
          ? `Registry status changed: ${display(previous.status)} → ${display(next.status)}. Your tasks are preserved.`
          : "Registry checked. Your tasks and notes are preserved.",
      );
    } catch {
      setNotice(
        "Could not refresh the registry. Your saved study and tasks remain available.",
      );
    } finally {
      setRefreshing(false);
    }
  }
  async function restore(file: File) {
    try {
      if (file.size > 8_000_000) throw Error("Backup exceeds 8 MB.");
      const imported = parsePlanner(await file.text());
      const next = mergePlanner(planRef.current, imported);
      const added =
        next.studies.reduce((n, s) => n + s.tasks.length, 0) -
        plan.studies.reduce((n, s) => n + s.tasks.length, 0);
      save(
        next,
        `Backup merged: ${next.studies.length - plan.studies.length} new studies and ${added} new tasks. Existing notes and matching task IDs were kept.`,
      );
      if (!selected) pick(next.studies[0]?.study.id || "");
    } catch {
      setNotice(
        "Backup rejected. Use a valid Trial Coordinator v1 backup under 8 MB. Your existing work was not changed.",
      );
    }
  }
  const tasks = (active?.tasks || [])
    .filter((t) =>
      filter === "all"
        ? true
        : filter === "done"
          ? t.done
          : filter === "overdue"
            ? overdue(t)
            : !t.done,
    )
    .sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
  return (
    <div
      className={`planner ${plan.studies.length ? "planner-has-studies" : ""}`}
    >
      <header className="planner-top">
        <a href="/" className="planner-brand">
          Trial / Coordinator<span>Studies & next actions</span>
        </a>
        <div className="planner-toolbar">
          <button
            disabled={!ready}
            onClick={() =>
              download(
                "trial-coordinator-backup.json",
                JSON.stringify(plan, null, 2),
              )
            }
          >
            Back up workspace ↓
          </button>
          <button
            disabled={!canEdit}
            onClick={() => backupInput.current?.click()}
          >
            Restore backup
          </button>
          {!account && <a href="/account">Account workspace ↗</a>}
          <a href="/demo">Screening example ↗</a>
          <input
            ref={backupInput}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void restore(f);
              e.target.value = "";
            }}
          />
        </div>
      </header>
      <main className="planner-main">
        <section className="planner-heading">
          <div>
            <p className="planner-kicker">Your study desk</p>
            <h1>
              {plan.studies.length ? (
                <>
                  Your study <em>desk.</em>
                </>
              ) : (
                <>
                  Keep the next
                  <br />
                  <em>action clear.</em>
                </>
              )}
            </h1>
          </div>
          <div className="planner-intro">
            <p>
              Save public studies. Track follow-ups, deadlines and decisions in
              one place.
            </p>
            <p className="planner-small">
              {account
                ? "Saved to your account only when you choose Save to account. "
                : "Saved on this browser only. Open Account workspace for cross-device saving. "}
              Use study operations and public information—not patient records.
            </p>
            <button
              className="planner-primary"
              disabled={!canEdit}
              onClick={() => setShowSearch((v) => !v)}
            >
              {showSearch ? "Close study search" : "Find a study + "}
            </button>
          </div>
        </section>
        {!ready && <p role="status">Opening your workspace…</p>}
        {notice && (
          <div
            className={`planner-notice ${unsaved || blocked ? "planner-warning" : ""}`}
            role={unsaved || blocked ? "alert" : "status"}
          >
            {notice}
            {unsaved && !blocked && (
              <button onClick={() => save(plan)}>Retry saving</button>
            )}
            {blocked && (
              <>
                <button
                  onClick={() =>
                    download(
                      "trial-coordinator-recovery.txt",
                      recovery.current || JSON.stringify(plan),
                      "text/plain",
                    )
                  }
                >
                  Download recovery copy
                </button>
                <button onClick={() => window.location.reload()}>
                  Reload workspace
                </button>
                {corrupt && (
                  <button
                    onClick={() => {
                      try {
                        if (recovery.current)
                          localStorage.setItem(
                            PLANNER_KEY + "-recovery-" + Date.now(),
                            recovery.current,
                          );
                        localStorage.setItem(
                          PLANNER_KEY,
                          JSON.stringify(emptyPlanner()),
                        );
                        window.location.reload();
                      } catch {
                        setNotice(
                          "Browser storage is still unavailable. Download the recovery copy before changing browser settings.",
                        );
                      }
                    }}
                  >
                    Preserve recovery & start empty
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {showSearch && (
          <section className="planner-search" aria-label="Find a study">
            <form onSubmit={search}>
              <label>
                Condition or NCT ID
                <input
                  value={query}
                  maxLength={100}
                  required
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="e.g. obesity or NCT05420051"
                />
              </label>
              <label>
                Location (optional)
                <input
                  value={location}
                  maxLength={100}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="City, state or country"
                />
              </label>
              <button className="planner-primary" disabled={searching}>
                {searching ? "Searching…" : "Search registry"}
              </button>
            </form>
            <p className="planner-small">
              Condition searches show studies recruiting overall. Facility
              status can differ. NCT lookup retrieves any public record.
            </p>
            {searchError && <p role="alert">{searchError}</p>}
            <div className="planner-results">
              {results.map((s) => (
                <article key={s.id}>
                  <div>
                    <p className="planner-kicker">
                      {s.id} · {display(s.status)}
                    </p>
                    <h3>{s.title}</h3>
                    <p className="planner-small">
                      {s.locations.length} listed facilities ·{" "}
                      {s.phase || "Phase not listed"}
                    </p>
                  </div>
                  <button disabled={!canEdit} onClick={() => addStudy(s)}>
                    {plan.studies.some((x) => x.study.id === s.id)
                      ? "Open saved study"
                      : "Save study +"}
                  </button>
                  <a
                    href={`https://clinicaltrials.gov/study/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Source ↗
                  </a>
                </article>
              ))}
            </div>
            {pageToken && (
              <button
                disabled={searching}
                onClick={() => void search(undefined, true)}
              >
                Load more studies
              </button>
            )}
          </section>
        )}
        <section className="planner-counts" aria-label="Workspace totals">
          <span>
            <strong>{plan.studies.filter((s) => !s.archived).length}</strong>{" "}
            active studies
          </span>
          <span>
            <strong>{allTasks.filter((t) => !t.done).length}</strong> open tasks
          </span>
          <span>
            <strong>{allTasks.filter((t) => overdue(t)).length}</strong> overdue
          </span>
        </section>
        <div className="planner-grid">
          <aside className="planner-studies">
            <div className="planner-list-heading">
              <h2>Saved studies</h2>
              <label>
                <input
                  type="checkbox"
                  checked={showArchive}
                  onChange={(e) => setShowArchive(e.target.checked)}
                />{" "}
                Include archived
              </label>
            </div>
            {!visibleStudies.length && (
              <p className="planner-small">
                Your workspace starts empty. Find a study above to begin.
              </p>
            )}
            {visibleStudies.map((s) => (
              <button
                className={`planner-study ${selected === s.study.id ? "selected" : ""}`}
                aria-pressed={selected === s.study.id}
                key={s.study.id}
                onClick={() => pick(s.study.id)}
              >
                <span>
                  {s.study.id}
                  {s.archived ? " · archived" : ""}
                </span>
                <strong>{s.study.title}</strong>
                <small>
                  {s.tasks.filter((t) => !t.done).length} open ·{" "}
                  {s.tasks.filter((t) => overdue(t)).length} overdue
                </small>
              </button>
            ))}
          </aside>
          {active ? (
            <section className="planner-work" aria-label="Study workspace">
              <div className="planner-study-title">
                <p className="planner-kicker">
                  {active.study.id} · {display(active.study.status)}
                </p>
                <h2>{active.study.title}</h2>
                <div className="planner-inline">
                  <a
                    href={`https://clinicaltrials.gov/study/${active.study.id}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open registry ↗
                  </a>
                  <button disabled={!canEdit || refreshing} onClick={refresh}>
                    {refreshing ? "Checking…" : "Refresh public record"}
                  </button>
                  <button
                    disabled={!canEdit}
                    onClick={() =>
                      update(
                        active.study.id,
                        (s) => ({ ...s, archived: !s.archived }),
                        active.archived
                          ? "Study restored."
                          : "Study archived; its tasks and notes are retained.",
                      )
                    }
                  >
                    {active.archived ? "Restore study" : "Archive study"}
                  </button>
                </div>
                <p className="planner-small">
                  Registry posted {active.study.updated || "date unavailable"} ·
                  Last checked {new Date(active.checkedAt).toLocaleDateString()}
                  . Public status is not site approval.
                </p>
              </div>
              <section className="planner-task-section">
                <div className="planner-task-heading">
                  <h3>Next actions</h3>
                  <button
                    disabled={!active.tasks.some((t) => !t.done && t.due)}
                    onClick={() =>
                      download(
                        `${active.study.id}-tasks.ics`,
                        calendar([active]),
                        "text/calendar",
                      )
                    }
                  >
                    Export dated tasks to calendar ↓
                  </button>
                </div>
                <div className="planner-filters" aria-label="Task filters">
                  {["open", "overdue", "done", "all"].map((f) => (
                    <button
                      key={f}
                      aria-pressed={filter === f}
                      onClick={() => setFilter(f)}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                {!tasks.length && (
                  <p className="planner-small">
                    {filter === "open"
                      ? "No open tasks. Add the next action below."
                      : `No ${filter} tasks.`}
                  </p>
                )}
                <ul className="planner-tasks">
                  {tasks.map((t) => (
                    <li key={t.id}>
                      <label className="planner-check">
                        <input
                          type="checkbox"
                          checked={t.done}
                          disabled={!canEdit}
                          onChange={(e) =>
                            update(active.study.id, (s) => ({
                              ...s,
                              tasks: s.tasks.map((x) =>
                                x.id === t.id
                                  ? {
                                      ...x,
                                      done: e.target.checked,
                                      updatedAt: new Date().toISOString(),
                                    }
                                  : x,
                              ),
                            }))
                          }
                        />
                        <span className={t.done ? "completed" : ""}>
                          {t.title}
                        </span>
                      </label>
                      <p className={overdue(t) ? "planner-overdue" : ""}>
                        {t.due
                          ? `${overdue(t) ? "Overdue · " : ""}${t.due}`
                          : "No due date"}{" "}
                        · {t.owner || "Unassigned"}
                      </p>
                      {t.notes && (
                        <p className="planner-task-note">{t.notes}</p>
                      )}
                      <button
                        disabled={!canEdit}
                        onClick={() => {
                          setEditing(t.id);
                          setTask({
                            title: t.title,
                            owner: t.owner,
                            due: t.due,
                            notes: t.notes,
                          });
                          document.getElementById("task-title")?.focus();
                        }}
                      >
                        Edit task
                      </button>
                    </li>
                  ))}
                </ul>
                <form className="planner-task-form" onSubmit={saveTask}>
                  <h4>{editing ? "Edit next action" : "Add a next action"}</h4>
                  <label>
                    Task
                    <input
                      id="task-title"
                      required
                      maxLength={180}
                      value={task.title}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setTask({ ...task, title: e.target.value })
                      }
                      placeholder="e.g. Confirm site recruitment status"
                    />
                  </label>
                  <div className="planner-form-row">
                    <label>
                      Due date
                      <input
                        type="date"
                        name="due"
                        onInput={(e) =>
                          setTask({ ...task, due: e.currentTarget.value })
                        }
                        value={task.due}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setTask({ ...task, due: e.target.value })
                        }
                      />
                    </label>
                    <label>
                      Owner or role
                      <input
                        maxLength={100}
                        value={task.owner}
                        disabled={!canEdit}
                        onChange={(e) =>
                          setTask({ ...task, owner: e.target.value })
                        }
                        placeholder="e.g. Study coordinator"
                      />
                    </label>
                  </div>
                  <label>
                    Task notes
                    <textarea
                      maxLength={4000}
                      value={task.notes}
                      disabled={!canEdit}
                      onChange={(e) =>
                        setTask({ ...task, notes: e.target.value })
                      }
                      placeholder="Question to resolve or context for the next step"
                    />
                  </label>
                  <div className="planner-inline">
                    <button className="planner-primary" disabled={!canEdit}>
                      {editing ? "Save changes" : "Add task"}
                    </button>
                    {editing && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(null);
                          setTask(blankTask());
                        }}
                      >
                        Cancel edit
                      </button>
                    )}
                  </div>
                </form>
              </section>
              <section className="planner-notes">
                <h3>Study notes</h3>
                <label>
                  Decisions and operational context
                  <textarea
                    key={active.study.id + active.notes}
                    defaultValue={active.notes}
                    maxLength={6000}
                    disabled={!canEdit}
                    onBlur={(e) => {
                      if (e.target.value !== active.notes)
                        update(
                          active.study.id,
                          (s) => ({ ...s, notes: e.target.value }),
                          "Study notes saved.",
                        );
                    }}
                    placeholder="Study-level notes only. No patient or participant information."
                  />
                </label>
                <p className="planner-small">
                  {account
                    ? "Notes enter your draft when you leave this field. Then choose Save to account."
                    : "Notes save when you leave this field."}
                </p>
              </section>
              <details className="planner-facilities">
                <summary>
                  Public facilities & contacts ({active.study.locations.length})
                </summary>
                {active.study.centralContact && (
                  <p>
                    Central contact: {active.study.centralContact.name} ·{" "}
                    {active.study.centralContact.email} ·{" "}
                    {active.study.centralContact.phone}
                  </p>
                )}
                {active.study.locations.map((l, i) => (
                  <article key={i}>
                    <h4>{l.facility}</h4>
                    <p>
                      {l.place} ·{" "}
                      {display(l.status) || "Facility status not reported"}
                    </p>
                    {l.contact && (
                      <p>
                        {l.contact.name} · {l.contact.email} · {l.contact.phone}
                      </p>
                    )}
                  </article>
                ))}
              </details>
            </section>
          ) : (
            <section className="planner-empty">
              <p className="planner-kicker">Start with a real study</p>
              <h2>
                One study.
                <br />A clear next step.
              </h2>
              <p>
                Search the public registry, save a study, and add something you
                need to do.{" "}
                {account
                  ? "Choose Save to account to keep changes across devices."
                  : "Your tasks and notes stay here when you return to this browser."}
              </p>
              <button
                className="planner-primary"
                disabled={!canEdit}
                onClick={() => setShowSearch(true)}
              >
                Find your first study ↗
              </button>
              <p className="planner-small">
                Want to inspect the screening interface?{" "}
                <a href="/demo">Open the clearly labeled sample walkthrough.</a>
              </p>
            </section>
          )}
        </div>
      </main>
      <footer className="planner-footer">
        <span>
          {unsaved
            ? "Unsaved changes"
            : blocked
              ? "Workspace requires attention"
              : account
                ? "Account draft · Save using the control above"
                : "Personal workspace · Stored on this browser"}
        </span>
        <span>
          Calendar export creates a file; it does not send invitations or set up
          syncing.
        </span>
      </footer>
    </div>
  );
}
