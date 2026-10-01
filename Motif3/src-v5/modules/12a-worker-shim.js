// ---- module: worker-shim v1.0.0
const __m_worker_shim = (() => {
// worker-shim — the render worker's stand-ins for the engine's few DOM touchpoints. `install` is stringified into
// the worker blob ahead of the engine modules (it must run before 04/05 create their canvases and read storage), so
// it may not reference anything outside its own body. On the page it is never called.
function install(scope, seed) {
  const mem = new Map(Object.entries(seed || {}));
  scope.window = scope;
  // In-memory storage seeded from the page: kits read their saved registry at load; writes stay in the worker.
  scope.localStorage = {
    getItem: k => (mem.has(String(k)) ? mem.get(String(k)) : null), setItem: (k, v) => { mem.set(String(k), String(v)); },
    removeItem: k => { mem.delete(String(k)); }, clear: () => mem.clear(), key: i => [...mem.keys()][i] ?? null, get length() { return mem.size; },
  };
  scope.document = {
    hidden: false, fonts: scope.fonts,
    createElement(tag) { if (String(tag).toLowerCase() !== 'canvas') throw new Error(`render worker has no <${tag}>`); return new OffscreenCanvas(300, 150); },
  };
}
return { install };

})();
