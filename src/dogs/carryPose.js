// Item na boca: o `mouthSocket` (filho do osso da cabeça) onde o jogo pendura a cenoura, a bolinha, a
// pantufa, o patinho, o ursinho ou o frisbee. A pose da boca se ajusta ao tipo do item: detectado pelo nome/userData.carryKind do objeto
// (ou pela forma da caixa envolvente) ou forçado com setForced(kind). Cenoura = pose da v1 (atravessada).
import * as THREE from 'three';

/** Pose por tipo de item: abertura da boca, deslocamento e rotação do socket (em unidades da cabeça). */
/** @type {Record<import('../types').ItemKind, { open: number, pos: number[], rot: number[] }>} */
export const CARRY = {
  carrot: { open: 0.35, pos: [0, 0, 0], rot: [0, 0, 0] },
  // bolinha: boca bem aberta, bola à frente e abaixo — os dentes da frente "afundam" nela
  ball: { open: 1.0, pos: [0, -0.036, 0.016], rot: [0, 0, 0] },
  // pantufa: mordida por uma ponta, atravessada e caída para o lado
  slipper: { open: 0.6, pos: [0.045, -0.02, 0.014], rot: [0.12, 0.18, -0.32] },
  // patinho de borracha: boca aberta como na bolinha, um pouco mais à frente (o bico aparece de lado)
  duck: { open: 0.85, pos: [0, -0.03, 0.022], rot: [0, 0, 0] },
  // ursinho: mordido pela barriga, atravessado e pendendo para o lado (como a pantufa)
  bear: { open: 0.7, pos: [0.03, -0.035, 0.016], rot: [0.1, 0.12, -0.42] },
  // frisbee: mordido pela borda, o disco à frente do focinho, um pouco inclinado para baixo
  frisbee: { open: 0.42, pos: [0, -0.03, 0.01], rot: [0.85, 0, 0] },
};

/**
 * opts: { kind (nome da dog), headBone, toHead, design, s, P }
 * → { mouthSocket, sync() (chame no começo de cada quadro), setForced(kind|null), kind, open }
 */
export function createCarrySocket({ kind, headBone, toHead, design, s, P }) {
  const mouthSocket = new THREE.Object3D();
  mouthSocket.name = `${kind}-mouthSocket`;
  mouthSocket.position.copy(toHead(design.face.mouth)).add(new THREE.Vector3(0, -0.004 * s, 0.006 * s));
  headBone.add(mouthSocket);
  const socketBase = mouthSocket.position.clone();
  const HS = s * P.hs;
  let carryForced = null, carryChild = null, carryOpen = 0.35;
  /** @type {import('../types').ItemKind} */
  let carryKind = 'carrot';
  const _bb = new THREE.Box3(), _bb2 = new THREE.Box3(), _mInv = new THREE.Matrix4(), _mRel = new THREE.Matrix4();
  const _v = new THREE.Vector3(), _v2 = new THREE.Vector3();

  /** Caixa envolvente do item no próprio referencial. */
  function localBox(o) {
    _bb.makeEmpty();
    o.updateMatrixWorld(true);
    _mInv.copy(o.matrixWorld).invert();
    o.traverse((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingBox) m.geometry.computeBoundingBox();
      _mRel.multiplyMatrices(_mInv, m.matrixWorld);
      _bb.union(_bb2.copy(m.geometry.boundingBox).applyMatrix4(_mRel));
    });
    return _bb;
  }
  /** Tipo do item pelo nome/userData, ou pela forma (redondo → bola; achatado → pantufa; comprido → cenoura). */
  function detectKind(o) {
    let tag = '';
    o.traverse((m) => { tag += ' ' + (m.name || '') + ' ' + (m.userData?.carryKind || m.userData?.kind || ''); });
    tag = tag.toLowerCase();
    if (/ball|bola/.test(tag)) return 'ball';
    if (/slipper|pantufa|chinelo/.test(tag)) return 'slipper';
    if (/carrot|cenoura/.test(tag)) return 'carrot';
    if (/duck|patinho/.test(tag)) return 'duck';
    if (/bear|ursinho/.test(tag)) return 'bear';
    if (/frisbee|disco/.test(tag)) return 'frisbee';
    const b = localBox(o);
    if (b.isEmpty()) return 'carrot';
    const d = [b.max.x - b.min.x, b.max.y - b.min.y, b.max.z - b.min.z].sort((a, c) => a - c);
    if (d[2] / Math.max(d[0], 1e-4) < 1.5) return 'ball';
    return d[1] / d[2] > 0.36 ? 'slipper' : 'carrot';
  }
  function applyCarryPose(kind, o) {
    const C = CARRY[kind] || CARRY.carrot;
    carryKind = kind;
    carryOpen = C.open;
    mouthSocket.rotation.set(C.rot[0], C.rot[1], C.rot[2]);
    mouthSocket.position.copy(socketBase).add(_v.set(C.pos[0] * HS, C.pos[1] * HS, C.pos[2] * HS));
    if (o && kind !== 'carrot') {
      // alinha o eixo mais longo do item com o X da cabeça (atravessado) e centraliza a caixa
      const b = localBox(o);
      if (!b.isEmpty()) {
        const dx = b.max.x - b.min.x, dy = b.max.y - b.min.y, dz = b.max.z - b.min.z;
        if (kind === 'slipper' || kind === 'bear') {
          if (dz >= dx && dz >= dy) mouthSocket.rotateY(Math.PI / 2);
          else if (dy >= dx && dy >= dz) mouthSocket.rotateZ(Math.PI / 2);
        }
        b.getCenter(_v2).applyQuaternion(mouthSocket.quaternion);
        mouthSocket.position.sub(_v2);
        // frisbee: a boca segura a borda, então o centro do disco vai para a frente do focinho
        if (kind === 'frisbee') mouthSocket.position.add(_v2.set(0, 0, dz * 0.42).applyQuaternion(mouthSocket.quaternion));
      }
    }
  }

  return {
    mouthSocket,
    /** Reaplica a pose quando o item na boca muda (ou depois de setForced). */
    sync() {
      const ch = mouthSocket.children[0] || null;
      if (ch !== carryChild) {
        carryChild = ch;
        applyCarryPose(carryForced || (ch ? detectKind(ch) : 'carrot'), ch);
      }
    },
    /** Força a pose: 'carrot' | 'ball' | 'slipper' | 'duck' | 'bear' | 'frisbee' | null (automático). */
    setForced(kind) {
      carryForced = kind || null;
      carryChild = undefined; // reaplica no próximo sync
    },
    get kind() { return carryKind; },
    /** Abertura da boca (0..1) pedida pelo item atual. */
    get open() { return carryOpen; },
  };
}
