// Pré-carga de uma fase enquanto as dogs passeiam no mapa das fases (src/levels/mapa/): a carga que antes acontecia
// atrás da cortina vai acontecendo por baixo, e a barrinha da plaquinha mostra o andamento.
//   1. 'import'  — perto da bandeirinha (FLAG_PRELOAD): o código da fase (o import do `load()`), sem travar nada.
//   2. 'build'   — parada na frente dela (FLAG_NEAR, quase sem andar): o cenário montado num Group fora da cena
//                  (uma travadinha curta, com a plaquinha na tela e a dog parada).
//   3. 'gpu'     — os programas da fase compilados na variante do jogo (compileAsync, sem travar) e as texturas
//                  enviadas aos poucos (engine.precompile).
//   4. 'ready'   — pronta: entrar só troca as montagens (o aquecimento de sempre, engine.prepare, fica curto).
// Afastou-se (outra bandeirinha ou nenhuma): a montagem é descartada (o código importado fica no cache do navegador).
// API: createLevelPreload({ engine, params, emit }) → { want(index, def, { build }), update(dt, { moving }), take(index), cancel(), info() }
import * as THREE from 'three';
import { createResourceScope } from '../core/resources.js';

/** Quanto da barrinha cada etapa enche. */
const SHARE = { import: 0.3, build: 0.65, gpu: 1 };
/** Parada na frente da bandeirinha por este tempo (s) antes de montar (para a travadinha não pegar a dog andando). */
const SETTLE = 0.35;

/**
 * @param {{ engine: import('../types').Engine, params: URLSearchParams, emit: import('../types').GameEmit }} opts
 */
export function createLevelPreload({ engine, params, emit }) {
  /**
   * @type {null | { index: number, def: import('../types').LevelDef, status: 'import' | 'imported' | 'build' | 'gpu' | 'ready' | 'error',
   *   module: any, root: THREE.Group | null, resources: any, built: any, wantBuild: boolean, settle: number, progress: number, token: number }}
   */
  let cur = null;
  let token = 0;

  function report() {
    if (!cur) { emit('map:preload', { index: null, progress: 0, status: 'idle' }); return; }
    emit('map:preload', { index: cur.index, progress: cur.progress, status: cur.status });
  }
  function dropBuild(c) {
    if (!c?.root) return;
    try { c.built?.dispose?.(); } catch (e) { console.warn('[preload] descarte', e); }
    try { c.resources?.dispose(); } catch (e) { console.warn('[preload] descarte', e); }
    c.root = c.built = c.resources = null;
  }
  function cancel() {
    if (cur) dropBuild(cur);
    cur = null;
    token++;
  }

  /**
   * A fase que o mapa quer adiantada (index null: nenhuma). build: as dogs estão na frente dela (pode montar).
   * @param {number | null} index @param {import('../types').LevelDef | null} def @param {{ build?: boolean }} [opts]
   */
  function want(index, def, { build = false } = {}) {
    if (index == null || !def) {
      if (cur) { cancel(); report(); }
      return;
    }
    if (cur && cur.index === index) {
      if (build && !cur.wantBuild) { cur.wantBuild = true; cur.settle = 0; }
      if (!build) cur.wantBuild = false;
      return;
    }
    cancel();
    const my = ++token;
    cur = { index, def, status: 'import', module: null, root: null, resources: null, built: null, wantBuild: build, settle: 0, progress: 0.05, token: my };
    report();
    Promise.resolve().then(() => def.load?.()).then((mod) => {
      if (!cur || cur.token !== my) return;
      cur.module = mod || {};
      cur.status = 'imported';
      cur.progress = SHARE.import;
      report();
    }, (error) => {
      if (!cur || cur.token !== my) return;
      console.warn('[preload] import da fase', def.id, error);
      cur.status = 'error';
      report();
    });
  }

  /** Monta o cenário fora da cena e manda a GPU preparar (assíncrono). */
  function build() {
    const c = cur;
    const full = { ...c.def, ...c.module };
    if (typeof full.build !== 'function') { c.status = 'error'; report(); return; }
    c.status = 'build';
    const root = new THREE.Group();
    root.name = `fase:${full.id}`;
    const resources = createResourceScope(root);
    try {
      c.built = full.build({ engine, root, layout: full.layout, params });
    } catch (error) {
      console.warn('[preload] montagem da fase', full.id, error);
      try { resources.dispose(); } catch (_) { /* nada a liberar */ }
      c.status = 'error';
      report();
      return;
    }
    c.root = root;
    c.resources = resources;
    c.progress = SHARE.build;
    c.status = 'gpu';
    report();
    const my = c.token;
    Promise.resolve(engine.precompile?.(root, { onProgress: (k) => {
      if (!cur || cur.token !== my) return;
      cur.progress = SHARE.build + (SHARE.gpu - SHARE.build) * Math.min(1, k) * 0.98;
      report();
    } })).catch((error) => console.warn('[preload] GPU', error)).finally(() => {
      if (!cur || cur.token !== my) return;
      cur.status = 'ready';
      cur.progress = 1;
      report();
    });
  }

  return {
    want,
    /** A cada quadro do mapa: monta quando a dog parou na frente da bandeirinha. */
    update(dt, { moving = false } = {}) {
      if (!cur || cur.status !== 'imported' || !cur.wantBuild) return;
      cur.settle = moving ? 0 : cur.settle + dt;
      if (cur.settle >= SETTLE) build();
    },
    /**
     * Entrando na fase `index`: o que já foi adiantado (o módulo e, se pronta ou na GPU, a montagem), e o pré-carregador
     * esquece (quem leva cuida). Outra fase: descarta e devolve null.
     * @returns {{ module: any, root: THREE.Group | null, resources: any, built: any } | null}
     */
    take(index) {
      if (!cur || cur.index !== index) { cancel(); return null; }
      const c = cur;
      cur = null;
      token++;
      return { module: c.module, root: c.root, resources: c.resources, built: c.built };
    },
    cancel,
    info: () => (cur ? { index: cur.index, status: cur.status, progress: +cur.progress.toFixed(2) } : null),
  };
}
