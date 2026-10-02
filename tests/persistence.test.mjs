import test from 'node:test';
import assert from 'node:assert/strict';
import {restoreCases, restoreWorkspace} from '../lib/persistence.ts';
const seed = {id:'DEMO–021',age:52,sex:'FEMALE',marks:{},nextAction:'Complete preliminary review',savedAt:null,sourcePostedAt:null,snapshot:null,archived:[]};
const marked = {...seed,marks:{0:{status:'follow_up',evidence:'none',followUp:{question:'criterion_wording',owner:'investigator',dueDate:'2026-10-01',answer:'pending'}}}};
test('restores follow-up ownership and returns detached data',()=>{
 const result=restoreCases([marked],[seed]);
 assert.equal(result[0].marks[0].followUp.owner,'investigator');
 result[0].marks[0].followUp.owner='coordinator';
 assert.equal(marked.marks[0].followUp.owner,'investigator');
});
test('rejects the whole review instead of dropping invalid marks',()=>{
 for(const marks of [{0:null},{0:{status:'eligible',evidence:'record'}},{'-1':{status:'appears_met',evidence:'record'}},{0:{status:'appears_met',evidence:'invented'}}]) {
  assert.throws(()=>restoreCases([{...seed,marks}],[seed]));
 }
});
test('rejects malformed archives, contacts, and follow-up dates',()=>{
 assert.throws(()=>restoreCases([{...seed,archived:[null]}],[seed]));
 assert.throws(()=>restoreCases([{...seed,snapshot:{id:'NCT12345678'}}],[seed]));
 const invalid=structuredClone(marked); invalid.marks[0].followUp.dueDate='2026-02-30';
 assert.throws(()=>restoreCases([invalid],[seed]));
});
test('does not trust saved synthetic profiles or duplicate identities',()=>{
 assert.throws(()=>restoreCases([{...seed,age:99}],[seed]));
 assert.throws(()=>restoreCases([seed,seed],[seed]));
 assert.throws(()=>restoreWorkspace(JSON.stringify({studyId:'NCT12345678',siteIndex:0.5,cases:[seed]}),[seed]));
});
test('accepts older reviews without snapshots without inventing provenance',()=>{
 const {snapshot, archived, ...legacy}=marked;
 const result=restoreCases([legacy],[seed])[0];
 assert.equal(result.snapshot,null);
 assert.equal(result.selectedFacility,undefined);
 assert.equal(result.marks[0].status,'follow_up');
});
const snapshot={id:'NCT12345678',title:'Example',status:'RECRUITING',phase:'',conditions:[],minAge:'',maxAge:'',sex:'ALL',criteria:'Inclusion Criteria:\n- Example criterion',updated:'2026-01-01',locations:[],centralContact:null};
test('rejects observations outside their source and snapshots from another study',()=>{
 assert.throws(()=>restoreCases([{...marked,snapshot,marks:{8:marked.marks[0]}}],[seed]));
 assert.throws(()=>restoreCases([{...marked,snapshot}],[seed],'NCT87654321'));
 assert.equal(restoreCases([{...marked,snapshot}],[seed],'NCT12345678')[0].marks[0].status,'follow_up');
});
test('rejects malformed nested snapshot contacts',()=>{
 assert.throws(()=>restoreCases([{...marked,snapshot:{...snapshot,centralContact:{name:{bad:true},email:'',phone:''}}}],[seed]));
});
