// Distance from Coast (SPEC 13.3): km to the nearest coast, in bands that
// run inland on land (greens → browns) and offshore on water (light → dark
// blue). Lakes count as land. The distances come from the worker
// (`coastDistance` job, full resolution) as one signed layer: positive
// inland, negative offshore. Until the first result arrives the map is gray.

// Band edges in km (both ramps).
export const COAST_BANDS_KM = [50, 100, 250, 500, 1000, 2000];

// Data palettes (with the renderer, per CLAUDE.md).
const INLAND = [[198, 214, 140], [170, 196, 112], [146, 170, 92], [168, 150, 88], [150, 116, 72], [120, 88, 60], [92, 66, 48]];
const OFFSHORE = [[170, 214, 236], [128, 186, 222], [92, 156, 204], [62, 124, 180], [40, 94, 150], [26, 68, 118], [16, 44, 84]];
const PENDING = [70, 74, 80];

function band(km) {
  let k = 0;
  while (k < COAST_BANDS_KM.length && km >= COAST_BANDS_KM[k]) k++;
  return k;
}

export function drawCoastDistance(g, { map, coast }) {
  const w = map.sourceWidth;
  const h = map.sourceHeight;
  const data = coast?.data && coast.width === w && coast.height === h ? coast.data : null;
  const out = new Uint8ClampedArray(w * h * 4);
  for (let i = 0, p = 0; i < w * h; i++, p += 4) {
    let c = PENDING;
    if (data) {
      const d = data[i];
      c = d > 0 ? INLAND[band(d)] : OFFSHORE[band(-d)];
    }
    out[p] = c[0]; out[p + 1] = c[1]; out[p + 2] = c[2]; out[p + 3] = 255;
  }
  g.putImageData(new ImageData(out, w, h), 0, 0);
}
// The base layer rebuilds when a new distance result arrives.
drawCoastDistance.dataKey = (store) => `coast${store.coast?.version ?? 0}`;

const rgb = (c) => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
const labels = COAST_BANDS_KM.map((km, k) => (k === 0 ? `< ${km} km` : `${COAST_BANDS_KM[k - 1]}–${km} km`)).concat(`> ${COAST_BANDS_KM.at(-1)} km`);
drawCoastDistance.legend = {
  columns: [
    { title: 'Inland', items: INLAND.map((c, k) => ({ color: rgb(c), label: labels[k] })) },
    { title: 'Offshore', items: OFFSHORE.map((c, k) => ({ color: rgb(c), label: labels[k] })) },
  ],
  note: 'Lakes count as land.',
};
