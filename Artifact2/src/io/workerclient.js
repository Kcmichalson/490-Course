// Promise-based requests to the simulation worker.

export function createWorkerClient(worker) {
  let nextId = 1;
  const pending = new Map();
  worker.addEventListener('message', (e) => {
    const msg = e.data;
    const entry = msg && pending.get(msg.id);
    if (!entry) return;
    if (msg.type === 'done' || msg.type === 'pong') {
      pending.delete(msg.id);
      entry.resolve(msg.result);
    } else if (msg.type === 'error') {
      pending.delete(msg.id);
      entry.reject(new Error(msg.message));
    }
  });
  return {
    request(type, payload = {}, transfer = []) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        worker.postMessage({ ...payload, type, id }, transfer);
      });
    },
  };
}
