// FASE 8 · Lavanderia de Domingo — cenário (a área de serviço numa manhã de sol, em corte de maquete).
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: tipo Fase8Props em src/types.d.ts. Luz: o sol do preset (com sombra; a
// parede do fundo faz sombra e a janela desenha o retângulo de sol) + três PointLights quentes sem sombra.
import { shared } from '../../../world/util.js';
import { buildRoom } from './room.js';
import { buildLaundry } from './laundry.js';
import { buildRack } from './rack.js';
import { buildProps } from './props.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase8Props>}
 */
export function buildWorld({ root, layout }) {
  const room = buildRoom(layout);
  root.add(room.group);
  const laundry = buildLaundry({ root, layout });
  const P = buildProps({
    root, layout, washer: laundry.washer,
    rackBuilder: (sock) => buildRack({ root, layout, sock }),
  });
  return {
    props: P.props,
    env: { room, laundry },
    // o que pode ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [...P.seeThrough, room.walls, laundry.board],
    update(dt, t) {
      shared.time.value = t;
      room.update(dt, t);
      laundry.update(dt, t);
      P.props.update(dt, t);
    },
    dispose() {},
  };
}
