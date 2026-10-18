// Hover tooltip (tile inspector). M1 shows lat/lon, the source pixel, and the
// sim cell; later milestones add elevation, temperature, rain, wind, etc.

const OFFSET = 16;

export function createInspector(el, container) {
  const main = document.createElement('div');
  main.className = 'tt-main';
  const sub = document.createElement('div');
  sub.className = 'tt-sub';
  el.append(main, sub);

  return {
    // info: { latLon, px, py, i, j }
    show(sx, sy, info) {
      main.textContent = info.latLon;
      sub.textContent = `Pixel ${info.px}, ${info.py} · Sim cell ${info.i}, ${info.j}`;
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
