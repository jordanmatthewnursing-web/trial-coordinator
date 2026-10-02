# Synthetic workflow verification

Updated 2026-09-27. These are engineering checks on invented cases, not coordinator usability research or evidence of clinical effectiveness.

## Reproduce automated checks

```sh
node --experimental-strip-types --test tests/*.test.mjs
npx tsc --noEmit
npm run build
```

29 automated tests currently cover segmentation, normalization, requests, snapshot comparisons, review lifecycle, and persistence validation.

## Evidence matrix

| Scenario | Evidence | Result |
| --- | --- | --- |
| Partly reviewed case | Browser, DEMO–021 / NCT05420051: two of eleven criteria marked | Nine unreviewed criteria shown in handoff; no complete/eligible claim |
| Possible exclusion | Browser: criterion 3 marked possible exclusion | Handoff names the possible exclusion and retains source text; corrected generic mismatch wording |
| Evidence missing | Browser: two marked criteria initially have no evidence | Both links shown; adding a synthetic clinical record to criterion 3 removes only its evidence warning |
| Return to the relevant criterion | Browser: handoff evidence link | Focus moves to criterion-2 (displayed criterion 3) |
| Reload | Browser after evidence correction | Both observations persist; only criterion 1 still lacks evidence |
| Follow-up answer | Workspace unit test; earlier browser check | Owner and answer persist; answer does not automatically reclassify observation |
| Registry criteria change | Snapshot and workspace unit tests | Changed criteria pause review; archive retains previous marks and source |
| Selected facility changes | Workspace unit tests | Unchanged registry does not conceal a changed selected facility; old facility retained in archive |
| Legacy facility missing | Browser and unit tests | Handoff pauses; explicit archive/restart retains earlier review |
| Missing or malformed registry fields | Study adapter unit tests | Missing optional fields remain unknown; malformed records rejected or reported omitted in search |
| Rate limit / temporary source outage | Registry unit tests | Bounded retry, short Retry-After honored, long cooldown returned without early retry |
| Fresh source on export | Browser successful request to refresh endpoint | Download waits for fresh record and includes recheck time |
| Invalid saved observation/archive | Persistence unit tests | Whole saved case rejected rather than silently dropping a concern |
| Valid older archive | Browser with two existing archived versions | Both versions restore; unavailable historic provenance remains explicitly unknown |
| Mobile handoff | Browser at 390 × 844 in prior verification pass | Controls, source timestamps, and feedback readable; no horizontal overflow |

## Remaining verification

- Manual screen-reader testing. Keyboard-only review and export passed at desktop and phone viewport sizes; this is not a screen-reader certification.
- Independent coordinator task testing, including actual handoff expectations. No completion-time or efficiency claim is supported yet.

The private deployment contains synthetic cases only. Browser checks modify local demo cases, not production review data.

## September 27 browser evidence

Seven isolated local Chrome scenarios passed using synthetic API fixtures: malformed workspace preservation and explicit backup/replacement; quota failure with memory-only edits and recovery export; denied storage reads; changed source blocking export; unavailable source blocking export; concurrent edit invalidating export; unchanged source producing a timestamped packet with incomplete coverage.

Keyboard-only navigation completed case selection, follow-up observation, evidence selection, investigator assignment, handoff, and download at 1440 × 1000 and 390 × 844. No horizontal overflow was detected. Export feedback has a live region. Active navigation now exposes aria-current on desktop and mobile. Native select controls were exercised using keyboard type-ahead.

Harnesses and machine-readable results are maintained in the adjacent portfolio-program/qa directory. These checks use synthetic records and isolated storage; they do not modify the hosted workspace.
