// Hover tooltip (tile inspector): lat/lon, elevation, the source pixel, and
// the sim cell, then extra lines: day length (M3), wind (M3, while wind data
// is loaded), and a mode-specific line. Later milestones add temperature,
// rain, etc.

const OFFSET = 16;

export function createInspector(el, container) {
  const main = document.createElement('div');
  main.className = 'tt-main';
  const sub = document.createElement('div');
  sub.className = 'tt-sub';
  const extra = document.createElement('div');
  el.append(main, sub, extra);

  return {
    // info: { latLon, elevation?, lines? (extra lines, '' skipped), px, py, i, j }
    show(sx, sy, info) {
      main.textContent = info.latLon;
      sub.textContent = `${info.elevation ? `${info.elevation} · ` : ''}Pixel ${info.px}, ${info.py} · Sim cell ${info.i}, ${info.j}`;
      extra.replaceChildren(...(info.lines ?? []).filter(Boolean).map((text) => {
        const line = document.createElement('div');
        line.className = 'tt-sub';
        line.textContent = text;
        return line;
      }));
      el.hidden = false;
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const cw = container.clientWidth;
      const ch = container.clientHeight;
      const x = sx + OFFSET + w > cw ? sx - OFFSET - w : sx + OFFSET;
      const y = sy + OFFSET + h > ch ? sy - OFFSET - h : sy + OFFSET;
      el.style.transform = `translate(${Math.max(0, x)}px, ${Math.max(0, y)}px)`;
    },
    hide() {
      el.hidden = true;
    },
  };
}
