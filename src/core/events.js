// Barramento de eventos minimalista. Lista dos eventos: docs/ARQUITETURA.md §8.
const listeners = new Map();

const bus = {
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => bus.off(name, fn);
  },
  once(name, fn) {
    const off = bus.on(name, (p) => {
      off();
      fn(p);
    });
    return off;
  },
  off(name, fn) {
    listeners.get(name)?.delete(fn);
  },
  emit(name, payload = {}) {
    const set = listeners.get(name);
    if (!set) return;
    for (const fn of [...set]) {
      try {
        fn(payload);
      } catch (err) {
        console.error(`[events] erro no listener de "${name}"`, err);
      }
    }
  },
};

// A emissão conhece os payloads de carregamento. Os listeners e os eventos de
// mecânicas ainda usam a fronteira aberta existente; não muda o dispatch em runtime.
export const events = /** @type {Omit<typeof bus, 'emit'> & { emit: import('../types').GameEmit }} */ (bus);
