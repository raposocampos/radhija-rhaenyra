// PANDORÓPOLIS — o cenário do mapa das fases: uma cidadezinha em maquete flutuando no mar.
// API: buildWorld({ engine, root, layout }) → { props: MapaProps, seeThrough, env, update(dt, t) }
// Peças:
//   kit.js        o "balde" que junta as peças fixas por material e região (poucas malhas para a cidade inteira)
//   ground.js     mar, platôs com as encostas, ruas, faixas, calçadas, pisos, areia, gramados, terra
//   pecas.js      peças comuns: a casa em corte de maquete, cordões de luz, cerca de lápis, lanterna, água, chuva
//   casa.js       a casa das dogs: o jardim (fase 1), a casa em corte (fase 5) e a lavanderia (fase 8)
//   condominio.js área de serviço (2), jardim do lago (3), terraço da torre (4), brinquedoteca (6), pracinha (7)
//   chacara.js    a casa do vovô e o jardim de inverno (9), a festa no quintal (10), horta, bichos
//   buildings.js  muro e portaria, a cerquinha da casa, o prédio da torre, as lojas, o portal, o galpão e o chiqueiro
//   details.js    árvores e ipês, buxinhos, canteiros, postes, carros e ônibus, bancos, hidrantes, chafariz
//   markers.js    as bandeirinhas das fases (bandeira, número no chão, biscoitos, cadeado, anel da próxima)
//   clouds.js     as nuvens das áreas fechadas e a ponte levadiça do rio
//   billboard.js  o outdoor da Amora (Vote 1313)
//   train.js      o trenzinho da brinquedoteca
// A sombra do sol cobre só a vizinhança do que a câmera olha (engine.focusShadow): a cidade é grande demais para
// um mapa de sombra só.
import { shared } from '../../../world/util.js';
import { createKit, whenFontsReady } from './kit.js';
import { buildGround } from './ground.js';
import { buildBuildings } from './buildings.js';
import { buildDetails } from './details.js';
import { buildCasa } from './casa.js';
import { buildCondominio } from './condominio.js';
import { buildChacara } from './chacara.js';
import { buildMarkers } from './markers.js';
import { buildClouds } from './clouds.js';
import { buildBillboard } from './billboard.js';
import { buildTrain } from './train.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').MapaProps>}
 */
export function buildWorld({ engine, root, layout }) {
  const L = layout;
  /** @type {Record<string, number>} */
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const kit = createKit(root);
  const ground = T('ground', () => buildGround(kit, root, L));
  const buildings = T('buildings', () => buildBuildings(kit, root, L));
  const details = T('details', () => buildDetails(kit, root, L));
  const casa = T('casa', () => buildCasa(kit, root, L));
  const condo = T('condominio', () => buildCondominio(kit, root, L));
  const farm = T('chacara', () => buildChacara(kit, root, L));
  const markers = T('markers', () => buildMarkers(kit, root, L));
  const billboard = T('billboard', () => buildBillboard(kit, root, L));
  const train = T('train', () => buildTrain(root, condo.trackPoint));
  const merged = T('merge', () => kit.finish());
  const sky = T('clouds', () => buildClouds(root, L));
  // as placas, os números e o outdoor foram desenhados com a fonte substituta: refaz quando a do jogo chegar
  whenFontsReady(() => {
    for (const s of [...buildings.signs, ...condo.signs, ...farm.signs]) s.redraw();
    markers.redraw();
    billboard.redraw();
  });

  const off = L.CAMERA.offset;
  /** @type {import('../../../types').MapaProps} */
  const props = {
    flags: markers,
    clouds: sky.clouds,
    bridge: sky.bridge,
    update() {},
    reset() {},
  };
  return {
    props,
    env: { timings, meshes: merged.meshes.length, groups: Object.keys(merged.groups) },
    // tudo o que fica em pé pode ficar entre a câmera e as dogs (o chão não)
    seeThrough: [
      ...merged.meshes.filter((m) => !m.name.startsWith('mapa:ground')),
      ...markers.seeThrough, billboard.mesh, train.group, root.getObjectByName('mapa:ponte'),
      ...root.children.filter((o) => o.name.startsWith('mapa:nuvens')),
    ],
    update(dt, t) {
      shared.time.value = t;
      ground.update(dt);
      details.update(dt, t);
      casa.update(dt, t);
      condo.update(dt, t);
      farm.update(dt, t);
      markers.update(dt, t);
      sky.update(dt, t);
      train.update(dt, t);
      // a sombra acompanha o ponto que a câmera olha (a câmera fica a `offset` dele)
      const c = engine?.camera?.position;
      if (c) engine.focusShadow?.(c.x - off[0], c.z - off[2], { half: 18, top: 12 });
    },
  };
}
