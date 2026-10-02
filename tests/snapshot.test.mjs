import test from "node:test";
import assert from "node:assert/strict";
import {
  diffStudySnapshots,
  isStudySnapshot,
  snapshotStudy,
} from "../lib/snapshot.ts";

const base = {
  id: "NCT12345678",
  title: "Example",
  status: "RECRUITING",
  phase: "PHASE3",
  conditions: ["Type 2 diabetes"],
  minAge: "18 Years",
  maxAge: "70 Years",
  sex: "ALL",
  criteria: "Inclusion Criteria:\n- Type 2 diabetes",
  updated: "2026-01-01",
  centralContact: null,
  locations: [
    {
      facility: "Site A",
      place: "Boston, United States",
      status: "RECRUITING",
      contact: null,
    },
  ],
};

test("snapshot is detached from a later in-memory study mutation", () => {
  const source = structuredClone(base);
  const captured = snapshotStudy(source);
  source.locations[0].status = "SUSPENDED";
  source.conditions.push("Other");
  assert.equal(captured.locations[0].status, "RECRUITING");
  assert.deepEqual(captured.conditions, ["Type 2 diabetes"]);
});

test("rejects incomplete saved snapshots before comparing them", () => {
  assert.equal(isStudySnapshot({ id: "NCT12345678", locations: [] }), false);
  assert.equal(isStudySnapshot(snapshotStudy(base)), true);
});

test("detects eligibility and facility changes independently of posted date", () => {
  const next = structuredClone(base);
  next.criteria = "Inclusion Criteria:\n- Type 2 diabetes for 6 months";
  next.locations[0].status = "NOT_YET_RECRUITING";
  next.updated = "2026-02-01";
  const changes = diffStudySnapshots(snapshotStudy(base), snapshotStudy(next));
  assert.deepEqual(
    changes.map((item) => item.key),
    ["criteria", "site-status:site a|boston, united states#1"],
  );
  assert.equal(
    changes.every((item) => item.priority === "review"),
    true,
  );
});

test("reports a posted date alone as context and preserves duplicate facilities", () => {
  const next = structuredClone(base);
  next.updated = "2026-02-01";
  assert.deepEqual(
    diffStudySnapshots(snapshotStudy(base), snapshotStudy(next)).map(
      (item) => item.key,
    ),
    ["posted"],
  );
  const duplicate = structuredClone(base);
  duplicate.locations.push({ ...duplicate.locations[0], status: "SUSPENDED" });
  assert.deepEqual(
    diffStudySnapshots(snapshotStudy(base), snapshotStudy(duplicate)).map(
      (item) => item.key,
    ),
    ["site:site a|boston, united states#2"],
  );
});
