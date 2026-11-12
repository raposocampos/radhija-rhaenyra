// A RHAENYRA DISTRAÍDA, a "lesada" (pedido do usuário em 2026-11-11: "melhore os sinais de que a Rhaenyra é mais
// lesada"; docs/HISTORIA.md: "Distraída: se distrai com borboleta…"; "Boba: tropeça…"). Fora das cenas, de vez em quando
// (pouco: divertido, não irritante), a Rhaenyra que segue a irmã (a Radhija com a jogadora) se distrai:
//  - RABO: dá uma voltinha curta a trote atrás do próprio rabo — um círculo andado de verdade (~0,35 m de raio, uma
//    volta), com o corpo curvado em "C", a cabeça virada para o rabo (o gesto chaseTail de dogAnimation.js). Nunca gira
//    parada no lugar: o meio do corpo anda o círculo inteiro;
//  - BORBOLETA: uma borboleta (src/story/scene/butterfly.js: uma do cenário, se houver perto, ou uma que chega voando)
//    passa no focinho dela; ela corre atrás, dá o bote e erra (a borboleta sobe);
//  - BOLHA: bolhas de sabão passam flutuando (src/story/scene/bubbles.js); ela corre atrás e abocanha uma (PLOC!);
//  - CHEIRO: vai até um cantinho ali do lado e fareja o chão, achando que é comida.
// A Radhija bufa e chama ("Rhaenyra! Foco!", legenda curta do jogo) e a Rhaenyra reage atrasada ("Hã?") no fim.
// E as trapalhadas, também raras: correndo atrás da irmã ela às vezes TROPEÇA (o peito mergulha e ela se recompõe); com
// ela ou com a jogadora, correndo de encontro a uma PORTA fechada, ela BATE O FOCINHO (TÓIM!, recua zonza: "Ai!"); e,
// quando a Radhija late perto dela, às vezes ela demora a entender ("Hã? Eu?").
// Regras (as do usuário): a companheira nunca fica para trás nem trava a navegação (só começa com a irmã perto e parada
// ou andando devagar; se a irmã se afasta, ela larga tudo e volta; nada dura mais que ~3 s); nada atravessa nada (a
// voltinha e o bote são caminhos conferidos ponto a ponto com o corpo inteiro e a irmã, antes e a cada quadro; o resto
// anda com a colisão de sempre); e nada acontece nas cenas, no Fica, com outra coisa segurando a dog ou logo depois.
// Ligação com a área (puzzle.js): update(dt, { playing }) a cada quadro, lockFor(nome) na trava da dog, reset().
// A trava é a das fases (InputLock): drive (a voltinha e o bote, andados aqui) ou move (com a colisão do núcleo).
import { events } from '../../core/events.js';
import { buildPath, along, speedProfile } from '../../game/walkPath.js';
import { GESTURE_TIME } from '../../dogs/dogAnimation.js';

const TAU = Math.PI * 2;
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
const smooth = (k) => { const x = clamp(k, 0, 1); return x * x * (3 - 2 * x); };

/** As regras de tempo e distância (s, m, m/s): [de, até] é sorteado. */
export const LESADA = Object.freeze({
  /** Quanto tempo de jogo (com ela de companheira, perto da irmã e livre) até a primeira distração e entre elas. */
  first: [16, 26],
  every: [40, 70],
  /** Folga depois de uma cena, de uma troca de dog, do Fica ou de outra coisa com ela (s). */
  calm: 4,
  /** Só começa com a irmã até `leash` m, andando a menos de `slow` m/s; com a irmã a mais de `far` m, larga tudo. */
  leash: 2.4,
  slow: 0.9,
  far: 3.3,
  /** O peso de cada distração no sorteio (a mesma não repete em seguida). */
  kinds: Object.freeze({ rabo: 3, borboleta: 3, cheiro: 2, bolha: 2 }),
  /** A voltinha atrás do rabo: o raio (m) do círculo que o meio do corpo anda, quantas voltas e a velocidade (trote). */
  rabo: Object.freeze({ r: [0.32, 0.38], turns: [1.0, 1.12], v: 1.35 }),
  /** Correndo atrás da borboleta ou da bolha: a velocidade, quanto tempo no máximo e a que distância ela dá o bote. */
  chase: Object.freeze({ v: 1.7, max: 2.0, near: 0.55 }),
  /** Farejando: a que distância fica o cantinho, a velocidade até lá e quanto tempo de focinho no chão. */
  sniff: Object.freeze({ d: [0.55, 0.95], v: 0.9, t: 2.1 }),
  /** Tropeço: s correndo (a mais de `speed` m/s) até o primeiro e entre eles; quanto livre à frente (m). */
  trip: Object.freeze({ first: [26, 40], every: [60, 100], speed: 1.45, ahead: 0.9 }),
  /** Focinho na porta: a velocidade contra ela (m/s) e o intervalo mínimo (s). */
  bonk: Object.freeze({ speed: 1.3, cd: 8 }),
  /** O "Hã?" atrasado quando a Radhija late perto: a chance, o intervalo mínimo (s), o atraso (s) e o alcance (m). */
  ha: Object.freeze({ chance: 0.5, cd: 24, delay: [0.55, 0.85], r: 7 }),
  /** A Radhija chama: até que distância (m), de quanto em quanto tempo no máximo (s) e a chance. */
  call: Object.freeze({ r: 8, cd: 14, chance: 0.8 }),
});

/** As falas (legendas curtas do jogo). Sem duplo sentido e sem nada da noite da garoa. */
const LINES = {
  rabo: ['Um dia eu alcanço!', 'Ele é muito rápido!', 'Quase!'],
  borboleta: ['Borboleta!', 'Borboletinha!'],
  borboletaFim: ['Ela voa! Não vale!', 'Volta aqui, borboletinha!'],
  bolha: ['Bolha!', 'Uma bolha!'],
  bolhaFim: ['Ué… cadê a bolha?', 'Sumiu!'],
  bolhaErrou: ['Escapou!'],
  cheiro: ['Hmm… cheiro de biscoito!', 'Isso aqui cheira a almoço…', 'Hmm… migalha de pão!'],
  tropeco: ['Opa! Foi de propósito!', 'Tô bem! Tô bem!'],
  bonk: ['Ai! Quem botou essa porta aí?', 'Essa porta é nova?', 'Tô bem! Tô bem!'],
  ha: ['Hã?', 'Hã? Oi!', 'Hã? Tô indo!', 'Hã? Eu?'],
};
/** A Radhija chamando a irmã de volta (bufando). */
const CALLS = {
  rabo: ['Rhaenyra! Foco!', 'Aff… Rhaenyra, aqui!'],
  borboleta: ['Larga a borboleta, Rhaenyra!', 'Rhaenyra! Foco!'],
  bolha: ['Rhaenyra! Bolha não é pista!', 'Foco, Rhaenyra!'],
  cheiro: ['Rhaenyra! Isso não é pista!', 'Aff… Rhaenyra, aqui!'],
};
/** As portas (o que conta para o focinho): as folhas com dobradiça e o que tiver nome de porta, portão, grade ou vidro. */
const DOOR_ID = /porta|portao|grade|vidro|janela/;

/** Um gerador pequeno com semente (as partidas e os testes se repetem). */
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * @param {{ ctx: import('../../types').PuzzleContext<any>, dir: any, emit: (name: string, payload?: object) => void,
 *   flutter?: ReturnType<typeof import('./butterfly.js').createButterflies> | null,
 *   bubbles?: ReturnType<typeof import('./bubbles.js').createBubbles> | null,
 *   busy?: (name: string) => boolean, layout?: any, seed?: number }} o
 *   busy: outra coisa da área segura a dog agora (uma cena, um empurrão, a corda).
 */
export function createLesada({ ctx, dir, emit, flutter = null, bubbles = null, busy = () => false, layout = null, seed = 1313 }) {
  const { ctrls, world } = ctx;
  let rand = rng(seed);
  const between = (r) => r[0] + (r[1] - r[0]) * rand();
  /** Uma fala da lista, em rodízio (não repete a anterior). */
  const turn = {};
  const pick = (list, key) => {
    turn[key] = ((turn[key] ?? Math.floor(rand() * list.length)) + 1) % list.length;
    return list[turn[key]];
  };

  // ---------------------------------------------------------------- a trava (o mesmo objeto, mexido a cada quadro)
  const mv = { dx: 0, dz: 0, speed: 0, back: false };
  const look = { x: 0, y: 0, z: 0 };
  const gest = { kind: /** @type {import('../../types').DogGestureKind} */ ('wag'), t: 0, side: 1 };
  /** @type {import('../../types').InputLock & Record<string, any>} */
  const lock = { action: 'none', faceX: 0, faceZ: 0, drive: false, move: mv, look: null, gesture: null, talk: 0, airK: -1 };

  // ---------------------------------------------------------------- o estado
  /** A distração (ou trapalhada) em andamento: { kind, ph, t, ... } ou null. */
  /** @type {any} */
  let R = null;
  const S = {
    on: true, t: 0, calm: 0, wait: 0, tripWait: 0, callCd: 0, haCd: 0, bonkCd: 0, talkT: 0, last: '',
    /** O "Hã?" pendurado (s até ele), depois de um latido da irmã. */
    haIn: -1,
    /** Outra coisa com ela (o Lambe-Lambe, uma animação do cenário, o xixi): s de espera. */
    hold: 0,
    count: { rabo: 0, borboleta: 0, bolha: 0, cheiro: 0, tropeco: 0, bonk: 0, ha: 0 },
  };
  /** As portas que ela já está encostando (para contar só a batida nova). */
  const touching = new Set();
  function fresh() {
    rand = rng(seed);
    for (const k of Object.keys(turn)) delete turn[k];
    S.t = 0; S.calm = 0; S.callCd = 0; S.haCd = 0; S.bonkCd = 0; S.talkT = 0; S.last = ''; S.haIn = -1; S.hold = 0;
    S.wait = between(LESADA.first);
    S.tripWait = between(LESADA.trip.first);
    for (const k of Object.keys(S.count)) S.count[k] = 0;
    touching.clear();
  }
  fresh();

  // ---------------------------------------------------------------- outras coisas com ela (eventos do jogo)
  const offs = [
    events.on('lick:start', (/** @type {any} */ p = {}) => { if (p.target === 'rhaenyra' || p.name === 'rhaenyra') { S.hold = Math.max(S.hold, 30); end(); } }),
    events.on('lick:end', () => { S.hold = Math.min(S.hold, 1.5); }),
    events.on('extra:start', (/** @type {any} */ p = {}) => { S.hold = Math.max(S.hold, 30); if (p.name === 'rhaenyra' || R?.kind !== 'bonk') end(); }),
    events.on('extra:end', () => { S.hold = Math.min(S.hold, 2); }),
    events.on('dog:pee', (/** @type {any} */ p = {}) => { if (p.name === 'rhaenyra') { S.hold = Math.max(S.hold, 12); end(); } }),
    events.on('dog:switch', () => { S.calm = 0; }),
    events.on('dog:bark', (/** @type {any} */ p = {}) => {
      // a Radhija latiu (a jogadora, não a cena): às vezes a irmã demora a entender
      if (p.name !== 'radhija' || p.scene || R || S.haIn >= 0 || S.haCd > 0) return;
      if (rand() < LESADA.ha.chance) S.haIn = between(LESADA.ha.delay);
    }),
  ];

  // ---------------------------------------------------------------- ajudas
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  const fwdX = (c) => Math.sin(c.yaw), fwdZ = (c) => Math.cos(c.yaw);
  const BED = layout?.BED ?? null;
  /** O corpo inteiro (o meio, o peito e a garupa) da dog c em (x, z) olhando para yaw cabe ali, longe da irmã o e da caminha? */
  function roomy(c, x, z, yaw, o) {
    if (world.overlaps(x, z, c.r, c.size)) return false;
    const B = c.cfg?.body;
    if (B) {
      const sx = Math.sin(yaw), sz = Math.cos(yaw), f = B.front - B.r, b = B.r - B.back;
      if (world.overlaps(x + sx * f, z + sz * f, B.r, c.size) || world.overlaps(x + sx * b, z + sz * b, B.r, c.size)) return false;
    }
    if (BED && Math.hypot(x - BED.x, z - BED.z) < BED.r + (BED.rim ?? 0.1) + c.r + 0.05) return false;
    return !o || Math.hypot(x - o.x, z - o.z) > c.r + o.r + 0.14;
  }
  /** Confere com os colisores só da companheira ligados (ela é a companheira). */
  function asCompanion(fn) {
    const prev = !!world.companionMode;
    world.setCompanionMode?.(true);
    try { return fn(); } finally { world.setCompanionMode?.(prev); }
  }
  /** roomy com os colisores da companheira (a cada quadro da voltinha: sem criar função). */
  function roomyC(c, x, z, yaw, o) {
    const prev = !!world.companionMode;
    world.setCompanionMode?.(true);
    const ok = roomy(c, x, z, yaw, o);
    world.setCompanionMode?.(prev);
    return ok;
  }
  /** O caminho inteiro cabe (de `skip` m em diante)? */
  function pathFits(c, P, o, skip = 0.04) {
    for (let i = 0; i < P.s.length; i += 2) {
      if (P.s[i] < skip) continue;
      if (!roomy(c, P.x[i], P.z[i], P.yaw[i], o)) return false;
    }
    return true;
  }
  /** Uma reta que a dog c anda inteira (o corpo no rumo da reta) sem encostar em nada nem na irmã. */
  function lineFits(c, ax, az, bx, bz, o) {
    const len = Math.hypot(bx - ax, bz - az);
    const yaw = Math.atan2(bx - ax, bz - az);
    const n = Math.max(1, Math.ceil(len / 0.08));
    for (let i = 1; i <= n; i++) {
      const k = i / n;
      if (!roomy(c, ax + (bx - ax) * k, az + (bz - az) * k, yaw, o)) return false;
    }
    return true;
  }
  /**
   * Para onde ela pode correr `len` m: livre, sem passar pela irmã e terminando perto dela (nunca fica para trás).
   * → { dx, dz } ou null.
   */
  function chaseDir(c, o, len) {
    const a0 = rand() * TAU;
    for (let i = 0; i < 12; i++) {
      const a = a0 + (i * TAU) / 12;
      const dx = Math.sin(a), dz = Math.cos(a);
      const ex = c.x + dx * len, ez = c.z + dz * len;
      const de = Math.hypot(ex - o.x, ez - o.z);
      if (de > LESADA.far - 0.7 || de < c.r + o.r + 0.4) continue;
      // a irmã longe da reta inteira
      const t = clamp(((o.x - c.x) * dx + (o.z - c.z) * dz) / len, 0, 1);
      if (Math.hypot(c.x + dx * len * t - o.x, c.z + dz * len * t - o.z) < c.r + o.r + 0.2) continue;
      if (!lineFits(c, c.x, c.z, ex, ez, o)) continue;
      return { dx, dz };
    }
    return null;
  }
  /** O focinho da Rhaenyra (no mundo), `ahead` m à frente do meio, na altura y (o mesmo objeto: vale até a próxima). */
  const _nose = { x: 0, y: 0, z: 0 };
  const nose = (c, ahead = 0.42, y = 0.5) => { _nose.x = c.x + fwdX(c) * ahead; _nose.y = y; _nose.z = c.z + fwdZ(c) * ahead; return _nose; };
  const say = (who, text) => {
    dir.say?.(who, text, { mode: 'jogo' });
    if (who === 'rhaenyra') S.talkT = 0.35 + text.length * 0.045;
  };
  const sfx = (name, c, volume = 1) => emit('story:sfx', { name, x: c.x, z: c.z, volume });

  // ---------------------------------------------------------------- a trava: parada, andando ou levada
  /** Parada (freando com a colisão de sempre), de frente para onde está. */
  function still(c) {
    lock.drive = false;
    lock.move = mv;
    mv.dx = 0; mv.dz = 0; mv.speed = 0; mv.back = false;
    lock.faceX = c.x + fwdX(c);
    lock.faceZ = c.z + fwdZ(c);
  }
  /** Andando até (x, z) a `speed` m/s, com a colisão de sempre. */
  function walkTo(c, x, z, speed) {
    const dx = x - c.x, dz = z - c.z, d = Math.hypot(dx, dz) || 1;
    lock.drive = false;
    lock.move = mv;
    mv.dx = dx / d; mv.dz = dz / d; mv.speed = speed; mv.back = false;
    lock.faceX = x;
    lock.faceZ = z;
  }
  /** Levada por aqui (o núcleo não a move): o lugar, o rumo e a passada de verdade para as patas. */
  function driveTo(c, x, z, yaw, v, k, dt) {
    lock.drive = true;
    const px = c.x, pz = c.z;
    c.x = x; c.z = z;
    c.yaw = Math.atan2(Math.sin(yaw), Math.cos(yaw));
    c.wantYaw = c.yaw;
    c.v = 0;
    c.dashT = 0;
    c.animSpeed = v;
    c.yawRate = k * v;
    const idt = 1 / Math.max(dt, 1e-4);
    c.vx = (x - px) * idt;
    c.vz = (z - pz) * idt;
    lock.faceX = x + Math.sin(yaw);
    lock.faceZ = z + Math.cos(yaw);
    R.lastX = x;
    R.lastZ = z;
  }
  const gesture = (kind, t, side = 1) => { gest.kind = kind; gest.t = t; gest.side = side; lock.gesture = gest; };
  const lookAt = (x, y, z) => { look.x = x; look.y = y; look.z = z; lock.look = look; };

  // ---------------------------------------------------------------- começar
  function begin(kind, extra = {}) {
    R = { kind, ph: '', t: 0, T: 0, called: false, said: false, lastX: NaN, lastZ: NaN, ...extra };
    S.count[kind] = (S.count[kind] ?? 0) + 1;
    lock.action = 'none';
    lock.airK = -1;
    lock.look = null;
    lock.gesture = null;
    lock.talk = 0;
    return R;
  }
  const phase = (name) => { R.ph = name; R.t = 0; R.said = false; };

  /** RABO: a voltinha planejada daqui (o círculo inteiro cabe, de um lado ou do outro). */
  function planLoop(c, o) {
    const Rr = between(LESADA.rabo.r), turns = between(LESADA.rabo.turns);
    const sides = rand() < 0.5 ? [1, -1] : [-1, 1];
    for (const side of sides) {
      const k = side / Rr, ramp = 0.16;
      const mid = Math.max(0.4, (turns * TAU - ramp * Math.abs(k)) / Math.abs(k));
      const path = buildPath(c.x, c.z, c.yaw, [{ len: ramp, k0: 0, k1: k }, { len: mid, k0: k, k1: k }, { len: ramp, k0: k, k1: 0 }]);
      if (!asCompanion(() => pathFits(c, path, o))) continue;
      return { path, side, r: Rr, prof: speedProfile(path.len, LESADA.rabo.v, 0.22, 0.26) };
    }
    return null;
  }
  const starters = {
    rabo(c, o) {
      if (c.animSpeed > 0.7) return false;
      const plan = planLoop(c, o);
      if (!plan) return false;
      begin('rabo', { side: plan.side });
      phase('olha');
      return true;
    },
    borboleta(c, o) {
      if (!flutter) return false;
      const D = asCompanion(() => chaseDir(c, o, 1.6));
      if (!D) return false;
      const N = nose(c, 0.5, 0.55);
      const clear = (a) => {
        const n = Math.max(1, Math.ceil(Math.hypot(N.x - a.x, N.y - a.y, N.z - a.z) / 0.1));
        for (let i = 0; i <= n; i++) {
          const k = i / n;
          if (flutter.blocked(a.x + (N.x - a.x) * k, a.y + (N.y - a.y) * k, a.z + (N.z - a.z) * k)) return false;
        }
        return true;
      };
      let bf = flutter.nearest(c.x, c.z, 5.5);
      if (bf && !clear(bf.pos)) bf = null;
      let visitor = false;
      if (!bf) {
        // uma que chega voando de longe, pelo lado para onde ela vai correr
        const P0 = { x: c.x + D.dx * 2.0, y: 0.95, z: c.z + D.dz * 2.0 };
        if (!clear(P0)) return false;
        bf = flutter.visitor;
        bf.place(P0, Math.atan2(c.x - P0.x, c.z - P0.z));
        visitor = true;
      }
      bf.flyTo(N, { speed: 1.1, then: 'hover' });
      begin('borboleta', { bf, D, visitor });
      phase('chega');
      return true;
    },
    bolha(c, o) {
      if (!bubbles || !flutter) return false;
      const D = asCompanion(() => chaseDir(c, o, 1.3));
      if (!D) return false;
      const px = -D.dz, pz = D.dx; // o lado
      let n = 0;
      for (const [side, y, back] of [[-0.28, 0.58, 0], [0.05, 0.74, 0.25], [0.32, 0.62, 0.1]]) {
        const p = { x: c.x + D.dx * (1.7 + back) + px * side, y, z: c.z + D.dz * (1.7 + back) + pz * side };
        if (flutter.blocked(p.x, p.y, p.z)) continue;
        if (bubbles.spawn(p, { x: -D.dx * 0.34 + px * side * 0.1, z: -D.dz * 0.34 + pz * side * 0.1 }, 0.04 + 0.012 * rand(), 6.5)) n++;
      }
      if (!n) return false;
      begin('bolha', { D });
      phase('chega');
      return true;
    },
    cheiro(c, o) {
      if (c.animSpeed > 0.7) return false;
      for (let i = 0; i < 10; i++) {
        const a = rand() * TAU, d = between(LESADA.sniff.d);
        const x = c.x + Math.sin(a) * d, z = c.z + Math.cos(a) * d;
        if (Math.hypot(x - o.x, z - o.z) < c.r + o.r + 0.45 || Math.hypot(x - o.x, z - o.z) > LESADA.leash + 0.4) continue;
        if (!asCompanion(() => lineFits(c, c.x, c.z, x, z, o))) continue;
        begin('cheiro', { spot: { x, z } });
        phase('vai');
        return true;
      }
      return false;
    },
  };
  /** Sorteia uma distração (a mesma não repete em seguida) e começa a primeira que der. */
  function startAny(c, o) {
    const kinds = Object.keys(LESADA.kinds).filter((k) => k !== S.last);
    const order = [];
    while (kinds.length) {
      const tot = kinds.reduce((a, k) => a + LESADA.kinds[k], 0);
      let r = rand() * tot;
      const i = kinds.findIndex((k) => (r -= LESADA.kinds[k]) < 0);
      order.push(kinds.splice(i < 0 ? 0 : i, 1)[0]);
    }
    for (const k of order) {
      if (starters[k](c, o)) { S.last = k; return true; }
    }
    return false;
  }
  function startTrip(c, o) {
    const ex = c.x + fwdX(c) * LESADA.trip.ahead, ez = c.z + fwdZ(c) * LESADA.trip.ahead;
    if (!asCompanion(() => lineFits(c, c.x, c.z, ex, ez, o))) return false;
    begin('tropeco', { v0: Math.max(c.animSpeed, 1) });
    phase('tropeca');
    return true;
  }
  function startBonk(c, h) {
    if (R) end();
    begin('bonk', { nx: h.nx, nz: h.nz });
    phase('bonk');
    S.bonkCd = LESADA.bonk.cd;
    sfx('bonk', c);
    const head = dir.head?.('rhaenyra', 0.05) ?? { x: c.x, y: 0.6, z: c.z };
    dir.onomato?.('TÓIM!', { at: { x: head.x - h.nx * 0.1, y: head.y + 0.05, z: head.z - h.nz * 0.1 }, size: 0.85, color: '#ffd23f', rot: -10, style: 'shake' });
  }

  /** A Radhija chama (bufando), uma vez por distração. */
  function call(kind) {
    if (!R || R.callTried || ctx.activeDog !== 'radhija' || S.callCd > 0) return;
    const c = ctrls.rhaenyra, o = ctrls.radhija;
    if (dist(c, o) > LESADA.call.r) return;
    R.callTried = true;
    if (rand() > LESADA.call.chance) return;
    R.called = true;
    S.callCd = LESADA.call.cd;
    sfx('bufa', o, 0.8);
    say('radhija', pick(CALLS[kind] ?? CALLS.rabo, `call-${kind}`));
  }
  /** O fim: a dog volta a quem a move de sempre, no chão. */
  function end() {
    if (!R) return;
    const c = ctrls.rhaenyra;
    if (R.kind === 'borboleta' && R.bf?.object.visible) {
      // a que veio de fora vai embora pelo alto (e some lá em cima); a do cenário volta para o lugar dela
      if (R.visitor) R.bf.flyTo({ x: R.bf.pos.x + R.D.dx * 1.5, y: 3.6, z: R.bf.pos.z + R.D.dz * 1.5 }, { speed: 1.3, then: 'hide' });
      else flutter?.home(R.bf);
    }
    if (R.hop) c.y = 0;
    lock.drive = false;
    lock.look = null;
    lock.gesture = null;
    lock.talk = 0;
    lock.airK = -1;
    R = null;
  }

  // ---------------------------------------------------------------- cada distração, quadro a quadro
  /** O bote (borboleta e bolha): um pulinho curto para a frente, conferido antes (até `len` m). */
  function hopPlan(c, o, len) {
    for (const L of [len, len * 0.6, 0]) {
      if (!L || asCompanion(() => lineFits(c, c.x, c.z, c.x + fwdX(c) * L, c.z + fwdZ(c) * L, o))) {
        return { x0: c.x, z0: c.z, yaw: c.yaw, len: L };
      }
    }
    return { x0: c.x, z0: c.z, yaw: c.yaw, len: 0 };
  }
  function stepHop(c, o, dt, dur, up) {
    const H = R.hop;
    const k = clamp(R.t / dur, 0, 1);
    const e = smooth(k);
    // a irmã (ou uma porta) entrou na frente no meio do bote: ela cai onde está
    let x = H.x0 + Math.sin(H.yaw) * H.len * e, z = H.z0 + Math.cos(H.yaw) * H.len * e;
    if (!roomyC(c, x, z, H.yaw, o)) { x = c.x; z = c.z; H.len = 0; }
    driveTo(c, x, z, H.yaw, k < 1 ? (H.len / dur) * 1.5 : 0, 0, dt);
    c.y = Math.sin(Math.PI * k) * up;
    lock.airK = k < 1 ? k : -1;
    return k;
  }
  const RUN = {
    rabo(c, o, dt) {
      if (R.ph === 'olha') {
        still(c);
        // olha para trás, por cima do ombro, para o lado da voltinha
        lookAt(c.x - fwdX(c) * 0.5 + R.side * fwdZ(c) * 0.3, 0.28, c.z - fwdZ(c) * 0.5 - R.side * fwdX(c) * 0.3);
        gesture('alert', R.t);
        if (R.t >= 0.5) {
          // a voltinha de onde ela parou (freando, ela anda uns centímetros)
          const plan = planLoop(c, o);
          if (!plan) return end();
          R.plan = plan;
          R.side = plan.side;
          R.o = { x: c.x, z: c.z, yaw: c.yaw, k: 0, d: 0, v: 0 };
          phase('volta');
          sfx('pulinho', c, 0.6);
        }
        return;
      }
      if (R.ph === 'volta') {
        const P = R.plan, Q = R.o;
        P.prof.at(R.t, Q);
        along(P.path, Q.d, Q);
        // algo entrou no caminho (a irmã, uma porta): para onde está
        const ok = roomyC(c, Q.x, Q.z, Q.yaw, o);
        lock.look = null;
        gesture('chaseTail', R.t, R.side);
        if (!ok || R.t >= P.prof.T) { phase('tonta'); still(c); return; }
        driveTo(c, Q.x, Q.z, Q.yaw, Q.v, Q.k, dt);
        if (R.t > 0.5) call('rabo');
        return;
      }
      // tonta: para, a cabeça inclinada; "Hã?" se a irmã chamou
      still(c);
      gesture('tilt', R.t, -R.side);
      lookAt(o.x, 0.35, o.z);
      if (R.t > 0.3 && !R.said) { R.said = true; if (R.called || rand() < 0.6) say('rhaenyra', R.called ? pick(LINES.ha, 'ha') : pick(LINES.rabo, 'rabo')); }
      if (R.t > 1.0) end();
    },
    borboleta(c, o, dt) {
      const bf = R.bf;
      if (!bf.object.visible && R.ph !== 'ha') return end();
      if (R.ph === 'chega') {
        still(c);
        lookAt(bf.pos.x, bf.pos.y, bf.pos.z);
        const N = nose(c, 0.5, 0.55);
        if (Math.hypot(bf.pos.x - N.x, bf.pos.y - N.y, bf.pos.z - N.z) < 0.35 || R.t > 2.6) {
          phase('nota');
          say('rhaenyra', pick(LINES.borboleta, 'borboleta'));
        }
        return;
      }
      if (R.ph === 'nota') {
        still(c);
        lookAt(bf.pos.x, bf.pos.y, bf.pos.z);
        gesture('alert', R.t);
        // ela levanta as orelhas; a borboleta passa pelo focinho e sai em zigue-zague, baixinho, para ela ir atrás
        if (R.t > 0.3 && !R.go) { R.go = true; bf.flyTo({ x: c.x + R.D.dx * 1.8, y: 0.62, z: c.z + R.D.dz * 1.8 }, { speed: 1.25, then: 'hover' }); }
        if (R.t > 0.55) phase('corre');
        return;
      }
      if (R.ph === 'corre') {
        const d = Math.hypot(bf.pos.x - c.x, bf.pos.z - c.z);
        walkTo(c, bf.pos.x, bf.pos.z, LESADA.chase.v);
        lookAt(bf.pos.x, bf.pos.y, bf.pos.z);
        gesture('wag', R.t);
        if (R.t > 0.5) call('borboleta');
        R.slow = c.animSpeed < 0.3 && R.t > 0.4 ? (R.slow ?? 0) + dt : 0;
        if (R.t > 0.7 && d < LESADA.chase.near + 0.1 && bf.pos.y < 1.1) { phase('bote'); R.hop = hopPlan(c, o, 0.3); return; }
        if (R.t > LESADA.chase.max || dist(c, o) > LESADA.far - 0.2 || R.slow > 0.3) { phase('ha'); flee(); }
        return;
      }
      if (R.ph === 'bote') {
        lookAt(bf.pos.x, bf.pos.y, bf.pos.z);
        gesture('wag', R.t);
        const k = stepHop(c, o, dt, 0.5, 0.2);
        if (k > 0.4 && !R.snap) {
          R.snap = true;
          dir.onomato?.('NHAC!', { at: { ...nose(c, 0.45, 0.62) }, size: 0.7, color: '#ffffff', rot: 8 });
          flee();
        }
        if (k >= 1) { c.y = 0; R.hop = null; lock.airK = -1; phase('ha'); }
        return;
      }
      // errou: olha a borboleta subindo; "Hã?" se a irmã chamou
      still(c);
      lookAt(bf.pos.x, bf.pos.y, bf.pos.z);
      gesture('tilt', R.t, 1);
      if (R.t > 0.3 && !R.said) { R.said = true; say('rhaenyra', R.called ? pick(LINES.ha, 'ha') : pick(LINES.borboletaFim, 'borboletaFim')); }
      if (R.t > 1.1) end();
    },
    bolha(c, o, dt) {
      const N = nose(c, 0.42, 0.5);
      const b = bubbles.nearest(N);
      if (R.ph === 'chega') {
        still(c);
        if (b) lookAt(b.pos.x, b.pos.y, b.pos.z);
        if (!b) return end();
        if (Math.hypot(b.pos.x - N.x, b.pos.z - N.z) < 1.0 || R.t > 2.6) { phase('nota'); say('rhaenyra', pick(LINES.bolha, 'bolha')); }
        return;
      }
      if (R.ph === 'nota') {
        still(c);
        if (b) lookAt(b.pos.x, b.pos.y, b.pos.z);
        gesture('alert', R.t);
        if (R.t > 0.4) phase(b ? 'corre' : 'ha');
        return;
      }
      if (R.ph === 'corre') {
        if (!b) { phase('ha'); return; }
        walkTo(c, b.pos.x, b.pos.z, LESADA.chase.v * 0.85);
        lookAt(b.pos.x, b.pos.y, b.pos.z);
        gesture('wag', R.t);
        if (R.t > 0.4) call('bolha');
        R.slow = c.animSpeed < 0.3 && R.t > 0.4 ? (R.slow ?? 0) + dt : 0;
        if (Math.hypot(b.pos.x - N.x, b.pos.z - N.z) < 0.4) { phase('bote'); R.hop = hopPlan(c, o, 0.22); return; }
        if (R.t > LESADA.chase.max || dist(c, o) > LESADA.far - 0.2 || R.slow > 0.3) phase('ha');
        return;
      }
      if (R.ph === 'bote') {
        if (b) lookAt(b.pos.x, b.pos.y, b.pos.z);
        const k = stepHop(c, o, dt, 0.45, 0.16);
        if (k > 0.4 && !R.snap) {
          R.snap = true;
          const p = bubbles.popNear(nose(c, 0.45, 0.55), 0.5);
          if (p) {
            R.popped = true;
            sfx('bolha', c);
            dir.onomato?.('PLOC!', { at: p, size: 0.7, color: '#bfe9ff', rot: -8 });
          }
        }
        if (k >= 1) { c.y = 0; R.hop = null; lock.airK = -1; phase('ha'); }
        return;
      }
      // cadê? olha para um lado e para o outro
      still(c);
      const side = R.t < 0.5 ? 1 : -1;
      lookAt(c.x + fwdX(c) * 0.6 + fwdZ(c) * 0.5 * side, 0.45, c.z + fwdZ(c) * 0.6 - fwdX(c) * 0.5 * side);
      gesture('tilt', R.t, side);
      if (R.t > 0.3 && !R.said) {
        R.said = true;
        say('rhaenyra', R.called ? pick(LINES.ha, 'ha') : R.popped ? pick(LINES.bolhaFim, 'bolhaFim') : pick(LINES.bolhaErrou, 'bolhaErrou'));
      }
      if (R.t > 1.1) end();
    },
    cheiro(c, o, dt) {
      const P = R.spot;
      if (R.ph === 'vai') {
        walkTo(c, P.x, P.z, LESADA.sniff.v);
        lookAt(P.x, 0.02, P.z);
        R.slow = c.animSpeed < 0.2 && R.t > 0.4 ? (R.slow ?? 0) + dt : 0;
        if (Math.hypot(P.x - c.x, P.z - c.z) < 0.16 || R.t > 1.8 || R.slow > 0.3) phase('fareja');
        return;
      }
      if (R.ph === 'fareja') {
        still(c);
        lock.look = null;
        gesture('sniffGround', R.t);
        if ((R.t > 0.15 && !R.s1) || (R.t > 1.0 && !R.s2)) { if (R.t > 1.0) R.s2 = true; R.s1 = true; sfx('fungada', c, 0.8); }
        if (R.t > 0.6 && !R.said) { R.said = true; say('rhaenyra', pick(LINES.cheiro, 'cheiro')); }
        if (R.t > 1.0) call('cheiro');
        if (R.t > LESADA.sniff.t) phase('ha');
        return;
      }
      still(c);
      lookAt(o.x, 0.35, o.z);
      gesture(R.called ? 'tilt' : 'wag', R.t, 1);
      if (R.t > 0.25 && !R.said) { R.said = true; if (R.called) say('rhaenyra', pick(LINES.ha, 'ha')); }
      if (R.t > 0.9) end();
    },
    tropeco(c, o, dt) {
      // segue um pouquinho para a frente, freando (com a colisão de sempre), o peito mergulha e ela se recompõe
      const e = smooth(R.t / 0.45);
      lock.drive = false;
      lock.move = mv;
      mv.dx = fwdX(c); mv.dz = fwdZ(c); mv.speed = R.v0 * (1 - e) * 0.8; mv.back = false;
      lock.faceX = c.x + fwdX(c);
      lock.faceZ = c.z + fwdZ(c);
      lock.look = null;
      gesture('stumble', R.t);
      if (R.t > 0.06 && !R.s1) { R.s1 = true; sfx('tropeco', c); }
      if (R.t > 0.45 && !R.said) { R.said = true; if (rand() < 0.5) say('rhaenyra', pick(LINES.tropeco, 'tropeco')); }
      if (R.t >= GESTURE_TIME.stumble) end();
    },
    bonk(c, o, dt) {
      // recua um passinho de frente para a porta, zonza
      lock.drive = false;
      lock.move = mv;
      mv.dx = R.nx; mv.dz = R.nz; mv.speed = R.t < 0.22 ? 0.55 : 0; mv.back = true;
      lock.faceX = c.x - R.nx;
      lock.faceZ = c.z - R.nz;
      lock.action = R.t < 0.35 ? 'startled' : 'none';
      lock.look = null;
      gesture('bonk', R.t);
      if (R.t > 0.45 && !R.said) { R.said = true; say('rhaenyra', pick(LINES.bonk, 'bonk')); }
      if (R.t >= GESTURE_TIME.bonk - 0.25) { lock.action = 'none'; end(); }
    },
    ha(c, o) {
      still(c);
      lookAt(o.x, 0.4, o.z);
      gesture('tilt', R.t, R.side ?? 1);
      if (!R.said) { R.said = true; say('rhaenyra', pick(LINES.ha, 'ha')); }
      if (R.t > 0.9) end();
    },
  };
  /** A borboleta foge para cima e para longe (a do cenário depois volta para o lugar dela). */
  function flee() {
    const bf = R?.bf;
    if (!bf || R.fled) return;
    R.fled = true;
    const up = { x: bf.pos.x + R.D.dx * 1.0, y: 2.3, z: bf.pos.z + R.D.dz * 1.0 };
    bf.flyTo(up, { speed: 1.6, then: 'wander', radius: 0.4 });
  }

  // ---------------------------------------------------------------- a cada quadro
  /** A batida nova numa porta, correndo (a mais de LESADA.bonk.speed contra ela). */
  function doorHit(c) {
    const hits = c.hits;
    let hit = null;
    if (hits && hits.length && (c.v || 0) > LESADA.bonk.speed && !(c.jumpT > 0) && !c.shove) {
      const fx = fwdX(c), fz = fwdZ(c);
      for (const h of hits) {
        if (h.kind !== 'gate' && !DOOR_ID.test(String(h.id))) continue;
        if (touching.has(h.id)) continue;
        if (-(fx * h.nx + fz * h.nz) * c.v >= LESADA.bonk.speed) { hit = h; break; }
      }
    }
    touching.clear();
    if (hits) for (const h of hits) touching.add(h.id);
    return hit;
  }

  /**
   * @param {number} dt
   * @param {{ playing: boolean }} o playing: jogando (sem cena, fora do mural; a área decide)
   */
  function update(dt, { playing }) {
    S.t += dt;
    S.callCd = Math.max(0, S.callCd - dt);
    S.haCd = Math.max(0, S.haCd - dt);
    S.bonkCd = Math.max(0, S.bonkCd - dt);
    S.hold = Math.max(0, S.hold - dt);
    S.talkT = Math.max(0, S.talkT - dt);
    const c = ctrls.rhaenyra, o = ctrls.radhija;
    if (!c || !o) return;
    const comp = ctx.activeDog === 'radhija';
    const free = S.on && playing && !ctx.isStaying?.('rhaenyra') && !busy('rhaenyra') && S.hold <= 0
      && !(c.jumpT > 0) && !(c.wallDur > 0) && !c.shove;
    // a batida na porta (ativa ou companheira), também no meio de uma corrida atrás de alguma coisa
    const hit = doorHit(c);
    if (hit && free && S.bonkCd <= 0 && (!R || R.ph === 'corre' || R.ph === 'vai')) startBonk(c, hit);
    if (R) {
      // trocou de dog (só o focinho na porta vale para a ativa), a cena começou, o Fica, alguém a pôs em outro lugar
      const moved = Number.isFinite(R.lastX) && Math.hypot(c.x - R.lastX, c.z - R.lastZ) > 0.25;
      if (!free || moved || (!comp && R.kind !== 'bonk') || (R.kind !== 'bonk' && dist(c, o) > LESADA.far + 0.4)) end();
      else {
        R.t += dt;
        R.T += dt;
        lock.talk = S.talkT > 0 ? 0.8 : 0;
        RUN[R.kind](c, o, dt);
        if (R && R.T > 6) end(); // nada dura demais
      }
    }
    if (!free || !comp) { S.calm = 0; S.haIn = -1; return; }
    S.calm += dt;
    if (R || S.calm < LESADA.calm) return;
    const d = dist(c, o);
    // o "Hã?" atrasado depois do latido da irmã
    if (S.haIn >= 0) {
      S.haIn -= dt;
      if (S.haIn < 0 && d < LESADA.ha.r && c.animSpeed < 0.9) { S.haCd = LESADA.ha.cd; begin('ha', { side: rand() < 0.5 ? 1 : -1 }); phase('ha'); return; }
    }
    // perto da irmã, ela parada ou andando devagar: o tempo da próxima distração corre
    if (d <= LESADA.leash && o.animSpeed < LESADA.slow && c.animSpeed < 1.0 && (c.y || 0) < 0.02) {
      S.wait -= dt;
      if (S.wait <= 0) S.wait = startAny(c, o) ? between(LESADA.every) : 1.5 + rand();
    }
    // correndo atrás da irmã: o tropeço
    if (!R && c.animSpeed >= LESADA.trip.speed && d > 0.9) {
      S.tripWait -= dt;
      if (S.tripWait <= 0) S.tripWait = startTrip(c, o) ? between(LESADA.trip.every) : 1.5;
    }
  }

  return {
    update,
    /** A trava da Rhaenyra enquanto ela está distraída (ou zonza); null fora disso. */
    lockFor(name) {
      if (name !== 'rhaenyra' || !R) return null;
      if (R.kind !== 'bonk' && ctx.activeDog === 'rhaenyra') return null;
      return lock;
    },
    /** Começa uma distração agora (testes; a mesma conferência de sempre). → começou? */
    start(kind) {
      const c = ctrls.rhaenyra, o = ctrls.radhija;
      if (R || !starters[kind] && kind !== 'tropeco' && kind !== 'ha') return false;
      if (kind === 'tropeco') return startTrip(c, o);
      if (kind === 'ha') { begin('ha', { side: rand() < 0.5 ? 1 : -1 }); phase('ha'); return true; }
      const ok = starters[kind](c, o);
      if (ok) S.last = kind;
      return ok;
    },
    /** Liga ou desliga (as medições que comparam duas passagens desligam: um sorteio não tira a dog do lugar). */
    setOn(on) { S.on = !!on; if (!on) end(); },
    get on() { return S.on; },
    get run() { return R ? { kind: R.kind, ph: R.ph, t: R.t } : null; },
    reset() {
      if (R?.hop) ctrls.rhaenyra.y = 0;
      R = null;
      lock.drive = false;
      lock.look = null;
      lock.gesture = null;
      lock.talk = 0;
      lock.airK = -1;
      lock.action = 'none';
      fresh();
    },
    info() {
      return { on: S.on, run: R ? { kind: R.kind, ph: R.ph, t: +R.t.toFixed(2), called: R.called } : null, wait: +S.wait.toFixed(2), count: { ...S.count } };
    },
    dispose() { for (const off of offs) off(); },
  };
}
