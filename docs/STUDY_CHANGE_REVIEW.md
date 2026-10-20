# Saved-study change review

## User task

A person returning to a saved study needs to know whether its public recruitment information changed before deciding what to follow up. A refresh should not quietly replace their reference record or manufacture tasks.

## Shipped behavior

- Check for updates retrieves the public ClinicalTrials.gov record through the existing bounded registry adapter.
- Validated records are compared with the saved baseline. Title, phase, overall status, central contact, and per-facility status/contact changes appear as before/after values. Facility order and registry date alone do not generate work.
- A pending review survives reload and validated backup restore. The saved baseline stays visible until the user accepts the update.
- Users may accept without creating a task, or edit and approve a follow-up title. Task notes retain the source URL, check time and changed values (bounded to the existing task-note limit).
- Acceptance checks the pending review timestamp, prevents repeated acceptance and retains existing personal notes/tasks. A bounded history records the last 20 accepted updates and whether a task was created.
- Account mode uses the existing explicit account-save and revision checks. Updating a draft does not imply the server has saved it.

## Boundaries

This is a deterministic operational workflow, not an LLM agent. No eligibility inference, clinical urgency, external message, automatic task creation, scheduled monitoring or customer validation is claimed. Human review is meaningful because a public registry's status can differ from what a facility can currently do.

## Engineering decisions

The existing version-1 backup accepts optional review/history fields, so old backups remain readable. No database migration is required: account storage already persists the validated planner document. A malformed or wrong-study response cannot replace the baseline. Failed network requests leave both the baseline and an existing review intact. Source order is canonicalized for location comparison while duplicate facility entries are retained in grouped comparisons.

The UI shows the first 20 changed fields and directs larger reviews to the source. Generated task notes are capped at 4,000 characters; source URL and check time are placed first. These bounds keep the feature within the existing storage contracts.

## Verification

`npm run test:review` exercises old backups, ordering/date-only changes, staged persistence, contact/status differences, acceptance with/without a task, repeated/stale approval, malformed/wrong-study responses, reverted updates and bounded history.

The full test suite and type checking are required before publication. Local browser checks use clearly labeled synthetic fixtures for changed states; they are not observed changes to real trials. A separate real-registry lookup exercises the live adapter. Public release does not establish coordinator usefulness or clinical validation.
