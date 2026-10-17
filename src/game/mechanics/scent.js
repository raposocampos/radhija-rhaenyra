// Cheiro: as nuvens do superbafo da Radhija e o que o cenário faz com elas.
// - Nuvem: nasce na frente da Radhija com um empurrão, desacelera e se espalha devagar (raio cresce) até
//   sumir. Não atravessa paredes (colide como um círculo pequeno, passa onde a Radhija passa).
// - Vento (addWind): faixa retangular a partir de uma origem, numa direção. Dentro dela a nuvem é levada
//   pela corrente e fica compacta. Mova o objeto devolvido (x, z, dirX, dirZ) ou desligue com enabled.
// - Duto (addDuct): uma nuvem que chega à boca (inlet) com o duto ativo é engolida e sai pela outra ponta
//   (outlet) depois de `travel` segundos, soprada na direção da saída.
// - Nariz (addNose): alvo que reage quando uma nuvem o alcança (onSmell), uma vez por nuvem.
// Tudo determinístico: preview() roda a mesma simulação, sem efeitos, para desenhar a mira.
// Eventos: scent:spawn, scent:duct, scent:exit, scent:smell, scent:fade (sempre com x, z).

const SPAWN_R = 0.3;
const CALM_R = 1.05; // raio máximo parado (o cheiro se espalha por perto)
const WIND_R = 0.38; // no vento a nuvem fica compacta
const COLLIDE_R = 0.12;

/**
 * opts: { world (colisão; opcional), emit(nome, dados), view (desenho; opcional) }
 * @param {{ world?: import('../../types').CollisionWorld | null, emit?: (name: string, payload?: object) => void, view?: any }} [opts]
 * @returns {import('../../types').ScentField}
 */
export function createScentField({ world = null, emit = () => {}, view = null } = {}) {
  /** @type {any[]} */
  const clouds = [];
  /** @type {any[]} */
  const winds = [];
  /** @type {any[]} */
  const ducts = [];
  /** @type {any[]} */
  const noses = [];
  let nextId = 1;

  /** Vento somado no ponto (x, z) → { x, z } em m/s. */
  function windAt(x, z) {
    let wx = 0;
    let wz = 0;
    for (const w of winds) {
      if (w.enabled === false) continue;
      const L = Math.hypot(w.dirX, w.dirZ) || 1;
      const ux = w.dirX / L;
      const uz = w.dirZ / L;
      const rx = x - w.x;
      const rz = z - w.z;
      const along = rx * ux + rz * uz;
      const across = Math.abs(-rx * uz + rz * ux);
      if (along < 0 || along > w.length || across > w.halfWidth) continue;
      const k = w.strength * (1 - 0.45 * (along / w.length)); // enfraquece longe do ventilador
      wx += ux * k;
      wz += uz * k;
    }
    return { x: wx, z: wz };
  }

  /** @param {import('../../types').ScentShot} shot @returns {any} */
  function makeCloud({ x, z, dirX = 0, dirZ = 1, speed = 2.6, life = 5 }) {
    const L = Math.hypot(dirX, dirZ) || 1;
    return {
      id: nextId++, x, z, vx: (dirX / L) * speed, vz: (dirZ / L) * speed,
      r: SPAWN_R, age: 0, life, state: 'free', duct: null, ductT: 0, smelled: new Set(),
    };
  }

  /** Avança uma nuvem dt segundos. live=false: só simula (prévia), sem eventos. */
  function step(c, dt, live) {
    c.age += dt;
    if (c.state === 'duct') {
      c.ductT += dt;
      if (c.ductT >= c.duct.travel) {
        const d = c.duct;
        c.state = 'free';
        c.x = d.outlet.x;
        c.z = d.outlet.z;
        const L = Math.hypot(d.outlet.dirX, d.outlet.dirZ) || 1;
        c.vx = (d.outlet.dirX / L) * (d.outlet.speed ?? 1.6);
        c.vz = (d.outlet.dirZ / L) * (d.outlet.speed ?? 1.6);
        c.r = WIND_R;
        c.age = Math.min(c.age, c.life * 0.35); // sai "fresca" do outro lado
        if (live) emit('scent:exit', { id: c.id, duct: d.id, x: c.x, z: c.z });
      }
      return;
    }
    const w = windAt(c.x, c.z);
    const inWind = Math.abs(w.x) + Math.abs(w.z) > 0.01;
    const k = 1 - Math.exp(-dt * (inWind ? 3.2 : 1.7));
    c.vx += (w.x - c.vx) * k;
    c.vz += (w.z - c.vz) * k;
    if (world) {
      const res = world.move(c.x, c.z, c.vx * dt, c.vz * dt, COLLIDE_R, 'small');
      // bateu: perde a velocidade contra a parede
      if (res.hits.length) {
        const ex = (res.x - c.x) / Math.max(dt, 1e-4);
        const ez = (res.z - c.z) / Math.max(dt, 1e-4);
        c.vx += (ex - c.vx) * 0.6;
        c.vz += (ez - c.vz) * 0.6;
      }
      c.x = res.x;
      c.z = res.z;
    } else {
      c.x += c.vx * dt;
      c.z += c.vz * dt;
    }
    const rT = inWind ? WIND_R : CALM_R;
    c.r += (rT - c.r) * (1 - Math.exp(-dt * (inWind ? 2.5 : 0.55)));
    for (const d of ducts) {
      if (!d.active()) continue;
      if (Math.hypot(c.x - d.inlet.x, c.z - d.inlet.z) < d.inlet.r) {
        c.state = 'duct';
        c.duct = d;
        c.ductT = 0;
        if (live) emit('scent:duct', { id: c.id, duct: d.id, x: d.inlet.x, z: d.inlet.z });
        break;
      }
    }
  }

  // ---------- API ----------
  /** Solta uma nuvem em (x, z) soprada na direção (dirX, dirZ). */
  function spawn(opts) {
    const c = makeCloud(opts);
    clouds.push(c);
    emit('scent:spawn', { id: c.id, x: c.x, z: c.z });
    return c;
  }

  function update(dt) {
    for (const c of clouds) step(c, dt, true);
    for (const c of clouds) {
      if (c.state !== 'free') continue;
      for (const n of noses) {
        if (n.enabled === false || c.smelled.has(n.id)) continue;
        if (Math.hypot(c.x - n.x, c.z - n.z) < n.r + c.r * 0.7) {
          c.smelled.add(n.id);
          emit('scent:smell', { id: n.id, cloud: c.id, x: n.x, z: n.z });
          n.onSmell?.(c, n);
        }
      }
    }
    for (let i = clouds.length - 1; i >= 0; i--) {
      const c = clouds[i];
      if (c.age >= c.life) {
        clouds.splice(i, 1);
        emit('scent:fade', { id: c.id, x: c.x, z: c.z });
      }
    }
    view?.sync?.(clouds, dt);
  }

  /**
   * Prévia do caminho de uma nuvem soprada agora: { points: [{x, z}], exits: [{x, z}] }.
   * Mesma simulação do jogo (vento, paredes, dutos), por `secs` segundos, sem eventos.
   */
  function preview(opts, { secs = 2.6, dt = 1 / 20 } = {}) {
    const c = makeCloud(opts);
    nextId--; // a prévia não gasta id
    const points = [{ x: c.x, z: c.z }];
    const exits = [];
    let wasDuct = false;
    const steps = Math.round(secs / dt);
    for (let k = 0; k < steps && c.age < c.life; k++) {
      step(c, dt, false);
      if (c.state === 'duct') { wasDuct = true; continue; }
      if (wasDuct) { exits.push({ x: c.x, z: c.z }); wasDuct = false; }
      points.push({ x: c.x, z: c.z });
    }
    return { points, exits, inDuct: c.state === 'duct' };
  }

  /** Nuvem livre mais próxima de (x, z) cujo contorno está a menos de `margin` (ou null). */
  function near(x, z, margin = 0.5) {
    let best = null;
    let bd = Infinity;
    for (const c of clouds) {
      if (c.state !== 'free') continue;
      const d = Math.hypot(c.x - x, c.z - z) - c.r;
      if (d < margin && d < bd) { bd = d; best = c; }
    }
    return best;
  }

  /** Vento: { id, x, z (origem), dirX, dirZ, length, halfWidth, strength (m/s), enabled }. Devolve o objeto (mutável). */
  function addWind(w) {
    const o = Object.assign({ enabled: true, length: 3, halfWidth: 0.35, strength: 2.4 }, w);
    winds.push(o);
    return o;
  }
  /** Duto: { id, inlet: {x, z, r}, outlet: {x, z, dirX, dirZ, speed?}, travel (s), active() }. */
  function addDuct(d) {
    const o = Object.assign({ travel: 1.2, active: () => true }, d);
    ducts.push(o);
    return o;
  }
  /** Nariz: { id, x, z, r, onSmell(cloud, nose), enabled }. */
  function addNose(n) {
    const o = Object.assign({ enabled: true, r: 0.5 }, n);
    noses.push(o);
    return o;
  }

  function reset() {
    clouds.length = 0;
    view?.clear?.();
  }

  // Diferente de reset(): encerra a fase e solta callbacks/colisão antigos.
  function dispose() {
    clouds.length = winds.length = ducts.length = noses.length = 0;
    try { view?.dispose?.(); }
    finally { view = null; world = null; emit = () => {}; }
  }

  return {
    spawn, update, preview, near, windAt, addWind, addDuct, addNose, reset, dispose,
    showPreview: (p) => view?.showPreview?.(p),
    hidePreview: () => view?.hidePreview?.(),
    get clouds() { return clouds; },
    get winds() { return winds; },
    get ducts() { return ducts; },
    get noses() { return noses; },
    info: () => ({
      clouds: clouds.map((c) => ({ id: c.id, x: +c.x.toFixed(2), z: +c.z.toFixed(2), r: +c.r.toFixed(2), state: c.state, age: +c.age.toFixed(2) })),
    }),
  };
}
