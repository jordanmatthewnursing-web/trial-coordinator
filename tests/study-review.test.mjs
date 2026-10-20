import test from 'node:test';
import assert from 'node:assert/strict';
import { studyChanges, stageStudyReview, acceptStudyReview } from '../lib/study-review.ts';
import { parsePlanner } from '../lib/planner.ts';
const now='2026-10-20T12:00:00.000Z', later='2026-10-20T13:00:00.000Z';
const study={id:'NCT05420051',title:'Test fixture - not a registry claim',status:'RECRUITING',phase:'PHASE3',updated:'2026-10-01',locations:[{facility:'Test facility',place:'Test city',status:'RECRUITING',contact:null}],centralContact:null};
const saved={study,savedAt:now,checkedAt:now,notes:'Keep my notes',archived:false,tasks:[]};
const changed={...study,status:'ACTIVE_NOT_RECRUITING'};
test('old backups remain valid without review fields',()=>assert.deepEqual(parsePlanner(JSON.stringify({version:1,studies:[saved]})).studies[0],saved));
test('metadata dates and facility order alone do not create work',()=>{
 const before={...study,locations:[...study.locations,{...study.locations[0],facility:'Another'}]};
 assert.deepEqual(studyChanges(before,{...before,updated:'2026-10-20',locations:[...before.locations].reverse()}),[]);
});
test('staging preserves baseline, notes and tasks, and survives export/reload',()=>{
 const next=stageStudyReview(saved,changed,later);
 assert.equal(next.study.status,'RECRUITING');assert.equal(next.notes,saved.notes);assert.equal(next.tasks.length,0);
 assert.equal(parsePlanner(JSON.stringify({version:1,studies:[next]})).studies[0].review.record.status,changed.status);
 assert.equal(saved.review,undefined);
});
test('facility recruitment and public contact changes are visible',()=>{
 const next={...study,locations:[{...study.locations[0],status:'COMPLETED',contact:{name:'Test contact',email:'test@example.org',phone:''}}]};
 const [diff]=studyChanges(study,next);assert.match(diff.field,/Test facility/);assert.match(diff.after,/COMPLETED.*test@example.org/);
});
test('approval updates baseline without automatically creating a task',()=>{
 const next=acceptStudyReview(stageStudyReview(saved,changed,later),later,null,later);
 assert.equal(next.study.status,changed.status);assert.equal(next.tasks.length,0);assert.equal(next.review,undefined);assert.equal(next.reviewHistory.length,1);
});
test('approved follow-up has provenance and repeated approval cannot duplicate it',()=>{
 const pending=stageStudyReview(saved,changed,later);
 const next=acceptStudyReview(pending,later,{title:'Check with the listed facility'},later);
 assert.equal(next.tasks.length,1);assert.match(next.tasks[0].notes,/clinicaltrials.gov/);assert.match(next.tasks[0].notes,/RECRUITING/);
 assert.throws(()=>acceptStudyReview(next,later,{title:'Duplicate'},later));
});
test('stale approval and invalid follow-up leave original data unchanged',()=>{
 const pending=stageStudyReview(saved,changed,later);
 assert.throws(()=>acceptStudyReview(pending,now,null,later));
 assert.throws(()=>acceptStudyReview(pending,later,{title:'  '},later));assert.equal(pending.tasks.length,0);
});
test('wrong-study and malformed records are rejected before mutation',()=>{
 assert.throws(()=>stageStudyReview(saved,{...changed,id:'NCT99999999'},later));
 assert.throws(()=>stageStudyReview(saved,{...changed,locations:null},later));
 assert.equal(saved.study.status,'RECRUITING');
});
test('a reverted source clears pending review and preserves personal data',()=>{
 const pending=stageStudyReview(saved,changed,later);const reverted=stageStudyReview(pending,study,later);
 assert.equal(reverted.review,undefined);assert.equal(reverted.notes,saved.notes);
});
test('review history stays bounded while existing tasks remain intact',()=>{
 const history=Array.from({length:20},(_,i)=>({checkedAt:now,reviewedAt:now,summary:String(i)}));
 const next=acceptStudyReview(stageStudyReview({...saved,reviewHistory:history},changed,later),later,null,later);
 assert.equal(next.reviewHistory.length,20);assert.equal(next.reviewHistory[0].summary,'1');
});
