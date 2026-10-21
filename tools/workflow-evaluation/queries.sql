-- These are synthetic evaluation outcomes, not production telemetry or customer metrics.
SELECT category, COUNT(*) AS cases, SUM(passed) AS passed,
       ROUND(100.0 * SUM(passed) / COUNT(*), 1) AS pass_percent
FROM case_results WHERE implementation = 'current-workflow' GROUP BY category;

-- Find cases that need investigation. A correctly rejected input is not a failure.
SELECT case_id, category, failure FROM case_results
WHERE implementation = 'current-workflow' AND passed = 0;

-- Verify the deliberately unsafe implementation is detected by the same evaluation.
SELECT implementation, COUNT(*) AS cases, SUM(passed = 0) AS failures
FROM case_results GROUP BY implementation;
