// Barramento de eventos minimalista. Ver docs/CONTRATO.md (seção "Eventos") para a lista oficial.
const listeners = new Map();

export const events = {
  on(name, fn) {
    if (!listeners.has(name)) listeners.set(name, new Set());
    listeners.get(name).add(fn);
    return () => events.off(name, fn);
  },
  once(name, fn) {
    const off = events.on(name, (p) => {
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
