import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCriteria } from '../lib/criteria.ts';

test('keeps inclusion and exclusion criteria distinct in registry bullet text', () => {
  const text = 'Inclusion Criteria:\n\n* Adults age 18 or older\n* Confirmed diagnosis\n\nExclusion Criteria:\n\n- Active infection';
  assert.deepEqual(parseCriteria(text), [
    { group: 'Inclusion', text: 'Adults age 18 or older' },
    { group: 'Inclusion', text: 'Confirmed diagnosis' },
    { group: 'Exclusion', text: 'Active infection' },
  ]);
});

test('preserves inline headings and wrapped criterion text', () => {
  const text = 'Inclusion Criteria: Able to consent\nExclusion Criteria:\n1. Prior therapy\nwithin the last 30 days';
  assert.deepEqual(parseCriteria(text), [
    { group: 'Inclusion', text: 'Able to consent' },
    { group: 'Exclusion', text: 'Prior therapy within the last 30 days' },
  ]);
});

test('shows escaped registry punctuation as readable criterion text', () => {
  const text = 'Inclusion Criteria:\n- Activity \\<150 minutes/week\nExclusion Criteria:\n- PHQ-9 \\[score\\] ≥15';
  assert.deepEqual(parseCriteria(text), [
    { group: 'Inclusion', text: 'Activity <150 minutes/week' },
    { group: 'Exclusion', text: 'PHQ-9 [score] ≥15' },
  ]);
});
