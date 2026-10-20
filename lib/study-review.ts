import { savedSchema, plannerStudySchema, type SavedStudy } from './planner.ts';

type Study = SavedStudy['study'];
export type StudyChange = { field: string; before: string; after: string };
const tidy = (value: string) => value.trim().replace(/\s+/g, ' ');
const contactText = (value: Study['centralContact']) =>
  value ? [value.name, value.email, value.phone].map(tidy).filter(Boolean).join(' · ') : '';
const locationText = (value: Study['locations'][number]) =>
  [tidy(value.status), contactText(value.contact)].filter(Boolean).join(' · ') || 'Details not listed';
const locationKey = (value: Study['locations'][number]) => JSON.stringify([tidy(value.facility), tidy(value.place)]);
function groupedLocations(study: Study) {
  const groups = new Map<string, string[]>();
  for (const location of study.locations) {
    const key = locationKey(location);
    groups.set(key, [...(groups.get(key) || []), locationText(location)]);
  }
  return new Map([...groups].map(([key, values]) => [key, values.sort().join('\n')]));
}
export function studyChanges(before: Study, after: Study): StudyChange[] {
  if (before.id !== after.id) throw Error('The registry returned another study.');
  const changes: StudyChange[] = [];
  const add = (field: string, a: string, b: string) => {
    if (tidy(a) !== tidy(b)) changes.push({ field, before: a || 'Not listed', after: b || 'Not listed' });
  };
  add('Overall status', before.status, after.status);
  add('Study title', before.title, after.title);
  add('Phase', before.phase, after.phase);
  add('Central contact', contactText(before.centralContact), contactText(after.centralContact));
  const oldLocations = groupedLocations(before), newLocations = groupedLocations(after);
  for (const key of [...new Set([...oldLocations.keys(), ...newLocations.keys()])].sort()) {
    const [facility, place] = JSON.parse(key) as string[];
    add([facility || 'Unnamed facility', place].filter(Boolean).join(' · '),
      oldLocations.get(key) || 'Not in saved record', newLocations.get(key) || 'Not in latest record');
  }
  return changes;
}
export function stageStudyReview(current: SavedStudy, record: unknown, checkedAt: string): SavedStudy {
  const next = plannerStudySchema.parse(record);
  const changes = studyChanges(current.study, next);
  return savedSchema.parse(changes.length
    ? { ...current, checkedAt, review: { record: next, checkedAt } }
    : { ...current, study: next, checkedAt, review: undefined });
}
export function acceptStudyReview(current: SavedStudy, expectedCheck: string,
  followUp: { title: string } | null, reviewedAt: string): SavedStudy {
  const review = current.review;
  if (!review || review.checkedAt !== expectedCheck) throw Error('This review has changed. Open the latest update before accepting it.');
  const changes = studyChanges(current.study, review.record);
  if (!changes.length) throw Error('There are no changes left to review.');
  const id = 'registry-review-' + expectedCheck;
  const summary = changes.map(change => change.field).join('; ').slice(0, 2000);
  const tasks = [...current.tasks];
  if (followUp && !tasks.some(task => task.id === id)) {
    tasks.push({ id, title: followUp.title, owner: '', due: '', done: false,
      createdAt: reviewedAt, updatedAt: reviewedAt,
      notes: (`Registry changes reviewed: ${summary}\nChecked: ${review.checkedAt}\nSource: https://clinicaltrials.gov/study/${current.study.id}\n\n` +
        changes.map(change => `${change.field}\nSaved: ${change.before}\nLatest: ${change.after}`).join('\n\n')).slice(0, 4000) });
  }
  return savedSchema.parse({ ...current, study: review.record, review: undefined, tasks,
    reviewHistory: [...(current.reviewHistory || []), {
      checkedAt: review.checkedAt, reviewedAt, summary,
      ...(followUp ? { taskId: id } : {}),
    }].slice(-20) });
}
