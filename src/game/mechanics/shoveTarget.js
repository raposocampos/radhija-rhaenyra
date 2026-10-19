// Algo empurrável no alto (empurrão em pé da Rhaenyra): uma arvorezinha, uma mesinha, uma estante baixa… com um item
// lá em cima. O puzzle oferece `spot` em shoveSpots() e repassa puzzle.onShove(ctrl, spot) → shove().
// Cada empurrão balança a coisa (mola amortecida, mostrada pelo prop em setSway) e solta um pouco o item; no
// `pushes`-ésimo (3 por padrão) ele cai: escorrega até a beirada (mesa, estante) ou se solta dos galhos (árvore),
// cai com gravidade, quica e rola até um ponto livre do chão (o primeiro de item.land sem dog nem colisor por perto).
// Depois disso, empurrar só balança. Tudo determinístico (sem física genérica).
// cfg (do layout): { x, z, nx, nz, y, w, over, pushes, kind: 'tree' | 'table' | 'shelf', sway?: { w, zeta, kick, grow },
//   item?: { from: {x,y,z}, edge?: {x,y,z}, land: [{x,z}, …], r, restY?, center?, rB?, roll?, bounce? } }
//   (x, z) = pé da superfície no meio da face onde as patas apoiam; (nx, nz) = normal (para o lado da dog);
//   y = altura das patas; w = meia largura da face; over = quanto além da face as patas apoiam (em cima de uma
//   beirada); item.from/edge = onde o item está e de onde ele sai do apoio (mundo, sem balanço); item.r = raio no chão;
//   center = altura do meio do item acima da origem dele (o giro é em torno do meio); restY = altura do meio parado
//   no chão; rB = raio da esfera que contém o item (no ar, nada passa do chão em nenhum giro; assenta no fim).
// Eventos: shove:hit { id, kind, n, of, x, y, z } a cada empurrão · shove:drop { id, kind, x, y, z } · shove:bounce
//   { id, x, z, k } a cada quique (k = força 0..1) · shove:land { id, x, z }.
import * as THREE from 'three';

const G = 9.8;
const sstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Mola de cada tipo: w = rad/s, zeta = amortecimento, kick = rad/s por empurrão, grow = aumento a cada empurrão. */
export const SHOVE_SWAY = Object.freeze({
  tree: Object.freeze({ w: 8.5, zeta: 0.11, kick: 0.3, grow: 0.3, oneSided: false }),
  table: Object.freeze({ w: 24, zeta: 0.32, kick: 0.62, grow: 0.18, oneSided: true }),
  shelf: Object.freeze({ w: 17, zeta: 0.22, kick: 0.5, grow: 0.22, oneSided: true }),
});
/** Tempo do item escorregando até a beirada (s). */
export const SHOVE_SLIDE = 0.24;

/**
 * Trajetória da queda: do ponto P0 (mundo) até o chão em L, com `bounce` (restituição) e rolagem no fim.
 * → { dur, at(t, out) → out (posição), dist(t) (distância percorrida no chão), impacts [{ t, k }] }
 * @param {{x:number,y:number,z:number}} P0 @param {{x:number,z:number}} L
 * @param {{ restY: number, bounce: number, roll: boolean }} o
 */
export function fallPath(P0, L, { restY, bounce, roll }) {
  const h0 = Math.max(0.01, P0.y - restY);
  const t1 = Math.sqrt((2 * h0) / G);
  const flights = [t1];
  const vys = [G * t1];
  let v = bounce * G * t1;
  while (v > 0.45 && flights.length < 4) {
    flights.push((2 * v) / G);
    vys.push(v);
    v *= bounce;
  }
  const tRoll = roll ? 0.55 : 0.16;
  const tAir = flights.reduce((a, b) => a + b, 0);
  const D = Math.hypot(L.x - P0.x, L.z - P0.z);
  const ux = D > 1e-6 ? (L.x - P0.x) / D : 0;
  const uz = D > 1e-6 ? (L.z - P0.z) / D : 0;
  const u = D / (tAir + 0.5 * tRoll); // velocidade no ar; no chão, cai até zero (área = metade)
  const impacts = [];
  let acc = 0;
  for (let i = 0; i < flights.length; i++) {
    acc += flights[i];
    impacts.push({ t: acc, k: Math.min(1, vys[i] / 3) });
  }
  const dur = tAir + tRoll;
  /** Distância horizontal percorrida até t. */
  const dist = (t) => {
    if (t <= tAir) return u * t;
    const s = Math.min(t - tAir, tRoll);
    return u * tAir + u * s - (u * s * s) / (2 * tRoll);
  };
  /** Altura até t. */
  const height = (t) => {
    if (t <= t1) return restY + h0 - 0.5 * G * t * t;
    let t0 = t1;
    for (let i = 1; i < flights.length; i++) {
      if (t <= t0 + flights[i]) {
        const s = t - t0;
        return restY + vys[i] * s - 0.5 * G * s * s;
      }
      t0 += flights[i];
    }
    return restY;
  };
  return {
    dur,
    tAir,
    impacts,
    dist,
    /** @param {number} t @param {THREE.Vector3} out */
    at(t, out) {
      const tt = Math.min(Math.max(t, 0), dur);
      const d = dist(tt);
      return out.set(P0.x + ux * d, Math.max(restY, height(tt)), P0.z + uz * d);
    },
    dir: { x: ux, z: uz },
  };
}

/**
 * @param {{ id: string, cfg: import('../../types').ShoveTargetCfg, emit: import('../../types').GameEmit,
 *   world?: import('../../types').CollisionWorld | null, root?: THREE.Object3D | null,
 *   prop?: import('../../types').ShoveTargetProp | null, item?: THREE.Object3D | null }} opts
 */
export function createShoveTarget({ id, cfg, emit, world = null, root = null, prop = null, item = null }) {
  const kind = cfg.kind || 'tree';
  const pushes = cfg.pushes ?? 3;
  const sway = { ...SHOVE_SWAY[kind], ...(cfg.sway || {}) };
  /** @type {import('../../types').ShoveSpot} */
  const spot = { id, x: cfg.x, z: cfg.z, nx: cfg.nx, nz: cfg.nz, y: cfg.y, w: cfg.w ?? 0, over: cfg.over ?? 0, kind };
  const IC = cfg.item || null;
  const restY = IC ? IC.restY ?? IC.r : 0;
  const center = IC?.center ?? 0;
  const rB = IC ? Math.max(IC.rB ?? restY, restY) : 0;
  const _c = new THREE.Vector3();
  const bounce = IC ? IC.bounce ?? (IC.roll ? 0.45 : 0.28) : 0;
  // onde o item mora (no prop, que balança) e para onde ele escorrega (beirada), no referencial do pai dele
  const home = item ? { parent: item.parent, pos: item.position.clone(), quat: item.quaternion.clone() } : null;
  let edgeLocal = null;
  const S = {
    n: 0, a: 0, va: 0, dropped: false, landed: false, phase: 'rest', t: 0,
    creep: 0, creepGoal: 0, land: null, path: null, impactI: 0, q0: new THREE.Quaternion(), qEnd: new THREE.Quaternion(),
    axis: new THREE.Vector3(1, 0, 0), turns: 0, dropParent: /** @type {THREE.Object3D | null} */ (null),
  };
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const at = (y = cfg.y) => ({ x: cfg.x + cfg.nx * 0.05, y, z: cfg.z + cfg.nz * 0.05 });

  /** A beirada no referencial do pai do item (calculada uma vez, com tudo parado). */
  function localEdge() {
    if (edgeLocal || !item || !home?.parent) return edgeLocal;
    const E = IC.edge || IC.from;
    home.parent.updateWorldMatrix(true, false);
    edgeLocal = home.parent.worldToLocal(new THREE.Vector3(E.x, E.y, E.z));
    return edgeLocal;
  }
  if (IC?.edge) localEdge();

  /** Ponto do chão onde o item vai parar: o primeiro livre de colisores e de dogs; senão, o mais longe das dogs. */
  function pickLand(ctrls) {
    const list = IC.land || [];
    const dogs = Object.values(ctrls || {});
    const free = (p) => dogs.every((c) => Math.hypot(c.x - p.x, c.z - p.z) > c.r + IC.r + 0.04);
    const clear = (p) => !world || !world.overlaps(p.x, p.z, IC.r, 'small');
    const ok = list.find((p) => free(p) && clear(p));
    if (ok) return { x: ok.x, z: ok.z };
    let best = list[0] || { x: IC.from.x, z: IC.from.z };
    let bestD = -1;
    for (const p of list.filter(clear)) {
      const d = Math.min(...dogs.map((c) => Math.hypot(c.x - p.x, c.z - p.z) - c.r));
      if (d > bestD) { best = p; bestD = d; }
    }
    return { x: best.x, z: best.z };
  }

  /**
   * Um empurrão chegou (puzzle.onShove com este spot): balança mais a cada um; no `pushes`-ésimo, o item cai.
   * @param {import('../../types').DogController | null} [c] @param {Record<string, import('../../types').DogController>} [ctrls]
   */
  function shove(c = null, ctrls = {}) {
    S.n++;
    S.va += sway.kick * (1 + sway.grow * Math.min(S.n - 1, pushes));
    emit('shove:hit', { id, kind, n: S.n, of: pushes, ...at(), by: c?.name ?? null });
    if (!item || S.dropped) return S.n;
    if (S.n >= pushes) {
      S.dropped = true;
      S.land = pickLand(ctrls);
      S.phase = IC.edge ? 'slide' : 'loose';
      S.t = 0;
      const p = item.getWorldPosition(_v);
      emit('shove:drop', { id, kind, x: p.x, y: p.y, z: p.z });
    } else {
      // solta um pouco: escorrega rumo à beirada (mesa/estante) ou fica mais solto nos galhos (árvore)
      S.creepGoal = Math.min(0.72, S.n / pushes * 0.9);
    }
    return S.n;
  }

  /** Larga o item no mundo (sai do prop que balança, mantendo a posição) e calcula a queda. */
  function startFall() {
    item.getWorldQuaternion(S.q0);
    const P0 = item.getWorldPosition(new THREE.Vector3()).add(_c.set(0, center, 0).applyQuaternion(S.q0));
    S.dropParent = root || item.parent?.parent || item.parent;
    S.dropParent?.attach?.(item);
    S.path = fallPath(P0, S.land, { restY: rB, bounce, roll: !!IC.roll });
    S.impactI = 0;
    S.axis.set(S.path.dir.z, 0, -S.path.dir.x);
    if (S.axis.lengthSq() < 1e-6) S.axis.set(1, 0, 0);
    S.axis.normalize();
    // de pé no fim, virado para onde rolou (os bichinhos); a bola só rola
    S.qEnd.setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(S.path.dir.x, S.path.dir.z) + 0.6);
    S.turns = IC.roll ? 0 : 1;
    S.phase = 'fall';
    S.t = 0;
  }

  /** Por quadro (pausa congela: o puzzle só chama em 'playing'). */
  function update(dt) {
    // balanço: mola amortecida; mesa e estante só inclinam para longe da dog (voltam e assentam nos pés)
    const { w, zeta } = sway;
    S.va += (-w * w * S.a - 2 * zeta * w * S.va) * dt;
    S.a += S.va * dt;
    if (sway.oneSided && S.a < 0) {
      if (S.va < -0.05) emit('shove:settle', { id, kind, ...at(0.05), k: Math.min(1, -S.va / 0.6) });
      S.a = 0;
      S.va = Math.max(0, -S.va * 0.25);
    }
    if (Math.abs(S.a) < 1e-5 && Math.abs(S.va) < 1e-4) { S.a = 0; S.va = 0; }
    prop?.setSway(S.a, S.va);
    if (!item) return;
    if (S.phase === 'rest') {
      // escorregando aos pouquinhos (só mesa/estante, que têm beirada) e um tremidinho com o balanço
      S.creep += (S.creepGoal - S.creep) * (1 - Math.exp(-dt * 10));
      const E = IC.edge ? localEdge() : null;
      if (E) item.position.copy(home.pos).lerp(E, S.creep);
      else item.position.copy(home.pos);
      item.position.y += Math.abs(S.va) * 0.004;
      return;
    }
    S.t += dt;
    if (S.phase === 'slide') {
      // escorrega até a beirada, acelerando, e tomba por cima dela
      const k = Math.min(1, S.t / SHOVE_SLIDE);
      const E = localEdge();
      item.position.copy(home.pos).lerp(E, S.creep + (1 - S.creep) * k * k);
      if (k >= 1) startFall();
      return;
    }
    if (S.phase === 'loose') {
      // o galho solta: um pulinho para cima antes de cair
      const k = Math.min(1, S.t / 0.12);
      item.position.copy(home.pos);
      item.position.y += Math.sin(k * Math.PI) * 0.025;
      if (k >= 1) startFall();
      return;
    }
    if (S.phase === 'fall') {
      const P = S.path;
      // o meio do item segue a trajetória; no fim ele assenta (de rB até restY) enquanto termina de girar
      P.at(S.t, _v);
      _v.y -= (rB - restY) * sstep(P.tAir * 0.85, P.dur, S.t);
      while (S.impactI < P.impacts.length && S.t >= P.impacts[S.impactI].t) {
        const I = P.impacts[S.impactI++];
        emit('shove:bounce', { id, x: _v.x, z: _v.z, k: I.k });
      }
      // gira: a bola rola pelo chão (ângulo = distância / raio); os bichinhos dão uma cambalhota e assentam de pé
      const k = Math.min(1, S.t / P.dur);
      const ang = IC.roll ? P.dist(S.t) / Math.max(0.02, IC.r) : S.turns * Math.PI * 2 * sstep(0, 1, k);
      _q.setFromAxisAngle(S.axis, ang);
      item.quaternion.copy(S.q0).slerp(S.qEnd, IC.roll ? 0 : sstep(0, 0.35, k));
      item.quaternion.premultiply(_q);
      if (S.t >= P.dur && !IC.roll) item.quaternion.copy(S.qEnd);
      item.position.copy(_v).sub(_c.set(0, center, 0).applyQuaternion(item.quaternion));
      if (S.t >= P.dur) {
        S.phase = 'landed';
        S.landed = true;
        emit('shove:land', { id, x: item.position.x, z: item.position.z });
      }
    }
  }

  function reset() {
    Object.assign(S, { n: 0, a: 0, va: 0, dropped: false, landed: false, phase: 'rest', t: 0, creep: 0, creepGoal: 0, land: null, path: null, impactI: 0, dropParent: null });
    prop?.setSway(0, 0);
    if (item && home?.parent) {
      home.parent.add(item);
      item.position.copy(home.pos);
      item.quaternion.copy(home.quat);
    }
  }

  return {
    id,
    kind,
    spot,
    shove,
    update,
    reset,
    get pushes() { return S.n; },
    get dropped() { return S.dropped; },
    get landed() { return S.landed; },
    /** O item caiu e está parado no chão (ninguém pegou): onde (mundo). */
    get itemAt() { return S.landed && item && item.parent === S.dropParent ? { x: item.position.x, z: item.position.z } : null; },
    get sway() { return S.a; },
    info: () => ({
      pushes: S.n, of: pushes, sway: +S.a.toFixed(4), phase: S.phase, dropped: S.dropped, landed: S.landed,
      land: S.land, item: item ? { x: +item.position.x.toFixed(3), y: +item.position.y.toFixed(3), z: +item.position.z.toFixed(3) } : null,
    }),
  };
}
