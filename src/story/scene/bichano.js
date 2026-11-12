// O BICHANO no Modo História (cap. 1): o mesmo gato laranja rajado da fase 9 (createCat de src/world/cat.js, o modelo
// não muda), agora morando na garagem do Recanto, em cima do capô quentinho da caminhonete. É testemunha: dorme, senta
// para conversar, brinca (a patinha no ar, o rabo chicoteando) e dá o depoimento (a boca mexe, a cabeça balança, o
// olhar de sabichão).
// As poses daqui são dele (o setPose do gato da fase 9 é outro); o modelo é animado POR FORA, pelas articulações do
// esqueleto de grupos que o createCat monta (o corpo, o pescoço, a cabeça, as quatro patas e os oito gomos do rabo).
// createBichano() → { object, setPose(name, k?), update(dt, t), lookAt(p | null), say(on), pose, spotY }
//   Poses: 'dorme' (enroladinho, a respiração), 'sentado' (sentado, acordado, olhando), 'brinca' (agachado na frente,
//   o traseiro rebolando e a pata direita dando tapinhas no ar; k 0..1 é o tapa, sem k ele bate sozinho), 'fala'
//   (sentado, a boca mexe, a cabeça acompanha e uma pata gesticula). say(on) mexe a boca em qualquer pose.
//   A origem fica no apoio (as patas, ou a barriga quando ele dorme, encostam em y = 0); ele olha para +Z.
import * as THREE from 'three';
import { createCat } from '../../world/cat.js';

const { clamp, lerp, smoothstep: ss } = THREE.MathUtils;
const TAU = Math.PI * 2;

/** As articulações do gato da fase 9, achadas pela montagem do createCat (ver src/world/cat.js). */
function catRig(root) {
  const body = root.children.find((o) => !o.isMesh);
  const groups = body.children.filter((o) => !o.isMesh);
  const neck = groups.find((g) => g.position.z > 0.1 && g.position.y > 0);
  const head = neck?.children[0];
  const hips = groups.filter((g) => g !== neck && g.position.y < 0 && g.children.some((c) => !c.isMesh));
  const tailRoot = groups.find((g) => g.position.z < -0.15);
  const torso = body.children.find((o) => o.isMesh);
  if (!head || hips.length !== 4 || !tailRoot || !torso) throw new Error('bichano: o modelo do gato (src/world/cat.js) mudou de montagem');
  const legs = hips.map((hip) => ({ hip, knee: hip.children.find((c) => !c.isMesh), front: hip.position.z > 0, side: Math.sign(hip.position.x) }));
  const tail = [];
  for (let g = tailRoot.children[0]; g; g = g.children.find((c) => !c.isMesh)) tail.push(g);
  const eyes = head.children.filter((g) => !g.isMesh && g.children.length === 4).map((eye) => ({ eye, pupil: eye.children[1], lid: eye.children[3] }));
  const ears = head.children.filter((g) => !g.isMesh && g.children.length === 2);
  return { body, neck, head, legs, tail, torso, eyes, ears };
}

/**
 * O gato da fase 9 é feito para o close de lá (esferas de até 28 × 18 gomos); aqui ele mora no cenário, quase sempre
 * longe: as mesmas formas (pelos parâmetros de cada geometria, com a mesma textura), com menos gomos. Uma peça girada
 * depois de criada (o tronco e os gomos do rabo, rotateX(π/2)) é reconhecida pela caixa; o que não bate fica como está.
 */
function lighten(root) {
  const same = (a, b) => a.min.distanceTo(b.min) < 1e-6 && a.max.distanceTo(b.max) < 1e-6;
  root.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    if (!m.isMesh) return;
    const g = /** @type {any} */ (m.geometry), p = g.parameters;
    if (!p) return;
    /** @type {(lo: boolean) => THREE.BufferGeometry} */
    let make;
    if (g.type === 'SphereGeometry' && p.widthSegments > 12) {
      make = (lo) => new THREE.SphereGeometry(p.radius, lo ? Math.max(10, Math.round(p.widthSegments * 0.55)) : p.widthSegments,
        lo ? Math.max(7, Math.round(p.heightSegments * 0.55)) : p.heightSegments, p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
    } else if (g.type === 'CapsuleGeometry' && (p.capSegments > 2 || p.radialSegments > 8)) {
      make = (lo) => new THREE.CapsuleGeometry(p.radius, p.length, lo ? 2 : p.capSegments, lo ? Math.min(8, p.radialSegments) : p.radialSegments);
    } else return;
    const ref = make(false);
    ref.computeBoundingBox();
    g.computeBoundingBox();
    let turn = false;
    if (!same(ref.boundingBox, g.boundingBox)) {
      ref.rotateX(Math.PI / 2);
      ref.computeBoundingBox();
      if (!same(ref.boundingBox, g.boundingBox)) { ref.dispose(); return; }
      turn = true;
    }
    ref.dispose();
    const lo = make(true);
    if (turn) lo.rotateX(Math.PI / 2);
    g.dispose();
    m.geometry = lo;
  });
}

/** Uma pose: números do corpo, da cabeça, das patas (quadril, joelho) e do rabo. */
const KEYS = ['bodyY', 'pitch', 'roll', 'neck', 'hp', 'hy', 'hr', 'eyes', 'pupil', 'ears', 'raise', 'curl', 'wrap', 'sway', 'swayF', 'breath', 'mouth',
  'fh', 'fk', 'hh', 'hk', 'swipe'];
/** As poses paradas (o que mexe no tempo vem por cima, em `live`). */
const POSES = {
  // enroladinho: o corpo baixo e deitado de lado, a cabeça nas patas, o rabo em volta (os números da fase 9)
  dorme: { bodyY: 0.075, pitch: 0, roll: 0.25, neck: 0.45, hp: 0.55, hy: 0.55, hr: 0.1, eyes: 0, pupil: 0.45, ears: 0, raise: 0.35, curl: 0.04, wrap: 0.36, sway: 0.02, swayF: 1.6, breath: 1, mouth: 0, fh: 1.25, fk: -1.6, hh: -0.9, hk: 2.0, swipe: 0 },
  // sentado, de peito empinado, a cabeça no nível, o rabo enrolado nas patas
  sentado: { bodyY: 0.13, pitch: -0.55, roll: 0, neck: 0, hp: 0.48, hy: 0, hr: 0, eyes: 1, pupil: 0.45, ears: 0, raise: -0.5, curl: 0.12, wrap: 0.2, sway: 0.12, swayF: 1.2, breath: 0.4, mouth: 0, fh: 0.55, fk: -0.1, hh: -1.2, hk: 2.2, swipe: 0 },
  // agachado para o bote: a frente baixa, o traseiro alto, as pupilas redondas e o rabo em pé chicoteando
  brinca: { bodyY: 0.12, pitch: 0.28, roll: 0, neck: -0.1, hp: -0.3, hy: 0, hr: 0, eyes: 1, pupil: 1.6, ears: -0.15, raise: 0.9, curl: 0.15, wrap: 0, sway: 0.8, swayF: 6, breath: 0.3, mouth: 0, fh: 0.9, fk: -1.25, hh: -0.6, hk: 1.25, swipe: 0 },
  // o depoimento: sentado, o olhar meio fechado de sabichão
  fala: { bodyY: 0.13, pitch: -0.55, roll: 0, neck: 0, hp: 0.45, hy: 0, hr: 0, eyes: 0.7, pupil: 0.55, ears: 0.1, raise: -0.5, curl: 0.12, wrap: 0.2, sway: 0.25, swayF: 1.8, breath: 0.4, mouth: 0, fh: 0.55, fk: -0.1, hh: -1.2, hk: 2.2, swipe: 0 },
};
export const BICHANO_POSES = Object.keys(POSES);

export function createBichano() {
  const cat = createCat();
  lighten(cat.object);
  const rig = catRig(cat.object);
  const object = new THREE.Group();
  object.name = 'bichano:garagem';
  object.add(cat.object);
  cat.object.position.set(0, 0, 0);
  cat.object.rotation.set(0, 0, 0);
  // a boca que abre na fala (a do modelo é só o risquinho do sorriso)
  const mouthMat = new THREE.MeshStandardMaterial({ color: '#3a1a14', roughness: 0.6 });
  const mouth = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6).scale(0.011, 0.01, 0.006), mouthMat);
  mouth.name = 'bichano-boca';
  mouth.position.set(0, -0.04, 0.078);
  mouth.scale.set(1, 0.05, 1);
  rig.head.add(mouth);

  const S = {
    name: 'dorme', k: /** @type {number | null} */ (null), poseT: 0,
    cur: { ...POSES.dorme }, look: /** @type {{x:number,y:number,z:number}|null} */ (null), lookK: 0, lookYaw: 0, lookPitch: 0,
    say: false, talkK: 0, blinkT: 2, blink: 0, t: 0,
  };
  // o quanto erguer o gato em cada pose para ele encostar no apoio (medido no modelo, uma vez)
  const lift = {};
  const _b = new THREE.Box3();

  function apply(P, t) {
    const { body, neck, head, legs, tail, torso, eyes, ears } = rig;
    body.position.y = P.bodyY;
    body.rotation.set(P.pitch, 0, P.roll);
    neck.rotation.set(P.neck, 0, 0);
    head.rotation.set(P.hp, P.hy, P.hr);
    // o olhar: a cabeça vira (até onde um pescoço de gato vai)
    if (S.lookK > 0.002) {
      const w = S.lookK * clamp(P.eyes + 0.2, 0, 1);
      head.rotation.y = lerp(head.rotation.y, S.lookYaw, w);
      head.rotation.x = lerp(head.rotation.x, P.hp + S.lookPitch, w);
    }
    for (const e of ears) e.rotation.x = -P.ears * 0.8;
    for (const l of legs) {
      l.hip.rotation.set(l.front ? P.fh : P.hh, 0, 0);
      l.knee.rotation.set(l.front ? P.fk : P.hk, 0, 0);
    }
    // a pata direita da frente: o tapinha no ar (brinca) ou o gesto (fala)
    if (P.swipe > 0.001) {
      const paw = legs.find((l) => l.front && l.side < 0) || legs[0];
      paw.hip.rotation.x = lerp(paw.hip.rotation.x, -0.9, P.swipe);
      paw.hip.rotation.z = -0.25 * P.swipe;
      paw.knee.rotation.x = lerp(paw.knee.rotation.x, -1.1, P.swipe);
    }
    tail.forEach((seg, i) => {
      const w = Math.sin(t * P.swayF - i * 0.55) * P.sway * (i / tail.length);
      // raise: a raiz sobe (+) ou desce; curl: cada gomo enrola para cima; wrap: para o lado (em volta do corpo)
      seg.rotation.set(i === 0 ? -P.raise : P.curl * (i < 3 ? 0.4 : 1), w + P.wrap * (i > 0 ? 1 : 0.5), 0);
    });
    torso.scale.y = 0.9 + Math.sin(t * 2.1) * 0.032 * P.breath;
    // os olhos (pálpebra da fase 9) e as pupilas (redondas de animação, fininhas de sono)
    const blinkK = S.blink > 0 ? Math.sin(Math.PI * Math.min(1, S.blink / 0.15)) : 0;
    const open = P.eyes * (1 - blinkK);
    for (const e of eyes) {
      e.lid.rotation.x = lerp(Math.PI / 2 + 0.05, -0.15, open);
      e.lid.visible = open < 0.98;
      e.pupil.scale.set(P.pupil, 1.25, 0.5);
    }
    const flap = S.talkK * (0.3 + 0.7 * Math.abs(Math.sin(t * 10)) * (0.6 + 0.4 * Math.sin(t * 2.3)));
    const mo = Math.max(P.mouth, flap);
    mouth.scale.set(1, 0.05 + 0.95 * mo, 1);
    mouth.visible = mo > 0.02;
  }

  /** O alvo agora (a pose parada mais o que mexe no tempo). */
  function target(t) {
    const P = { ...POSES[S.name] };
    if (S.name === 'brinca') {
      // o tapinha: sozinho, um a cada 1,1 s; o traseiro rebola antes
      const k = S.k ?? ((S.poseT % 1.1) / 1.1);
      P.swipe = Math.sin(Math.PI * ss(k, 0.45, 0.75)) * (k < 0.9 ? 1 : 0);
      P.roll = 0.07 * Math.sin(t * 13) * (1 - ss(k, 0.4, 0.5));
      P.bodyY += 0.012 * P.swipe;
      P.hp -= 0.15 * P.swipe;
    } else if (S.name === 'fala') {
      // a cabeça acompanha a fala e a pata direita faz um gesto de vez em quando
      P.hr = 0.12 * Math.sin(t * 1.7);
      P.hp += 0.06 * Math.sin(t * 3.3);
      P.swipe = 0.45 * ss(Math.sin(t * 0.9), 0.55, 0.95);
    } else if (S.name === 'sentado') {
      P.hy = 0.25 * Math.sin(t * 0.45) * ss(Math.sin(t * 0.21), -0.2, 0.4);
      P.ears = 0.15 * ss(Math.sin(t * 1.3 + 1), 0.9, 1);
    }
    return P;
  }

  const _v = new THREE.Vector3();
  function update(dt, t) {
    S.t = t;
    S.poseT += dt;
    S.blinkT -= dt;
    if (S.blinkT <= 0) { S.blink = 0.0001; S.blinkT = 2.5 + ((Math.sin(t * 91.7) * 4375.85) % 1 + 1) % 1 * 3; }
    if (S.blink > 0) { S.blink += dt; if (S.blink > 0.15) S.blink = 0; }
    S.talkK += ((S.say || S.name === 'fala' ? 1 : 0) - S.talkK) * (1 - Math.exp(-dt * 12));
    S.lookK += ((S.look ? 1 : 0) - S.lookK) * (1 - Math.exp(-dt * 6));
    if (S.look) {
      object.updateMatrixWorld(true);
      rig.body.worldToLocal(_v.set(S.look.x, S.look.y, S.look.z));
      _v.sub(rig.neck.position);
      const f = 1 - Math.exp(-dt * 8);
      S.lookYaw += (clamp(Math.atan2(_v.x, _v.z), -1.1, 1.1) - S.lookYaw) * f;
      S.lookPitch += (clamp(-Math.atan2(_v.y - 0.06, Math.hypot(_v.x, _v.z)), -0.5, 0.5) - S.lookPitch) * f;
    }
    const T = target(t);
    const f = 1 - Math.exp(-dt * (S.name === 'brinca' ? 14 : 5));
    for (const k of KEYS) S.cur[k] += (T[k] - S.cur[k]) * f;
    // o rabo e o ritmo seguem a pose nova sem esperar a mistura
    S.cur.swayF = T.swayF;
    apply(S.cur, t);
    cat.object.position.y = lerp(cat.object.position.y, lift[S.name] ?? 0, f);
  }

  // mede quanto cada pose afunda abaixo da origem (o gato da fase 9 não tem os pés no zero)
  for (const name of Object.keys(POSES)) {
    apply({ ...POSES[name], swipe: 0 }, 0);
    cat.object.position.y = 0;
    object.updateMatrixWorld(true);
    _b.setFromObject(cat.object, true);
    lift[name] = -_b.min.y;
  }
  apply(S.cur, 0);
  cat.object.position.y = lift.dorme;

  return {
    object,
    /** O nome da pose agora. */
    get pose() { return S.name; },
    /** Quanto a pose ergue o gato acima do apoio. */
    get spotY() { return lift[S.name]; },
    /**
     * 'dorme' | 'sentado' | 'brinca' | 'fala' (o resto vira 'sentado'); k: o progresso do tapinha em 'brinca'.
     * @param {string} name @param {number} [k] @param {{ instant?: boolean }} [opts]
     */
    setPose(name, k, opts = {}) {
      if (!POSES[name]) name = 'sentado';
      if (name !== S.name) { S.name = name; S.poseT = 0; }
      S.k = typeof k === 'number' && Number.isFinite(k) ? clamp(k, 0, 1) : null;
      if (opts.instant) {
        Object.assign(S.cur, target(S.t));
        apply(S.cur, S.t);
        cat.object.position.y = lift[S.name] ?? 0;
      }
    },
    update,
    /** A cabeça vira para um ponto do mundo; null volta ao normal. */
    lookAt(p) { S.look = p ? { x: p.x, y: p.y, z: p.z } : null; },
    /** A boca mexe (em qualquer pose; em 'fala' ela já mexe). */
    say(on) { S.say = !!on; },
    setVisible(on) { object.visible = !!on; },
    /** Libera o gato inteiro (as malhas, os materiais e as texturas de pelagem) e tira da cena. */
    dispose() {
      const mats = new Set();
      object.traverse((o) => {
        if (!(/** @type {any} */ (o).isMesh)) return;
        const m = /** @type {THREE.Mesh} */ (o);
        m.geometry.dispose();
        mats.add(m.material);
      });
      for (const m of mats) {
        /** @type {any} */ (m).map?.dispose?.();
        /** @type {any} */ (m).dispose?.();
      }
      object.removeFromParent();
    },
  };
}
