"use client";
import { useState } from 'react';
import type { SavedStudy } from '@/lib/planner';
import { studyChanges } from '@/lib/study-review';

export default function UpdatesInbox({ studies, selected, onSelect }: {
  studies: SavedStudy[];
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const pending = studies.filter(s => !s.archived && s.review)
    .sort((a, b) => a.review!.checkedAt.localeCompare(b.review!.checkedAt));
  return <section className="planner-updates" aria-label="Updates inbox">
    <div className="planner-updates-heading">
      <h2>Updates <span>{pending.length}</span></h2>
      <button type="button" aria-expanded={expanded} aria-controls="pending-study-updates" onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide' : 'Show'} updates</button>
    </div>
    {expanded && <div id="pending-study-updates">
      <p className="planner-small">{pending.length ? 'Review saved records before accepting changes. Oldest checks appear first.' : 'No updates waiting for review. Check a saved study for changes.'}</p>
      {pending.map(saved => {
        const review = saved.review!;
        const changes = studyChanges(saved.study, review.record);
        return <button type="button" className="planner-update-row" key={saved.study.id} aria-pressed={selected === saved.study.id} onClick={() => {
          onSelect(saved.study.id);
          requestAnimationFrame(() => document.querySelector<HTMLElement>('.planner-work')?.scrollIntoView({ behavior: 'instant', block: 'start' }));
        }}>
          <span className="planner-update-id">{saved.study.id}</span>
          <span><strong>{saved.study.title}</strong><small>{changes.slice(0, 3).map(c => c.field).join(' · ')}{changes.length > 3 ? ` · +${changes.length - 3} more` : ''}</small></span>
          <span className="planner-update-action">Review {changes.length} {changes.length === 1 ? 'change' : 'changes'} →</span>
        </button>;
      })}
      {pending.length > 0 && <p className="planner-small">Checks run when you request them. This inbox does not monitor the registry in the background.</p>}
    </div>}
  </section>;
}
