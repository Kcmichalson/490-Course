// Simulation worker. Runs the sim pipeline off the main thread (SPEC 12).
// M1 stub: answers pings, which proves the module-worker path works both
// locally and on GitHub Pages before M3 depends on it.

self.addEventListener('message', (e) => {
  const msg = e.data;
  if (msg && msg.type === 'ping') self.postMessage({ type: 'pong', id: msg.id });
});
