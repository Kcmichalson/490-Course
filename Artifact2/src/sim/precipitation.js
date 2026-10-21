// Precipitation and rain shadows (SPEC 7, pipeline step 7, M5). Pure.
//
// A steady moisture field q (capacity units: air at 0 °C holds 1) is carried
// along the final wind with the same upwind stencils as the M4 tracer
// (upwind.js: one north-south cell per step, direction only, cos-latitude
// east-west steps), solved in flow order: each cell after the cells its air
// comes from, loops iterated until the estimated error left is below
// PRECIP_TOLERANCE of each cell's capacity (at most 500 passes; SPEC 7,
// approved Session 8). Per cell and step:
//   Qc    = exp(0.07·T)                    capacity (Clausius–Clapeyron)
//   qIn   = q at the upwind point;  RH = qIn / Qc;  Δh = h − h(upwind point)
//   decay = β · gate · belt(p) · descent   background rain-out, scaled by
//           the pressure belts and cut on lee slopes (rain shadow)
//   gate  = 1 − sinking(p) · (1 − ramp(RH))  sinking air (highs) rains only
//           when humid; rising air (lows) is lifted to saturation anyway
//   oro   = OROG_PER_KM · climb (km) · ramp(RH)   orographic rain on windward
//           slopes; the climb is measured on terrain smoothed over ±120 km
//   P     = qIn · min(1, decay + oro); the excess above capacity rains too
//   land: a share of P evaporates again (recycling)
//   open water (ocean, lakes; not sea ice): evaporation toward saturation
//           at the water's temperature (M5: the M4 air over the sea; SST is M7)
// precipitation (mm/month) = PRECIP_CAL · P / dy (km): rain per km of travel,
// so the answer doesn't depend on the grid size.
//
// The 12 monthly runs (mid-month days) give monthly precipitation; Annual
// Mean is their mean. A single day is its own run.

import {
  CAPACITY_PER_C, RAINOUT_KM, RAIN_RH_MIN, RECYCLE, EVAP_KM, OROG_PER_KM, OROG_SMOOTH_KM, DESCENT_M_PER_KM, BELT_LOW_FACTOR,
  BELT_HIGH_FACTOR, RH_EDGE, PRECIP_CAL, PRECIP_TOLERANCE, PRECIP_LOCAL_TOLERANCE, PRECIP_MAX_SWEEPS, PLANET_RADIUS_KM,
} from './constants.js';
import { CATEGORY } from './terrain.js';
import { upwindStencil, cellKm } from './upwind.js';
import { windProfile } from './wind.js';
import { seasonTemperature } from './temperature.js';
import { MONTH_MID_DAYS } from './planet.js';

// Capacity: warm air holds ~7% more water vapor per °C.
export const capacity = (tC) => Math.exp(CAPACITY_PER_C * tC);

// Pressure-belt rain multiplier from the pressure index p (−1 at the lows,
// +1 at the highs; wind.js pressureIndex): geometric blend from 2× (rising
// air) to 0.3× (sinking air), smooth in latEff.
export function beltFactor(p) {
  const low = (1 - p) / 2;
  return Math.exp(low * Math.log(BELT_LOW_FACTOR) + (1 - low) * Math.log(BELT_HIGH_FACTOR));
}

// Rain needs humid air: 0 below RAIN_RH_MIN, 1 at saturation.
export const rhRamp = (rh) => Math.min(1, Math.max(0, (rh - RAIN_RH_MIN) / (1 - RAIN_RH_MIN)));

// How much the air sinks, from the pressure index: 0 at the lows (rising
// air), 1 at the highs (subsidence).
export const sinkingShare = (p) => Math.min(1, Math.max(0, (1 + p) / 2));

// The humidity gate on the background rain-out: subsiding air under the
// highs rains only when humid (deserts), while air rising at the lows
// (ITCZ, subpolar lows) is lifted to saturation whatever its surface
// humidity, so the gate fades out there. Without this, air that dried or
// warmed below RAIN_RH_MIN never rained again, even at the ITCZ (LOG M5).
export const humidityGate = (rh, p) => 1 - sinkingShare(p) * (1 - rhRamp(rh));

// Rain shadow: sinking air on a lee slope warms and dries (descent in m/km).
export const descentFactor = (mPerKm) => Math.exp(-Math.max(0, mPerKm) / DESCENT_M_PER_KM);

// Terrain smoothed with a box of ±km (north-south in rows; east-west in km
// at each row's latitude, so it spans more cells toward the poles). Wraps
// east-west on wrapping maps, else clamps; clamps at the top and bottom.
// Running sums, so the cost doesn't depend on the radius. km = 0: as is.
export function smoothElevation(grid, elevation, radiusKm, km) {
  const W = grid.width;
  const H = grid.height;
  if (!(km > 0)) return elevation;
  const wraps = grid.wraps ?? true;
  const { dy, dx } = cellKm(grid, radiusKm);
  const ry = Math.round(km / dy);
  const tmp = new Float32Array(W * H);
  const prefix = new Float64Array(W + 1);
  for (let j = 0; j < H; j++) {
    const rx = Math.min(Math.floor((W - 1) / 2), Math.round(km / dx[j]));
    for (let i = 0; i < W; i++) prefix[i + 1] = prefix[i] + elevation[j * W + i];
    for (let i = 0; i < W; i++) {
      let sum;
      let count;
      if (wraps) {
        // Window i − rx … i + rx around the ring.
        const a = i - rx;
        const b = i + rx;
        sum = 0;
        if (a < 0) sum += prefix[W] - prefix[W + a];
        if (b >= W) sum += prefix[b - W + 1];
        sum += prefix[Math.min(W, b + 1)] - prefix[Math.max(0, a)];
        count = 2 * rx + 1;
      } else {
        const a = Math.max(0, i - rx);
        const b = Math.min(W - 1, i + rx);
        sum = prefix[b + 1] - prefix[a];
        count = b - a + 1;
      }
      tmp[j * W + i] = sum / count;
    }
  }
  const out = new Float32Array(W * H);
  const colPrefix = new Float64Array(H + 1);
  for (let i = 0; i < W; i++) {
    for (let j = 0; j < H; j++) colPrefix[j + 1] = colPrefix[j] + tmp[j * W + i];
    for (let j = 0; j < H; j++) {
      const a = Math.max(0, j - ry);
      const b = Math.min(H - 1, j + ry);
      out[j * W + i] = (colPrefix[b + 1] - colPrefix[a]) / (b - a + 1);
    }
  }
  return out;
}

// One month's (or day's) moisture solve.
//   inputs = { wind: { u, v } (rows or full), temperature (W·H, °C),
//              pressure (per row index, −1 lows … +1 highs),
//              terrain: { category, elevation } }
//   opts   = { radiusKm, tolerance, maxSweeps, recycle, smoothKm }
// → { precip (mm/month), rh (after the cell's update), sweeps (most passes
//     any loop needed), maxChange (largest last change of a loop), loops }
export function moistureSolve(grid, inputs, opts = {}) {
  const W = grid.width;
  const H = grid.height;
  const n = W * H;
  const radius = opts.radiusKm ?? grid.radiusKm ?? PLANET_RADIUS_KM;
  const tolerance = opts.tolerance ?? PRECIP_TOLERANCE;
  const localTolerance = Math.min(tolerance, PRECIP_LOCAL_TOLERANCE);
  const maxSweeps = opts.maxSweeps ?? PRECIP_MAX_SWEEPS;
  const recycle = opts.recycle ?? RECYCLE;
  const { temperature, pressure, terrain } = inputs;
  const { category } = terrain;
  // The climb is measured on smoothed terrain (rough ground's small bumps
  // don't each force ascent; approved Session 8).
  const elevation = smoothElevation(grid, terrain.elevation, radius, opts.smoothKm ?? OROG_SMOOTH_KM);
  const st = upwindStencil(grid, inputs.wind, radius);
  const { corners, weights, self, off, dy } = st;
  const beta = 1 - Math.exp(-dy / RAINOUT_KM);
  const eps = 1 - Math.exp(-dy / EVAP_KM);

  // Per-cell coefficients (they don't change while solving). The stencil
  // lists every cell in row order, so list index = cell index.
  const beltRow = new Float64Array(H);
  const sinkRow = new Float64Array(H);
  for (let j = 0; j < H; j++) { beltRow[j] = beltFactor(pressure[j]); sinkRow[j] = sinkingShare(pressure[j]); }
  const qc = new Float32Array(n);
  const decayC = new Float32Array(n); // β · belt · descent
  const oro = new Float32Array(n);    // orographic share
  const sinkK = new Float64Array(n);  // sinking share (humidity gate)
  const edgeIn = new Float64Array(n); // inflow from off the map (open ocean air)
  const kind = new Uint8Array(n);     // 1 = open water (evaporates), 2 = land (recycles), 0 = neither
  for (let k = 0; k < n; k++) {
    const j = Math.floor(k / W);
    qc[k] = capacity(temperature[k]);
    // Δh along the wind: the cell's surface height minus the height at the
    // upwind point (bilinear; off the map is open ocean, 0 m).
    const c = 4 * k;
    const hUp = weights[c] * elevation[corners[c]] + weights[c + 1] * elevation[corners[c + 1]]
      + weights[c + 2] * elevation[corners[c + 2]] + weights[c + 3] * elevation[corners[c + 3]] + self[k] * elevation[k];
    const dh = elevation[k] - hUp;
    oro[k] = (OROG_PER_KM * Math.max(0, dh)) / 1000;
    decayC[k] = beta * beltRow[j] * descentFactor(-dh / dy);
    sinkK[k] = sinkRow[j];
    edgeIn[k] = off[k] * RH_EDGE * qc[k];
    const cat = category[k];
    kind[k] = cat === CATEGORY.OCEAN || cat === CATEGORY.LAKE ? 1 : cat === CATEGORY.LAND ? 2 : 0;
  }
  const rampSpan = 1 - RAIN_RH_MIN;

  // One step of the cell's air: from the inflow qIn to the outflow
  // (returned); the rain P is left in stepRain.
  let stepRain = 0;
  const advance = (qIn, cap, decay, oroShare, sink, kd) => {
    const ramp = Math.min(1, Math.max(0, (qIn / cap - RAIN_RH_MIN) / rampSpan));
    const frac = Math.min(1, decay * (1 - sink * (1 - ramp)) + oroShare * ramp);
    let p = qIn * frac;
    let out = qIn - p;
    if (out > cap) { p += out - cap; out = cap; } // excess above capacity rains out
    if (kd === 2) out = Math.min(cap, out + recycle * p); // recycling over land
    else if (kd === 1 && out < cap) out += eps * (cap - out); // evaporation over open water
    stepRain = p;
    return out;
  };

  // Flow order (Session 8; LOG M5): every cell is solved after the cells its
  // air comes from. The upwind links (cell → its stencil corners) form a
  // graph; its strongly connected components (iterative Tarjan) are either
  // single cells, solved in one step, or loops (divergence pairs, each
  // latitude ring around a wrapping map), iterated in their own order until
  // no cell changes by more than the tolerance. Tarjan emits a component
  // only after every component it draws air from, so one pass in that order
  // is the whole solve. (Plain sweeps in four fixed orders stopped at a
  // "< 1% change" left the answer ~20% off at 1024; measured in LOG M5.)
  const index = new Int32Array(n).fill(-1);
  const low = new Int32Array(n);
  const onStack = new Uint8Array(n);
  const stack = new Int32Array(n);
  const callK = new Int32Array(n);
  const callE = new Int8Array(n);
  const order = new Int32Array(n);
  const compStart = [];
  let sp = 0;
  let next = 0;
  let op = 0;
  for (let root = 0; root < n; root++) {
    if (index[root] >= 0) continue;
    let cp = 0;
    callK[cp] = root; callE[cp] = 0; cp++;
    index[root] = low[root] = next++; stack[sp++] = root; onStack[root] = 1;
    while (cp > 0) {
      const k = callK[cp - 1];
      let e = callE[cp - 1];
      let descended = false;
      while (e < 4) {
        const r = 4 * k + e;
        e++;
        if (weights[r] === 0) continue;
        const v = corners[r];
        if (v === k) continue;
        if (index[v] < 0) {
          callE[cp - 1] = e;
          index[v] = low[v] = next++; stack[sp++] = v; onStack[v] = 1;
          callK[cp] = v; callE[cp] = 0; cp++;
          descended = true;
          break;
        }
        if (onStack[v] && index[v] < low[k]) low[k] = index[v];
      }
      if (descended) continue;
      if (low[k] === index[k]) { // k roots a component: everything it draws from is done
        compStart.push(op);
        let v;
        do { v = stack[--sp]; onStack[v] = 0; order[op++] = v; } while (v !== k);
      }
      cp--;
      if (cp > 0 && low[k] < low[callK[cp - 1]]) low[callK[cp - 1]] = low[k];
    }
  }
  compStart.push(op);

  // Pairs (as in the M4 tracer): along a divergence line, such as the
  // subtropical high where the trades and westerlies part, two cells draw
  // their air from each other, and passes shrink their error only ~0.3% each.
  // back[r] = the weight of cell k in corner r's own stencil (0 = no pair).
  const back = new Float64Array(4 * n);
  for (let k = 0; k < n; k++) {
    for (let r = 4 * k; r < 4 * k + 4; r++) {
      const v = corners[r];
      if (weights[r] === 0 || v === k) continue;
      let wb = 0;
      for (let r2 = 4 * v; r2 < 4 * v + 4; r2++) if (corners[r2] === k) wb += weights[r2];
      back[r] = wb;
    }
  }

  const q = new Float32Array(n);
  for (let k = 0; k < n; k++) q[k] = RH_EDGE * qc[k];
  const step = (k, qIn) => advance(qIn, qc[k], decayC[k], oro[k], sinkK[k], kind[k]);
  // Inflow of cell v from everything except cell k (and v's own share).
  const inflowWithout = (v, k) => {
    let s = edgeIn[v];
    for (let r = 4 * v; r < 4 * v + 4; r++) if (corners[r] !== k && corners[r] !== v) s += weights[r] * q[corners[r]];
    return s + self[v] * q[v];
  };
  // The cell's outflow if its own value were x: its partners respond to x
  // (two-cell lookahead), and its self share sees x.
  const lookahead = (k, x, rest) => {
    let inflow = rest + self[k] * x;
    for (let r = 4 * k; r < 4 * k + 4; r++) {
      if (back[r] === 0) continue;
      const v = corners[r];
      inflow += weights[r] * step(v, inflowWithout(v, k) + back[r] * x);
    }
    return step(k, inflow);
  };
  // Updates one cell: solves x = lookahead(x) (a contraction; secant steps
  // from the current value), then lets its partners follow. → change / capacity
  const update = (k) => {
    const cap = qc[k];
    let rest = edgeIn[k];
    let paired = false;
    for (let r = 4 * k; r < 4 * k + 4; r++) {
      if (weights[r] === 0 || corners[r] === k) continue;
      if (back[r] > 0) paired = true;
      else rest += weights[r] * q[corners[r]];
    }
    let x0 = q[k];
    let g0 = lookahead(k, x0, rest) - x0;
    let x = x0 + g0;
    if (paired || self[k] > 0) {
      for (let it = 0; it < 20 && Math.abs(x - x0) >= localTolerance * cap; it++) {
        const g = lookahead(k, x, rest) - x;
        const slope = g - g0;
        const nextX = slope !== 0 ? x - (g * (x - x0)) / slope : x + g;
        x0 = x; g0 = g;
        x = Math.min(cap, Math.max(0, nextX));
      }
    }
    const change = Math.abs(x - q[k]) / cap;
    q[k] = x;
    if (paired) {
      for (let r = 4 * k; r < 4 * k + 4; r++) {
        if (back[r] === 0) continue;
        const v = corners[r];
        q[v] = step(v, inflowWithout(v, k) + back[r] * x);
      }
    }
    return change;
  };
  // Loops stop on the estimated remaining error, not the change per pass
  // (SPEC 7, approved Session 8): a loop whose passes shrink its change only
  // slowly (contraction ρ near 1) is still far from its answer even when one
  // pass changes little; the error left is about change ÷ (1 − ρ).
  let sweeps = 1;     // the most passes any loop needed
  let maxChange = 0;  // the largest last change of any loop
  let maxError = 0;   // the largest estimated remaining error of any loop
  let loops = 0;
  for (let s = 0; s + 1 < compStart.length; s++) {
    const a = compStart[s];
    const b = compStart[s + 1];
    if (b - a === 1) { update(order[a]); continue; }
    loops++;
    let change = Infinity;
    let previous = Infinity;
    let estimate = Infinity;
    let pass = 0;
    while (pass < maxSweeps && estimate >= tolerance) {
      change = 0;
      for (let t = a; t < b; t++) change = Math.max(change, update(order[t]));
      pass++;
      if (change === 0) estimate = 0;
      else if (pass >= 2) {
        const rho = change / previous;
        estimate = rho < 1 ? change / (1 - rho) : Infinity;
      }
      previous = change;
    }
    if (pass > sweeps) sweeps = pass;
    if (change > maxChange) maxChange = change;
    if (estimate > maxError) maxError = estimate;
  }

  // Rain of the solved field.
  const precip = new Float32Array(n);
  const rh = new Float32Array(n);
  const toMm = PRECIP_CAL / dy;
  for (let k = 0; k < n; k++) {
    const c = 4 * k;
    const qIn = weights[c] * q[corners[c]] + weights[c + 1] * q[corners[c + 1]] + weights[c + 2] * q[corners[c + 2]]
      + weights[c + 3] * q[corners[c + 3]] + self[k] * q[k] + edgeIn[k];
    const out = advance(qIn, qc[k], decayC[k], oro[k], sinkK[k], kind[k]);
    precip[k] = stepRain * toMm;
    rh[k] = out / qc[k];
  }
  return { precip, rh, sweeps, maxChange, maxError, loops };
}

// Inputs of one day from the pipeline's pieces: the final wind (finalWindFor
// returns { u, v } for a day), the cell temperatures, and the base wind's
// pressure index row.
function dayInputs(grid, planet, terrain, s, day, finalWindFor) {
  const profile = windProfile(grid, planet, day);
  return {
    wind: finalWindFor(day, profile),
    temperature: seasonTemperature(grid, planet.tiltDeg, { day }, terrain, s),
    pressure: profile.pressure,
    terrain,
  };
}

// One day's precipitation. → { precip, rh, sweeps, maxChange }
export function precipitationDay(grid, planet, terrain, s, day, finalWindFor, opts = {}) {
  return moistureSolve(grid, dayInputs(grid, planet, terrain, s, day, finalWindFor), opts);
}

// The 12 monthly runs and their mean.
// → { months: [Float32Array mm/month] ×12, rh: [Float32Array] ×12, annual, sweeps: [12] }
export function precipitationMonths(grid, planet, terrain, s, finalWindFor, opts = {}) {
  const n = grid.width * grid.height;
  const months = [];
  const rh = [];
  const sweeps = [];
  const annual = new Float32Array(n);
  for (const d of MONTH_MID_DAYS) {
    const r = precipitationDay(grid, planet, terrain, s, d, finalWindFor, opts);
    months.push(r.precip);
    rh.push(r.rh);
    sweeps.push(r.sweeps);
  }
  // Annual Mean = the mean of the 12 months, cell by cell.
  for (let k = 0; k < n; k++) {
    let sum = 0;
    for (let m = 0; m < 12; m++) sum += months[m][k];
    annual[k] = sum / 12;
  }
  return { months, rh, annual, sweeps };
}
