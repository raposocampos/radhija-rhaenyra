// Humanos de relance (kit de cenas, docs/HISTORIA.md "Humanos de relance"): só mãos e pés, em plano baixo, nunca o
// rosto; o modelo vai no máximo até a cintura. Feitos de formas arredondadas, no estilo das dogs e do cenário.
//  - createTutoraArm(): a manga e a mão da tutora (fecha o basculante na abertura). Pivô no ombro, fora do quadro: o
//    braço gira para dentro da cena e a mão segura a alavanca.
//  - createPorteiro(): as duas botinas com a barra da calça até o joelho (de pé na frente do portãozinho) e o braço com
//    a manga do uniforme, que desce até o trinco.
// Cada um devolve { object, ... } com as partes que a cena anima (rotações e posições); nada aqui anda sozinho.
import * as THREE from 'three';

const SKIN = '#E7B48F';
const SKIN_DARK = '#C98F6B';

function std(color, roughness = 0.8) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0 });
}
/** Cápsula deitada no eixo Y (comprimento total `len`, raio `r`), com a base na origem. */
function capsule(r, len, seg = 10) {
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - 2 * r), 4, seg);
  g.translate(0, len / 2, 0);
  return g;
}
function mesh(geo, material, name) {
  const m = new THREE.Mesh(geo, material);
  m.name = name;
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

/** Mão aberta (palma, quatro dedos e o polegar), com o pulso na origem e os dedos para −Y. */
function hand(skin) {
  const g = new THREE.Group();
  g.name = 'mao';
  const palm = mesh(new THREE.BoxGeometry(0.085, 0.09, 0.03), skin, 'palma');
  palm.position.set(0, -0.055, 0);
  g.add(palm);
  const fingers = [];
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.position.set(-0.03 + i * 0.02, -0.1, 0);
    const fm = mesh(capsule(0.0095, 0.07 - Math.abs(i - 1.5) * 0.008), skin, `dedo-${i + 1}`);
    fm.rotation.x = Math.PI; // aponta para −Y
    f.add(fm);
    g.add(f);
    fingers.push(f);
  }
  const thumb = new THREE.Group();
  thumb.position.set(0.045, -0.035, 0.008);
  const tm = mesh(capsule(0.011, 0.055), skin, 'polegar');
  tm.rotation.set(Math.PI, 0, 0.9);
  thumb.add(tm);
  g.add(thumb);
  /** 0 = aberta … 1 = fechada (segurando). */
  g.userData.grip = (k) => {
    for (const f of fingers) f.rotation.x = -1.35 * k;
    thumb.rotation.y = -0.8 * k;
  };
  return g;
}

/**
 * O braço da tutora: o ombro fica na origem (fora do quadro); `reach` é o comprimento do ombro à mão.
 * Anime object.rotation (o braço inteiro), elbow.rotation.x e hand.userData.grip(k).
 */
export function createTutoraArm({ sleeve = '#8E7CC3', cuff = '#F1ECF7', reach = 0.72 } = {}) {
  const object = new THREE.Group();
  object.name = 'humano:tutora';
  const skin = std(SKIN, 0.7);
  const cloth = std(sleeve, 0.9);
  const upper = mesh(capsule(0.06, reach * 0.5), cloth, 'manga');
  upper.rotation.x = Math.PI; // do ombro para baixo
  object.add(upper);
  const elbow = new THREE.Group();
  elbow.name = 'cotovelo';
  elbow.position.y = -reach * 0.48;
  object.add(elbow);
  const fore = mesh(capsule(0.052, reach * 0.42), cloth, 'antebraco');
  fore.rotation.x = Math.PI;
  elbow.add(fore);
  const cuffM = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.035, 14), std(cuff, 0.85), 'punho');
  cuffM.position.y = -reach * 0.42;
  elbow.add(cuffM);
  const h = hand(skin);
  h.position.y = -reach * 0.44;
  elbow.add(h);
  return { object, elbow, hand: h, dispose: () => disposeTree(object) };
}

/** Botina de trabalho: sola escura, bico arredondado, cano com o cadarço; a ponta para +Z, o calcanhar na origem. */
function boot(leather, sole) {
  const g = new THREE.Group();
  g.name = 'botina';
  const s = mesh(new THREE.BoxGeometry(0.11, 0.035, 0.29), sole, 'sola');
  s.position.set(0, 0.018, 0.1);
  g.add(s);
  const toe = mesh(new THREE.SphereGeometry(0.058, 14, 10), leather, 'bico');
  toe.scale.set(1, 0.72, 1.25);
  toe.position.set(0, 0.06, 0.19);
  g.add(toe);
  const foot = mesh(new THREE.BoxGeometry(0.1, 0.08, 0.2), leather, 'peito-do-pe');
  foot.position.set(0, 0.075, 0.07);
  g.add(foot);
  const shaft = mesh(new THREE.CylinderGeometry(0.052, 0.058, 0.15, 14), leather, 'cano');
  shaft.position.set(0, 0.15, 0);
  g.add(shaft);
  const laces = mesh(new THREE.BoxGeometry(0.03, 0.12, 0.012), std('#E9D8B8', 0.9), 'cadarco');
  laces.position.set(0, 0.12, 0.055);
  laces.rotation.x = -0.35;
  g.add(laces);
  return g;
}

/**
 * O porteiro: as duas pernas (botina e calça até o joelho) e o braço com a manga do uniforme, que desce até o trinco.
 * Anime legs.left/right (passos), arm.rotation e arm.userData.hand.userData.grip(k).
 */
export function createPorteiro({ trousers = '#3D4E73', shirt = '#C9B98F' } = {}) {
  const object = new THREE.Group();
  object.name = 'humano:porteiro';
  const leather = std('#6B4426', 0.65);
  const sole = std('#2A2420', 0.9);
  const pants = std(trousers, 0.92);
  const legs = {};
  for (const side of ['left', 'right']) {
    const leg = new THREE.Group();
    leg.name = `perna-${side === 'left' ? 'esquerda' : 'direita'}`;
    leg.position.x = side === 'left' ? -0.11 : 0.11;
    leg.add(boot(leather, sole));
    const shin = mesh(new THREE.CylinderGeometry(0.068, 0.074, 0.5, 14), pants, 'calca');
    shin.position.y = 0.42;
    leg.add(shin);
    const hem = mesh(new THREE.CylinderGeometry(0.077, 0.077, 0.03, 14), pants, 'barra');
    hem.position.y = 0.19;
    leg.add(hem);
    object.add(leg);
    legs[side] = leg;
  }
  // o braço: o ombro fica bem acima do quadro (só a manga curta, o antebraço e a mão aparecem)
  const arm = new THREE.Group();
  arm.name = 'braco';
  arm.position.set(0.2, 1.25, 0.05);
  const sleeve = mesh(capsule(0.06, 0.32), std(shirt, 0.9), 'manga-do-uniforme');
  sleeve.rotation.x = Math.PI;
  arm.add(sleeve);
  const fore = mesh(capsule(0.045, 0.3), std(SKIN_DARK, 0.75), 'antebraco');
  fore.rotation.x = Math.PI;
  fore.position.y = -0.3;
  arm.add(fore);
  const h = hand(std(SKIN_DARK, 0.75));
  h.position.y = -0.58;
  arm.add(h);
  arm.userData.hand = h;
  object.add(arm);
  return { object, legs, arm, hand: h, dispose: () => disposeTree(object) };
}

function disposeTree(obj) {
  const seen = new Set();
  obj.traverse((o) => {
    if (!o.isMesh) return;
    o.geometry?.dispose();
    if (!seen.has(o.material)) {
      seen.add(o.material);
      o.material?.dispose?.();
    }
  });
  obj.removeFromParent();
}
