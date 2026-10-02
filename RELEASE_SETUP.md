# Trial Coordinator

Keep an incomplete preliminary trial review understandable as evidence and public study information change.

A private synthetic prototype with Worklist and Case workspace navigation. Review observations, study context, follow-ups and handoff share one case. Download is available directly from review, subject to a fresh source check.

## Technical decisions

- Typed registry adapter and detached source snapshots.
- Source changes pause reuse of earlier observations.
- Follow-up answers and review observations remain separate.
- Validated browser-local restoration with visible failure and recovery.
- Handoff retains uncertainty; no aggregate eligibility score.

## Reproduce

Node 22.13+ and npm:

```sh
npm ci
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
npm start -- --port 4187
```

The canonical source passed 29 tests, TypeScript and build checks. External browser checks cover the full synthetic review loop and seven failure scenarios; these are not bundled portable tests.

See `docs/WORKSPACE_SIMPLIFICATION.md` for the current interface and `docs/ENGINEERING_CASE_STUDY.md` for its engineering background. Local persistence is not shared team storage. No patient screening, clinical eligibility validation, coordinator adoption or measured time savings is claimed. Independent usability review and final design acceptance remain open.

This is a release draft. Public repository links and original-work licensing remain pending.

---

# Trial Coordinator

A designed research-site coordinator workspace for a **synthetic** preliminary screen. The public demo supports a path from protocol context to criterion review and handoff. It is a portfolio prototype, not a patient record system, local protocol authority, or eligibility determination tool.

## Current experience

- Opens on assigned demo work: one public study and three invented candidate scenarios.
- Fetches the selected NCT record from ClinicalTrials.gov API v2, validates the fields used in review, and distinguishes study-wide recruitment from each listed facility's status. Malformed records are rejected; missing optional fields remain visibly unknown.
- Displays source freshness, public contacts, and the original eligibility text.
- Organizes free-text inclusion/exclusion criteria into reviewable lines without automatically inferring eligibility.
- Records a preliminary observation and a synthetic evidence-source category for each line. Exclusion criteria use exclusion-specific labels.
- Gives each follow-up a criterion-linked question, owner, due date, controlled answer state, and review timestamp. An answer does not silently change the preliminary observation.
- Surfaces follow-ups, their assignment and answer state, possible conflicts, and missing evidence in a handoff preview and downloadable text packet.
- Saves the synthetic review and a public-source snapshot on this device only. On return, it compares criteria, structured limits, recruitment, facilities, and contacts. A changed record pauses review and handoff until the prior synthetic version is archived.
- Keeps broad registry search available as a supporting import tool.

## Boundaries

The demo contains no real patient record integration, sign-in, shared workflow, local IRB-approved protocol, or PHI storage. Do not enter identifiable patient information. Browser-local state is for invented scenarios only. Public registry records may differ from site-approved protocols; the study team makes formal eligibility decisions. A posted-date-only change is shown as context; it does not establish a clinical change.

## Architecture

`lib/study.ts` validates and normalizes registry records and preserves separate overall and facility statuses. `/api/study/[id]` loads a specific assigned public record and verifies its ID; `/api/studies` supports discovery and reports skipped malformed records. Both use a shared request budget, bounded retries, cancellation, and Retry-After handling. Normal responses may be cached for five minutes; handoff checks bypass caching. `lib/criteria.ts` segments free-text criteria but never interprets them. `lib/snapshot.ts` captures public-source fields and computes deterministic field-level changes. `lib/persistence.ts` validates saved cases and archives, pausing writes and exposing recovery when saved data is invalid. The client stores only synthetic demo state in local browser storage and builds an export with provenance and unresolved work.

## Product and design work

- [Product brief](docs/PRODUCT_BRIEF.md)
- [Coordinator research plan](docs/RESEARCH_PLAN.md)
- [Experience direction and audit](docs/UX_DIRECTION.md)
- [Engineering case study](docs/ENGINEERING_CASE_STUDY.md)
- [Verification evidence and remaining checks](docs/VERIFICATION.md)

Coordinator interviews and task testing are still required before this can be described as a validated workflow or finished portfolio case study.

## Run and verify

```sh
npm install
npm run dev
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```
