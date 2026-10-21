# Saved-study updates: implementation evidence

## The user problem

A person tracking public studies needs to distinguish a new registry record from the version they saved, then decide what to follow up. Replacing that baseline silently removes the comparison they need.

## The working path

Search and save a public study → request an update → validate the response → compare supported fields → review changes → accept, with an optional approved follow-up task.

The Updates inbox collects pending reviews across active saved studies. Checks run on request, not in the background. Account drafts require an explicit **Save to account**.

## Decisions

- Structured comparison makes supported changes reproducible without model interpretation. Date-only and facility-order changes do not create review work.
- The saved baseline remains until acceptance. The approval checks the expected review timestamp.
- Acceptance and task creation are separate decisions. A created task retains source attribution.
- Account storage uses revision checks instead of silently overwriting a newer save. Users can export an unsaved draft before reconciliation.
- Registry status does not determine patient eligibility or current facility capacity.

## Evidence and remaining checks

The published workflow passed the existing 49 project tests, TypeScript checking and production build. The [replayable evaluation](../tools/workflow-evaluation/README.md) adds synthetic reference cases, a deliberately unsafe control and local SQLite account lifecycle checks. These are controlled engineering results, not customer or clinical validation.

Fresh browser review of the Updates inbox and hosted sign-in/cross-device verification remain outstanding. No production users, measured savings, scheduled monitoring, autonomous agent or model-generated interpretation is claimed.

## Recovery guide

**Registry check fails:** preserve the baseline and pending review. Distinguish missing record, malformed response and transient failure. Capture the public study ID, action and exact error; redact personal notes and account identifiers. Do not clear storage or repeatedly retry an unchanged outage.

**Account save conflicts:** keep the draft open and export a backup. Read the newer account version, then reconcile deliberately. Do not force overwrite. Importing an old backup may reintroduce old domain state even though account revision checks still protect against concurrent writes.

**Sign-in expires or save is uncertain:** back up before reauthenticating or reloading. A write may have completed despite a lost response; re-read its revision before retrying.

**Acceptance is stale:** reopen the latest pending review. Do not replay an old approval to manufacture a task.

Bug reports should state expected and actual behavior, reproducible steps, route, browser and time. Never include credentials, cookies or patient data.
