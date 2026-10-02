# Trial Coordinator: product brief

Status: discovery. Primary user: a clinical research coordinator at a research site. The current site is a technical prototype, not the finished portfolio project.

## Product thesis

Research-site coordinators screen and follow up with potential participants against protocols their site runs. They must make the next action clear without confusing a preliminary screen with a formal eligibility decision. Build a protocol-specific workbench that shows what is known, what is missing, who must verify it, and what changed since the last review.

This is a hypothesis until interviews confirm the actual workflow, tools, handoffs, and pain points. The registry search is a way to find and import a public study record; it is not the main coordinator workspace. The site-approved protocol and local recruitment rules may differ from or contain more detail than the public registry record.

## Evidence and unresolved questions

- ClinicalTrials.gov distinguishes a study's overall recruitment status from each facility's status. A study-level `RECRUITING` flag cannot prove that a particular site is recruiting. The prototype now displays the first listed facilities and their public status, but it cannot establish local site approval or current capacity.
- Registry eligibility text is not a complete or reliable machine-readable rule set. The source protocol and study team remain authoritative. The current parser is only a way to organize text for review.
- CTTI has identified finding people who meet eligibility criteria as a major recruitment barrier. Whether this workbench saves coordinators time, and where their actual bottleneck occurs, remain hypotheses.
- Clinical research coordinators commonly handle screening, recruitment, enrollment, and participant follow-up. That makes a case-centered workflow more plausible than an open-ended trial search, but interviews must determine the actual product wedge.

Sources: [ClinicalTrials.gov protocol data definitions](https://clinicaltrials.gov/prs-info/protocol-definitions); [ClinicalTrials.gov common questions](https://clinicaltrials.gov/find-studies/for-patients/common-questions); [CTTI recruitment research](https://ctti-clinicaltrials.org/type/news/new-publication-ctti-presents-stakeholder-survey-results-on-barriers-and-solutions-to-clinical-trial-recruitment-2/); [ACRP coordinator role](https://acrpnet.org/glossary/clinical-research-coordinator-crc).

## One complete workflow to build

1. **Set up a site protocol:** Import a public study by NCT ID, select the coordinator's facility, and record which local protocol version is being used. Clearly distinguish public registry data from locally confirmed facts. The demo uses a synthetic local protocol.
2. **Start a synthetic candidate case:** Record only the minimum facts needed to rehearse a preliminary screen. The public demo must not accept identifiable patient information.
3. **Review criteria:** Organize source inclusion/exclusion statements, preserve the original text, and record `appears met`, `possible mismatch`, `unknown`, or `needs follow-up` with an evidence note and reviewer timestamp. Never turn these marks into an automated eligibility verdict.
4. **Resolve unknowns:** Assign follow-up questions and a next action; retain the question's source criterion, owner, due date, and answer. Make unresolved blockers visible.
5. **Handoff:** Produce a review packet with study ID, protocol version, source links, reviewer notes, unresolved questions, and an explicit preliminary status. Export without exposing patient data by default.
6. **Recheck:** Each handoff download makes an uncached registry request and stops if the record changed or cannot be checked. The packet records the check time. On returning to a case, compare the saved registry snapshot with the current record and flag changes in eligibility, status, sites, or contacts before reusing an earlier review. A registry change does not silently overwrite the local review. The selected facility is captured with the review; changing it pauses handoff and preserves the previous context in the archive. Older reviews without captured facility context must restart explicitly.

The workflow is finished only when someone can move from a site protocol and synthetic case to a defensible next action and later explain the evidence behind it. The current demo now supports protocol context, criterion review, structured criterion-linked follow-up assignments and answer states, handoff, and field-level public-source change review for invented cases. It does not yet support a verified local protocol, freeform reviewer notes, or shared team work.

## Technical depth to demonstrate

- A typed ClinicalTrials.gov adapter with schema validation, pagination, retries and rate-limit behavior, provenance, and fixture-based tests for missing or malformed data. Runtime validation, malformed-record tests, bounded retries, cancellation, and Retry-After handling are in place. Search pagination retains the submitted query, keeps loaded results on page failures, and deduplicates records across pages.
- Structured storage for studies, source snapshots, candidate cases, criterion reviews, tasks, and audit events. Start with synthetic cases; any real patient data requires a separate privacy/security design and deployment decision.
- Deterministic change detection between source snapshots, including field-level diffs and a clear distinction between absent data and changed data.
- A protocol import that identifies the chosen site and explains that registry status is not local site approval.
- Accessible keyboard and mobile workflows, honest empty/error/loading states, and a complete screen-reader review path.
- A versioned export whose contents can be traced to the source record and review state.

AI is optional. If used, it may propose criterion segmentation or summarize changes with exact source spans. Human edits and decisions must remain visible. Evaluate extraction accuracy against hand-labeled cases before claiming it works.

## Demo boundary and release gates

The public portfolio demo uses invented candidate cases and public registry data. It must not offer a free-text patient intake or imply that users may store PHI. A clinical deployment would be a separate product requiring institution-specific protocol authority, privacy/security review, access controls, and operational validation.

The build has four gates:

1. **Problem gate:** Interview findings support one narrow coordinator task and identify the existing artifact or handoff it replaces.
2. **Workflow gate:** A coordinator can start from an assigned protocol, review a synthetic candidate, resolve an unknown, and produce a handoff without jumping between disconnected screens.
3. **Trust gate:** Every criterion and change points to its source; missing information stays visibly unknown; tests catch stale registry data, site/overall status differences, and malformed records.
4. **Portfolio gate:** The case study shows the evidence, design tradeoffs, implementation, user test results, and remaining limits. No claim of clinical effectiveness is made without evidence.

## Validation plan

Interview 3–5 research-site coordinators or equivalent users. Ask for a recent screening task, their tools, the last ambiguous criterion, and the handoff artifact they actually use. Avoid pitching the interface first. Determine whether the valuable wedge is prescreening, handoff, follow-up, protocol-change awareness, or something else. Test the current prototype against that task and record task completion, time, missed blockers, and trust failures. Build a small synthetic benchmark from real public studies, including ambiguous criteria, missing contacts, and a site whose status differs from the overall study. Re-test after each major workflow change.

## Portfolio bar

Publish a case study only when it includes: the user problem and evidence; alternatives considered; architecture and data boundaries; a working end-to-end demo; tests for consequential behavior; usability findings; measurable before/after results or an honest explanation that measurements are pending; and limitations. A polished search screen alone does not clear this bar.

## Immediate next decisions

1. Conduct workflow interviews and collect examples of existing handoff artifacts, stripped of patient information.
2. Select one narrow workflow based on that evidence and write task-level success criteria.
3. Extend the synthetic workspace with verified local protocol context and shared next actions after the workflow is tested. Keep the public demo limited to structured synthetic fields unless a separate privacy design is approved.
4. Validate with users before final visual polish or portfolio write-up.

## Saved workspace recovery

Browser data is validated before restoration, including observations, follow-up fields, archives, source contacts, facility context, and source-criterion references. Invalid saved reviews are rejected as a whole. Saving pauses with a recovery download instead of silently dropping observations. Users can explicitly save the displayed examples; the original invalid workspace is copied to a separate browser recovery key first. Storage failures retain the current in-memory work and prevent unsafe study switching. This is local recovery, not a server backup or a shared audit log.
