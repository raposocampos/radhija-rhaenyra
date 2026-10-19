// Rolar de costas no modelo novo (pedido do usuário: a rolagem do modelo atual, o corpo girando reto como uma tábua
// com as patas esticadas, ficou "nada natural"). Por cima da pose do esqueleto guia, só enquanto o extra 'roll' roda:
//   deita (a pose do guia) → tomba de lado puxando pelo ombro (o peito gira antes da garupa) → de costas com o corpo
//   em "C" (cabeça e garupa curvadas para a barriga), as patas da frente dobradas no peito e as de trás abertas em
//   "sapinho", pedalando → se esfrega balançando de um lado para o outro, a coluna serpenteando e a cabeça esfregando
//   o chão → volta de lado, puxando agora pela garupa → de bruços e levanta (de novo a pose do guia).
// O corpo fica apoiado no chão o tempo todo (dog.js acerta a altura pelo ponto mais baixo: nem flutua nem afunda).
import * as THREE from 'three';
import { keyed } from '../dogAnimation.js';

const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
/** Giro do corpo em torno do comprimento (rad; + = ela tomba para o lado direito), pelo progresso k da rolagem. */
const ANGLE = [[0, 0], [0.12, 0], [0.2, 0.3], [0.3, 1.4], [0.4, 2.45], [0.64, 2.45], [0.72, 1.5], [0.8, 0.55], [0.87, 0.08], [0.9, 0], [1, 0]];
/** Esfregando as costas (0..1). */
const RUB = [[0, 0], [0.4, 0], [0.46, 1], [0.6, 1], [0.66, 0], [1, 0]];
/** Peso desta pose sobre a do guia: no começo (deitando) e no fim (levantando) vale a do guia. */
const OWN = [[0, 0], [0.1, 0], [0.17, 1], [0.84, 1], [0.91, 0], [1, 0]];

/**
 * @param {{ skel2: { bones: THREE.Bone[], index: Record<string, number> }, cfg: { visual: { shoulder: number } } }} opts
 */
export function createRollOverlay({ skel2, cfg }) {
  const I = skel2.index;
  const B = (n) => skel2.bones[I[n]];
  const hc = cfg.visual.shoulder * 0.72; // meio do tronco: o eixo do giro
  const _e = new THREE.Euler();
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion();
  const _p = new THREE.Vector3();
  const _Z = new THREE.Vector3(0, 0, 1);
  /** Multiplica uma rotação (Euler YXZ) na rotação local do osso, com peso w. */
  const add = (bone, x, y, z, w) => {
    _q.setFromEuler(_e.set(x * w, y * w, z * w, 'YXZ'));
    bone.quaternion.multiply(_q);
  };
  /** Leva a rotação local do osso para (x, y, z) (absoluta, a partir do repouso), com peso w. */
  const toward = (bone, x, y, z, w) => {
    if (w <= 0) return;
    _q.setFromEuler(_e.set(x, y, z, 'YXZ'));
    bone.quaternion.slerp(_q, Math.min(1, w));
  };

  /**
   * Aplica a rolagem (se o extra for 'roll') nos ossos e no corpo (inner). Devolve o peso aplicado (0 = nada).
   * @param {{ kind: string, k: number, t: number } | null | undefined} extra @param {THREE.Object3D} inner
   */
  function apply(extra, inner) {
    if (!extra || extra.kind !== 'roll') return 0;
    const k = Math.min(1, Math.max(0, extra.k));
    const t = extra.t || 0;
    const w = keyed(OWN, k);
    if (w <= 1e-3) return 0;
    const rub = keyed(RUB, k);
    const wig = Math.sin(t * 5.6);
    const A = keyed(ANGLE, k) + 0.28 * wig * rub;
    const dA = (keyed(ANGLE, Math.min(1, k + 0.01)) - keyed(ANGLE, Math.max(0, k - 0.01))) / 0.02;
    const side = sstep(0.3, 1.3, A);
    const back = sstep(1.3, 2.3, A);
    const fold = sstep(0.4, 1.8, A);

    // corpo: gira em torno do meio do tronco (0, hc, 0); a altura certa vem do contato com o chão (dog.js)
    _q2.setFromAxisAngle(_Z, A);
    _p.set(0, hc, 0).applyQuaternion(_q2);
    inner.quaternion.slerp(_q2, w);
    inner.position.lerp(_p.set(-_p.x, hc - _p.y, 0), w);

    // coluna: torce puxando pelo ombro na ida e pela garupa na volta; de costas, curva em "C" para a barriga e,
    // esfregando, serpenteia de um lado para o outro
    const twist = Math.max(-0.35, Math.min(0.35, dA * 0.03));
    const flex = 0.32 * back;
    const bend = 0.12 * back + 0.22 * Math.sin(t * 5.6 + 0.9) * rub;
    add(B('spineF'), flex / 2, bend / 2, twist / 2, w);
    add(B('chest'), flex / 2, bend / 2, twist / 2, w);
    add(B('spineB'), -flex / 2, -bend / 2, -twist / 2, w);
    add(B('hips'), -flex / 2, -bend / 2, -twist / 2, w);
    // pescoço e cabeça: de lado, a cabeça descansa no chão; de costas, vira para trás e esfrega de um lado para o outro
    const rubHead = Math.sin(t * 5.6 + 1.6) * rub;
    add(B('neck'), -0.25 * back + 0.12 * side * (1 - back), 0.3 * rubHead, 0.18 * side * (1 - back), w);
    add(B('neck1'), -0.15 * back, 0.2 * rubHead, 0, w);
    add(B('head'), -0.2 * back, 0.15 * rubHead, 0, w);

    // patas: da frente dobradas junto do peito, de trás abertas em "sapinho"; esfregando, pedalam
    const lw = w * fold;
    const pedal = (ph) => Math.sin(t * 7.5 + ph) * rub;
    /** @type {[string, number, number][]} lado, sinal (abrir para fora) e fase da pedalada */
    const legs = [['L', 1, 0], ['R', -1, Math.PI]];
    for (const [s, sg, ph] of legs) {
      toward(B(`F${s}u`), -1.1 + 0.3 * pedal(ph), 0, 0.15 * sg, lw);
      toward(B(`F${s}l`), 2.25, 0, 0, lw);
      toward(B(`F${s}c`), 1.15, 0, 0, lw);
      toward(B(`F${s}p`), 0.45, 0, 0, lw);
      toward(B(`H${s}u`), -0.9 + 0.35 * pedal(ph + Math.PI / 2), 0, 0.42 * sg, lw);
      toward(B(`H${s}l`), 1.2, 0, 0, lw);
      toward(B(`H${s}m`), -0.7, 0, 0, lw);
      toward(B(`H${s}p`), 0.4, 0, 0, lw);
    }
    // rabo: estica para trás, rente ao chão, abanando
    const tw = w * side;
    const wag = 0.45 * Math.sin(t * 9) * side;
    toward(B('tail0'), -1.25, wag, 0, tw);
    toward(B('tail1'), -0.5, wag * 0.4, 0, tw);
    toward(B('tail2'), -0.5, wag * 0.3, 0, tw);
    toward(B('tail3'), -0.4, 0, 0, tw);
    toward(B('tail4'), -0.3, 0, 0, tw);
    return w;
  }

  return { apply };
}
