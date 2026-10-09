"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronDown,
  CircleHelp,
  ClipboardList,
  Download,
  FileText,
  LayoutGrid,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";
import { restoreCases, restoreWorkspace } from "@/lib/persistence";
import { parseCriteria } from "@/lib/criteria";
import type { Study } from "@/lib/study";
import {
  isStudySnapshot,
  diffStudySnapshots,
  snapshotStudy,
  type SourceChange,
} from "@/lib/snapshot";
import {
  archiveAndBeginReview,
  captureFacility,
  restoreFacility,
  facilityLabel,
  answerLabels,
  emptyFollowUpTask,
  ownerLabels,
  questionLabels,
  reviewSourceState,
  updateMark,
  type ArchivedReview,
  type DemoCase,
  type Evidence,
  type FollowUpAnswer,
  type FollowUpOwner,
  type FollowUpQuestion,
  type FollowUpTask,
  type Mark,
  type ReviewStatus,
} from "@/lib/workspace";

type View = "worklist" | "protocol" | "review" | "handoff" | "library";
type Status = ReviewStatus;

const defaultCases: DemoCase[] = [
  {
    id: "DEMO–021",
    age: 52,
    sex: "FEMALE",
    marks: {},
    nextAction: "Complete preliminary review",
    savedAt: null,
    sourcePostedAt: null,
    snapshot: null,
    archived: [],
  },
  {
    id: "DEMO–034",
    age: 67,
    sex: "MALE",
    marks: {},
    nextAction: "Confirm open questions",
    savedAt: null,
    sourcePostedAt: null,
    snapshot: null,
    archived: [],
  },
  {
    id: "DEMO–047",
    age: 39,
    sex: "FEMALE",
    marks: {},
    nextAction: "Prepare handoff",
    savedAt: null,
    sourcePostedAt: null,
    snapshot: null,
    archived: [],
  },
];
const statusLabels: Record<Status, string> = {
  unreviewed: "Not reviewed",
  appears_met: "Appears met",
  possible_mismatch: "Possible mismatch",
  follow_up: "Needs follow-up",
};
function observationLabel(status: Status, group: string) {
  if (group === "Exclusion") {
    if (status === "appears_met") return "No exclusion observed";
    if (status === "possible_mismatch") return "Possible exclusion";
  }
  return statusLabels[status];
}
const evidenceLabels: Record<Evidence, string> = {
  none: "Evidence not recorded",
  referral: "Synthetic referral",
  candidate: "Synthetic candidate report",
  record: "Synthetic clinical record",
};
const actions = [
  "Complete preliminary review",
  "Confirm open questions",
  "Request missing information",
  "Confirm with study team",
  "Discuss with investigator",
  "Prepare handoff",
];

function displayStatus(value: string) {
  return value
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/^./, (letter) => letter.toUpperCase());
}
function ageYears(value: string): number | null {
  const match = value.match(/^(\d+)\s+(year|month|week|day)s?$/i);
  if (!match) return null;
  return (
    Number(match[1]) /
    { year: 1, month: 12, week: 52.18, day: 365.25 }[
      match[2].toLowerCase() as "year" | "month" | "week" | "day"
    ]
  );
}
function preliminaryAge(study: Study, demo: DemoCase) {
  const min = ageYears(study.minAge);
  const max = ageYears(study.maxAge);
  if ((min !== null && demo.age < min) || (max !== null && demo.age > max))
    return "Outside stated range";
  if (min === null && max === null) return "No structured range";
  return "Within stated range";
}
function preliminarySex(study: Study, demo: DemoCase) {
  if (study.sex !== "ALL" && study.sex !== "FEMALE" && study.sex !== "MALE")
    return "No structured field";
  return study.sex !== "ALL" && study.sex !== demo.sex
    ? "Outside stated criterion"
    : "No structured mismatch";
}
function download(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/plain" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function SourceChangePanel({
  changes,
  legacy,
  onRestart,
}: {
  changes: SourceChange[];
  legacy: boolean;
  onRestart: () => void;
}) {
  return (
    <section
      className="source-change-panel"
      aria-label="Source changes requiring review"
    >
      <div className="source-change-heading">
        <div>
          <span className="eyebrow">REVIEW PAUSED</span>
          <h2>Review context needs attention.</h2>
        </div>
        <span>
          {legacy
            ? "OLDER REVIEW"
            : `${changes.length} CHANGE${changes.length === 1 ? "" : "S"}`}
        </span>
      </div>
      <p>
        {legacy
          ? "This saved demo review predates source snapshots, so its criteria cannot be safely mapped to the current record."
          : "The prior observations remain attached to the record version used when they were made. Examine the changes before beginning a new review."}
      </p>
      {changes.length > 0 && (
        <div className="source-change-list">
          {changes.map((change) => (
            <details key={change.key}>
              <summary>
                <span
                  className={
                    change.priority === "review" ? "change-priority" : ""
                  }
                >
                  {change.priority === "review" ? "CHECK" : "INFO"}
                </span>
                <strong>{change.label}</strong>
                <ChevronDown size={16} />
              </summary>
              <div className="change-comparison">
                <div>
                  <span>AT REVIEW</span>
                  <p>{change.before}</p>
                </div>
                <div>
                  <span>CURRENT CONTEXT</span>
                  <p>{change.after}</p>
                </div>
              </div>
            </details>
          ))}
        </div>
      )}
      <button className="primary-button" onClick={onRestart}>
        Archive prior review and begin again <ArrowRight size={16} />
      </button>
      <small>The earlier synthetic review remains saved in this browser.</small>
    </section>
  );
}
function ArchiveHistory({ archives }: { archives: ArchivedReview[] }) {
  if (!archives.length) return null;
  return (
    <details className="archive-history">
      <summary>
        Earlier synthetic review versions ({archives.length}){" "}
        <ChevronDown size={16} />
      </summary>
      <div>
        {archives.map((archive, index) => {
          const items = parseCriteria(archive.snapshot?.criteria || "");
          const marked = Object.entries(archive.marks).filter(
            ([, mark]) => mark.status !== "unreviewed",
          );
          return (
            <section key={index}>
              <span className="eyebrow">
                VERSION {String(index + 1).padStart(2, "0")}
              </span>
              <h3>
                {archive.snapshot?.updated
                  ? `Registry posted ${archive.snapshot.updated}`
                  : "Source snapshot unavailable"}
              </h3>
              <p>
                {marked.length} preliminary observations · last saved{" "}
                {archive.savedAt
                  ? new Date(archive.savedAt).toLocaleString()
                  : "date unavailable"}
              </p>
              <p>Facility: {facilityLabel(restoreFacility(archive.selectedFacility))}</p>
              <ul>
                {marked.map(([key, mark]) => {
                  const item = items[Number(key)];
                  return (
                    <li key={key}>
                      <strong>
                        {item
                          ? `${item.group} ${Number(key) + 1}`
                          : `Criterion ${Number(key) + 1}`}
                      </strong>
                      <span>
                        {item?.text ||
                          "Original criterion text was not captured in this older version."}
                      </span>
                      <small>
                        {observationLabel(mark.status, item?.group || "Other")}{" "}
                        · {evidenceLabels[mark.evidence]}
                      </small>
                      {mark.followUp && <small>
                        {questionLabels[mark.followUp.question]} · {ownerLabels[mark.followUp.owner]} · {answerLabels[mark.followUp.answer]}
                      </small>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </details>
  );
}
function FollowUpEditor({
  task,
  criterionNumber,
  needsFollowUp,
  onChange,
}: {
  task: FollowUpTask;
  criterionNumber: number;
  needsFollowUp: boolean;
  onChange: (change: Partial<FollowUpTask>) => void;
}) {
  return (
    <div className="follow-up-editor">
      <div className="follow-up-heading">
        <span className="eyebrow">QUESTION / {String(criterionNumber).padStart(2, "0")}</span>
        <span>{needsFollowUp ? "OPEN" : "OBSERVATION UPDATED"}</span>
      </div>
      <div className="follow-up-fields">
        <label>
          WHAT NEEDS CONFIRMATION
          <select value={task.question} onChange={(event) => onChange({question: event.target.value as FollowUpQuestion})}>
            {Object.entries(questionLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          OWNER
          <select value={task.owner} onChange={(event) => onChange({owner: event.target.value as FollowUpOwner})}>
            {Object.entries(ownerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label>
          DUE DATE
          <input type="date" value={task.dueDate} onChange={(event) => onChange({dueDate: event.target.value})} />
        </label>
        <label>
          ANSWER
          <select value={task.answer} onChange={(event) => onChange({answer: event.target.value as FollowUpAnswer})}>
            {Object.entries(answerLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
      </div>
      {needsFollowUp && task.answer !== "pending" && task.answer !== "unclear" && <p>Answer recorded. Review the preliminary observation above; it will not change automatically.</p>}
      <small>Structured demo fields only. Do not enter patient information.</small>
    </div>
  );
}

export default function Home() {
  const [view, setView] = useState<View>("worklist");
  const [reviewTarget, setReviewTarget] = useState<number | null>(null);
  useEffect(() => {
    if (view !== "review" || reviewTarget === null) return;
    const target = document.getElementById(`criterion-${reviewTarget}`);
    if (target) {
      target.focus({ preventScroll: true });
      target.scrollIntoView({ block: "center" });
      setReviewTarget(null);
    }
  }, [view, reviewTarget]);
  function openCriterion(index: number) {
    setReviewTarget(index);
    setView("review");
  }
  const [studyId, setStudyId] = useState("NCT05420051");
  const [study, setStudy] = useState<Study | null>(null);
  const [sourceError, setSourceError] = useState("");
  const [sourceRetry, setSourceRetry] = useState(0);
  const [loading, setLoading] = useState(true);
  const [siteIndex, setSiteIndex] = useState(0);
  const [cases, setCases] = useState<DemoCase[]>(defaultCases);
  const [caseId, setCaseId] = useState(defaultCases[0].id);
  const [hydrated, setHydrated] = useState(false);
  const [storageNotice, setStorageNotice] = useState("");
  const [storageBlocked, setStorageBlocked] = useState(false);
  const recoveryData = useRef<string | null>(null);
  const [searchCondition, setSearchCondition] = useState("type 2 diabetes");
  const [searchLocation, setSearchLocation] = useState("United States");
  const [searchResults, setSearchResults] = useState<Study[]>([]);
  const [searchOmitted, setSearchOmitted] = useState(0);
  const [searchPageToken, setSearchPageToken] = useState<string | null>(null);
  const [submittedSearch, setSubmittedSearch] = useState<{condition: string; location: string} | null>(null);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [sourceOpen, setSourceOpen] = useState(false);
  const [packetBusy, setPacketBusy] = useState(false);
  const [packetNotice, setPacketNotice] = useState("");
  const [sourceCheckedAt, setSourceCheckedAt] = useState<string | null>(null);

  useEffect(() => {
    let raw: string | null = null;
    try {
      raw = localStorage.getItem("trial-coordinator-demo-v3");
      if (raw) {
        const saved = restoreWorkspace(raw, defaultCases);
        setStudyId(saved.studyId);
        setSiteIndex(saved.siteIndex);
        setCases(saved.cases);
      }
    } catch {
      recoveryData.current = raw;
      setStorageBlocked(true);
      setStorageNotice("Saved workspace could not be restored. Saving is paused so the original data stays intact. You can download it for recovery; the cases shown here are fresh examples.");
    }
    setHydrated(true);
  }, []);
  useEffect(() => {
    if (!hydrated || storageBlocked) return;
    try {
      localStorage.setItem("trial-coordinator-demo-v3", JSON.stringify({ studyId, siteIndex, cases }));
      localStorage.setItem(`trial-coordinator-cases-${studyId}`, JSON.stringify(cases));
    } catch {
      setStorageBlocked(true);
      setStorageNotice("Browser storage is unavailable or full. Current changes are only in memory. Download this workspace before closing the page.");
    }
  }, [hydrated, studyId, siteIndex, cases, storageBlocked]);
  useEffect(() => {
    if (!hydrated) return;
    const controller = new AbortController();
    setLoading(true);
    setStudy(null);
    setSourceError("");
    fetch(`/api/study/${studyId}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw Error(response.status === 503
            ? "The public registry is temporarily unavailable. Try again shortly."
            : "The public study record could not be loaded.");
        return response.json() as Promise<Study>;
      })
      .then((result) => {
        setStudy(result);
        setSourceCheckedAt(new Date().toISOString());
        setSiteIndex((index) =>
          Math.min(index, Math.max(0, result.locations.length - 1)),
        );
      })
      .catch((error) => {
        if (!controller.signal.aborted) setSourceError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [studyId, hydrated, sourceRetry]);

  const demo = cases.find((item) => item.id === caseId) || cases[0];
  const packetContext = JSON.stringify({ studyId, siteIndex, demo });
  const latestPacketContext = useRef(packetContext);
  useEffect(() => { latestPacketContext.current = packetContext; }, [packetContext]);
  useEffect(() => { setPacketNotice(""); }, [studyId, caseId, siteIndex]);
  const liveSnapshot = useMemo(
    () => (study ? snapshotStudy(study) : null),
    [study],
  );
  const site = study?.locations[siteIndex];
  const sourceState = useMemo(
    () => reviewSourceState(demo, liveSnapshot, site || null),
    [demo, liveSnapshot, site],
  );
  const sourceChanges = sourceState.changes;
  const legacyReview = sourceState.legacy;
  const sourceChanged = sourceState.requiresRestart;
  const currentCriteriaCount = useMemo(
    () => parseCriteria(study?.criteria || "").length,
    [study?.criteria],
  );
  const criteria = useMemo(
    () =>
      parseCriteria(
        sourceChanged && demo.snapshot
          ? demo.snapshot.criteria
          : study?.criteria || "",
      ),
    [sourceChanged, demo.snapshot, study?.criteria],
  );
  const reviewed = criteria.filter(
    (_, index) =>
      demo.marks[index]?.status && demo.marks[index].status !== "unreviewed",
  ).length;
  const unreviewed = criteria
    .map((item, index) => ({ ...item, index }))
    .filter(({ index }) => !demo.marks[index] || demo.marks[index].status === "unreviewed");
  const followUps = criteria
    .map((item, index) => ({ ...item, index }))
    .filter(({ index }) => demo.marks[index]?.status === "follow_up");
  const mismatches = criteria
    .map((item, index) => ({ ...item, index }))
    .filter(({ index }) => demo.marks[index]?.status === "possible_mismatch");
  const missingEvidence = criteria
    .map((item, index) => ({ ...item, index }))
    .filter(({ index }) => {
      const mark = demo.marks[index];
      return (
        mark &&
        (mark.status === "appears_met" ||
          mark.status === "possible_mismatch") &&
        mark.evidence === "none"
      );
    });
  const priorQuestions = criteria
    .map((item, index) => ({ ...item, index }))
    .filter(({ index }) =>
      demo.marks[index]?.followUp &&
      demo.marks[index]?.status !== "follow_up" &&
      demo.marks[index]?.status !== "unreviewed"
    );
  function changeCase(updater: (current: DemoCase) => DemoCase) {
    setCases((current) =>
      current.map((item) => (item.id === caseId ? updater(item) : item)),
    );
  }
  function markCriterion(index: number, partial: Partial<Mark>) {
    if (sourceChanged || !liveSnapshot) return;
    changeCase((item) => ({
      ...item,
      marks: {
        ...item.marks,
        [index]: updateMark(item.marks[index], partial, new Date().toISOString()),
      },
      savedAt: new Date().toISOString(),
      sourcePostedAt: item.sourcePostedAt || study?.updated || null,
      snapshot: item.snapshot || liveSnapshot,
      selectedFacility: item.selectedFacility === undefined ? captureFacility(site) : item.selectedFacility,
    }));
  }
  function startUpdatedReview() {
    if (!liveSnapshot) return;
    changeCase((item) => archiveAndBeginReview(item, liveSnapshot, captureFacility(site)));
  }
  async function searchLibrary(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (searching) return;
    const append = !event && !!submittedSearch && !!searchPageToken;
    const query = append ? submittedSearch! : { condition: searchCondition.trim(), location: searchLocation.trim() };
    setSearching(true);
    setSearchError("");
    if (!append) {
      setSearchResults([]);
      setSearchOmitted(0);
      setSearchPageToken(null);
      setSubmittedSearch(query);
    }
    try {
      const params = new URLSearchParams(query);
      if (append) params.set("pageToken", searchPageToken!);
      const response = await fetch(`/api/studies?${params}`);
      if (!response.ok) throw Error(response.status === 503
        ? "The public registry is temporarily unavailable. Try again shortly."
        : "Search is unavailable right now.");
      const result = (await response.json()) as { studies: Study[]; omitted: number; nextPageToken: string | null };
      setSearchResults(current => {
        const combined = append ? [...current, ...result.studies] : result.studies;
        return [...new Map(combined.map(study => [study.id, study])).values()];
      });
      setSearchOmitted(current => (append ? current : 0) + (result.omitted || 0));
      setSearchPageToken(result.nextPageToken || null);
    } catch (error) {
      setSearchError(error instanceof Error ? error.message : "Search failed.");
    } finally {
      setSearching(false);
    }
  }
  function assignStudy(next: Study) {
    if (next.id === studyId) {
      setView("protocol");
      return;
    }
    if (storageBlocked) {
      setStorageNotice("Study switching is paused while browser storage is unavailable. Download your workspace before leaving this study.");
      return;
    }
    let nextCases = defaultCases;
    try {
      localStorage.setItem(`trial-coordinator-cases-${studyId}`, JSON.stringify(cases));
      const raw = localStorage.getItem(`trial-coordinator-cases-${next.id}`);
      if (raw) nextCases = restoreCases(JSON.parse(raw), defaultCases, next.id);
    } catch {
      setStorageNotice("This study could not be opened safely. Its saved data has been left intact, and your current study remains open.");
      return;
    }
    setStudyId(next.id);
    setStudy(next);
    setSiteIndex(0);
    setCases(nextCases);
    setCaseId(defaultCases[0].id);
    setView("protocol");
  }
  async function packet() {
    if (!study || sourceChanged || packetBusy) return;
    setPacketBusy(true);
    setPacketNotice("");
    const contextAtRequest = packetContext;
    try {
      const response = await fetch(`/api/study/${study.id}?refresh=1`, {
        cache: "no-store", signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) throw Error("The public record could not be rechecked. Your review is saved; try the download again shortly.");
      const fresh = await response.json() as Study;
      if (!isStudySnapshot(fresh) || fresh.id !== study.id) throw Error("The registry returned an invalid record. The packet was not downloaded.");
      if (latestPacketContext.current !== contextAtRequest) {
        setPacketNotice("The case changed during the source check. Download again to use the current review.");
        return;
      }
      const checkedAt = new Date().toISOString();
      setSourceCheckedAt(checkedAt);
      setStudy(fresh);
      if (diffStudySnapshots(snapshotStudy(study), snapshotStudy(fresh)).length) {
        setPacketNotice("The public record changed. Review the updated context before downloading.");
        return;
      }
    const lines = [
      "TRIAL / COORDINATOR — PRELIMINARY HANDOFF",
      "",
      `Synthetic case: ${demo.id}`,
      `Study: ${study.title} (${study.id})`,
      `Review facility: ${facilityLabel(demo.snapshot ? demo.selectedFacility : captureFacility(site))}`,
      `Public facility status: ${site ? displayStatus(site.status) : "Unknown"}`,
      `Public record last posted: ${fresh.updated || "not available"}`,
      `Public source rechecked: ${checkedAt}`,
      `Public record at review: ${demo.sourcePostedAt || "not recorded"}`,
      `Packet prepared: ${new Date().toISOString()}`,
      `Synthetic profile: age ${demo.age}, sex ${demo.sex.toLowerCase()}`,
      `Next action: ${demo.nextAction}`,
      "",
      "This is a preliminary synthetic exercise, not an eligibility decision.",
      "Public registry data may differ from the site-approved protocol. Confirm with the study team.",
      "",
      `REVIEW VERSION ${demo.archived.length + 1}`,
      `Review coverage: ${reviewed} of ${criteria.length} criteria reviewed`,
      "OUTSTANDING WORK",
      ...(criteria.length ? [
        `Not reviewed: ${unreviewed.length}${unreviewed.length ? ` (criteria ${unreviewed.map(item => item.index + 1).join(", ")})` : ""}`,
        `Observations needing follow-up: ${followUps.length}`,
        `Possible mismatches: ${mismatches.length}`,
        `Observations without evidence: ${missingEvidence.length}${missingEvidence.length ? ` (criteria ${missingEvidence.map(item => item.index + 1).join(", ")})` : ""}`,
      ] : ["No criteria available. Review coverage cannot be assessed."]),
      "Counts may overlap. These observations do not establish eligibility.",
      "",
      "ALL CRITERIA AND OBSERVATIONS",
      ...criteria.map((item, index) => {
        const mark: Mark = demo.marks[index] || {
          status: "unreviewed",
          evidence: "none",
        };
        const task = mark.followUp;
        return `${index + 1}. [${item.group}] ${item.text}\n   Observation: ${observationLabel(mark.status, item.group)}\n   Evidence: ${evidenceLabels[mark.evidence]}\n   Reviewed: ${mark.reviewedAt || "timestamp unavailable"}${task ? `\n   Follow-up: ${questionLabels[task.question]}\n   Owner: ${ownerLabels[task.owner]}\n   Due: ${task.dueDate || "not set"}\n   Answer: ${answerLabels[task.answer]}` : ""}`;
      }),
      "",
      `Unresolved follow-ups: ${followUps.length}`,
      `Possible mismatches: ${mismatches.length}`,
      `Reviewed without evidence: ${missingEvidence.length}`,
      "",
      `Source: https://clinicaltrials.gov/study/${study.id}`,
    ];
    download(`${study.id}-${demo.id}-handoff.txt`, lines.join("\n"));
    setPacketNotice("Source rechecked. Packet downloaded.");
    } catch (error) {
      setPacketNotice(error instanceof Error && error.name !== "TimeoutError" ? error.message : "The source check timed out. Your review is saved; try again shortly.");
    } finally {
      setPacketBusy(false);
    }
  }

  const nav: { id: View; label: string; icon: React.ReactNode }[] = [
    { id: "worklist", label: "Worklist", icon: <LayoutGrid size={17} /> },
    { id: "review", label: "Case workspace", icon: <ClipboardList size={17} /> },
  ];
  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-symbol">
            t<span>·</span>
          </div>
          <div>
            <strong>TRIAL / COORDINATOR</strong>
            <small>RESEARCH WORKSPACE</small>
          </div>
        </div>
        <a href="/" className="text-action">← My studies & tasks</a><div className="sidebar-group-label">SCREENING EXAMPLE</div>
        <nav className="primary-nav" aria-label="Workspace">
          {nav.map((item) => (
            <button
              key={item.id}
              className={(view === item.id || (item.id === "review" && view === "handoff")) ? "active" : ""}
              aria-current={(view === item.id || (item.id === "review" && view === "handoff")) ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
              {(view === item.id || (item.id === "review" && view === "handoff")) && <span className="nav-current" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-rule" />
        <div className="sidebar-group-label">ASSIGNED PROTOCOL</div>
        <button className="protocol-mini" onClick={() => setView("protocol")}>
          <span className="protocol-mini-icon">01</span>
          <span>
            <strong>{study?.title || "Loading public record"}</strong>
            <small>{studyId}</small>
          </span>
        </button>
        <div className="sidebar-spacer" />
        <div className="demo-tag">
          <ShieldCheck size={16} />
          <span>
            Synthetic workspace
            <br />
            <strong>No patient information</strong>
          </span>
        </div>
        <p className="sidebar-foot">
          Built for careful preliminary review. Formal eligibility belongs to
          the study team.
        </p>
      </aside>

      <div className="main-column">
        <header className="topbar">
          <div className="crumb">
            WORKSPACE <span>/</span> {view.replaceAll("_", " ").toUpperCase()}
          </div>
          <div className="topbar-right">
            <span className="live-indicator" /> PUBLIC REGISTRY{" "}
            <span className="topbar-date">
              {study?.updated ? `POSTED ${study.updated}` : "SOURCE PENDING"}
            </span>
          </div>
        </header>
        <div
          className="mobile-nav"
          role="navigation"
          aria-label="Workspace mobile navigation"
        >
          {nav.map((item) => (
            <button
              key={item.id}
              className={(view === item.id || (item.id === "review" && view === "handoff")) ? "active" : ""}
              aria-current={(view === item.id || (item.id === "review" && view === "handoff")) ? "page" : undefined}
              onClick={() => setView(item.id)}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
        <div className="content">
          {storageNotice && <div className="notice error" role="alert">
            <p>{storageNotice}</p>
            <button className="text-action" onClick={() => download("trial-workspace-recovery.json", recoveryData.current ?? JSON.stringify({studyId,siteIndex,cases}, null, 2))}>Download saved workspace <Download size={15}/></button>
            {storageBlocked && <button className="text-action" onClick={() => {
              try {
                if (recoveryData.current) localStorage.setItem(`trial-coordinator-recovery-${Date.now()}`, recoveryData.current);
                localStorage.setItem("trial-coordinator-demo-v3", JSON.stringify({studyId,siteIndex,cases}));
                localStorage.setItem(`trial-coordinator-cases-${studyId}`, JSON.stringify(cases));
                const recovered = !!recoveryData.current;
                recoveryData.current = null;
                setStorageBlocked(false);
                setStorageNotice(recovered ? "Saving resumed for the displayed cases. The original data is retained in a separate browser recovery copy." : "Browser saving resumed.");
              } catch {
                setStorageNotice("Browser storage is still unavailable. Download your workspace before closing this page.");
              }
            }}>Save the displayed cases</button>}
          </div>}
          {sourceError && (
            <div className="notice error" role="alert">
              {sourceError}{" "}
              <button onClick={() => setSourceRetry((count) => count + 1)}>
                Retry source
              </button>
            </div>
          )}
          {loading && (
            <div className="notice" role="status">
              Retrieving the public study record…
            </div>
          )}
          {(view === "review" || view === "handoff") && !study && (
            <div className="empty-state" role="status">
              The public study record must load before a synthetic review or
              handoff can be shown.
            </div>
          )}
          {view === "worklist" && (
            <>
              <div className="page-eyebrow">
                WORKLIST <span>SYNTHETIC CASES</span>
              </div>
              <div className="worklist-heading">
                <h1>Case queue</h1>
                <p><strong>{String(cases.length).padStart(2, "0")}</strong> synthetic cases assigned to this public study record.</p>
              </div>
              <div className="worklist-protocol">
                <div className="worklist-protocol-index" aria-hidden="true">01</div>
                <div className="worklist-protocol-copy">
                  <span className="eyebrow">ASSIGNED STUDY · {studyId}</span>
                  <h2>{study?.title || "Loading public study record…"}</h2>
                  <p>{study?.phase || "Phase not listed"} <span>·</span> Public registry record</p>
                </div>
                <button onClick={() => setView("protocol")}>
                  Review study <ArrowUpRight size={17} />
                </button>
              </div>
              <section className="section-block worklist-queue">
                <div className="section-head">
                  <div>
                    <span className="eyebrow">PRELIMINARY REVIEW</span>
                    <h2>Assigned cases</h2>
                  </div>
                  <span>SELECT A CASE TO REVIEW</span>
                </div>
                <div className="case-list">
                  {cases.map((item, index) => {
                    const count = Object.values(item.marks).filter(
                      (mark) => mark.status !== "unreviewed",
                    ).length;
                    const stale = reviewSourceState(
                      item,
                      liveSnapshot,
                    ).requiresRestart;
                    return (
                      <button
                        key={item.id}
                        className="case-row"
                        onClick={() => {
                          setCaseId(item.id);
                          setView("review");
                        }}
                      >
                        <span className="case-number">0{index + 1}</span>
                        <span className="case-name">
                          <strong>{item.id}</strong>
                          <small>
                            Age {item.age} · {item.sex.toLowerCase()} ·
                            synthetic
                          </small>
                        </span>
                        <span
                          className={`case-progress ${stale ? "stale" : ""}`}
                        >
                          {stale
                            ? "Source changed"
                            : count
                              ? `${count} reviewed`
                              : "Not started"}
                        </span>
                        <span className="case-next">{item.nextAction}</span>
                        <ArrowRight size={19} />
                      </button>
                    );
                  })}
                </div>
              </section>
              <p className="workspace-caveat">
                <CircleHelp size={16} /> The public registry supports this demo.
                It does not replace the site-approved protocol or a study team's
                eligibility decision.
              </p>
            </>
          )}

          {view === "protocol" && (
            <>
              <div className="page-eyebrow">
                STUDY DETAILS <span>PUBLIC RECORD</span>
              </div>
              <div className="page-heading compact">
                <div>
                  <h1>Protocol context.</h1>
                  <p>
                    Inspect the public source and selected facility. These details are also available inside each case.
                  </p>
                </div>
                <button
                  className="text-action"
                  onClick={() => setView("library")}
                >
                  <Search size={17} /> Explore public studies
                </button>
              </div>
              <div className="protocol-hero">
                <div>
                  <span className="eyebrow">
                    CURRENT DEMO PROTOCOL · {studyId}
                  </span>
                  <h2>{study?.title || "Loading study…"}</h2>
                  <div className="pill-row">
                    <span className="pill green">
                      {study ? displayStatus(study.status) : "Loading"}
                    </span>
                    <span className="pill">
                      {study?.phase || "Phase not listed"}
                    </span>
                    <span className="pill">
                      {study?.conditions[0] || "Condition pending"}
                    </span>
                  </div>
                </div>
                <div className="protocol-hero-index">
                  01<span>/ 01</span>
                </div>
              </div>
              <div className="detail-grid">
                <section className="paper-card">
                  <div className="card-header">
                    <span className="eyebrow">SITE VERIFICATION</span>
                    <span className="step-index">01</span>
                  </div>
                  <h3>Facility status</h3>
                  <p>
                    Study-wide recruiting status does not establish that a
                    particular facility is accepting participants.
                  </p>
                  <label className="field-label">
                    SELECTED PUBLIC FACILITY
                    <select
                      value={siteIndex}
                      onChange={(event) =>
                        setSiteIndex(Number(event.target.value))
                      }
                    >
                      {study?.locations.length ? (
                        study.locations.map((item, index) => (
                          <option
                            value={index}
                            key={`${item.facility}-${index}`}
                          >
                            {item.facility} — {item.place}
                          </option>
                        ))
                      ) : (
                        <option value={0}>No facilities listed</option>
                      )}
                    </select>
                  </label>
                  <div className="site-fact">
                    <span>FACILITY STATUS</span>
                    <strong>
                      {site ? displayStatus(site.status) : "Not listed"}
                    </strong>
                  </div>
                  <div className="site-fact">
                    <span>PUBLIC CONTACT</span>
                    <strong>
                      {site?.contact?.name ||
                        study?.centralContact?.name ||
                        "Not listed"}
                    </strong>
                    <small>
                      {site?.contact?.email ||
                        study?.centralContact?.email ||
                        ""}
                    </small>
                  </div>
                  <div className="subtle-note">
                    A coordinator must verify local approval, protocol version,
                    and current capacity outside this public record.
                  </div>
                </section>
                <section className="paper-card">
                  <div className="card-header">
                    <span className="eyebrow">SOURCE & FRESHNESS</span>
                    <span className="step-index">02</span>
                  </div>
                  <h3>Registry provenance</h3>
                  <p>
                    Criteria below come from the public registry entry and may
                    not include site-specific requirements.
                  </p>
                  <div className="source-list">
                    <div>
                      <span>Registry ID</span>
                      <strong>{studyId}</strong>
                    </div>
                    <div>
                      <span>Last posted</span>
                      <strong>{study?.updated || "Unavailable"}</strong>
                    </div>
                    <div>
                      <span>Eligibility text</span>
                      <strong>{currentCriteriaCount} review lines</strong>
                    </div>
                  </div>
                  <a
                    className="source-link"
                    href={`https://clinicaltrials.gov/study/${studyId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original source <ArrowUpRight size={16} />
                  </a>
                </section>
              </div>
              <div className="bottom-action">
                <span>Ready to begin a synthetic review?</span>
                <button
                  className="primary-button"
                  onClick={() => setView("review")}
                >
                  Open case workspace <ArrowRight size={17} />
                </button>
              </div>
            </>
          )}

          {(view === "review" || view === "handoff") && study && (
            <>
              <div className="page-eyebrow">
                CASE WORKSPACE <span>{demo.id}</span>
              </div>
              <div className="page-heading compact">
                <div>
                  <h1>Case workspace.</h1>
                  <p>
                    Review the evidence, resolve questions and prepare the handoff here.
                  </p>
                </div>
                <div className="review-progress">
                  <strong>
                    {reviewed}
                    <span> / {criteria.length}</span>
                  </strong>
                  <small>criteria reviewed</small>
                </div>
              </div>
              <div className="case-switcher">
                <label>
                  ACTIVE SYNTHETIC CASE{" "}
                  <span className="select-wrap">
                    <select
                      value={caseId}
                      onChange={(event) => setCaseId(event.target.value)}
                    >
                      {cases.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.id} · age {item.age} · {item.sex.toLowerCase()}
                        </option>
                      ))}
                    </select>
                    <ChevronDown size={16} />
                  </span>
                </label>
                <div>
                  <span>
                    Age <strong>{demo.age}</strong>
                  </span>
                  <span>
                    Sex <strong>{demo.sex.toLowerCase()}</strong>
                  </span>
                  <span>
                    Source <strong>synthetic only</strong>
                  </span>
                </div>
              </div>
              <details className="case-context" key={`context-${studyId}-${caseId}`}>
                <summary><span>Study &amp; facility</span><strong>{studyId} · {site?.facility || "No facility listed"}</strong></summary>
              <div className="detail-grid case-context-grid">
                <section className="paper-card">
                  <div className="card-header">
                    <span className="eyebrow">SITE VERIFICATION</span>
                    <span className="step-index">01</span>
                  </div>
                  <h3>Facility status</h3>
                  <p>
                    Study-wide recruiting status does not establish that a
                    particular facility is accepting participants.
                  </p>
                  <label className="field-label">
                    SELECTED PUBLIC FACILITY
                    <select
                      value={siteIndex}
                      onChange={(event) =>
                        setSiteIndex(Number(event.target.value))
                      }
                    >
                      {study?.locations.length ? (
                        study.locations.map((item, index) => (
                          <option
                            value={index}
                            key={`${item.facility}-${index}`}
                          >
                            {item.facility} — {item.place}
                          </option>
                        ))
                      ) : (
                        <option value={0}>No facilities listed</option>
                      )}
                    </select>
                  </label>
                  <div className="site-fact">
                    <span>FACILITY STATUS</span>
                    <strong>
                      {site ? displayStatus(site.status) : "Not listed"}
                    </strong>
                  </div>
                  <div className="site-fact">
                    <span>PUBLIC CONTACT</span>
                    <strong>
                      {site?.contact?.name ||
                        study?.centralContact?.name ||
                        "Not listed"}
                    </strong>
                    <small>
                      {site?.contact?.email ||
                        study?.centralContact?.email ||
                        ""}
                    </small>
                  </div>
                  <div className="subtle-note">
                    A coordinator must verify local approval, protocol version,
                    and current capacity outside this public record.
                  </div>
                </section>
                <section className="paper-card">
                  <div className="card-header">
                    <span className="eyebrow">SOURCE & FRESHNESS</span>
                    <span className="step-index">02</span>
                  </div>
                  <h3>Registry provenance</h3>
                  <p>
                    Criteria below come from the public registry entry and may
                    not include site-specific requirements.
                  </p>
                  <div className="source-list">
                    <div>
                      <span>Registry ID</span>
                      <strong>{studyId}</strong>
                    </div>
                    <div>
                      <span>Last posted</span>
                      <strong>{study?.updated || "Unavailable"}</strong>
                    </div>
                    <div>
                      <span>Eligibility text</span>
                      <strong>{currentCriteriaCount} review lines</strong>
                    </div>
                  </div>
                  <a
                    className="source-link"
                    href={`https://clinicaltrials.gov/study/${studyId}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open original source <ArrowUpRight size={16} />
                  </a>
                </section>
              </div>
              </details>
              <div className="case-toolbar">
                <div className="case-views" role="group" aria-label="Case view">
                  <button aria-pressed={view === "review"} onClick={() => setView("review")}>Review criteria</button>
                  <button aria-pressed={view === "handoff"} onClick={() => setView("handoff")}>Handoff</button>
                </div>
                <span className={storageBlocked ? "save-state danger-text" : "save-state"} role="status">{storageBlocked ? "Changes only in memory" : hydrated ? "Autosaved on this device" : "Restoring workspace…"}</span>
                <button className="primary-button" onClick={packet} disabled={packetBusy || sourceChanged}>{packetBusy ? "Checking source…" : "Download handoff"}<Download size={16}/></button>
              </div>
              {packetNotice && <p className="packet-note" role="status">{packetNotice}</p>}
              {view === "review" && (<>
              {sourceChanged && (
                <SourceChangePanel
                  changes={sourceChanges}
                  legacy={legacyReview}
                  onRestart={startUpdatedReview}
                />
              )}
              {!sourceChanged && (
                <>
                  <div className="quick-checks">
                    <div>
                      <span>STRUCTURED AGE</span>
                      <strong
                        className={
                          study &&
                          preliminaryAge(study, demo).startsWith("Outside")
                            ? "danger-text"
                            : ""
                        }
                      >
                        {study ? preliminaryAge(study, demo) : "Source pending"}
                      </strong>
                      <small>
                        {study?.minAge || "No minimum"} –{" "}
                        {study?.maxAge || "No maximum"}
                      </small>
                    </div>
                    <div>
                      <span>STRUCTURED SEX</span>
                      <strong
                        className={
                          study &&
                          preliminarySex(study, demo).startsWith("Outside")
                            ? "danger-text"
                            : ""
                        }
                      >
                        {study ? preliminarySex(study, demo) : "Source pending"}
                      </strong>
                      <small>
                        Registry field: {study?.sex.toLowerCase() || "pending"}
                      </small>
                    </div>
                    <div className="quick-check-callout">
                      <CircleHelp size={19} />
                      <span>
                        These checks only compare two fields. They never
                        establish eligibility.
                      </span>
                    </div>
                  </div>
                  <div className="section-head criterion-head">
                    <div>
                      <span className="eyebrow">SOURCE-LED REVIEW</span>
                      <h2>Eligibility criteria</h2>
                    </div>
                    <button
                      className="text-action"
                      onClick={() => setSourceOpen(!sourceOpen)}
                    >
                      {sourceOpen ? "Hide" : "Read"} original text{" "}
                      <ArrowRight size={16} />
                    </button>
                  </div>
                  {sourceOpen && (
                    <pre className="original-text">
                      {study?.criteria || "No source criteria are available."}
                    </pre>
                  )}
                  {criteria.length ? (
                    <div className="criteria-stack">
                      {criteria.map((item, index) => {
                        const mark: Mark = demo.marks[index] || {
                          status: "unreviewed",
                          evidence: "none",
                        };
                        return (
                          <section
                            className="criterion-card"
                            id={`criterion-${index}`}
                            tabIndex={-1}
                            key={`${studyId}-${index}`}
                          >
                            <div className="criterion-left">
                              <span
                                className={`group-tag ${item.group.toLowerCase()}`}
                              >
                                {item.group}{" "}
                                <span>
                                  {String(index + 1).padStart(2, "0")}
                                </span>
                              </span>
                              <p>{item.text}</p>
                              <a
                                href={`https://clinicaltrials.gov/study/${studyId}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                Source: public registry{" "}
                                <ArrowUpRight size={13} />
                              </a>
                            </div>
                            <div className="criterion-controls">
                              <label>
                                PRELIMINARY OBSERVATION
                                <select
                                  value={mark.status}
                                  onChange={(event) =>
                                    markCriterion(index, {
                                      status: event.target.value as Status,
                                    })
                                  }
                                >
                                  {Object.entries(statusLabels).map(
                                    ([value]) => (
                                      <option key={value} value={value}>
                                        {observationLabel(
                                          value as Status,
                                          item.group,
                                        )}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                              <label>
                                EVIDENCE SOURCE
                                <select
                                  value={mark.evidence}
                                  onChange={(event) =>
                                    markCriterion(index, {
                                      evidence: event.target.value as Evidence,
                                    })
                                  }
                                >
                                  {Object.entries(evidenceLabels).map(
                                    ([value, label]) => (
                                      <option key={value} value={value}>
                                        {label}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                            </div>
                            {(mark.status === "follow_up" || mark.followUp) && (
                              <FollowUpEditor
                                task={mark.followUp || emptyFollowUpTask()}
                                criterionNumber={index + 1}
                                needsFollowUp={mark.status === "follow_up"}
                                onChange={(change) => markCriterion(index, {
                                  followUp: {
                                    ...(mark.followUp || emptyFollowUpTask()),
                                    ...change,
                                  },
                                })}
                              />
                            )}
                          </section>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="empty-state">
                      No criteria could be segmented. Review the original source
                      record directly.
                    </div>
                  )}
                  <div className="bottom-action">
                    <span>
                      {followUps.length} open follow-up
                      {followUps.length === 1 ? "" : "s"} · {mismatches.length}{" "}
                      possible{" "}
                      {mismatches.length === 1 ? "conflict" : "conflicts"}
                    </span>
                    <button
                      className="primary-button"
                      onClick={() => setView("handoff")}
                    >
                      Preview handoff <ArrowRight size={17} />
                    </button>
                  </div>
                </>
              )}
              <ArchiveHistory archives={demo.archived} />
              </>)}
              {view === "handoff" && (<>
              {sourceChanged && (
                <SourceChangePanel
                  changes={sourceChanges}
                  legacy={legacyReview}
                  onRestart={startUpdatedReview}
                />
              )}
              {!sourceChanged && (
                <>
                  <div className="handoff-grid">
                    <section className="handoff-document">
                      <div className="document-top">
                        <span>TRIAL / COORDINATOR</span>
                        <span>REVIEW VERSION {String(demo.archived.length + 1).padStart(2, "0")}</span>
                      </div>
                      <div className="document-title">
                        <span>PRELIMINARY SCREEN · {demo.id}</span>
                        <h2>{study?.title || "Study pending"}</h2>
                        <p>
                          {studyId} · {site?.facility || "Site not selected"}
                        </p>
                      </div>
                      <div className="document-stats">
                        <div>
                          <strong>
                            {reviewed}
                            <small> / {criteria.length}</small>
                          </strong>
                          <span>REVIEWED</span>
                        </div>
                        <div>
                          <strong>{followUps.length}</strong>
                          <span>NEED FOLLOW-UP</span>
                        </div>
                        <div>
                          <strong>{mismatches.length}</strong>
                          <span>MISMATCHES</span>
                        </div>
                      </div>
                      <div className="document-section review-coverage">
                        <span className="eyebrow">REVIEW COVERAGE</span>
                        <h3>{!criteria.length ? "No criteria available" : unreviewed.length ? `${unreviewed.length} ${unreviewed.length === 1 ? "criterion remains" : "criteria remain"} unreviewed` : "Every criterion has an observation"}</h3>
                        {!criteria.length ? <p>Review coverage cannot be assessed. Check the original record with the study team.</p> : unreviewed.length > 0 ? <details>
                          <summary>See unfinished criteria</summary>
                          <ol>{unreviewed.map(item => <li key={item.index}><button onClick={() => openCriterion(item.index)}><span>{String(item.index + 1).padStart(2, "0")}</span><span>{item.text}</span><ArrowUpRight size={16}/></button></li>)}</ol>
                        </details> : <p>Check outstanding questions and evidence before sharing the review.</p>}
                      </div>
                      <div className="document-section">
                        <span className="eyebrow">NEEDS ATTENTION</span>
                        {followUps.length ||
                        mismatches.length ||
                        missingEvidence.length ? (
                          <ul>
                            {followUps.map((item) => {
                              const task = demo.marks[item.index]?.followUp || emptyFollowUpTask();
                              return <li key={`follow-${item.index}`}>
                                <CircleHelp size={16} />
                                <div className="handoff-question">
                                  <strong>Criterion {item.index + 1}: {questionLabels[task.question]}</strong>
                                  <p>{item.text}</p>
                                  <small>{ownerLabels[task.owner]} · Due {task.dueDate || "not set"} · {answerLabels[task.answer]}</small>
                                  {task.answer !== "pending" && task.answer !== "unclear" && <small>Observation still marked needs follow-up.</small>}
                                </div>
                              </li>;
                            })}
                            {mismatches.map((item) => (
                              <li key={`mismatch-${item.index}`}>
                                <CircleHelp size={16} /> Review {observationLabel("possible_mismatch", item.group).toLowerCase()} in criterion {item.index + 1}:{" "}
                                {item.text}
                              </li>
                            ))}
                            {missingEvidence.length > 0 && (
                              <li>
                                <CircleHelp size={16} />{" "}
                                <div className="handoff-question"><strong>Evidence source missing</strong>
                                  {missingEvidence.map(item => <button className="text-action" key={item.index} onClick={() => openCriterion(item.index)}>Review criterion {item.index + 1} <ArrowRight size={14}/></button>)}
                                </div>
                              </li>
                            )}
                          </ul>
                        ) : (
                          <p>
                            {unreviewed.length || !criteria.length ? "No concerns recorded so far. Review coverage is incomplete." : "No outstanding concerns recorded. Confirm the full protocol with the study team."}
                          </p>
                        )}
                      </div>
                      {priorQuestions.length > 0 && <div className="document-section prior-questions">
                        <span className="eyebrow">QUESTION HISTORY</span>
                        <ul>{priorQuestions.map((item) => {
                          const mark = demo.marks[item.index];
                          const task = mark.followUp!;
                          return <li key={`prior-${item.index}`}><Check size={16}/><div className="handoff-question"><strong>Criterion {item.index + 1}: {questionLabels[task.question]}</strong><small>{answerLabels[task.answer]} · Current observation: {observationLabel(mark.status, item.group)}</small></div></li>;
                        })}</ul>
                      </div>}
                      <div className="document-footer">
                        <ShieldCheck size={18} />
                        <p>
                          This synthetic packet is a preliminary work product.
                          The site-approved protocol and study team determine
                          eligibility.
                        </p>
                      </div>
                    </section>
                    <aside className="handoff-side">
                      <div className="paper-card">
                        <span className="eyebrow">NEXT ACTION</span>
                        <h3>Assigned next action</h3>
                        <label className="field-label">
                          ASSIGNED ACTION
                          <select
                            value={demo.nextAction}
                            onChange={(event) =>
                              changeCase((item) => ({
                                ...item,
                                nextAction: event.target.value,
                                savedAt: new Date().toISOString(),
                              }))
                            }
                          >
                            {actions.map((action) => (
                              <option key={action}>{action}</option>
                            ))}
                          </select>
                        </label>
                        <p>Saved in this browser for this synthetic case.</p>
                      </div>
                      <div className="paper-card">
                        <span className="eyebrow">PROVENANCE</span>
                        <div className="source-list">
                          <div>
                            <span>Public source</span>
                            <strong>{studyId}</strong>
                          </div>
                          <div>
                            <span>Record posted</span>
                            <strong>{study?.updated || "Unavailable"}</strong>
                          </div>
                          <div>
                            <span>Source checked</span>
                            <strong>{sourceCheckedAt ? new Date(sourceCheckedAt).toLocaleString() : "Not yet"}</strong>
                          </div>
                          <div>
                            <span>Review saved</span>
                            <strong>
                              {demo.savedAt
                                ? new Date(demo.savedAt).toLocaleString()
                                : "Not yet"}
                            </strong>
                          </div>
                        </div>
                        <a
                          className="source-link"
                          href={`https://clinicaltrials.gov/study/${studyId}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Inspect source <ArrowUpRight size={15} />
                        </a>
                      </div>
                      <button className="download-button" onClick={packet} disabled={packetBusy}>
                        <Download size={18} /> {packetBusy ? "Checking public record…" : "Download full review packet"}
                      </button>
                      <p className="packet-note">The public record is rechecked before each download.</p>
                      <button
                        className="back-button"
                        onClick={() => setView("review")}
                      >
                        <ArrowLeft size={16} /> Return to criteria
                      </button>
                    </aside>
                  </div>
                </>
              )}
              <ArchiveHistory archives={demo.archived} />
              </>)}
            </>
          )}

          {view === "library" && (
            <>
              <div className="page-eyebrow">
                PUBLIC REGISTRY <span>SUPPORTING TOOL</span>
              </div>
              <div className="page-heading compact">
                <div>
                  <h1>Study search.</h1>
                  <p>
                    Import a public record into this synthetic workspace.
                    Registry status is not site approval.
                  </p>
                </div>
                <button
                  className="text-action"
                  onClick={() => setView("protocol")}
                >
                  <ArrowLeft size={16} /> Back to protocol
                </button>
              </div>
              <form className="library-form" onSubmit={searchLibrary}>
                <label>
                  CONDITION
                  <input
                    value={searchCondition}
                    onChange={(event) => setSearchCondition(event.target.value)}
                    required
                  />
                </label>
                <label>
                  LOCATION
                  <input
                    value={searchLocation}
                    onChange={(event) => setSearchLocation(event.target.value)}
                  />
                </label>
                <button type="submit" className="primary-button" disabled={searching}>
                  <Search size={17} />{" "}
                  {searching ? "Searching…" : "Search public studies"}
                </button>
              </form>
              {searchError && (
                <div className="notice error" role="alert">
                  {searchError}
                </div>
              )}
              {searchOmitted > 0 && <div className="notice" role="status">
                {searchOmitted} public record{searchOmitted === 1 ? "" : "s"} could not be displayed because required source fields were malformed.
              </div>}
              {submittedSearch && <p className="search-context" role="status">{searchResults.length} studies shown for {submittedSearch.condition}{submittedSearch.location ? ` · ${submittedSearch.location}` : ""}</p>}
              <div className="library-results">
                {searchResults.map((item) => (
                  <button
                    className="library-result"
                    key={item.id}
                    onClick={() => assignStudy(item)}
                  >
                    <div>
                      <span>
                        {item.id} · {displayStatus(item.status)}
                      </span>
                      <h3>{item.title}</h3>
                      <p>
                        {item.conditions.slice(0, 2).join(" · ") ||
                          "Conditions not listed"}
                      </p>
                    </div>
                    <Plus size={22} />
                  </button>
                ))}
              </div>
              {searchPageToken && <button className="primary-button" disabled={searching} onClick={() => searchLibrary()}>{searching ? "Loading…" : "Load more studies"} <ArrowRight size={16}/></button>}
              {!searchResults.length && !searching && !searchError && (
                <div className="empty-state">
                  {submittedSearch ? "No displayable studies found. Try another condition or location." : "Search by condition to inspect public registry records."}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
