// Kit de peças reutilizáveis para puzzles de fase (dicas, prompts, colecionáveis, item carregado,
// entrega no objetivo). Cada fase compõe o seu puzzle com isso + as mecânicas de src/game/mechanics/.
// Ver docs/ARQUITETURA.md §4.5 (interface de puzzle).
import * as THREE from 'three';

/** Distância até um ponto medida pelo centro OU pela cabeça da dog (o que estiver mais perto). */
export function reach(c, x, z) {
  const hl = (c.cfg.visual?.length || 0.6) * 0.42;
  const hx = c.x + Math.sin(c.yaw) * hl;
  const hz = c.z + Math.cos(c.yaw) * hl;
  return Math.min(Math.hypot(c.x - x, c.z - z), Math.hypot(hx - x, hz - z));
}

/**
 * Dicas (hint) e prompts (interact:prompt) sem repetição excessiva.
 * texts: { hint: { chave: 'texto' }, prompt: { chave: 'texto' } }
 */
export function createHints(emit, texts) {
  const S = { time: 0, next: new Map(), prev: new Set(), now: new Set(), prompt: undefined, promptKind: null };
  return {
    S,
    /** Começo de quadro (chame no início do update do puzzle). */
    frame(dt) {
      S.time += dt;
      S.prev = S.now;
      S.now = new Set();
    },
    /** Dica na borda de subida da condição (enquanto a condição dura, não repete), com cooldown. */
    cond(key, duration = 3.6, cooldown = 9) {
      S.now.add(key);
      if (S.prev.has(key)) return;
      if ((S.next.get(key) || 0) > S.time) return;
      S.next.set(key, S.time + cooldown);
      emit('hint', { text: texts.hint[key] ?? key, duration });
    },
    /** Dica imediata (ex.: ao apertar E), com cooldown curto. */
    now(key, duration = 3.6, cooldown = 2.5) {
      if ((S.next.get(key) || 0) > S.time) return;
      S.next.set(key, S.time + cooldown);
      emit('hint', { text: texts.hint[key] ?? key, duration });
    },
    setPrompt(kind, key = 'E') {
      const text = kind ? texts.prompt[kind] ?? kind : null;
      if (text === S.prompt) return;
      S.prompt = text;
      S.promptKind = kind;
      emit('interact:prompt', text ? { text, key } : { text: null });
    },
    get promptKind() { return S.promptKind; },
    reset() {
      S.next = new Map();
      S.prev = new Set();
      S.now = new Set();
      S.prompt = undefined;
      S.promptKind = null;
    },
  };
}

/** Colecionáveis: coleta automática pela dog ativa ao encostar. */
export function createCollectibles({ list, props, emit, pickupR = 0.42 }) {
  const got = new Set();
  return {
    update(active) {
      list.forEach((col, i) => {
        if (got.has(col.id)) return;
        // na altura certa: um ossinho lá em cima (col.y) só para quem está lá; quem está lá em cima não pega os do chão
        if (Math.abs((active.y || 0) - (col.y ?? 0)) > 0.6) return;
        if (Math.hypot(active.x - col.x, active.z - col.z) < pickupR) {
          got.add(col.id);
          const item = props?.collectibles?.find?.((p) => p.id === col.id) || props?.collectibles?.[i];
          item?.collect?.();
          emit('collectible:pickup', { id: col.id, x: col.x, z: col.z, count: got.size, total: list.length });
        }
      });
    },
    reset() {
      got.clear();
      props?.collectibles?.forEach?.((c) => c.reset?.());
    },
    get count() { return got.size; },
    get total() { return list.length; },
  };
}

// ---------------------------------------------------------------------------------------------------------------
// Largar e pegar de novo (todas as fases): a dog que leva um item larga com E quando não há outra ação ali, e o item
// cai da boca até o chão, num ponto que ela (ou quem pode carregá-lo) alcança de novo. dropSpot escolhe o ponto;
// createCarryItem().putDown anima a queda e guarda onde ele ficou (floor); nearFloor diz se dá para pegar.
// ---------------------------------------------------------------------------------------------------------------

/** Até onde a dog alcança um item largado no chão para pegar de novo (pelo centro ou pela cabeça, como `reach`). */
export const FLOOR_REACH = 0.55;

/**
 * Como cada item fica deitado no chão (giro em X, Y, Z antes do rumo): os que ficam em pé no plano XY (laço, óculos,
 * vela, estrela, livro) deitam de costas, com a frente para cima; a meia (pendurada pelo punho) deita de lado. Os outros
 * ficam como na boca (cenoura e legumes deitados; bolinha, pantufa, frisbee e biscoito de base; patinho e chapéu em pé;
 * ursinho deitado).
 * @type {Record<string, [number, number, number]>}
 */
const REST_TILT = {
  ribbon: [-Math.PI / 2, 0, 0], glasses: [-Math.PI / 2, 0, 0], candle: [-Math.PI / 2, 0, 0], star: [-Math.PI / 2, 0, 0],
  book: [-Math.PI / 2, 0, 0], sock: [0, 0, Math.PI / 2],
};
const UP = new THREE.Vector3(0, 1, 0);
const _inv = new THREE.Matrix4();
const _rel = new THREE.Matrix4();
const _tiltM = new THREE.Matrix4();
const _v = new THREE.Vector3();

/**
 * Medidas do item deitado (giro `tilt`, sem o rumo), no referencial dele: quanto subir para a parte de baixo encostar
 * no chão (lift), onde fica o meio da pegada no chão (cx, cz: o item é posto com esse meio no ponto escolhido) e o raio
 * da pegada (r), já com a escala `scale` do item. Lê os vértices de verdade (os itens são pequenos). Sem malha (testes
 * headless): um item de 8 cm.
 * @param {THREE.Object3D} obj @param {THREE.Quaternion} tilt @param {THREE.Vector3} scale
 */
function restInfo(obj, tilt, scale) {
  obj.updateMatrixWorld(true);
  _inv.copy(obj.matrixWorld).invert();
  _tiltM.makeRotationFromQuaternion(tilt).scale(scale);
  let minY = Infinity, minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  /** @type {number[]} */
  const xz = [];
  obj.traverse((o) => {
    const m = /** @type {THREE.Mesh} */ (o);
    const pos = m.isMesh ? m.geometry?.attributes?.position : null;
    if (!pos) return;
    _rel.multiplyMatrices(_tiltM, _inv).multiply(m.matrixWorld);
    for (let i = 0; i < pos.count; i++) {
      _v.fromBufferAttribute(pos, i).applyMatrix4(_rel);
      if (_v.y < minY) minY = _v.y;
      if (_v.x < minX) minX = _v.x;
      if (_v.x > maxX) maxX = _v.x;
      if (_v.z < minZ) minZ = _v.z;
      if (_v.z > maxZ) maxZ = _v.z;
      xz.push(_v.x, _v.z);
    }
  });
  if (minY === Infinity) return { lift: 0, cx: 0, cz: 0, r: 0.08 };
  const cx = (minX + maxX) / 2, cz = (minZ + maxZ) / 2;
  let r2 = 0;
  for (let i = 0; i < xz.length; i += 2) r2 = Math.max(r2, (xz[i] - cx) ** 2 + (xz[i + 1] - cz) ** 2);
  return { lift: -minY, cx, cz, r: Math.sqrt(r2) };
}

/** Colisores dos bichos que andam (gansa, porcos, galinhas, o gato): não seguram nem empurram um item no chão. */
function moversOf(world) {
  return new Set(world.dynamics.filter((d) => d.kind === 'npc').map((d) => d.id));
}

/**
 * Um teste "o ponto (x, z) cai em alguma destas áreas?", para o `avoid` de dropSpot e das fases: círculos { x, z, r },
 * caixas { x, z, hx, hz } e retângulos { minX, maxX, minZ, maxZ }, com uma folga `pad`. Entradas nulas são ignoradas.
 * @param {any[]} list @param {number} [pad]
 * @returns {(x: number, z: number) => boolean}
 */
export function inZones(list, pad = 0) {
  return (x, z) => list.some((a) => {
    if (!a) return false;
    if (typeof a.r === 'number') return Math.hypot(x - a.x, z - a.z) < a.r + pad;
    if (typeof a.hx === 'number') return Math.abs(x - a.x) < a.hx + pad && Math.abs(z - a.z) < a.hz + pad;
    return x > a.minX - pad && x < a.maxX + pad && z > a.minZ - pad && z < a.maxZ + pad;
  });
}

/**
 * Onde a dog `c` larga o que leva na boca: logo à frente do focinho, num chão livre (fora de colisores: parede, móvel,
 * cerca, água, buraco; e dentro do mapa), sem nada entre ela e o ponto (nunca do outro lado de uma cerca ou de uma
 * porta) e perto o bastante para pegar de novo dali mesmo. Tenta à frente, um pouco mais perto, para os lados e para
 * trás; `avoid(x, z)` recusa pontos da fase (placas, a entrega, a boca do túnel…), mas se ela está bem no meio de um
 * deles, vale o primeiro ponto livre; sem nenhum, aos pés dela (onde ela está, cabe). `r` é o raio da pegada do item.
 * Os bichos que andam não contam.
 * @param {import('../types').CollisionWorld} world
 * @param {import('../types').DogController} c
 * @param {{ r?: number, avoid?: ((x: number, z: number) => boolean) | null }} [opts]
 * @returns {{ x: number, z: number }}
 */
export function dropSpot(world, c, { r = 0.08, avoid = null } = {}) {
  const ignore = moversOf(world);
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const ahead = c.r + 0.1;
  /** @type {[number, number, number][]} */
  const tries = [[fx, fz, ahead], [fx, fz, ahead * 0.75], [fx, fz, ahead * 0.5]];
  for (const a of [0.7, -0.7, 1.4, -1.4, 2.1, -2.1, Math.PI]) {
    const ca = Math.cos(a), sa = Math.sin(a);
    tries.push([fx * ca + fz * sa, fz * ca - fx * sa, ahead]);
  }
  /** @type {{ x: number, z: number } | null} */
  let free = null;
  for (const [ux, uz, d] of tries) {
    const x = c.x + ux * d, z = c.z + uz * d;
    if (world.overlaps(x, z, r, c.size, { ignore })) continue;
    if (!world.segmentClear(c.x, c.z, x, z, 0.04, c.size, { ignore })) continue;
    if (!avoid?.(x, z)) return { x, z };
    free ||= { x, z };
  }
  return free || { x: c.x, z: c.z };
}

/** Onde fica a boca da dog (o ponto à frente do focinho onde o item largado cairia primeiro). */
export function mouthPoint(c) {
  const d = c.r + 0.1;
  return { x: c.x + Math.sin(c.yaw) * d, z: c.z + Math.cos(c.yaw) * d };
}

const smoothstep = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/**
 * Item carregado na boca (cenoura, bolinha, pantufa…).
 * obj: Object3D do item (eixo longo em X local, centrado). carrier: 'any' | 'large' | 'small'.
 * Largado (putDown / dropBy), ele cai da boca e pousa deitado do jeito dele num ponto do chão; `floor` diz onde está e
 * `nearFloor(c)` se a dog alcança para pegar de novo. `update(dt)` (todo quadro) anima a queda e, com `world`, tira o
 * item de baixo de um caixote ou portão que passe por cima dele (ele nunca some nem fica inalcançável). Com `emit`, a
 * queda avisa o jogo: item:drop ao soltar e item:land ao pousar (som e poeirinha).
 * @param {{ obj: THREE.Object3D | null, dogs: Record<string, any>, scene: THREE.Object3D, carrier?: string, name?: string,
 *   emit?: import('../types').GameEmit | null, world?: import('../types').CollisionWorld | null }} opts
 */
export function createCarryItem({ obj, dogs, scene, carrier = 'any', name = 'item', emit = null, world = null }) {
  const home = { parent: obj?.parent || scene, pos: obj ? obj.position.clone() : null, quat: obj ? obj.quaternion.clone() : null };
  /** @type {any} */
  let holder = null;
  /** @type {{ x: number, z: number } | null} */
  let floor = null;
  /** @type {import('../types').DogSize} */
  let floorSize = 'small';
  let floorR = 0.08;
  /** @type {null | { t: number, dur: number, settle: number, p0: THREE.Vector3, q0: THREE.Quaternion, s0: THREE.Vector3, p1: THREE.Vector3, q1: THREE.Quaternion, s1: THREE.Vector3, bounce: number, landed: boolean, silent: boolean, land: string, x: number, z: number }} */
  let fall = null;
  /** @type {Set<string> | null} */
  let movers = null;
  const t3 = REST_TILT[name];
  const tilt = new THREE.Quaternion().setFromEuler(t3 ? new THREE.Euler(t3[0], t3[1], t3[2]) : new THREE.Euler());
  const canCarry = (c) => carrier === 'any' || c.size === carrier;
  /** A queda termina na hora (pegou de novo, voltou para casa…): a escala volta à do item. */
  function endFall() {
    if (fall && obj) obj.scale.copy(fall.s1);
    fall = null;
  }
  /** O raio da pegada do item deitado (para escolher onde ele cabe). */
  const radius = () => (obj ? Math.min(0.15, Math.max(0.05, restInfo(obj, tilt, obj.scale).r)) : 0.08);
  /** Algo andou por cima do item no chão (caixote, portão, gaveta): ele é empurrado para fora, como um brinquedo. */
  function keepFree() {
    if (!world || !floor || holder) return;
    movers ||= moversOf(world);
    const rr = floorR * 0.7;
    if (!world.overlaps(floor.x, floor.z, rr, floorSize, { ignore: movers })) return;
    const p = world.resolve(floor.x, floor.z, rr, floorSize, { ignore: movers });
    if (obj) {
      obj.position.x += p.x - floor.x;
      obj.position.z += p.z - floor.z;
    }
    floor = { x: p.x, z: p.z };
  }
  const item = {
    name,
    canCarry,
    get holder() { return holder; },
    /** Onde o item está no chão (largado ou derrubado), ou null (em casa, na boca, entregue). */
    get floor() { return floor; },
    /** Ainda caindo da boca até o chão? */
    get falling() { return !!fall; },
    /** Raio da pegada do item deitado no chão (m). */
    get radius() { return radius(); },
    attach(dogName) {
      endFall();
      floor = null;
      holder = dogName;
      // pose da boca para o tipo do item (cenoura/bolinha/pantufa/patinho/ursinho/frisbee/meia/óculos/livro/chapéu/laço/vela/corda), se o modelo suportar
      if (['carrot', 'ball', 'slipper', 'duck', 'bear', 'frisbee', 'sock', 'glasses', 'book', 'hat', 'ribbon', 'candle', 'rope'].includes(name)) dogs[dogName]?.setCarryPose?.(name);
      if (!obj) return;
      const dog = dogs[dogName];
      (dog.mouthSocket || dog.object).add(obj);
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);
    },
    /** Devolve à posição original (reset). */
    returnHome() {
      endFall();
      floor = null;
      if (holder) dogs[holder]?.setCarryPose?.(null);
      holder = null;
      if (!obj) return;
      (home.parent || scene).add(obj);
      obj.position.copy(home.pos);
      obj.quaternion.copy(home.quat);
    },
    /** Larga no chão em (x, z) (ex.: empurrada pela gansa, se a fase quiser). */
    drop(x, z, y = 0.06) {
      endFall();
      if (holder) dogs[holder]?.setCarryPose?.(null);
      holder = null;
      floor = { x, z };
      if (!obj) return;
      (home.parent || scene).add(obj);
      obj.position.set(x, y, z);
      obj.rotation.set(0, Math.random() * Math.PI, 0);
    },
    /**
     * Larga o item: ele sai da boca (ou de onde estiver, na mesma pose) e cai até o chão em (x, z), pousando deitado do
     * jeito dele, com o meio da pegada no ponto. O chão vale na hora (floor); a queda é só o desenho.
     * opts: yaw (rumo no chão; padrão: um pouco sorteado), y (altura do chão), originY (em vez disso, a altura exata da
     * origem do item: num encaixe, como o lugar da carga na bandeja), size (quem pegou; o item fica onde essa dog cabe),
     * silent (sem item:drop/item:land), land (evento ao pousar, padrão item:land).
     * @param {number} x @param {number} z
     * @param {{ yaw?: number | null, y?: number, originY?: number | null, size?: import('../types').DogSize, silent?: boolean, land?: string }} [opts]
     */
    putDown(x, z, { yaw = null, y = 0, originY = null, size = 'small', silent = false, land = 'item:land' } = {}) {
      endFall();
      const who = holder;
      if (holder) dogs[holder]?.setCarryPose?.(null);
      holder = null;
      floor = { x, z };
      floorSize = size;
      if (!silent) emit?.('item:drop', { name: who, item: name, x, z });
      if (!obj) {
        floorR = 0.08;
        if (!silent) emit?.(land, { x, z, kind: name });
        return;
      }
      const s1 = obj.scale.clone(); // a escala do item (sem a da cabeça da dog)
      scene.attach(obj); // sai da boca no mesmo lugar e pose do mundo
      const R = restInfo(obj, tilt, s1);
      floorR = Math.min(0.15, Math.max(0.05, R.r));
      const a = yaw ?? Math.random() * Math.PI * 2;
      const ca = Math.cos(a), sa = Math.sin(a);
      // o meio da pegada (cx, cz), girado pelo rumo, fica no ponto escolhido
      const p1 = new THREE.Vector3(x - (R.cx * ca + R.cz * sa), originY ?? y + R.lift, z - (-R.cx * sa + R.cz * ca));
      const q1 = new THREE.Quaternion().setFromAxisAngle(UP, a).multiply(tilt);
      const h = Math.max(0, obj.position.y - p1.y);
      fall = {
        t: 0, dur: Math.min(0.42, 0.14 + Math.sqrt((2 * h) / 9.8)), settle: name === 'ball' ? 0.24 : 0,
        p0: obj.position.clone(), q0: obj.quaternion.clone(), s0: obj.scale.clone(), p1, q1, s1,
        bounce: name === 'ball' ? Math.min(0.05, 0.02 + h * 0.08) : 0, landed: false, silent, land, x, z,
      };
    },
    /**
     * A dog `c` larga o item que leva: o ponto vem de dropSpot (à frente dela, nada no meio, `avoid` da fase) e o item
     * cai da boca até lá. → o ponto.
     * @param {import('../types').DogController} c
     * @param {{ avoid?: ((x: number, z: number) => boolean) | null, silent?: boolean, land?: string }} [opts]
     */
    dropBy(c, { avoid = null, silent = false, land = 'item:land' } = {}) {
      const spot = world ? dropSpot(world, c, { r: radius(), avoid }) : { x: c.x, z: c.z };
      item.putDown(spot.x, spot.z, { yaw: c.yaw + (Math.random() - 0.5) * 0.7, size: c.size, silent, land });
      return spot;
    },
    /** A dog alcança o item no chão para pegar de novo? (pelo centro ou pela cabeça; `r` padrão FLOOR_REACH) */
    nearFloor(c, r = FLOOR_REACH) {
      return !!floor && !holder && reach(c, floor.x, floor.z) < r;
    },
    /** Por quadro: a queda (com um quiquinho da bolinha) e, no chão, sair de baixo do que passar por cima. */
    update(dt) {
      if (!fall) { keepFree(); return; }
      const F = fall;
      F.t += dt;
      const u = Math.min(1, F.t / F.dur);
      const e = 1 - (1 - u) * (1 - u); // sai rápido da boca e assenta
      let yy = F.p0.y + (F.p1.y - F.p0.y) * u * u; // cai acelerando
      if (F.t > F.dur && F.settle > 0) yy = F.p1.y + Math.sin(Math.PI * Math.min(1, (F.t - F.dur) / F.settle)) * F.bounce;
      if (obj) {
        obj.position.set(F.p0.x + (F.p1.x - F.p0.x) * e, yy, F.p0.z + (F.p1.z - F.p0.z) * e);
        obj.quaternion.slerpQuaternions(F.q0, F.q1, smoothstep(u));
        obj.scale.lerpVectors(F.s0, F.s1, u);
      }
      if (u >= 1 && !F.landed) {
        F.landed = true;
        if (!F.silent) emit?.(F.land, { x: F.x, z: F.z, kind: name });
      }
      if (F.t >= F.dur + F.settle) {
        if (obj) obj.position.y = F.p1.y;
        fall = null;
      }
    },
  };
  return item;
}

/** A dog que carrega o item chegou ao objetivo? (a líder dentro da zona também vale, com folga) */
export function deliveredAt(goal, carrierCtrl, active) {
  if (!carrierCtrl) return false;
  const d = Math.hypot(carrierCtrl.x - goal.x, carrierCtrl.z - goal.z);
  const leaderIn = Math.hypot(active.x - goal.x, active.z - goal.z) < goal.r;
  return d < goal.r || (carrierCtrl !== active && leaderIn && d < goal.r + 0.8);
}
