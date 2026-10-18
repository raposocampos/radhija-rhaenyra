// FASE 6 · Expresso do Superbafo — cenário: a oficina de brinquedos em corte de maquete.
// API: buildWorld({ engine, root, layout }) → { props, seeThrough, update(dt, t), dispose() }
// Tudo nasce dentro de `root`. Props: tipo Fase6Props em src/types.d.ts. Peças:
//   workshop.js  sala, paredes, janelas e móveis (com as luzes quentes, sem sombra)
//   railway.js   maquete do trem: base, feltro, trilho de madeira (de track.js), cerca, agulha e estação
//   train.js     locomotiva com cara e nariz de mola, vagão-caçamba articulado e engate
//   stations.js  pedal, canaleta e bandeja, marca de mira, tapete de foguete e a bolinha-planeta
// O trilho visível e o movimento do trem saem do mesmo createTrack() (layout.TRACK).
import { shared } from '../../../world/util.js';
import { buildTreats } from '../../../world/treats.js';
import { createTrack } from '../track.js';
import { COLLECTIBLES } from '../layout.js';
import { buildWorkshop } from './workshop.js';
import { buildRailway } from './railway.js';
import { buildTrain } from './train.js';
import { buildStations } from './stations.js';

/** @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase6Props>} */
export function buildWorld({ root }) {
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const track = createTrack();
  const workshop = T('workshop', () => buildWorkshop(root));
  const railway = T('railway', () => buildRailway(root, track));
  const consist = T('train', () => buildTrain(root));
  const stations = T('stations', () => buildStations(root));
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.16 });
  if (typeof window !== 'undefined') window.__f6Timings = timings;
  /** @type {import('../../../types').Fase6Props} */
  const props = {
    pedal: stations.pedal, junction: railway.junction, train: consist.train, nose: consist.nose,
    ball: stations.ball, goal: stations.goal, collectibles: treats.list, fireflies: false,
    update(dt, t) {
      treats.update(dt, t);
      railway.update(dt);
      consist.update(dt, t);
      stations.update();
    },
    reset() {
      railway.reset();
      consist.reset();
      stations.reset();
      for (const treat of treats.list) treat.reset();
    },
  };
  props.reset();
  return {
    props,
    env: { track, workshop, timings },
    seeThrough: workshop.seeThrough,
    update(dt, t) {
      shared.time.value = t;
      props.update(dt, t);
    },
    dispose() {},
  };
}
