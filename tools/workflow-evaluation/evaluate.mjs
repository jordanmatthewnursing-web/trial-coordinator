import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { stageStudyReview, acceptStudyReview } from '../../lib/study-review.ts';

// Synthetic fixtures exercise the real deployed workflow functions. No network or patient data.
const now = '2026-10-21T12:00:00.000Z', later = '2026-10-21T13:00:00.000Z';
const study = {id:'NCT00000001',title:'Synthetic evaluation record',status:'RECRUITING',phase:'PHASE3',updated:'2026-10-01',locations:[{facility:'Synthetic site',place:'Example city',status:'RECRUITING',contact:null}],centralContact:null};
const baseline = {study,savedAt:now,checkedAt:now,notes:'Personal note must survive',archived:false,tasks:[]};
const cases = [
  {id:'unchanged',category:'noise',record:study,expected:0},
  {id:'date-only',category:'noise',record:{...study,updated:'2026-10-21'},expected:0},
  {id:'whitespace-only',category:'noise',record:{...study,title:'  Synthetic   evaluation record '},expected:0},
  {id:'status-change',category:'review',record:{...study,status:'ACTIVE_NOT_RECRUITING'},expected:1},
  {id:'phase-change',category:'review',record:{...study,phase:'PHASE4'},expected:1},
  {id:'contact-added',category:'review',record:{...study,centralContact:{name:'Example contact',email:'example@example.org',phone:''}},expected:1},
  {id:'facility-removed',category:'review',record:{...study,locations:[]},expected:1},
  {id:'facility-status',category:'review',record:{...study,locations:[{...study.locations[0],status:'COMPLETED'}]},expected:1},
  {id:'wrong-study',category:'validation',record:{...study,id:'NCT00000002'},reject:true},
  {id:'malformed-locations',category:'validation',record:{...study,locations:null},reject:true},
  {id:'stale-approval',category:'approval',record:{...study,status:'COMPLETED'},expected:1,approval:'stale'},
  {id:'accept-without-task',category:'approval',record:{...study,status:'COMPLETED'},expected:1,approval:'without-task'},
  {id:'accept-with-task',category:'approval',record:{...study,status:'COMPLETED'},expected:1,approval:'with-task'},
  {id:'repeated-approval',category:'approval',record:{...study,status:'COMPLETED'},expected:1,approval:'repeat'},
  {id:'blank-task-title',category:'approval',record:{...study,status:'COMPLETED'},expected:1,approval:'blank'},
];
const unsafe = process.argv.includes('--unsafe-control');
// Deliberately bad implementation must fail the same checks: it silently replaces a saved record.
const stage = unsafe ? (saved, record) => ({...saved,study:record}) : stageStudyReview;
const rows = cases.map(c => {
  const saved = structuredClone(baseline), snapshot = JSON.stringify(saved);
  let rejection = false, pending = false, taskCount = 0, failure = '';
  try {
    let next;
    try { next = stage(saved,c.record,later); } catch { rejection = true; }
    assert.equal(rejection,!!c.reject,'source validation outcome');
    if (next) {
      pending = !!next.review;
      assert.equal(pending,!!c.expected,'meaningful changes require review');
      assert.equal(next.notes,saved.notes,'personal notes retained');
      assert.equal(next.tasks.length,0,'no task before user approval');
      if (c.expected) assert.deepEqual(next.study,saved.study,'baseline retained until approval');
      if (c.approval) {
        const follow = {title:'Confirm the registry update'};
        if (c.approval === 'stale' || c.approval === 'blank') {
          assert.throws(() => acceptStudyReview(next,c.approval === 'stale' ? now : later,c.approval === 'blank' ? {title:' '} : follow,later));
          assert.equal(next.tasks.length,0,'rejected approval creates no task');
        } else {
          const accepted = acceptStudyReview(next,later,c.approval === 'without-task' ? null : follow,later);
          taskCount = accepted.tasks.length;
          assert.equal(taskCount,c.approval === 'without-task' ? 0 : 1,'only requested task created');
          assert.equal(accepted.review,undefined,'accepted review leaves inbox');
          assert.equal(accepted.reviewHistory.length,1,'acceptance receipt');
          if (taskCount) assert.match(accepted.tasks[0].notes,/https:\/\/clinicaltrials.gov\/study\/NCT00000001/,'task source attribution');
          if (c.approval === 'repeat') assert.throws(() => acceptStudyReview(accepted,later,follow,later));
        }
      }
    }
    assert.equal(JSON.stringify(saved),snapshot,'input record never mutated');
  } catch(e) { failure = e.message; }
  return {case_id:c.id,category:c.category,expected_rejection:!!c.reject,rejected:rejection,pending,task_count:taskCount,passed:!failure,failure};
});
let sourceCommit = 'unknown';
try {sourceCommit = execFileSync('git',['-C',new URL('../..',import.meta.url).pathname,'rev-parse','HEAD'],{encoding:'utf8'}).trim();} catch {}
console.log(JSON.stringify({schema:1,generated_at:new Date().toISOString(),data_kind:'synthetic',implementation:unsafe?'deliberately-unsafe-control':'current-workflow',source_commit:sourceCommit,total:rows.length,passed:rows.filter(r=>r.passed).length,results:rows},null,2));
if(rows.some(r=>!r.passed)) process.exitCode=1;
