"use client";
import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import StudyPlanner from "./StudyPlanner";
import { plannerSchema, type Planner } from "@/lib/planner";
const loadedSchema = z.object({
  plan: plannerSchema,
  revision: z.number().int().min(0),
  updatedAt: z.string().nullable(),
});
export default function AccountPlanner({
  displayName,
  signOut,
}: {
  displayName: string;
  signOut: string;
}) {
  const [loaded, setLoaded] = useState<z.infer<typeof loadedSchema> | null>(
      null,
    ),
    [error, setError] = useState(""),
    [dirty, setDirty] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState(""),
    [attempt, setAttempt] = useState(0),
    [conflict, setConflict] = useState(false);
  const current = useRef<Planner | null>(null),
    revision = useRef(0);
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api/account-plan", { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        if (!response.ok)
          throw Error(
            "Account workspace could not load. Retry, or return to your browser workspace.",
          );
        return loadedSchema.parse(await response.json());
      })
      .then((value) => {
        current.current = value.plan;
        revision.current = value.revision;
        setLoaded(value);
      })
      .catch((e) => {
        if (!controller.signal.aborted) setError(e.message);
      });
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save() {
    if (!current.current || saving || conflict) return;
    const draft = current.current;
    setSaving(true);
    setMessage("Saving to your account…");
    try {
      const response = await fetch("/api/account-plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: draft, revision: revision.current }),
        signal: AbortSignal.timeout(15000),
      });
      const body = await response.json();
      if (!response.ok) {
        if (response.status === 409) setConflict(true);
        throw Error(
          z.object({ error: z.string() }).safeParse(body).data?.error ??
            "Save failed. Back up your draft.",
        );
      }
      const saved = z
        .object({
          revision: z.number().int().positive(),
          updatedAt: z.string(),
        })
        .parse(body);
      revision.current = saved.revision;
      setDirty(current.current !== draft);
      setMessage(
        current.current === draft
          ? "Saved to your account. Available when you sign in on another device."
          : "Saved that version. Newer edits still need saving.",
      );
    } catch (e) {
      setMessage(
        e instanceof Error && e.name === "TimeoutError"
          ? "Save could not be confirmed. Back up your draft before retrying."
          : e instanceof Error
            ? e.message
            : "Save failed. Back up your draft.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <>
      <section className="account-bar" aria-label="Account storage">
        <div>
          <strong>Account workspace</strong>
          <p>{displayName}</p>
          <p>Your personal account only. Team sharing is not available.</p>
        </div>
        <div className="account-actions">
          <button
            onClick={save}
            disabled={!loaded || !dirty || saving || conflict}
          >
            {!loaded
              ? "Loading account…"
              : saving
                ? "Saving…"
                : dirty
                  ? "Save to account"
                  : "Saved to account"}
          </button>
          <a href="/">Browser workspace</a>
          <a href={signOut} target="_top">
            Sign out
          </a>
        </div>
        <p>
          Moving existing work? Back up your browser workspace, then use Restore
          backup here and Save to account.
        </p>
        <p role="status">
          {message ||
            (loaded
              ? "Changes are drafts until you choose Save to account. Use Back up workspace before leaving with unsaved changes."
              : "Opening your account workspace…")}
        </p>
      </section>
      {error ? (
        <section className="account-error" role="alert">
          <p>{error}</p>
          <button onClick={() => setAttempt((x) => x + 1)}>
            Retry account load
          </button>
        </section>
      ) : loaded ? (
        <StudyPlanner
          account={{
            initialPlan: loaded.plan,
            onChange: (next) => {
              current.current = next;
              setDirty(true);
              setMessage("Unsaved account changes. Choose Save to account.");
            },
          }}
        />
      ) : null}
    </>
  );
}
