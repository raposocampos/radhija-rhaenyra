// FASE 9 · Biblioteca do Vovô — cenário (a casa do vovô numa noite de chuva, em corte de maquete).
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: tipo Fase9Props em src/types.d.ts. Peças:
//   room.js          pisos, parede do fundo (porta da frente, vidraças com chuva), divisórias, portinha e o duto
//   library.js       estantes, lareira, escadinha de rodinhas, globo, poltrona, mesinha, abajur, pufe e tapete
//   office.js        armário alto, escrivaninha, cadeira, arquivo, quadro e a porta do escritório
//   hall.js          banco, guarda-chuva pingando, cabideiro, aparador, espelho, arandela e a almofada do gato
//   conservatory.js  vasos grandes, mesinha de plantas, poltrona de vime, lanterna e o ventilador
//   props.js         óculos, livro, Bichano, alavancas, ossinhos e as luzes da casa
// Luz: o luar fraco do preset (com sombra) + cinco PointLights quentes sem sombra (o fogo da lareira tremula).
import { shared } from '../../../world/util.js';
import { buildRoom } from './room.js';
import { buildLibrary } from './library.js';
import { buildOffice } from './office.js';
import { buildHall } from './hall.js';
import { buildConservatory } from './conservatory.js';
import { buildProps } from './props.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase9Props>}
 */
export function buildWorld({ root, layout }) {
  const room = buildRoom(layout);
  root.add(room.group);
  const library = buildLibrary({ root, layout });
  const office = buildOffice({ root, layout });
  const hall = buildHall({ root, layout });
  const conservatory = buildConservatory({ root, layout });
  const P = buildProps({ root, layout, room, library, office, hall, conservatory });
  return {
    props: P.props,
    env: { room, library, hall, conservatory },
    // o que pode ficar entre a câmera e as dogs (o núcleo aplica o "ver através")
    seeThrough: [room.walls, library.ladder.object, library.globe.object, office.door.object, conservatory.group],
    update(dt, t) {
      shared.time.value = t;
      room.update(dt, t);
      library.update(dt, t);
      hall.update(dt, t);
      conservatory.update(dt, t);
      P.props.update(dt, t);
    },
    dispose() {},
  };
}
