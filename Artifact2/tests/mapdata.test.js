// Export Map Data (map-wide companion): the binary layout tools/mapquery.py
// reads, its rounding and clamping, and a gzip round trip.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  encodeMapData, decodeMapData, mapDataFileName, MAP_DATA_LAYERS, MAP_DATA_MAGIC, MAP_DATA_FORMAT, KOPPEN_WATER,
} from '../src/io/mapdata.js';

const W = 4;
const H = 2;

function sample() {
  const values = Object.fromEntries(MAP_DATA_LAYERS.map((l) => [l.name, new Float32Array(W * H)]));
  for (let k = 0; k < W * H; k++) {
    values.elevation[k] = k * 100 - 300;
    values.category[k] = k % 2;
    values.koppen[k] = k % 2 ? 25 : KOPPEN_WATER;
    values.temp_jan[k] = -12.34 + k;
    values.rain_jul[k] = 81.26 + k;
    values.wind_u[k] = 0.4641;
    values.wind_v[k] = -0.3671;
  }
  return values;
}
const HEADER = { width: W, height: H, lat_top: 90, lat_bottom: -90, lon_west: -180, lon_span: 360, wraps: true };

test('round trip keeps every layer to its stored precision', () => {
  const { header, layers } = decodeMapData(encodeMapData(HEADER, sample()));
  assert.equal(header.format, MAP_DATA_FORMAT);
  assert.equal(header.width, W);
  assert.equal(header.wraps, true);
  assert.equal(header.layers.length, 29);
  assert.deepEqual(Array.from(layers.elevation), [-300, -200, -100, 0, 100, 200, 300, 400]);
  assert.equal(layers.koppen[0], KOPPEN_WATER);
  assert.equal(layers.koppen[1], 25);
  assert.ok(Math.abs(layers.temp_jan[0] - -12.3) < 1e-9);
  assert.ok(Math.abs(layers.rain_jul[7] - 88.3) < 1e-9);
  assert.ok(Math.abs(layers.wind_u[3] - 0.464) < 1e-9);
  assert.ok(Math.abs(layers.wind_v[3] - -0.367) < 1e-9);
});

test('file starts with the magic line and a one-line JSON header', () => {
  const bytes = encodeMapData(HEADER, sample());
  const text = new TextDecoder().decode(bytes.subarray(0, bytes.indexOf(10, bytes.indexOf(10) + 1) + 1));
  assert.ok(text.startsWith(`${MAP_DATA_MAGIC}\n{`));
  const offsets = JSON.parse(text.split('\n')[1]).layers.map((l) => l.offset);
  assert.equal(offsets[0], 0);
  assert.equal(offsets[1], W * H * 2); // int16 elevation, then uint8 category
});

test('out-of-range values clamp instead of wrapping', () => {
  const v = sample();
  v.elevation[0] = 99999;
  v.rain_jul[0] = -5;
  const { layers } = decodeMapData(encodeMapData(HEADER, v));
  assert.equal(layers.elevation[0], 32767);
  assert.equal(layers.rain_jul[0], 0);
});

test('a missing or short layer is an error', () => {
  const v = sample();
  v.temp_feb = new Float32Array(3);
  assert.throws(() => encodeMapData(HEADER, v), /temp_feb/);
});

test('gzip round trip (as the app downloads it)', async () => {
  const bytes = encodeMapData(HEADER, sample());
  const gz = new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  const back = new Uint8Array(await new Response(new Blob([gz]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer());
  assert.deepEqual(back, bytes);
});

test('file name', () => {
  assert.equal(mapDataFileName(1024, 512), 'fcm-map-data-1024x512.bin.gz');
});
