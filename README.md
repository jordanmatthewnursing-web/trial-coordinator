# Trial Coordinator

## October 3: personal study organizer

The default route is now a usable, empty-by-default study/task workspace. Search real recruiting studies by condition/location or load any public NCT ID; save multiple studies; create/edit tasks with owners, notes and due dates; mark complete/reopen; filter overdue/completed work; archive/restore studies; refresh public metadata without dropping tasks; export dated open tasks as an all-day calendar file; back up and merge-restore a validated JSON workspace. Study notes save on blur. Calendar downloads do not send invitations or establish syncing.

Storage is browser-local and explicitly labeled. No account, shared team editing, cross-device sync, EHR, participant intake or clinical eligibility system is implemented. Task owner is a text label, not an invitation. Clearing browser data loses local work unless backed up. This is useful for a person organizing public-study operations; it is not a complete clinical trial management system.

The existing synthetic screening walkthrough has moved intact to `/demo`; its original browser storage key is preserved. The default screen has no invented assignments. Old descriptions below refer to that sample walkthrough.

New implementation: `components/StudyPlanner.tsx`, `lib/planner.ts`, `app/planner.css`; recovery/import validation, same-ID merge preservation, calendar escaping/folding and date checks are covered by `tests/planner.test.mjs`. Invalid saved data blocks overwrites; a recovery copy can be preserved before starting empty. Cross-tab writes pause editing until reload. Storage failures show unsaved status and offer backup/retry.


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

## Account workspace — October 3

`/account` uses the existing Sites sign-in with ChatGPT flow. `/` remains the browser-only organizer and `/demo` the synthetic screening example. The public site audience is unchanged. Account data is private to the stable Site user identity; there is no team access, email-based sharing, patient record storage or clinical CTMS claim.

Changes in the account workspace are drafts until Save to account. Import a backup deliberately to move browser data; no automatic migration or overwrite occurs. Account drafts stay in memory (not localStorage), with leave-page warning after a workspace change. Download a backup before leaving an unsaved or conflicted draft. Study note blur updates the draft; account save is still required. Task form content must first be added as a task. Account payload limit is 1 MB.

Schema: account_plans, one JSON workspace per authenticated Site user, integer revision, server update timestamp. Prepared D1 queries are scoped by the server identity. Atomic insert/update revision checks reject stale saves with HTTP409; no last-writer-wins overwrite. API responses are private/no-store. Anonymous requests are rejected; writes require same-origin JSON. Storage errors keep client drafts; uncertain save retries may return conflict and require backup/reload. Production tables are created only by the checked-in Drizzle migration.

Verification: strict typecheck/build; seven prior planner tests and three real SQLite storage tests (account isolation, concurrent/stale updates, absent revisions). Local browser used the platform's preview identity: backup import, explicit account save, reload with notes/completed task, two-tab conflict with stale draft retained, and 390px no horizontal overflow. Direct local HTTP checks returned401 for unauthenticated PUT and403 for cross-origin PUT. Hosted sign-in across two physical devices has not been tested. No clinical or external-user validation claimed.
