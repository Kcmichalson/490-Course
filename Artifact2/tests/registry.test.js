import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, MODES, modesInCategory } from '../src/render/modes.js';
import { OVERLAYS, OVERLAY_GROUPS } from '../src/render/overlays.js';
import { TOOLS } from '../src/ui/tools.js';
import { CATEGORY_KEYS, MODE_KEYS, KEYS, shouldIgnoreHotkey, isTypingTarget, undoAction, isReloadKey } from '../src/ui/shortcuts.js';
import { MILESTONES, isAvailable } from '../src/ui/comingsoon.js';

// Valid ids come from the ordered list; a bare 2 is not allowed (M2 is split into 2a/2b).
const milestoneOk = (m) => MILESTONES.includes(String(m)) && String(m) !== '2';

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
    if (o.defaultOn) assert.ok(isAvailable(o.milestone), `${o.id} can't default on before it exists`);
  }
});

test('tools: Navigate is available in M1, the rest later', () => {
  assert.equal(TOOLS[0].id, 'navigate');
  assert.ok(isAvailable(TOOLS[0].milestone));
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

test('reload is Ctrl+Shift+R (by physical key); plain Shift+R is not reload', () => {
  assert.ok(isReloadKey({ ctrlKey: true, shiftKey: true, code: 'KeyR' }));
  assert.ok(!isReloadKey({ shiftKey: true, code: 'KeyR' }), 'Shift+R alone no longer reloads');
  assert.ok(!isReloadKey({ ctrlKey: true, code: 'KeyR' }), 'Ctrl+R stays the browser reload');
  assert.ok(!isReloadKey({ ctrlKey: true, shiftKey: true, altKey: true, code: 'KeyR' }));
  const body = { tagName: 'BODY' };
  assert.ok(!shouldIgnoreHotkey({ target: body, ctrlKey: true, shiftKey: true, code: 'KeyR' }));
  assert.ok(shouldIgnoreHotkey({ target: body, ctrlKey: true, shiftKey: true, code: 'KeyT' }), 'other Ctrl+Shift combos are ignored');
  assert.ok(shouldIgnoreHotkey({ target: { tagName: 'INPUT', type: 'text' }, ctrlKey: true, shiftKey: true, code: 'KeyR' }));
});

test('undo keys: Ctrl+Z undoes, Ctrl+Y and Ctrl+Shift+Z redo; never while typing or in a dialog', () => {
  const body = { tagName: 'BODY' };
  assert.equal(undoAction({ key: 'z', ctrlKey: true, target: body }), 'undo');
  assert.equal(undoAction({ key: 'Z', ctrlKey: true, shiftKey: true, target: body }), 'redo');
  assert.equal(undoAction({ key: 'y', ctrlKey: true, target: body }), 'redo');
  assert.equal(undoAction({ key: 'z', metaKey: true, target: body }), 'undo');
  assert.equal(undoAction({ key: 'z', target: body }), null, 'plain Z is not undo');
  assert.equal(undoAction({ key: 'z', ctrlKey: true, target: { tagName: 'INPUT', type: 'number' } }), null, 'typing undo belongs to the field');
  assert.equal(undoAction({ key: 'z', ctrlKey: true, target: body, dialogOpen: true }), null);
});

test('sea caves are not in the registries; Sculpt and Undo are live; Tool Palette is M11', async () => {
  const ids = (list) => list.flatMap((t) => [t.id, ...(t.children ?? []).map((c) => c.id)]);
  for (const id of ['cave', 'cave-prone-rock']) assert.ok(!ids(TOOLS).includes(id), `${id} removed`);
  assert.ok(!OVERLAYS.some((o) => o.id === 'sea-caves'));
  const sculpt = TOOLS.find((t) => t.id === 'sculpt');
  assert.deepEqual(sculpt.children.map((c) => c.id), ['draw-land', 'raise', 'lower', 'carve-trench', 'smooth', 'erase']);
  assert.ok(isAvailable(sculpt.milestone) && sculpt.children.every((c) => isAvailable(c.milestone)));
  const { readFile } = await import('node:fs/promises');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /label: 'Tool Palette', milestone: 11/);
  assert.match(main, /shortcut: 'Ctrl\+Z', milestone: '2b'/, 'Edit > Undo is live');
});

// Until Session 4 this checked that M2b phase 2 was still locked; M2b is
// now finished, so the same items must be live.
test('M2b is complete: Slope, Distance from Coast, Shaded Relief, and Art Image are live; Art Check stays M6', async () => {
  const { RENDERERS } = await import('../src/render/modes/index.js');
  for (const id of ['slope', 'coast-distance']) {
    assert.ok(isAvailable(MODES.find((m) => m.id === id).milestone), id);
    assert.ok(RENDERERS[id], `${id} has a renderer`);
  }
  assert.ok(isAvailable(OVERLAYS.find((o) => o.id === 'shaded-relief').milestone));
  assert.equal(MODES.find((m) => m.id === 'art-check').milestone, 6);
  assert.ok(!isAvailable(6));
  const { readFile } = await import('node:fs/promises');
  const main = await readFile(new URL('../src/main.js', import.meta.url), 'utf8');
  assert.match(main, /label: 'Art Image…', milestone: '2b'/);
});

// M3 (Session 5): the wind mode and overlays are live. Until Session 6 this
// also checked that Temperature stayed locked; that check moved to the M4
// test below, which now expects the M4 items live.
test('M3 is live: Wind Speed & Pressure, Wind Arrows (with band labels), Pressure & ITCZ', async () => {
  const { RENDERERS } = await import('../src/render/modes/index.js');
  const wind = MODES.find((m) => m.id === 'wind-pressure');
  assert.ok(isAvailable(wind.milestone) && RENDERERS['wind-pressure'], 'wind mode has a renderer');
  assert.equal(typeof RENDERERS['wind-pressure'].drawScreen, 'function', 'belt lines drawn in screen space');
  for (const id of ['wind-arrows', 'wind-band-labels', 'pressure-itcz']) {
    assert.ok(isAvailable(OVERLAYS.find((o) => o.id === id).milestone), id);
  }
  const labels = OVERLAYS.find((o) => o.id === 'wind-band-labels');
  assert.equal(labels.parent, 'wind-arrows');
  assert.equal(OVERLAYS.findIndex((o) => o.id === 'wind-band-labels'), OVERLAYS.findIndex((o) => o.id === 'wind-arrows') + 1, 'listed right under its parent');
  const { readFile } = await import('node:fs/promises');
  const toolbar = await readFile(new URL('../src/ui/toolbar.js', import.meta.url), 'utf8');
  assert.match(toolbar, /applyComingSoon\(play, 11, 'Season playback'\)/, 'play button stays M11');
});

// M4 (Session 6): the five temperature modes and Climate Boundaries are live,
// each mode with a renderer and legend; M5 items stay locked.
test('M4 is live: the five temperature modes and Climate Boundaries; Precipitation stays M5', async () => {
  const { RENDERERS } = await import('../src/render/modes/index.js');
  for (const id of ['temperature', 'temp-range', 'growing-season', 'frost', 'winter-severity']) {
    assert.ok(isAvailable(MODES.find((m) => m.id === id).milestone), id);
    assert.ok(RENDERERS[id]?.legend, `${id} has a renderer and legend`);
  }
  assert.ok(isAvailable(OVERLAYS.find((o) => o.id === 'climate-boundaries').milestone));
  assert.ok(!isAvailable(MODES.find((m) => m.id === 'precipitation').milestone));
});
