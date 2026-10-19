// Tool registry (SPEC 13.2). Pure data; the toolbar dropdown and the Tools
// menu are both built from it.

export const TOOLS = [
  { id: 'navigate', label: 'Navigate', icon: 'tool-navigate', milestone: 1, hint: 'Drag to pan, click a tile to inspect it, scroll to zoom.' },
  {
    id: 'sculpt', label: 'Sculpt', icon: 'tool-sculpt', milestone: '2b-1',
    hint: 'Drag to paint. Space+drag or middle-drag pans.',
    children: [
      { id: 'draw-land', label: 'Draw Land', milestone: '2b-1' },
      { id: 'raise', label: 'Raise', milestone: '2b-1' },
      { id: 'lower', label: 'Lower', milestone: '2b-1' },
      { id: 'carve-trench', label: 'Carve Trench', milestone: '2b-1' },
      { id: 'smooth', label: 'Smooth', milestone: '2b-1' },
      { id: 'erase', label: 'Erase to Ocean', milestone: '2b-1' },
    ],
  },
  { id: 'route', label: 'Route tool', icon: 'tool-route', milestone: 10 },
];

export const DEFAULT_BRUSH_ID = 'draw-land';

export function getBrush(id) {
  const sculpt = TOOLS.find((t) => t.id === 'sculpt');
  return sculpt.children.find((c) => c.id === id) ?? sculpt.children[0];
}

export const DEFAULT_TOOL_ID = 'navigate';

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0];
}
