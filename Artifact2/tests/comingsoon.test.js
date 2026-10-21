import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MILESTONES, milestoneIndex, milestoneLabel, comingSoonText, isAvailable, CURRENT_MILESTONE } from '../src/ui/comingsoon.js';

// M2b was built in two phases ('2b-1', then '2b'); with M2b finished the
// phase id is gone (Session 4), so these expectations moved with it.
test('milestones are ordered 1, 2a, 2b, 3 … 11', () => {
  assert.deepEqual(MILESTONES.slice(0, 4), ['1', '2a', '2b', '3']);
  assert.equal(MILESTONES.at(-1), '11');
  assert.ok(milestoneIndex('2a') < milestoneIndex('2b'));
  assert.ok(milestoneIndex('2b') < milestoneIndex(3));
  assert.equal(milestoneIndex(2), -1, 'bare 2 is not a milestone');
  assert.equal(milestoneIndex('2b-1'), -1, 'the M2b phase id is removed');
});

// Moved with the milestone (Session 6: M4b current; Session 8: M5 current,
// M6 not yet).
test('M5 is available; M6 is not yet', () => {
  assert.equal(CURRENT_MILESTONE, '5');
  assert.ok(milestoneIndex(4) < milestoneIndex('4b') && milestoneIndex('4b') < milestoneIndex(5));
  assert.ok(isAvailable('2b'));
  assert.ok(isAvailable(3)); // restored in Session 7 (dropped in the rushed M4b edit)
  assert.ok(isAvailable(4));
  assert.ok(isAvailable('4b'));
  assert.ok(isAvailable(5));
  assert.ok(!isAvailable(6));
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
