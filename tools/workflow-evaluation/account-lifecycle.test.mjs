import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { readAccount, writeAccount } from '../../lib/account-store.ts';
import { parsePlanner } from '../../lib/planner.ts';
import { stageStudyReview, acceptStudyReview } from '../../lib/study-review.ts';

// Real project migration/queries; local SQLite adapter stands in for D1 statement binding.
// This does not exercise hosted identity, HTTP handlers, browser rendering or real devices.
function database() {
  const sql = new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../../drizzle/0000_fair_vampiro.sql', import.meta.url),'utf8'));
  return {sql,db:{prepare:query=>({bind:(...values)=>({first:async()=>sql.prepare(query).get(...values)??null})})}};
}
const at='2026-10-21T12:00:00.000Z',later='2026-10-21T13:00:00.000Z';
const study={id:'NCT00000001',title:'Synthetic account lifecycle fixture',status:'RECRUITING',phase:'PHASE3',updated:'2026-10-01',locations:[],centralContact:null};
const saved={study,savedAt:at,checkedAt:at,notes:'Retain this private note',archived:false,tasks:[]};
const document=s=>JSON.stringify({version:1,studies:[s]});
const changed={...study,status:'COMPLETED'};

test('pending review and approved task survive independent account reads',async()=>{
  const {sql,db}=database();
  try {
    const pending=stageStudyReview(saved,changed,later);
    const first=await writeAccount(db,'synthetic-user-a',document(pending),0);
    assert.equal(first.revision,1);
    const restored=parsePlanner((await readAccount(db,'synthetic-user-a')).body).studies[0];
    assert.equal(restored.study.status,'RECRUITING');
    assert.equal(restored.review.record.status,'COMPLETED');
    const accepted=acceptStudyReview(restored,later,{title:'Verify the source change'},later);
    const second=await writeAccount(db,'synthetic-user-a',document(accepted),1);
    assert.equal(second.revision,2);
    const final=parsePlanner((await readAccount(db,'synthetic-user-a')).body).studies[0];
    assert.equal(final.review,undefined);
    assert.equal(final.study.status,'COMPLETED');
    assert.equal(final.tasks.length,1);
    assert.equal(final.notes,saved.notes);
    assert.equal(final.reviewHistory[0].taskId,final.tasks[0].id);
    assert.match(final.tasks[0].notes,/clinicaltrials.gov/);
  } finally {sql.close();}
});

test('stale account draft cannot overwrite an accepted update; draft remains exportable',async()=>{
  const {sql,db}=database();
  try {
    const pending=stageStudyReview(saved,changed,later);
    await writeAccount(db,'synthetic-user-a',document(pending),0);
    const stale=await readAccount(db,'synthetic-user-a');
    const accepted=acceptStudyReview(pending,later,null,later);
    await writeAccount(db,'synthetic-user-a',document(accepted),stale.revision);
    const staleDraft=parsePlanner(stale.body);
    staleDraft.studies[0].notes='Unsaved note from another session';
    assert.equal(await writeAccount(db,'synthetic-user-a',JSON.stringify(staleDraft),stale.revision),null);
    const current=await readAccount(db,'synthetic-user-a');
    assert.equal(current.revision,2);
    assert.equal(parsePlanner(current.body).studies[0].review,undefined);
    assert.equal(parsePlanner(JSON.stringify(staleDraft)).studies[0].notes,'Unsaved note from another session');
    assert.equal(parsePlanner(current.body).studies[0].notes,saved.notes);
  } finally {sql.close();}
});

test('same public study in different account keys retains separate personal work',async()=>{
  const {sql,db}=database();
  try {
    await writeAccount(db,'synthetic-user-a',document(stageStudyReview(saved,changed,later)),0);
    assert.equal(await readAccount(db,'synthetic-user-b'),null);
    await writeAccount(db,'synthetic-user-b',document({...saved,notes:'Other account note'}),0);
    const a=parsePlanner((await readAccount(db,'synthetic-user-a')).body).studies[0];
    const b=parsePlanner((await readAccount(db,'synthetic-user-b')).body).studies[0];
    assert.ok(a.review);assert.equal(b.review,undefined);
    assert.equal(a.notes,saved.notes);assert.equal(b.notes,'Other account note');
  } finally {sql.close();}
});
