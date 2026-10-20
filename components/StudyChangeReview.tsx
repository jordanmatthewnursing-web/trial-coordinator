"use client";
import { useState } from 'react';
import { studyChanges } from '@/lib/study-review';
import type { SavedStudy } from '@/lib/planner';

export default function StudyChangeReview({ saved, disabled, onAccept }: {
  saved: SavedStudy; disabled: boolean; onAccept: (checkedAt: string, title: string | null) => void;
}) {
  const [addTask, setAddTask] = useState(false);
  const [title, setTitle] = useState(`Review registry changes for ${saved.study.id}`);
  if (!saved.review) return null;
  const changes = studyChanges(saved.study, saved.review.record);
  const checkedAt = saved.review.checkedAt;
  return <section className="study-review" aria-labelledby="study-review-title">
    <div className="study-review-heading">
      <div><p className="planner-kicker">Registry update · Awaiting your review</p>
        <h3 id="study-review-title">What changed</h3></div>
      <span>{changes.length} {changes.length === 1 ? 'change' : 'changes'}</span>
    </div>
    <p className="planner-small">Compared with your saved record. Checked {new Date(checkedAt).toLocaleString()}.
      {' '}<a href={`https://clinicaltrials.gov/study/${saved.study.id}`} target="_blank" rel="noreferrer">Verify at ClinicalTrials.gov ↗</a></p>
    <div className="study-review-columns" aria-hidden="true"><span>Field</span><span>Saved</span><span>Latest</span></div>
    {changes.slice(0, 20).map((change, i) => <dl className="study-review-row" key={i}>
      <dt>{change.field}</dt>
      <dd><span className="study-review-mobile-label">Saved</span>{change.before.replaceAll('_', ' ')}</dd>
      <dd><span className="study-review-mobile-label">Latest</span>{change.after.replaceAll('_', ' ')}</dd>
    </dl>)}
    {changes.length > 20 && <p className="planner-small">Showing 20 of {changes.length} changed fields. Review all facility details in the source before accepting this update.</p>}
    <p className="planner-small">Your saved record stays in place until you accept this update. Recruitment status does not establish eligibility or a site's ability to enroll.</p>
    <form onSubmit={event => { event.preventDefault(); onAccept(checkedAt, addTask ? title : null); }}>
      <label className="study-review-option"><input type="checkbox" checked={addTask} disabled={disabled}
        onChange={event => setAddTask(event.target.checked)} />Add a follow-up task</label>
      {addTask && <label className="study-review-task">Task title<input value={title} maxLength={180} required disabled={disabled}
        onChange={event => setTitle(event.target.value)} /></label>}
      <button className="planner-primary" disabled={disabled}>{addTask ? 'Accept update & add task' : 'Accept update'}</button>
      <p className="planner-small">No messages are sent. Existing tasks and notes are retained.</p>
    </form>
  </section>;
}
