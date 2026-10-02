import test from "node:test";
import assert from "node:assert/strict";
import { archiveAndBeginReview, reviewSourceState, updateMark } from "../lib/workspace.ts";
import { snapshotStudy } from "../lib/snapshot.ts";

const source = snapshotStudy({
  id: "NCT12345678",
  title: "Example",
  status: "RECRUITING",
  phase: "PHASE3",
  conditions: [],
  minAge: "18 Years",
  maxAge: "",
  sex: "ALL",
  criteria: "Inclusion Criteria:\n- First criterion",
  updated: "2026-01-01",
  locations: [],
  centralContact: null,
});
const demo = {
  id: "DEMO–021",
  age: 52,
  sex: "FEMALE",
  marks: { 0: { status: "appears_met", evidence: "referral" } },
  nextAction: "Prepare handoff",
  savedAt: "2026-01-02T00:00:00Z",
  sourcePostedAt: source.updated,
  snapshot: source,
  archived: [],
};

test("a changed eligibility criterion pauses an old review", () => {
  const current = {
    ...source,
    criteria: "Inclusion Criteria:\n- Revised criterion",
    updated: "2026-01-03",
  };
  const state = reviewSourceState(demo, current);
  assert.equal(state.requiresRestart, true);
  assert.deepEqual(
    state.changes.map((change) => change.key),
    ["criteria"],
  );
});

test("starting on the new source archives marks and clears the active review", () => {
  const current = {
    ...source,
    criteria: "Inclusion Criteria:\n- Revised criterion",
    updated: "2026-01-03",
  };
  const restarted = archiveAndBeginReview(demo, current);
  assert.deepEqual(restarted.marks, {});
  assert.equal(restarted.archived[0].snapshot.criteria, source.criteria);
  assert.equal(restarted.archived[0].marks[0].status, "appears_met");
  assert.equal(reviewSourceState(restarted, current).requiresRestart, false);
  assert.equal(demo.marks[0].status, "appears_met");
});

test("older marks without a snapshot require a fresh review", () => {
  const state = reviewSourceState({ ...demo, snapshot: null }, source);
  assert.equal(state.legacy, true);
  assert.equal(state.requiresRestart, true);
});

test("criterion follow-up keeps its owner, answer, and history when the observation changes", () => {
  const opened = updateMark(undefined, { status: "follow_up" }, "2026-01-02T10:00:00Z");
  assert.deepEqual(opened.followUp, {
    question: "candidate_fact",
    owner: "coordinator",
    dueDate: "",
    answer: "pending",
  });
  const answered = updateMark(opened, {
    followUp: { question: "criterion_wording", owner: "investigator", dueDate: "2026-01-06", answer: "supports" },
  }, "2026-01-03T10:00:00Z");
  const reclassified = updateMark(answered, { status: "appears_met", evidence: "record" }, "2026-01-04T10:00:00Z");
  assert.equal(reclassified.followUp.answer, "supports");
  assert.equal(reclassified.followUp.owner, "investigator");
  assert.equal(reclassified.reviewedAt, "2026-01-04T10:00:00Z");
  assert.equal(reclassified.status, "appears_met");
  const restarted = archiveAndBeginReview({ ...demo, marks: { 0: reclassified } }, { ...source, criteria: "Revised" });
  assert.equal(restarted.archived[0].marks[0].followUp.answer, "supports");
  assert.deepEqual(restarted.marks, {});
});

test("changing the selected facility pauses handoff even with an unchanged source", () => {
  const first = { facility: "North Clinic", place: "Boston" };
  const second = { facility: "South Clinic", place: "Boston" };
  const bound = { ...demo, selectedFacility: first };
  assert.equal(reviewSourceState(bound, source, {...first}).requiresRestart, false);
  const changed = reviewSourceState(bound, source, second);
  assert.equal(changed.requiresRestart, true);
  assert.equal(changed.changes[0].key, "selectedFacility");
  const restarted = archiveAndBeginReview(bound, source, second);
  second.facility = "Mutated outside review";
  assert.equal(restarted.selectedFacility.facility, "South Clinic");
  assert.equal(restarted.archived[0].selectedFacility.facility, "North Clinic");
  assert.equal(restarted.archived[0].marks[0].status, "appears_met");
  assert.deepEqual(restarted.marks, {});
});

test("legacy facility is unknown, while an explicit absent facility is preserved", () => {
  assert.equal(reviewSourceState(demo, source, null).requiresRestart, true);
  assert.equal(reviewSourceState({...demo,selectedFacility:null}, source, null).requiresRestart, false);
  assert.equal(reviewSourceState({...demo,selectedFacility:null}, source, {facility:"New",place:"Boston"}).requiresRestart, true);
  assert.equal(reviewSourceState({...demo,marks:{},snapshot:null}, source, null).requiresRestart, false);
});
