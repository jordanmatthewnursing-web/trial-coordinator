# Review workflow evaluation

From the repository root, after installing project dependencies:

```sh
python3 tools/workflow-evaluation/run.py
```

Requires Python 3 and the project's Node runtime (22.13+). No API key, network call or patient data. The runner imports the actual review, backup parser and account-store functions. Account checks use the real migration and prepared queries through a local SQLite adapter; they do not connect to the hosted database.

## What it produces

Generated files stay in the ignored `output/` directory:

- An HTML report and per-case JSON, including the source commit.
- A SQLite database with one outcome per case and implementation.
- Results from the diagnostic queries in `queries.sql`.
- TAP evidence from three account lifecycle checks.

The 15 synthetic reference scenarios cover noise, meaningful changes, input rejection and user approval. The current implementation passes all 15. A deliberately unsafe control silently replaces the saved baseline and omits review/validation; the same checks detect 12 failures. The control is never used by the application.

The account checks verify pending-review and task/history persistence, stale-write rejection with the original draft still parseable, and separate personal content for different account keys.

## Investigate a failure

Open `output/report.html`, choose a failing control case, read its assertion and inspect the corresponding function. Run the queries to separate expected input rejection from an actual failed check. Add a new reference scenario only when its expected behavior is justified independently of the current implementation.

## Limits

This small authored suite detects specific known failures; passing it does not establish general reliability. Results are synthetic domain/storage checks, not production telemetry, model accuracy, clinical validation, adoption or time savings. The suite does not exercise HTTP retries, hosted authentication, Cloudflare D1, browser rendering or physical devices. The generated report has been structurally checked, not visually reviewed in a browser.

The project's existing 49 tests are separate. Counts overlap in behavior and should not be combined into a claim of independent validations.
