# Personal study/task workflow — October 3

Jordan corrected the product standard: someone must be able to bring their own work and get useful work done. The previous default was three hardcoded synthetic screening cases, with no case creation or shared records. Its tested demo interactions did not make it a usable clinical trial management product.

## Implemented scope

A personal study organizer for public registry research and operational follow-ups. Starts empty. Search recruiting studies by condition/location or look up a public NCT ID; save multiple studies; create/edit named tasks with owner labels, dates and notes; complete/reopen and filter them; add study notes; refresh registry metadata; archive/restore studies; export dated tasks to an all-day calendar file; back up and merge-restore the workspace.

Source lookup uses the existing validated ClinicalTrials.gov API adapter. Main workspace remains usable from a saved record when registry refresh fails. Per-facility recruitment is preserved separately from overall status. The original screening walkthrough is at /demo with its old local storage untouched.

## Exact limits

Personal browser storage, no account or shared team backend. Owner fields do not assign work to real accounts or notify people. The calendar is a downloadable file, not live sync. Backup is a manual transfer/recovery mechanism. This is not participant management, a patient record system, an institutional protocol or a clinical eligibility tool. No patient information is requested. No actual coordinator adoption or time-saving outcome has been measured.

## Verification

36 unit checks pass (29 existing + 7 new): backup round-trip, non-destructive merge, malformed/duplicate rejection, date validation, due-state logic, calendar date rollover and escaping/Unicode folding. TypeScript and production build pass. Browser workflow verified against a real NCT record: save study, create task, edit owner/date, save notes, reload retention, completed filter, export actual calendar file, backup and restore without duplication, archive/restore. Found and fixed a date field that displayed a value without persisting it. Calendar file inspected with correct all-day start/end. 390px layout inspected without horizontal overflow. No physical-phone, calendar-app import, multi-user or clinical validation claim.

## Next product decisions

Review whether the first intended user needs personal study operations or an actual clinical site team system. The latter needs authenticated shared workspaces, authorized protocol handling and participant-data design before it can be represented as available. Do not grow generic task features in place of that decision. An actual prospective user should be able to complete a real non-patient task unaided; record that outcome rather than asserting it.
