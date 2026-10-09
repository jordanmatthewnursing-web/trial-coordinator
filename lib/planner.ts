import { z } from "zod";
export const PLANNER_KEY = "trial-coordinator-planner-v1";
const day = z
  .string()
  .refine(
    (v) =>
      v === "" ||
      (/^\d{4}-\d{2}-\d{2}$/.test(v) &&
        Number.isFinite(Date.parse(v + "T12:00:00Z")) &&
        new Date(v + "T12:00:00Z").toISOString().slice(0, 10) === v),
    "Use a valid date",
  );
export const taskSchema = z.object({
  id: z.string().min(1).max(100),
  title: z.string().trim().min(1).max(180),
  owner: z.string().max(100),
  due: day,
  notes: z.string().max(4000),
  done: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
const contact = z
  .object({
    name: z.string().max(500),
    phone: z.string().max(100),
    email: z.string().max(300),
  })
  .nullable();
export const plannerStudySchema = z.object({
  id: z.string().regex(/^NCT\d{8}$/),
  title: z.string().max(3000),
  status: z.string().max(100),
  phase: z.string().max(200),
  updated: z.string().max(100),
  locations: z
    .array(
      z.object({
        facility: z.string().max(2000),
        status: z.string().max(100),
        place: z.string().max(2000),
        contact,
      }),
    )
    .max(5000),
  centralContact: contact,
});
export const savedSchema = z
  .object({
    study: plannerStudySchema,
    savedAt: z.string().datetime(),
    checkedAt: z.string().datetime(),
    notes: z.string().max(6000),
    archived: z.boolean(),
    tasks: z.array(taskSchema).max(1000),
  })
  .superRefine((s, ctx) => {
    if (new Set(s.tasks.map((t) => t.id)).size !== s.tasks.length)
      ctx.addIssue({ code: "custom", message: "Duplicate task IDs" });
  });
export const plannerSchema = z
  .object({ version: z.literal(1), studies: z.array(savedSchema).max(100) })
  .superRefine((s, ctx) => {
    if (new Set(s.studies.map((x) => x.study.id)).size !== s.studies.length)
      ctx.addIssue({ code: "custom", message: "Duplicate study IDs" });
  });
export type PlanTask = z.infer<typeof taskSchema>;
export type SavedStudy = z.infer<typeof savedSchema>;
export type Planner = z.infer<typeof plannerSchema>;
export const emptyPlanner = (): Planner => ({ version: 1, studies: [] });
export function parsePlanner(text: string): Planner {
  if (text.length > 8_000_000) throw Error("Backup exceeds 8 MB.");
  return plannerSchema.parse(JSON.parse(text));
}
export function mergePlanner(current: Planner, incoming: Planner): Planner {
  const result: Planner = structuredClone(current);
  for (const entry of incoming.studies) {
    const present = result.studies.find((s) => s.study.id === entry.study.id);
    if (!present) {
      result.studies.push(entry);
      continue;
    }
    const ids = new Set(present.tasks.map((t) => t.id));
    present.tasks.push(...entry.tasks.filter((t) => !ids.has(t.id)));
  }
  return plannerSchema.parse(result);
}
export function localDay(now = new Date()) {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
export function overdue(task: PlanTask, today = localDay()) {
  return !task.done && !!task.due && task.due < today;
}
const escapeIcs = (s: string) =>
  s
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
function foldIcs(line: string) {
  const enc = new TextEncoder();
  let out = "",
    part = "",
    bytes = 0;
  for (const ch of line) {
    const size = enc.encode(ch).length;
    if (bytes + size > 73) {
      out += part + "\r\n ";
      part = "";
      bytes = 1;
    }
    part += ch;
    bytes += size;
  }
  return out + part;
}
export function calendar(studies: SavedStudy[], stamp = new Date()): string {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Trial Coordinator//Study Tasks//EN",
    "CALSCALE:GREGORIAN",
  ];
  for (const s of studies)
    for (const t of s.tasks.filter((t) => !t.done && t.due)) {
      const next = new Date(t.due + "T12:00:00Z");
      next.setUTCDate(next.getUTCDate() + 1);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${escapeIcs(s.study.id + "-" + t.id)}@trial-coordinator`,
        `DTSTAMP:${stamp
          .toISOString()
          .replace(/[-:]/g, "")
          .replace(/\.\d{3}/, "")}`,
        `DTSTART;VALUE=DATE:${t.due.replaceAll("-", "")}`,
        `DTEND;VALUE=DATE:${next.toISOString().slice(0, 10).replaceAll("-", "")}`,
        `SUMMARY:${escapeIcs(t.title)}`,
        `DESCRIPTION:${escapeIcs(s.study.id + " · " + s.study.title + "\nOwner: " + (t.owner || "Unassigned") + "\n" + t.notes)}`,
        `URL:https://clinicaltrials.gov/study/${s.study.id}`,
        "END:VEVENT",
      );
    }
  return lines.map(foldIcs).join("\r\n") + "\r\nEND:VCALENDAR\r\n";
}

export const plannerSearchSchema = z.object({
  studies: z.array(plannerStudySchema),
  nextPageToken: z.string().nullable().optional(),
});
