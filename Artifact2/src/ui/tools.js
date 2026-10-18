// Tool registry (SPEC 13.2). Pure data; the toolbar dropdown and the Tools
// menu are both built from it.

export const TOOLS = [
  { id: 'navigate', label: 'Navigate', icon: 'tool-navigate', milestone: 1, hint: 'Drag to pan, click a tile to inspect it, scroll to zoom.' },
  {
    id: 'sculpt', label: 'Sculpt', icon: 'tool-sculpt', milestone: '2b',
    children: [
      { id: 'draw-land', label: 'Draw Land', milestone: '2b' },
      { id: 'raise', label: 'Raise', milestone: '2b' },
      { id: 'lower', label: 'Lower', milestone: '2b' },
      { id: 'carve-trench', label: 'Carve Trench', milestone: '2b' },
      { id: 'smooth', label: 'Smooth', milestone: '2b' },
      { id: 'erase', label: 'Erase', milestone: '2b' },
      { id: 'cave-prone-rock', label: 'Cave-Prone Rock', milestone: 9 },
    ],
  },
  { id: 'cave', label: 'Cave tool', icon: 'tool-cave', milestone: 9 },
  { id: 'route', label: 'Route tool', icon: 'tool-route', milestone: 10 },
];

export const DEFAULT_TOOL_ID = 'navigate';

export function getTool(id) {
  return TOOLS.find((t) => t.id === id) ?? TOOLS[0];
}
