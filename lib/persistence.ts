import { z } from "zod";
import { parseCriteria } from "./criteria.ts";
import { isStudySnapshot, type StudySnapshot } from "./snapshot.ts";
import type { DemoCase } from "./workspace.ts";
const timestamp = z.string().datetime({ offset: true }).nullable().optional();
const facility = z.object({ facility: z.string(), place: z.string() }).nullable().optional();
const snapshot = z.custom<StudySnapshot | null>(value => value === null || isStudySnapshot(value)).optional();
const mark = z.object({
  status: z.enum(["unreviewed", "appears_met", "possible_mismatch", "follow_up"]),
  evidence: z.enum(["none", "referral", "candidate", "record"]),
  reviewedAt: z.string().datetime({ offset: true }).optional(),
  followUp: z.object({
    question: z.enum(["candidate_fact", "criterion_wording", "local_protocol"]),
    owner: z.enum(["coordinator", "study_team", "investigator"]),
    dueDate: z.string().refine(value => value === "" || (/^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value)),
    answer: z.enum(["pending", "supports", "conflicts", "unclear"]),
  }).optional(),
});
const marks = z.record(z.string().regex(/^(0|[1-9]\d*)$/), mark);
const caseSchema = z.object({
  id: z.string(),
  age: z.number().int().nonnegative(),
  sex: z.enum(["FEMALE", "MALE"]),
  marks,
  nextAction: z.enum(["Complete preliminary review", "Confirm open questions", "Request missing information", "Confirm with study team", "Discuss with investigator", "Prepare handoff"]),
  savedAt: timestamp,
  sourcePostedAt: z.string().nullable().optional(),
  snapshot,
  selectedFacility: facility,
  archived: z.array(z.object({snapshot, selectedFacility: facility, marks, savedAt: timestamp})).optional(),
});
/** Reject invalid reviews as a whole: dropping a mark can hide an unresolved concern. */
export function restoreCases(value: unknown, seeds: DemoCase[], studyId?: string): DemoCase[] {
  const parsed = z.array(caseSchema).parse(value);
  if (new Set(parsed.map(item => item.id)).size !== parsed.length || parsed.some(item => !seeds.some(seed => seed.id === item.id))) {
    throw Error("Unknown or duplicate case identity");
  }
  for (const item of parsed) {
    for (const review of [item, ...(item.archived ?? [])]) {
      if (!review.snapshot) continue;
      if (studyId && review.snapshot.id !== studyId) throw Error("Review belongs to another study");
      const count = parseCriteria(review.snapshot.criteria).length;
      if (Object.keys(review.marks).some(key => Number(key) >= count)) throw Error("Observation has no source criterion");
    }
  }
  return seeds.map(seed => {
    const saved = parsed.find(item => item.id === seed.id);
    if (!saved) return structuredClone(seed);
    if (saved.age !== seed.age || saved.sex !== seed.sex) throw Error("Unexpected synthetic profile");
    return { ...seed, ...saved, savedAt: saved.savedAt ?? null, sourcePostedAt: saved.sourcePostedAt ?? null,
      snapshot: saved.snapshot ?? null,
      archived: (saved.archived ?? []).map(item => ({...item, snapshot: item.snapshot ?? null, savedAt: item.savedAt ?? null})),
    } as DemoCase;
  });
}
export function restoreWorkspace(raw: string, seeds: DemoCase[]) {
  const saved = z.object({studyId:z.string().regex(/^NCT\d{8}$/),siteIndex:z.number().int().nonnegative(),cases:z.unknown()}).parse(JSON.parse(raw));
  return {...saved,cases:restoreCases(saved.cases,seeds,saved.studyId)};
}
