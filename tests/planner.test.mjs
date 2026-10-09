import test from "node:test";
import assert from "node:assert/strict";
import {
  parsePlanner,
  mergePlanner,
  taskSchema,
  calendar,
  overdue,
} from "../lib/planner.ts";
const task = {
  id: "one",
  title: "Confirm facility status",
  owner: "Coordinator",
  due: "2026-12-31",
  notes: "Line one\nLine two, with; separators",
  done: false,
  createdAt: "2026-10-03T00:00:00.000Z",
  updatedAt: "2026-10-03T00:00:00.000Z",
};
const entry = {
  study: {
    id: "NCT05420051",
    title: "Public study",
    status: "RECRUITING",
    phase: "",
    updated: "2026-10-01",
    locations: [],
    centralContact: null,
  },
  savedAt: task.createdAt,
  checkedAt: task.createdAt,
  notes: "Keep existing note",
  archived: false,
  tasks: [task],
};
const plan = { version: 1, studies: [entry] };
test("backup round-trip preserves task and study notes", () =>
  assert.deepEqual(parsePlanner(JSON.stringify(plan)), plan));
test("restore merges missing tasks without clobbering matching tasks or notes", () => {
  const incoming = structuredClone(plan);
  incoming.studies[0].notes = "Older note";
  incoming.studies[0].tasks[0].title = "Older task";
  incoming.studies[0].tasks.push({ ...task, id: "two" });
  const result = mergePlanner(plan, incoming);
  assert.equal(result.studies[0].notes, "Keep existing note");
  assert.equal(result.studies[0].tasks[0].title, task.title);
  assert.equal(result.studies[0].tasks.length, 2);
  assert.equal(plan.studies[0].tasks.length, 1);
});
test("malformed backup and duplicate task IDs fail rather than partly importing", () => {
  const bad = structuredClone(plan);
  bad.studies[0].tasks.push(task);
  assert.throws(() => parsePlanner(JSON.stringify(bad)));
  assert.throws(() => parsePlanner("{oops"));
  assert.throws(() =>
    parsePlanner(JSON.stringify({ version: 2, studies: [] })),
  );
});
test("invalid dates and blank titles fail cleanly", () => {
  for (const due of ["2026-02-30", "2026-99-99", "tomorrow"])
    assert.equal(taskSchema.safeParse({ ...task, due }).success, false);
  assert.equal(taskSchema.safeParse({ ...task, title: "   " }).success, false);
});
test("due-today and completed tasks are not overdue", () => {
  assert.equal(overdue(task, "2026-12-31"), false);
  assert.equal(overdue(task, "2027-01-01"), true);
  assert.equal(overdue({ ...task, done: true }, "2027-01-01"), false);
});
test("calendar uses all-day dates, next-day end and escaped descriptions", () => {
  const text = calendar([entry], new Date("2026-10-03T00:00:00Z"));
  assert.match(text, /DTSTART;VALUE=DATE:20261231/);
  assert.match(text, /DTEND;VALUE=DATE:20270101/);
  assert.match(
    text.replace(/\r\n /g, ""),
    /Line one\\nLine two\\, with\\; separators/,
  );
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.ok(
    !calendar([{ ...entry, tasks: [{ ...task, done: true }] }]).includes(
      "BEGIN:VEVENT",
    ),
  );
});
test("calendar folds Unicode lines within RFC line byte limit", () => {
  const text = calendar([
    { ...entry, tasks: [{ ...task, title: "研究".repeat(50) }] },
  ]);
  for (const line of text.split("\r\n"))
    assert.ok(Buffer.byteLength(line) <= 75);
});
