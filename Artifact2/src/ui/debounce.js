// Commit debouncing for planet sliders: holding an arrow key fires a commit
// per step, but the simulation should run once for the settled value.
// Timers are injectable so tests can drive them.

export const COMMIT_DELAY_MS = 400;

// The browser's timer functions must be called unbound (calling them as
// methods of another object throws "Illegal invocation"), so wrap them.
const realTimers = { setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h) };

// Returns a function that calls fn(value) once, `delay` ms after the last call.
export function debounceCommit(fn, delay = COMMIT_DELAY_MS, timers = realTimers) {
  let handle = null;
  let latest;
  const run = (v) => {
    latest = v;
    if (handle !== null) timers.clearTimeout(handle);
    handle = timers.setTimeout(() => {
      handle = null;
      fn(latest);
    }, delay);
  };
  // Runs a pending commit now (e.g. before the panel closes).
  run.flush = () => {
    if (handle === null) return;
    timers.clearTimeout(handle);
    handle = null;
    fn(latest);
  };
  return run;
}

// Runs async jobs one at a time, keeping only the latest waiting value
// (radius: one rebuild per settled value, never a queue of stale ones).
export function latestOnly(job) {
  let running = false;
  let waiting = null; // { value }
  async function pump() {
    if (running || !waiting) return;
    running = true;
    const { value } = waiting;
    waiting = null;
    try {
      await job(value);
    } finally {
      running = false;
      pump();
    }
  }
  return (value) => {
    waiting = { value };
    pump();
  };
}
