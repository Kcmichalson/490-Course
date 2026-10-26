// Export Map Data (map-wide companion, bonus after Artifact 3): the sim
// grid as one binary file for tools/mapquery.py. Pure, no DOM; main.js
// fills the layers and gzips the bytes.
//
// Layout: "FCMGRID1\n", one line of JSON (the header), then the layers
// back to back, little-endian, each width · height values in row order
// (index = j · width + i, row 0 = latTop). A stored value v means v · scale
// in the layer's unit.

export const MAP_DATA_MAGIC = 'FCMGRID1';
export const MAP_DATA_FORMAT = 'fcm-map-data';
export const MAP_DATA_VERSION = 1;
export const KOPPEN_WATER = 255;

const TYPES = {
  uint8: { size: 1, set: 'setUint8', get: 'getUint8', min: 0, max: 255, Array: Uint8Array },
  int16: { size: 2, set: 'setInt16', get: 'getInt16', min: -32768, max: 32767, Array: Int16Array },
  uint16: { size: 2, set: 'setUint16', get: 'getUint16', min: 0, max: 65535, Array: Uint16Array },
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

// The layers in file order: { name, type, scale, unit }.
export const MAP_DATA_LAYERS = Object.freeze([
  { name: 'elevation', type: 'int16', scale: 1, unit: 'm' },
  { name: 'category', type: 'uint8', scale: 1, unit: 'index into header.categories' },
  { name: 'koppen', type: 'uint8', scale: 1, unit: `index into header.koppen_codes; ${KOPPEN_WATER} = water` },
  ...MONTHS.map((m) => ({ name: `temp_${m}`, type: 'int16', scale: 0.1, unit: '°C' })),
  ...MONTHS.map((m) => ({ name: `rain_${m}`, type: 'uint16', scale: 0.1, unit: 'mm' })),
  { name: 'wind_u', type: 'int16', scale: 0.001, unit: 'relative, + toward east' },
  { name: 'wind_v', type: 'int16', scale: 0.001, unit: 'relative, + toward north' },
]);

// header: { width, height, ... } (the map's extent and settings);
// values: { [layer name]: array of width · height numbers in the layer's
// unit }. → Uint8Array (not yet compressed).
export function encodeMapData(header, values) {
  const n = header.width * header.height;
  let offset = 0;
  const layers = MAP_DATA_LAYERS.map((l) => {
    const entry = { ...l, offset };
    offset += n * TYPES[l.type].size;
    return entry;
  });
  const head = JSON.stringify({ format: MAP_DATA_FORMAT, version: MAP_DATA_VERSION, ...header, layers });
  const prefix = new TextEncoder().encode(`${MAP_DATA_MAGIC}\n${head}\n`);
  const out = new Uint8Array(prefix.length + offset);
  out.set(prefix);
  const view = new DataView(out.buffer, prefix.length);
  for (const l of layers) {
    const src = values[l.name];
    if (!src || src.length !== n) throw new Error(`layer ${l.name}: expected ${n} values`);
    const t = TYPES[l.type];
    for (let k = 0; k < n; k++) {
      const v = Math.min(t.max, Math.max(t.min, Math.round(src[k] / l.scale)));
      view[t.set](l.offset + k * t.size, Number.isFinite(v) ? v : 0, true);
    }
  }
  return out;
}

// bytes (uncompressed) → { header, layers: { [name]: Float64Array in the
// layer's unit } }.
export function decodeMapData(bytes) {
  const magicEnd = bytes.indexOf(10);
  const headEnd = bytes.indexOf(10, magicEnd + 1);
  const dec = new TextDecoder();
  if (dec.decode(bytes.subarray(0, magicEnd)) !== MAP_DATA_MAGIC) throw new Error('not an FCM map data file');
  const header = JSON.parse(dec.decode(bytes.subarray(magicEnd + 1, headEnd)));
  const n = header.width * header.height;
  const view = new DataView(bytes.buffer, bytes.byteOffset + headEnd + 1);
  const layers = {};
  for (const l of header.layers) {
    const t = TYPES[l.type];
    const out = new Float64Array(n);
    for (let k = 0; k < n; k++) out[k] = view[t.get](l.offset + k * t.size, true) * l.scale;
    layers[l.name] = out;
  }
  return { header, layers };
}

// "fcm-map-data-1024x512.bin.gz"
export const mapDataFileName = (w, h) => `fcm-map-data-${w}x${h}.bin.gz`;
