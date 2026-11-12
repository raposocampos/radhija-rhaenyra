// RECANTO DAS PATINHAS — o cenário do capítulo 1 (Modo História). Coordenadas em ../layout.js.
// API: buildWorld({ engine, root, layout }) → { props: RecantoProps, seeThrough, env, update(dt, t), dispose() }.
// Peças fixas entram no kit do mapa das fases (src/levels/mapa/world/kit.js): uma malha por material e por ZONA (um
// grupo com nome por lugar), então a área inteira sai em poucas dezenas de desenhos e o recorte da câmera tira as
// zonas fora de vista. O que se mexe (portas, galho, lixeira, barquinho, balde, bola, pombos, cenoura, mãos) fica em
// malhas próprias, com o lado de animar em `props`.
//   base.js     gramado, caminhos, muro, portãozinho, a rua e a cidade ao fundo, árvores, postes, bancos, cartazes, entulho
//   casa.js     a casa em corte (quarto, cozinha) e o quintal (porta da área de serviço, galho, telhas, casinha)
//   casaSul.js  a ala sul da casa (corredor e aspirador, banheiro, despensa no escuro, sala de jantar com a toalha e a
//               lata, sala de estar com o sofá, o pufe e a porta dos fundos)
//   comum.js    a piscina, a área de serviço (tanques, varal) e a torre (porta de mola, terraço, caixa d'água)
//   leste.js    a guarita (toldo, antena, radinho), a lixeira, o lago (ilha, píer, barquinho)
//   garagem.js  a garagem (caminhonete, depósito, prateleira com o balde, bola, corda)
//   atores.js   o Esquadrão Migalha (Capitão, Farelo, Soneca), a cenoura de borracha, as mãos e pés humanos, a chuva
// A sombra do sol cobre só a vizinhança do que a câmera olha (engine.focusShadow), como no mapa.
import * as THREE from 'three';
import { shared } from '../../../../world/util.js';
import { buildTreats } from '../../../../world/treats.js';
import { createKit, whenFontsReady } from '../../../../levels/mapa/world/kit.js';
import { buildBase } from './base.js';
import { buildCasa } from './casa.js';
import { buildCasaSul } from './casaSul.js';
import { buildComum } from './comum.js';
import { buildLeste } from './leste.js';
import { buildGaragem } from './garagem.js';
import { buildAtores } from './atores.js';
import { buildCinemaLight } from './cinemaLight.js';
import { buildTelhado } from './telhado.js';

/**
 * @param {import('../../../../types').LevelBuildArgs} args
 */
export function buildWorld({ engine, root, layout }) {
  const L = layout;
  /** @type {Record<string, number>} */
  const timings = {};
  /** @template T @param {string} name @param {() => T} fn @returns {T} */
  const T = (name, fn) => { const t0 = performance.now(); const v = fn(); timings[name] = Math.round(performance.now() - t0); return v; };
  const kit = createKit(root);
  /** @type {any[]} as peças (cada uma devolve props e, se tiver, update, reset, seeThrough, signs, dispose) */
  const parts = [
    T('base', () => buildBase(kit, root, L)),
    T('casa', () => buildCasa(kit, root, L)),
    T('casaSul', () => buildCasaSul(kit, root, L)),
    T('comum', () => buildComum(kit, root, L)),
    T('leste', () => buildLeste(kit, root, L)),
    T('garagem', () => buildGaragem(kit, root, L)),
    T('telhado', () => buildTelhado(kit, root, L)),
    T('atores', () => buildAtores(root, L)),
    T('luz', () => {
      const light = buildCinemaLight(root, L);
      return { props: { cinemaLight: light }, update: (dt, t) => light.update(dt, t), reset: () => light.reset() };
    }),
  ];
  const merged = T('merge', () => kit.finish());
  // 3ª pessoa: a casa é inteira (paredes até o forro). As paredes dela não projetam sombra própria, para o sol das
  // cenas continuar entrando nos cômodos (o quarto da abertura foi composto assim, como a maquete aberta de antes).
  for (const m of merged.meshes) if (/:casa$/.test(m.name)) m.castShadow = false;
  const treats = T('petiscos', () => buildTreats(root, L.COLLECTIBLES, { glow: 0.3 }));
  // Malha com textura não projeta sombra (as meias perdidas, de 15 cm): o material de sombra do three leva a textura
  // da malha junto, e essa variante do programa só era compilada quando a primeira delas entrava na caixa de sombra,
  // com a câmera andando (medido na primeira passagem: 1 programa depois da carga, na casinha do quintal).
  root.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    if (!m.isMesh || !m.castShadow) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    if (mats.some((x) => x && /** @type {any} */ (x).map && !(x.alphaTest > 0))) m.castShadow = false;
  });
  whenFontsReady(() => { for (const p of parts) for (const s of p.signs || []) s.redraw?.(); });

  /** Os props de todas as peças juntos (cada peça devolve os seus). */
  const props = Object.assign({}, ...parts.map((p) => p.props || {}));
  props.collectibles = treats.list;
  props.update = () => {};
  props.reset = () => { for (const p of parts) p.reset?.(); };

  const fwd = new THREE.Vector3();
  return {
    props,
    env: { timings, meshes: merged.meshes.length, groups: Object.keys(merged.groups) },
    // o que fica em pé pode ficar entre a câmera e as dogs (o chão, a água e os decalques do chão não)
    seeThrough: [
      ...merged.meshes.filter((m) => !/:(ground|plant|contact):/.test(m.name)),
      ...parts.flatMap((p) => p.seeThrough || []),
    ],
    update(dt, t) {
      shared.time.value = t;
      treats.update(dt, t);
      for (const p of parts) p.update?.(dt, t);
      // a sombra acompanha o que a câmera olha: uns metros à frente dela, no chão
      const cam = engine?.camera;
      if (cam?.getWorldDirection) {
        cam.getWorldDirection(fwd);
        const flat = Math.hypot(fwd.x, fwd.z) || 1;
        const reach = 5;
        engine.focusShadow?.(cam.position.x + (fwd.x / flat) * reach, cam.position.z + (fwd.z / flat) * reach, { half: 14, top: 10 });
      }
    },
    dispose() { for (const p of parts) p.dispose?.(); },
  };
}

/**
 * Props do Recanto (o que o puzzle anima). Cada peça do cenário devolve uma parte.
 * @typedef {{
 *   kitchenDoor: import('../../../../types').GateProp, kitchenHandle: import('../../../../types').WallButtonProp,
 *   serviceDoor: import('../../../../types').GateProp, branch: { object: import('three').Object3D, setPos(x: number, z: number): void },
 *   windowLeaf: { object: import('three').Object3D, setOpen(t: number): void }, bowl: { object: import('three').Object3D, setTipped(k: number): void },
 *   bedCarrot: { object: import('three').Object3D, setVisible(on: boolean): void },
 *   towerDoor: import('../../../../types').GateProp, gateLeaf: import('../../../../types').GateProp,
 *   line: { object: import('three').Object3D, shake(k: number): void, setPin(open: number): void },
 *   bin: { object: import('three').Object3D, setPos(x: number, z: number): void },
 *   boat: { object: import('three').Object3D, setPos(x: number, z: number, y?: number, tilt?: number): void },
 *   booth: { radio: { setOn(on: boolean): void }, windowAnchor: { x: number, y: number, z: number } },
 *   bucket: { object: import('three').Object3D, setTip(t: number): void }, ball: { object: import('three').Object3D, setPos(x: number, z: number, y?: number, spin?: number): void },
 *   rope: { object: import('three').Object3D, setPull(k: number): void, setGrip(src: (() => any) | null): void, bitePoint(): { x: number, y: number, z: number } },
 *   storageDoor: import('../../../../types').GateProp,
 *   vacuum?: { object: import('three').Object3D, setPose(x: number, z: number, yaw: number): void, setMode(m: string): void },
 *   pantry?: { object: import('three').Object3D, setLit(k: number): void }, pantrySwitch?: import('../../../../types').WallButtonProp,
 *   tablecloth?: { object: import('three').Object3D, setSlide(p: number): void, setGrip(src: (() => any) | null): void, bitePoint(): { x: number, y: number, z: number } },
 *   cookieTin?: any, pouf?: { object: import('three').Object3D, setPos(x: number, z: number): void },
 *   exitDoor?: import('../../../../types').GateProp & { setLatch(k: number): void },
 *   socks: { id: string, object: import('three').Object3D, collect(): void, reset(): void }[],
 *   squad: any, carrot: any, humans: any, ghosts: any, rain: any, city: any, cinemaLight?: any,
 *   collectibles: import('../../../../types').CollectibleProp[]
 * }} RecantoProps
 */
