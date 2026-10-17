// FASE 4 · Operação Patinho — cenário (terraço do prédio numa manhã de sol).
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: tipo Fase4Props em src/types.d.ts. Luz: só o sol do preset
// (com sombra) e o céu; nenhuma luz extra.
import { shared } from '../../../world/util.js';
import { buildTerrace } from './terrace.js';
import { buildProps } from './props.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase4Props>}
 */
export function buildWorld({ root, layout }) {
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const terrace = T('terrace', () => buildTerrace(layout));
  root.add(terrace.group);
  const P = T('props', () => buildProps({ root, layout, house: terrace.house }));
  if (typeof window !== 'undefined') window.__f4Timings = timings;
  return {
    props: P.props,
    env: { terrace, timings },
    // objetos que podem ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [...P.seeThrough, terrace.planters, terrace.house.group],
    update(dt, t) {
      shared.time.value = t;
      P.props.update(dt, t);
    },
    dispose() {},
  };
}
