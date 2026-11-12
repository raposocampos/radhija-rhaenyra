// RECANTO DAS PATINHAS — o cenário do capítulo 1 (Modo História). Coordenadas em ../layout.js.
// API: buildWorld({ engine, root, layout }) → { props: RecantoProps, seeThrough, env, update(dt, t), dispose() }.
// Peças fixas entram no kit do mapa das fases (src/levels/mapa/world/kit.js): uma malha por material e por ZONA (um
// grupo com nome por lugar), então a área inteira sai em poucas dezenas de desenhos e o recorte da câmera tira as
// zonas fora de vista. O que se mexe (portas, galho, lixeira, barquinho, balde, bola, pombos, cenoura, mãos) fica em
// malhas próprias, com o lado de animar em `props`.
//   base.js     gramado, caminhos, muro, portãozinho, a rua e a cidade ao fundo, árvores, postes, bancos, cartazes, entulho
//   casa.js     a casa em corte (quarto, cozinha)
//   casaSul.js  a ala sul da casa (corredor e aspirador, banheiro, despensa no escuro, sala de jantar com a toalha e a
//               lata, sala de estar com o sofá, o pufe e a porta dos fundos)
//   quintal.js  o quintal maior (a horta, o jabuti, a irrigação, a torneira e o balde, a goiabeira com a pipa, a porta da
//               área de serviço, o galho e as telhas, a casinha)
//   comum.js    a piscina, a área de serviço (tanques, varal) e a torre (porta de mola, terraço, caixa d'água)
//   leste.js    a guarita (toldo, antena, radinho), a lixeira, o lago (ilha, píer, barquinho)
//   garagem.js  a garagem (caminhonete, depósito, prateleira com o balde, bola, corda)
//   atores.js   o Esquadrão Migalha (Capitão, Farelo, Soneca), a cenoura de borracha, as mãos e pés humanos, a chuva
// A sombra do sol cobre só a vizinhança do que a câmera olha (engine.focusShadow), como no mapa. E sai barata (o teto
// de desempenho do celular conta a passada de sombra de novo): miudezas não fazem sombra e as caixas fazem a sombra por
// uma caixa simples (createAreaKit, abaixo).
import * as THREE from 'three';
import { shared } from '../../../../world/util.js';
import { buildTreats } from '../../../../world/treats.js';
import { createKit, whenFontsReady } from '../../../../levels/mapa/world/kit.js';
import { buildBase } from './base.js';
import { buildCasa } from './casa.js';
import { buildCasaSul } from './casaSul.js';
import { buildQuintal } from './quintal.js';
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
  const kit = createAreaKit(root);
  /** @type {any[]} as peças (cada uma devolve props e, se tiver, update, reset, seeThrough, signs, dispose) */
  const parts = [
    T('base', () => buildBase(kit, root, L)),
    T('casa', () => buildCasa(kit, root, L)),
    T('casaSul', () => buildCasaSul(kit, root, L)),
    T('quintal', () => buildQuintal(kit, root, L)),
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
      ...merged.meshes.filter((m) => !/:(ground|plant|contact|shadow):/.test(m.name)),
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

const _sb = new THREE.Box3(), _sm = new THREE.Matrix4(), _sq = new THREE.Quaternion(), _se = new THREE.Euler(), _sp = new THREE.Vector3(), _ss = new THREE.Vector3();
const _va = new THREE.Vector3(), _vb = new THREE.Vector3(), _vc = new THREE.Vector3(), _vn = new THREE.Vector3(), _vm = new THREE.Vector3();

/**
 * A peça é uma caixa (subdividida para a cor por vértice, como as paredes, ou com as quinas arredondadas)? Ocupando
 * quase toda a caixa em volta dela (o volume pelo teorema da divergência, a partir do meio da base: uma caixa sem a face
 * de baixo, que fica no chão, conta inteira): um cilindro ocupa 79 %, uma esfera 52 %, um telhado ou um arco bem menos.
 * @param {THREE.BufferGeometry} geo
 */
function boxLike(geo) {
  if (geo.type !== 'BoxGeometry' && geo.type !== 'BufferGeometry') return false;
  const pos = geo.attributes.position, idx = geo.index;
  const tris = (idx ? idx.count : pos.count) / 3;
  if (tris <= 24) return false;
  geo.computeBoundingBox();
  const b = geo.boundingBox;
  const sx = b.max.x - b.min.x, sy = b.max.y - b.min.y, sz = b.max.z - b.min.z;
  if (Math.min(sx, sy, sz) < 0.004) return false;
  b.getCenter(_vm).setY(b.min.y);
  let vol = 0;
  for (let t = 0; t < tris; t++) {
    const i = idx ? idx.getX(t * 3) : t * 3, j = idx ? idx.getX(t * 3 + 1) : t * 3 + 1, k = idx ? idx.getX(t * 3 + 2) : t * 3 + 2;
    _va.fromBufferAttribute(pos, i).sub(_vm);
    _vb.fromBufferAttribute(pos, j).sub(_vm);
    _vc.fromBufferAttribute(pos, k).sub(_vm);
    vol += _va.dot(_vn.crossVectors(_vb, _vc)) / 6;
  }
  return vol >= 0.9 * sx * sy * sz && vol <= 1.02 * sx * sy * sz;
}

/**
 * O kit da área, com a sombra mais barata (o teto de desempenho do celular conta a passada de sombra de novo):
 *  - miudezas sem sombra: uma peça 'solid' de até 8 cm (frutinhas, puxadores, parafusos, bolinhas, potinhos) ou chata no
 *    chão (até 6,5 cm de altura, rente a ele: tampas, discos, pedras chatas, mangueira enrolada) vai para o balde
 *    'nocast' (o mesmo material, sem sombra): a sombra dela mal aparece;
 *  - caixas com a sombra de uma caixa simples: uma peça 'solid' que é uma caixa (as paredes com a cor por vértice, de
 *    centenas de triângulos; as caixas de quinas arredondadas) vai para o 'nocast', e a caixa dela, com 12 triângulos,
 *    faz a sombra no lugar (no balde 'shadow', que não desenha nada: a mesma sombra, sem os triângulos).
 * A casa já não faz sombra (fica como está).
 * @param {THREE.Group} root
 * @returns {ReturnType<typeof createKit>}
 */
function createAreaKit(root) {
  const kit = createKit(root);
  /** @type {ReturnType<typeof createKit>['add']} */
  const add = (geo, o = {}) => {
    if ((o.slot ?? 'solid') !== 'solid' || o.group === 'casa') return kit.add(geo, o);
    geo.computeBoundingBox();
    _se.set(o.rx ?? 0, o.ry ?? 0, o.rz ?? 0);
    _sm.compose(_sp.set(o.x ?? 0, o.y ?? 0, o.z ?? 0), _sq.setFromEuler(_se), _ss.set(o.sx ?? 1, o.sy ?? 1, o.sz ?? 1));
    _sb.copy(geo.boundingBox).applyMatrix4(_sm);
    const sx = _sb.max.x - _sb.min.x, sy = _sb.max.y - _sb.min.y, sz = _sb.max.z - _sb.min.z;
    if (Math.max(sx, sy, sz) < 0.08 || (sy < 0.065 && _sb.min.y < 0.06)) return kit.add(geo, { ...o, slot: 'nocast', ao: o.ao ?? true });
    if (boxLike(geo)) {
      const b = geo.boundingBox;
      const box = new THREE.BoxGeometry(b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z);
      box.translate((b.min.x + b.max.x) / 2, (b.min.y + b.max.y) / 2, (b.min.z + b.max.z) / 2);
      kit.add(box, { x: o.x, y: o.y, z: o.z, rx: o.rx, ry: o.ry, rz: o.rz, sx: o.sx, sy: o.sy, sz: o.sz, group: o.group, slot: 'shadow', ao: false });
      return kit.add(geo, { ...o, slot: 'nocast', ao: o.ao ?? true });
    }
    return kit.add(geo, o);
  };
  return { add, finish: kit.finish };
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
 *   rope: { object: import('three').Object3D, setPull(k: number): void, setGrip(src: (() => any) | null): void, bitePoint(): { x: number, y: number, z: number }, tip(): { x: number, y: number, z: number } },
 *   storageDoor: import('../../../../types').GateProp, quintal?: any,
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
