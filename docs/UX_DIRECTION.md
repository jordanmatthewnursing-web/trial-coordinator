# Trial Coordinator: experience direction

Status: design hypothesis for coordinator testing. The audit below describes the original search-led prototype. The current demo now implements a worklist, protocol context, synthetic review, and handoff, but has not been tested with coordinators.

## Design principle

Make complex screening work feel calm, legible, and accountable. The interface should help a coordinator regain context quickly, see the next action, and trace every clinical statement to a source. Visual beauty comes from precise hierarchy, clear status, excellent typography, and considered transitions, not decorative clinical imagery.

## Current experience audit

| Current behavior                                            | Consequence for a coordinator                                                                               | Design response                                                                                     |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| A large trial-search hero is the entry point.               | It suggests open-ended study discovery is the daily job.                                                    | Open on assigned protocols and cases. Keep registry import as a secondary action.                   |
| Twelve long study cards compete for attention.              | Scanning is slow and relevance is unclear.                                                                  | Use compact protocol rows with site, phase, source freshness, and pending work.                     |
| A tall sticky review desk sits beside the results.          | Criteria, sites, and review actions become one dense scroll; on mobile the review follows the entire queue. | Give each case a focused workspace with a task rail on desktop and a clear step sequence on mobile. |
| Criterion marks have no evidence or next action.            | A review can look complete while unanswered questions remain.                                               | Put source text, reviewer observation, uncertainty, and follow-up together for each criterion.      |
| A text export is available before the workflow is complete. | The packet lacks local protocol context, unresolved questions, and provenance.                              | Make the handoff a deliberate final step with a preview and a visible list of gaps.                 |
| Review state disappears on refresh.                         | The coordinator cannot return to work or compare changes.                                                   | Save synthetic cases and source snapshots, then show a change summary on return.                    |

## Intended flow

1. **Worklist:** “What needs me today?” Assigned protocols, open synthetic cases, unresolved questions, and registry changes. Each row has one dominant next action.
2. **Protocol workspace:** Local site and protocol version first; public NCT record and its last-posted date clearly labeled as supporting evidence. Show site status separately from study-wide status.
3. **Synthetic case:** A single case header with progress, review owner, and last activity. No field invites real patient identifiers in the public demo.
4. **Criteria canvas:** One criterion per card. Source language is primary. The reviewer can mark an observation, attach a structured evidence source, and create a follow-up. Unknown remains a first-class state.
5. **Handoff preview:** A concise narrative with reviewed facts, possible mismatches, unresolved questions, version identifiers, and source links. The system never issues an eligibility verdict.
6. **Return visit:** Show what changed in the public record since the saved snapshot before the reviewer resumes. Do not overwrite past observations.

## Visual system

- **Mood:** Research field notebook meets a carefully designed contemporary tool. Warm paper surfaces, deep ink, muted botanical green for navigational emphasis, amber for missing information, and restrained vermilion for consequential mismatches. Color is always paired with text and iconography.
- **Type:** An expressive editorial serif for page titles and moment-setting copy; a highly legible sans for controls, criteria, data, and long reading. Avoid all-caps microcopy for dense clinical information. Keep criterion text at a comfortable reading size and line length.
- **Layout:** A compact left task rail, a generous reading canvas, and a contextual evidence panel on wide screens. On phone, one task at a time with a persistent way back to the case overview and a visible progress indicator.
- **Motion:** Brief transitions that explain navigation, review-state changes, and source diffs. Respect reduced-motion settings. No parallax or animation that delays a screening task.
- **Details:** Distinct empty, stale, loading, and source-error states; clear timestamps; source links next to the claims they support; keyboard access; visible focus; screen-reader labels; no nested scrolling for the primary review.

## Design tests

Ask a coordinator to use a synthetic case to (1) identify the next action, (2) locate the evidence for a criterion, (3) find whether the selected site is recruiting, and (4) explain what the handoff does _not_ establish. Observe errors and hesitation before asking whether they like the appearance. Test desktop and phone, including keyboard and screen-reader paths.

## Acceptance bar

The UI is ready for a portfolio case study when the complete synthetic workflow is usable and visually coherent at desktop and mobile sizes; every status has a source or owner; at least three users can complete the test tasks without a misleading eligibility conclusion; and visual polish survives real, long, missing, and conflicting trial data.
