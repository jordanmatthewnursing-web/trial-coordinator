from pathlib import Path
import html, json, shutil, sqlite3, subprocess, sys

root = Path(__file__).resolve().parent
out = root / 'output'
out.mkdir(exist_ok=True)
node = shutil.which('node')
if not node:
    raise SystemExit('Node.js is required; use the project runtime (Node 22.13+).')
account = subprocess.run([node, '--experimental-strip-types', '--test', str(root/'account-lifecycle.test.mjs')], capture_output=True, text=True)
(out/'account-lifecycle.tap').write_text(account.stdout + account.stderr)
if account.returncode:
    raise SystemExit('Account lifecycle checks failed; see output/account-lifecycle.tap')
runs = []
for flag in ([], ['--unsafe-control']):
    result = subprocess.run([node, '--experimental-strip-types', str(root/'evaluate.mjs'), *flag], capture_output=True, text=True)
    if not result.stdout.strip():
        raise SystemExit(result.stderr)
    run = json.loads(result.stdout)
    expected = 1 if flag else 0
    if result.returncode != expected:
        raise SystemExit(f'Unexpected evaluation exit ({result.returncode}): {result.stderr}')
    if flag and run['passed'] == run['total']:
        raise SystemExit('Unsafe control was not detected; evaluation cannot be trusted.')
    runs.append(run)
    (out/(run['implementation']+'.json')).write_text(json.dumps(run, indent=2)+'\n')

# Rebuild this local derived database transactionally; never touch hosted account data.
db = out/'evaluation.sqlite'
with sqlite3.connect(db) as con:
    con.execute('DROP TABLE IF EXISTS case_results')
    con.execute('CREATE TABLE case_results (implementation TEXT, case_id TEXT, category TEXT, expected_rejection INTEGER, rejected INTEGER, pending INTEGER, task_count INTEGER, passed INTEGER, failure TEXT, PRIMARY KEY (implementation, case_id))')
    for run in runs:
        for r in run['results']:
            con.execute('INSERT INTO case_results VALUES (?,?,?,?,?,?,?,?,?)', (run['implementation'],r['case_id'],r['category'],r['expected_rejection'],r['rejected'],r['pending'],r['task_count'],r['passed'],r['failure']))
    queries=[]
    for q in (root/'queries.sql').read_text().split(';'):
        if not q.strip(): continue
        cursor=con.execute(q)
        queries.append({'query':q.strip(),'columns':[d[0] for d in cursor.description],'rows':cursor.fetchall()})
(out/'query-results.json').write_text(json.dumps(queries,indent=2)+'\n')
e=html.escape
sections=[]
for run in runs:
    rows=''.join(f"<tr><td>{e(r['case_id'])}</td><td>{e(r['category'])}</td><td>{'Pass' if r['passed'] else 'Fail'}</td><td>{e(r['failure']) if r['failure'] else '—'}</td></tr>" for r in run['results'])
    sections.append(f"<section><h2>{e(run['implementation'])}</h2><p>{run['passed']} / {run['total']} cases passed · source <code>{e(run['source_commit'][:12])}</code></p><div class='table'><table><thead><tr><th>Case</th><th>Category</th><th>Result</th><th>Evidence</th></tr></thead><tbody>{rows}</tbody></table></div></section>")
(out/'report.html').write_text('''<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Study review evaluation</title><style>body{margin:0;background:#f8f6f0;color:#26372f;font:16px/1.65 system-ui}main{max-width:1080px;margin:auto;padding:48px 24px}h1{font:normal clamp(32px,6vw,60px)/1.12 Georgia,serif;max-width:700px}h2{font-weight:500}section{margin-top:48px;border-top:1px solid #c7cec4;padding-top:20px}table{width:100%;border-collapse:collapse;font-size:14px;text-align:left}td,th{padding:12px 12px 12px 0;border-bottom:1px solid #dce0d6;vertical-align:top}td:last-child{max-width:380px;white-space:pre-wrap;overflow-wrap:anywhere}.table{overflow-x:auto}code{font-size:12px}p{max-width:750px}</style><main><p>Trial Coordinator / engineering evidence</p><h1>What happens when a study changes?</h1><p>Replayable synthetic cases against the actual review functions. The second run deliberately replaces saved records without review; the evaluation must detect it. These results are not clinical validation, model accuracy, customer adoption or production monitoring.</p>'''+''.join(sections)+'</main></html>')
print(f"Current workflow: {runs[0]['passed']}/{runs[0]['total']} passed. Unsafe control: {runs[1]['total']-runs[1]['passed']} failures detected.")
print(f'Report: {out / "report.html"}')
