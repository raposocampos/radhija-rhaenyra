// FASE 5 · Operação Ursinho — cenário (dentro de casa numa tarde de chuva, em corte de maquete).
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: tipo Fase5Props em src/types.d.ts. Luz: a claridade fria do
// preset (com sombra) + PointLights quentes sem sombra: abajur, pendente, arandela, caminha (4) e a
// claridade de duas janelas (2).
import { shared } from '../../../world/util.js';
import { buildHouse } from './house.js';
import { buildFurniture } from './furniture.js';
import { buildProps } from './props.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase5Props>}
 */
export function buildWorld({ root, layout }) {
  const timings = {};
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const house = T('house', () => buildHouse(layout));
  root.add(house.group);
  const furniture = T('furniture', () => buildFurniture({ root, layout }));
  const P = T('props', () => buildProps({ root, layout, furniture }));
  if (typeof window !== 'undefined') window.__f5Timings = timings;
  return {
    props: P.props,
    env: { house, furniture, timings },
    // objetos que podem ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [...P.seeThrough, house.walls, furniture.kitchen.group, furniture.hall.group],
    update(dt, t) {
      shared.time.value = t;
      house.update(dt, t);
      P.props.update(dt, t);
    },
    dispose() {},
  };
}
