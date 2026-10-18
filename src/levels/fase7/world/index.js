// FASE 7 · Lambe-Lambe na Pracinha — cenário: a pracinha numa manhã depois da chuva.
// API: buildWorld({ engine, root, layout }) → { props, seeThrough, update(dt, t), dispose() }
// Tudo nasce dentro de `root`. Props: tipo Fase7Props em src/types.d.ts. Peças:
//   ground.js     gramado molhado, piso emborrachado do parquinho, calçada de pedra portuguesa e poças
//   fence.js      cerca de lápis de cor, portão com a plaquinha e o ferrolho do lado de dentro
//   tunnel.js     morrinho de grama com a manilha (a lama fica no fundo)
//   equipment.js  escorregador com casinha, balanço, gangorra, caixa de areia e joaninha de mola
//   items.js      a bolinha de tênis e o frisbee (com destaque)
//   park.js       bancos, postes, árvores, lixeira, cercas vivas floridas e o bairro ao fundo
//   picnic.js     a toalha de piquenique (a entrega), a cesta e os lugares dos dois objetos
import { shared } from '../../../world/util.js';
import { buildTreats } from '../../../world/treats.js';
import { COLLECTIBLES } from '../layout.js';
import { buildGround } from './ground.js';
import { buildFence } from './fence.js';
import { buildTunnel } from './tunnel.js';
import { buildEquipment } from './equipment.js';
import { buildItems } from './items.js';
import { buildPark } from './park.js';
import { buildPicnic } from './picnic.js';

/** @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase7Props>} */
export function buildWorld({ root, layout }) {
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const ground = T('ground', () => buildGround(root, layout));
  const fence = T('fence', () => buildFence(root, layout));
  const tunnel = T('tunnel', () => buildTunnel(root, layout));
  const equipment = T('equipment', () => buildEquipment(root, layout));
  const items = T('items', () => buildItems(root, layout));
  const park = T('park', () => buildPark(root, layout));
  const picnic = T('picnic', () => buildPicnic(root, layout));
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.16 });
  if (typeof window !== 'undefined') window.__f7Timings = timings;
  /** @type {import('../../../types').Fase7Props} */
  const props = {
    gate: fence.gate, latch: fence.latch, ball: items.ball, frisbee: items.frisbee, goal: picnic.goal,
    collectibles: treats.list, fireflies: false,
    update(dt, t) {
      treats.update(dt, t);
      items.update(dt, t);
      picnic.update(dt, t);
    },
    reset() {
      fence.gate.setOpen(0);
      fence.latch.setTurn(0);
      items.reset();
      picnic.reset();
      for (const treat of treats.list) treat.reset();
    },
  };
  props.reset();
  return {
    props,
    env: { ground, park, tunnel, timings },
    seeThrough: [...fence.seeThrough, ...tunnel.seeThrough, ...equipment.seeThrough],
    update(dt, t) {
      shared.time.value = t;
      ground.update(dt, t);
      equipment.update(dt, t);
      props.update(dt, t);
    },
    dispose() {},
  };
}
