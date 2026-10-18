import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, milestoneIndex, milestoneLabel, comingSoonText, isAvailable, CURRENT_MILESTONE } from '../src/ui/comingsoon.js';

test('milestones are ordered 1, 2a, 2b, 3 … 11', () => {
  assert.deepEqual(MILESTONES.slice(0, 4), ['1', '2a', '2b', '3']);
  assert.equal(MILESTONES.at(-1), '11');
  assert.ok(milestoneIndex('2a') < milestoneIndex('2b'));
  assert.ok(milestoneIndex('2b') < milestoneIndex(3));
  assert.equal(milestoneIndex(2), -1, 'bare 2 is not a milestone');
});

test('labels read M2a / M2b / M9', () => {
  assert.equal(milestoneLabel('2a'), 'M2a');
  assert.equal(milestoneLabel('2b'), 'M2b');
  assert.equal(milestoneLabel(9), 'M9');
  assert.equal(comingSoonText('2b'), 'Coming in M2b');
});

test('availability follows the current milestone; unknown ids are unavailable', () => {
  assert.ok(isAvailable(CURRENT_MILESTONE));
  assert.ok(isAvailable(1));
  assert.ok(!isAvailable(11));
  assert.ok(!isAvailable('nope'));
  assert.ok(!isAvailable(2));
});
