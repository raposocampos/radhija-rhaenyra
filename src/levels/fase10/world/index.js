// FASE 10 · Festa no Quintal — cenário: a casa em corte, a varanda da festa, o quintal e o fundo do quintal, num fim
// de tarde que vira noite.
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: tipo Fase10Props em src/types.d.ts. Peças:
//   ground.js     gramado, trilha de pedras, terra da horta, lama, piso do galpão e a grama com vento
//   house.js      sala e cozinha em corte (o quadro "Festa do ano passado", o quadro de luz, a fachada da varanda)
//   porch.js      deque, pergolado, faixa "FELIZ 3 ANOS", mesa e o bolo de três andares, balões e as luzinhas
//   yard.js       piscininha (água que sobe), barquinho, mangueira e torneira, caixote, ventilador, vasos, canteiro
//   fences.js     cerca do fundo com o portãozinho e a cordinha, muro do terreno, cerca viva e a vizinhança
//   treehouse.js  árvore, deque, casinha, roldana e balde, corda, cano de brinquedo, pombo e escorregador
//   garden.js     horta (vão da tábua quebrada, canteiros, girassóis) e o galpão (porta basculante, placa, rampa)
//   props.js      os três enfeites, as alavancas, o conduíte de energia, os ossinhos e as luzes
// Luz: o sol baixo do preset (com sombra) + cinco PointLights quentes sem sombra (o lampião acende com a festa).
import { shared } from '../../../world/util.js';
import { buildGround } from './ground.js';
import { buildHouse } from './house.js';
import { buildPorch } from './porch.js';
import { buildYard } from './yard.js';
import { buildFences } from './fences.js';
import { buildTreehouse } from './treehouse.js';
import { buildGarden } from './garden.js';
import { buildProps } from './props.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase10Props>}
 */
export function buildWorld({ root, layout }) {
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const ground = T('ground', () => buildGround(root, layout));
  const house = T('house', () => buildHouse(root, layout));
  const porch = T('porch', () => buildPorch(root, layout));
  const yard = T('yard', () => buildYard(root, layout));
  const fences = T('fences', () => buildFences(root, layout));
  const treehouse = T('treehouse', () => buildTreehouse(root, layout));
  const garden = T('garden', () => buildGarden(root, layout));
  const P = T('props', () => buildProps({ root, layout, house, porch, yard, fences, treehouse, garden }));
  if (typeof window !== 'undefined') window.__f10Timings = timings;
  P.props.reset();
  return {
    props: P.props,
    env: { ground, house, porch, yard, fences, treehouse, garden, timings },
    // o que pode ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [house.walls, ...yard.seeThrough, ...fences.seeThrough, ...treehouse.seeThrough, ...garden.seeThrough],
    update(dt, t) {
      shared.time.value = t;
      ground.update(dt, t);
      house.update(dt, t);
      porch.update(dt, t);
      yard.update(dt, t);
      fences.update(dt, t);
      treehouse.update(dt, t);
      garden.update(dt, t);
      P.props.update(dt, t);
    },
    dispose() {},
  };
}
