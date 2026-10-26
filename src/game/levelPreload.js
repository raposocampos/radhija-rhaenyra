// Pré-carga de uma fase enquanto as dogs passeiam no mapa das fases (src/levels/mapa/): perto de uma bandeirinha
// liberada, o código da fase (o import do `load()`, o cenário dela) vai sendo baixado por baixo, sem travar nada, e a
// barrinha da plaquinha mostra o andamento ('import' → 'ready'). Montar o cenário fica para a entrada, atrás da cortina,
// como em toda troca de fase: montar trava o navegador (de 0,05 s a 1 s no PC, mais no celular) e, feito durante o
// passeio, as dogs congelavam na frente da bandeirinha (retorno do usuário).
// Afastou-se (outra bandeirinha ou nenhuma): esquece (o código importado fica no cache do navegador).
// API: createLevelPreload({ emit }) → { want(index, def), take(index), cancel(), info() }

/**
 * @param {{ emit: import('../types').GameEmit }} opts
 */
export function createLevelPreload({ emit }) {
  /** @type {null | { index: number, def: import('../types').LevelDef, status: 'import' | 'ready' | 'error', module: any, progress: number, token: number }} */
  let cur = null;
  let token = 0;

  function report() {
    if (!cur) { emit('map:preload', { index: null, progress: 0, status: 'idle' }); return; }
    emit('map:preload', { index: cur.index, progress: cur.progress, status: cur.status });
  }
  function cancel() {
    cur = null;
    token++;
  }

  /**
   * A fase que o mapa quer adiantada (index null: nenhuma).
   * @param {number | null} index @param {import('../types').LevelDef | null} def
   */
  function want(index, def) {
    if (index == null || !def) {
      if (cur) { cancel(); report(); }
      return;
    }
    if (cur && cur.index === index) return;
    cancel();
    const my = ++token;
    cur = { index, def, status: 'import', module: null, progress: 0.15, token: my };
    report();
    Promise.resolve().then(() => def.load?.()).then((mod) => {
      if (!cur || cur.token !== my) return;
      cur.module = mod || {};
      cur.status = 'ready';
      cur.progress = 1;
      report();
    }, (error) => {
      if (!cur || cur.token !== my) return;
      console.warn('[preload] import da fase', def.id, error);
      cur.status = 'error';
      report();
    });
  }

  return {
    want,
    /**
     * Entrando na fase `index`: o código já baixado (ou null), e o pré-carregador esquece. Outra fase: null.
     * @returns {{ module: any } | null}
     */
    take(index) {
      if (!cur || cur.index !== index) { cancel(); return null; }
      const c = cur;
      cancel();
      return { module: c.module };
    },
    cancel,
    info: () => (cur ? { index: cur.index, status: cur.status, progress: +cur.progress.toFixed(2) } : null),
  };
}
