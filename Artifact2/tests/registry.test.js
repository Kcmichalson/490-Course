import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, MODES, modesInCategory } from '../src/render/modes.js';
import { OVERLAYS, OVERLAY_GROUPS } from '../src/render/overlays.js';
import { TOOLS } from '../src/ui/tools.js';
import { CATEGORY_KEYS, MODE_KEYS, KEYS, shouldIgnoreHotkey, isTypingTarget } from '../src/ui/shortcuts.js';

const milestoneOk = (m) => Number.isInteger(m) && m >= 1 && m <= 11;

test('29 map modes in 5 categories with unique ids', () => {
  assert.equal(CATEGORIES.length, 5);
  assert.equal(MODES.length, 29);
  assert.equal(new Set(MODES.map((m) => m.id)).size, MODES.length);
  const catIds = new Set(CATEGORIES.map((c) => c.id));
  for (const m of MODES) {
    assert.ok(catIds.has(m.category), `${m.id} has unknown category ${m.category}`);
    assert.ok(milestoneOk(m.milestone), `${m.id} milestone ${m.milestone}`);
    assert.ok(m.label && m.icon, `${m.id} needs a label and icon`);
  }
});

test('every category fits the Q–U mode keys', () => {
  assert.equal(CATEGORY_KEYS.length, CATEGORIES.length);
  for (const c of CATEGORIES) {
    const n = modesInCategory(c.id).length;
    assert.ok(n >= 1 && n <= MODE_KEYS.length, `${c.id} has ${n} modes`);
  }
});

test('hotkeys do not collide', () => {
  const all = [
    ...CATEGORY_KEYS, ...MODE_KEYS, KEYS.fit, ...KEYS.zoomIn, ...KEYS.zoomOut, KEYS.goTo, KEYS.shortcuts,
  ];
  assert.equal(new Set(all).size, all.length, `duplicate in ${all.join(' ')}`);
});

test('overlays: unique ids, known groups, valid milestones, only M1 ones on by default', () => {
  assert.equal(new Set(OVERLAYS.map((o) => o.id)).size, OVERLAYS.length);
  const groups = new Set(OVERLAY_GROUPS.map((g) => g.id));
  for (const o of OVERLAYS) {
    assert.ok(groups.has(o.group), `${o.id} group`);
    assert.ok(milestoneOk(o.milestone), `${o.id} milestone`);
    if (o.defaultOn) assert.equal(o.milestone, 1, `${o.id} can't default on before it exists`);
  }
});

test('tools: Navigate is available in M1, the rest later', () => {
  assert.equal(TOOLS[0].id, 'navigate');
  assert.equal(TOOLS[0].milestone, 1);
  for (const t of TOOLS) {
    assert.ok(milestoneOk(t.milestone));
    for (const c of t.children ?? []) assert.ok(milestoneOk(c.milestone));
  }
});

test('hotkey guard: silent while typing or while a dialog is open', () => {
  const el = (tagName, type, extra = {}) => ({ tagName, type, ...extra });
  // Typing targets
  for (const t of [el('INPUT', 'text'), el('INPUT', 'number'), el('INPUT', 'search'), el('INPUT', undefined),
    el('INPUT', 'range'), el('TEXTAREA'), el('SELECT'), el('DIV', undefined, { isContentEditable: true })]) {
    assert.ok(isTypingTarget(t), `${t.tagName}/${t.type} is a typing target`);
    assert.ok(shouldIgnoreHotkey({ target: t }), `${t.tagName}/${t.type} blocks hotkeys`);
  }
  // Not typing targets
  for (const t of [el('BUTTON'), el('INPUT', 'checkbox'), el('INPUT', 'radio'), el('CANVAS'), el('BODY'), null]) {
    assert.ok(!shouldIgnoreHotkey({ target: t }), `${t?.tagName} allows hotkeys`);
  }
  assert.ok(shouldIgnoreHotkey({ target: el('BODY'), dialogOpen: true }), 'dialog open blocks hotkeys');
  assert.ok(shouldIgnoreHotkey({ target: el('BODY'), ctrlKey: true }), 'Ctrl combos are not hotkeys');
});
