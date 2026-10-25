// Annual-mean heat transport and ice-albedo (SPEC 6, Climate inputs). Pure.
//
// The radiative rule (temperature.js) is a local balance: each latitude
// keeps its own sunlight. On a real planet, winds and ocean currents carry
// heat from the tropics toward the poles, and snow and ice reflect sunlight
// back to space. This 1-D model gives each latitude's annual mean with both,
// on equal-area cells (x = sin(latitude)):
//   T    = T̄ + k · (T_rad − ice − T̄)   Budyko: poleward heat transport pulls
//                                        every latitude toward the global mean
//   ice  = TQ_SLOPE · ICE_ALBEDO_SHARE · Q · iceShare(T)   (°C of sunlight
//                                        reflected by snow and ice)
//   iceShare = 0 at ICE_LINE_C + ramp/2 or warmer … 1 at ICE_LINE_C − ramp/2
// T̄ is the global mean of T_rad − ice, so the transport only moves heat
// between latitudes. Solved by damped iteration from T = T_rad.
// temperature.js adds the offset T − T_rad to every Tq term, so annual means
// move and the seasonal swing (Tq(season) − TqAnn) stays as in M4.

import { TQ_SLOPE, HEAT_TRANSPORT_K, ICE_ALBEDO_SHARE, ICE_LINE_C, ICE_RAMP_C } from './constants.js';

const DEG = Math.PI / 180;
const DAMPING = 0.3;     // numerical: share of each new estimate taken per iteration
const TOLERANCE = 1e-6;  // °C
const MAX_ITERATIONS = 5000;

// Center latitudes (degrees, south to north) of n equal-area cells.
export function equalAreaLats(n) {
  const out = new Float64Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.asin(-1 + ((i + 0.5) * 2) / n) / DEG;
  return out;
}

// Share of the ground under snow and ice for an annual mean (°C): a linear
// ramp, so the ice edge moves smoothly as the climate warms or cools.
export const iceShare = (t) => Math.min(1, Math.max(0, (ICE_LINE_C + ICE_RAMP_C / 2 - t) / ICE_RAMP_C));

// Annual means with transport and ice, from the radiative annual means
// (trad, °C) and annual mean insolation (insol, W/m²) of equal-area cells.
// → { temperature, offset (temperature − trad), iterations }
export function transportProfile(trad, insol, k = HEAT_TRANSPORT_K) {
  const n = trad.length;
  const t = Float64Array.from(trad);
  const target = new Float64Array(n);
  let iterations = 0;
  for (; iterations < MAX_ITERATIONS; iterations++) {
    let mean = 0;
    for (let i = 0; i < n; i++) {
      target[i] = trad[i] - TQ_SLOPE * ICE_ALBEDO_SHARE * insol[i] * iceShare(t[i]);
      mean += target[i];
    }
    mean /= n;
    let change = 0;
    for (let i = 0; i < n; i++) {
      const next = mean + k * (target[i] - mean);
      const step = DAMPING * (next - t[i]);
      t[i] += step;
      change = Math.max(change, Math.abs(step));
    }
    if (change < TOLERANCE) break;
  }
  const offset = new Float64Array(n);
  for (let i = 0; i < n; i++) offset[i] = t[i] - trad[i];
  return { temperature: t, offset, iterations };
}
