// MODO HISTÓRIA · Capítulo 1 — o TERRAÇO DA TORRE jogável (pedido do usuário em 2026-11-11: "quando se abre a porta não
// tem nada pra fazer, já vem uma animação e essa parte fica rápida e sem vida"). O terraço é um cenário à parte, no chão
// (layout.ROOFTOP, world/telhado.js); as cenas são de scenesTelhado.js. Um pega-pega com puzzle, das duas juntas:
//   1. OS POLEIROS: o Esquadrão (o Farelo com a cenoura) fica pousado num poleiro baixo (a antena, o varal, o
//      ar-condicionado). Quando uma dog chega perto (SCARE_R), ou late perto, o bando voa para outro poleiro livre: nunca
//      o de onde acabou de vir, nem um com dog por perto, nem um GUARDADO (uma dog no Fica a até GUARD_R dele);
//   2. ENCURRALAR: sem poleiro livre, eles sobem no alto da caixa d'água ("lá em cima elas não sobem"). Com três
//      poleiros baixos, uma irmã de guarda e a outra espantando dão conta em dois ou três voos; sozinha, o bando roda;
//   3. A CAIXA D'ÁGUA: a Rhaenyra empurra o caixote até embaixo da escada de marinheiro (o lance de baixo recolhido e
//      travado no alto); com o caixote no lugar, o impulso dela na parede (createWallButton, como a maçaneta da cozinha)
//      alcança o puxador da trava e a escada desce; a Radhija sobe (roteirizado, como a subida da lixeira);
//   4. LÁ NO ALTO: quase! O bando foge para a cidade com a cenoura e a tampa de borracha do alçapão (a pista 'tampa',
//      cena 'telhadoFuga'); com o Faro aceso, as penas mostram a direção da cidade;
//   5. O MIRANTE: na mureta do norte, a cena 'telhadoOlha' (a Radhija brava, a Rhaenyra: "pela rua!") e o corte de
//      volta para a porta da torre (etapa 'portaria').
// O puzzle de área (puzzle.js) delega a este módulo enquanto `active` (veja as linhas de integração no relatório do
// PR e em scenesTelhado.js). Tudo o que fica de permanente sai nos commits das cenas: pular ou assistir dá no mesmo.
// API: createRooftop(K, { world, root, emit, effects, ctx, props, dir, hints, faro?, book? }) →
//   { enter(), active, phase, update(dt, { active, comp, playing }), interact(c), modifyIntent(dt, c, intent, o),
//     shoveSpots(), wallSpots(), onWallTouch(c, spot), onBark(c), onFaro(c), lockFor(name), lookTarget(c), navFlags(),
//     objective(), lead(), info(), reset(), done, … e o que as cenas usam: begin(), escapeStart(), afterEscape(),
//     finish(), squadAt(id), spotsOf(id), heldBy }.
import { createPushCrate, createWallButton } from '../../../game/mechanics/index.js';
import { SCENT } from '../../faro/faro.js';

/** Os ids das cenas do terraço (registradas no puzzle: createRooftopScenes, scenesTelhado.js). */
export const ROOF_SCENES = Object.freeze({ chega: 'telhadoChega', fuga: 'telhadoFuga', olha: 'telhadoOlha' });
/** A que distância uma dog espanta o bando (m, do ponto do poleiro no chão); a que distância uma no Fica guarda um poleiro. */
export const SCARE_R = 1.8;
export const GUARD_R = 2.4;
/** Latindo, de mais longe. */
const BARK_R = 3.6;
/** Depois de pousar, o bando leva um instante para se assustar de novo (s). */
const SETTLE = 0.6;
/** O primeiro poleiro (a chegada) e os baixos, na ordem. */
const FIRST = 'varal';
const NAMES = ['radhija', 'rhaenyra'];
/** As falas curtas do Capitão a cada voo (em volta). */
const FLEE_LINES = ['Esquadrão, recuar!', 'Mudança de poleiro!', 'Ninguém alcança o Esquadrão Migalha!', 'Asas, para que te quero!'];
const TEXTS = {
  caca: 'Encurralem os pombos!',
  caixote: 'Eles estão na caixa d’água! Levem o caixote até a escada',
  trava: 'A escada está travada lá em cima: a Rhaenyra pula do caixote',
  subir: 'A escada desceu: a Radhija sobe (E)',
  farejar: 'Para onde eles foram? Farejem',
  mirante: 'As penas apontam para a cidade: vão até a mureta',
};
const HINTS = {
  guarda: 'Eles sempre fogem para outro poleiro: deixe uma de guarda perto de um deles (troque com Q e use o Fica: F) e espante com a outra!',
  caixote: 'O caixote tem que ficar embaixo da escada: a Rhaenyra empurra (segure Shift).',
  trava: 'Com o caixote embaixo da escada, a Rhaenyra pula de frente para ele (Espaço) e alcança o puxador da trava.',
  subir: 'A escada desceu até o caixote: a Radhija sobe (E).',
  alto: 'O puxador da trava é alto demais para o pulo do chão. Um caixote embaixo ajudaria…',
  farejar: 'Fareje (V): as penas mostram para onde eles foram.',
};

const near = (a, b, r) => Math.hypot(a.x - b.x, a.z - b.z) <= r;

/**
 * Os três lugares de um poleiro (o Capitão, o Farelo no meio com a cenoura e o Soneca), lado a lado no eixo dele.
 * @returns {{ x: number, y: number, z: number }[]}
 */
export function perchSpots(P) {
  const s = P.step;
  return [-s, 0, s].map((d) => (P.axis === 'z' ? { x: P.x, y: P.y, z: P.z + d } : { x: P.x + d, y: P.y, z: P.z }));
}

/**
 * @param {any} K o contexto das cenas do puzzle (dir, props, L, S, book, deduction, faro, placeAt, setStage, …)
 * @param {{ world: any, root?: any, emit: any, effects: any, ctx: any, props: any, dir: any,
 *   hints: any, faro?: any, book?: any }} o
 */
export function createRooftop(K, { world, emit, effects, ctx, props, dir, hints, faro = K.faro, book = K.book }) {
  const L = K.L;
  const P = props.rooftop || null;
  const PER = L.ROOF_PERCHES;
  const LOW = Object.keys(PER).filter((id) => !PER[id].high);
  const LD = L.ROOF_LADDER, CR = L.ROOF_CRATE, T = L.ROOF_TANK;
  const R = (n) => ctx.ctrls?.[n] ?? K.ctx?.ctrls?.[n];

  const crate = createPushCrate({ id: 'telhado-caixote', cfg: CR, world, emit, prop: P?.crate ?? null });
  const latch = createWallButton({ id: 'telhado-trava', cfg: L.ROOF_LATCH, emit, prop: P?.latch ?? null });
  // a trilha de cheiro das penas (aparece com o Faro depois da fuga), do pé da caixa d'água até o mirante
  const TRAIL = 'penas-telhado';
  faro?.addTrail?.(TRAIL, [{ x: T.x0 - 0.2, z: T.z1 - 0.3 }, ...L.ROOF_FEATHERS.map((f) => ({ x: f.x, z: f.z })), { x: L.ROOF_LOOKOUT.x, z: L.ROOF_LOOKOUT.z + 0.15 }], { color: SCENT.pombos, spacing: 0.2, enabled: false });

  /** @type {any} */
  let S = null;
  const fresh = () => ({
    phase: 'off', perch: null, prev: null, flight: null, settle: 0, hops: 0, sayCd: 0, guardCd: 0, lineI: 0,
    ladderDown: false, ladderT: -1, climb: null, trailSeen: false, lookHintCd: 0, guardShown: new Set(), time: 0,
  });

  // ---------------------------------------------------------------- o bando (o Esquadrão) e a cenoura
  const squad = () => props.squad || {};
  const birds = () => { const s = squad(); return [s.cap, s.far, s.son]; };
  /** A cenoura nas patas do Farelo (como o grab das cenas: K.heldBy guarda quem está com ela). */
  function grabCarrot() {
    const c = props.carrot;
    if (!c) return;
    const far = squad().far;
    c.object.visible = true;
    for (const p of Object.values(squad())) p.carry?.(p === far);
    if (c.holdBy && K.heldBy !== far) c.holdBy(far);
    K.heldBy = far;
  }
  function hideSquad() {
    K.heldBy = null;
    props.carrot?.holdBy?.(null);
    if (props.carrot) props.carrot.object.visible = false;
    for (const p of Object.values(squad())) { p.carry?.(false); p.shiver?.(0); p.lookAt?.(null); p.setVisible?.(false); }
  }
  /** O bando pousado no poleiro `id` (sem voo), olhando para (lx, lz). */
  function squadAt(id, look = null) {
    const spots = perchSpots(PER[id]);
    const lx = look?.x ?? (L.ROOFTOP.x0 + L.ROOFTOP.x1) / 2, lz = look?.z ?? (L.ROOFTOP.z0 + L.ROOFTOP.z1) / 2;
    birds().forEach((b, i) => {
      if (!b) return;
      const q = spots[i];
      b.setVisible(true);
      b.shiver?.(0);
      b.setPose({ x: q.x, y: q.y, z: q.z, yaw: Math.atan2(lx - q.x, lz - q.z), flying: false, asleep: i === 2 && id !== 'caixa' });
    });
    grabCarrot();
  }
  const perchOf = (id) => PER[id];
  /** Uma dog no Fica a até GUARD_R do poleiro? */
  const guarded = (id) => NAMES.some((n) => { const c = R(n); return c && ctx.isStaying?.(n) && near(c, PER[id], GUARD_R); });
  /** Alguma dog solta (fora do Fica) perto do poleiro? */
  const crowded = (id) => NAMES.some((n) => { const c = R(n); return c && !ctx.isStaying?.(n) && near(c, PER[id], SCARE_R + 0.3); });

  /** O bando se assusta com `c` e voa: para o poleiro livre mais longe dela, ou, sem nenhum, para a caixa d'água. */
  function flee(c) {
    const from = S.perch;
    const cand = LOW.filter((id) => id !== from && id !== S.prev);
    const free = cand.filter((id) => !guarded(id) && !crowded(id));
    let to = null;
    if (free.length) {
      free.sort((a, b) => Math.hypot(PER[b].x - c.x, PER[b].z - c.z) - Math.hypot(PER[a].x - c.x, PER[a].z - c.z));
      to = free[0];
    } else to = 'caixa';
    // o que eles queriam e estava guardado: o Capitão reclama
    const blocked = cand.find((id) => guarded(id));
    startFlight(to);
    S.hops++;
    say('capitao', to === 'caixa' ? 'Para a caixa d’água! Lá em cima elas não sobem!' : blocked && S.guardCd <= 0 ? 'Ali não! Tem cachorro de guarda!' : FLEE_LINES[S.lineI++ % FLEE_LINES.length], to === 'caixa' || !!blocked);
    if (blocked) S.guardCd = 5;
    if (to !== 'caixa' && S.hops >= 3 && !LOW.some((id) => guarded(id))) hints?.now?.(HINTS.guarda, 6, 14);
  }
  function startFlight(to) {
    const from = birds().map((b) => (b ? { x: b.object.position.x, y: b.object.position.y, z: b.object.position.z } : { x: 0, y: 0, z: 0 }));
    const dest = perchSpots(PER[to]);
    const d = Math.hypot(PER[to].x - from[1].x, PER[to].z - from[1].z);
    S.flight = { from, to: dest, id: to, t: 0, dur: Math.max(1.0, Math.min(1.9, 0.6 + d * 0.13)), arc: 0.7 + d * 0.07 };
    S.prev = S.perch;
    S.perch = null;
    emit('story:sfx', { name: 'asas', x: from[1].x, z: from[1].z });
  }
  function stepFlight(dt) {
    const F = S.flight;
    if (!F) return;
    F.t += dt;
    let done = true;
    birds().forEach((b, i) => {
      if (!b) return;
      const k = Math.min(1, Math.max(0, (F.t - i * 0.12) / F.dur));
      if (k < 1) done = false;
      const e = k * k * (3 - 2 * k);
      const a = F.from[i], z = F.to[i];
      const top = Math.max(a.y, z.y) + F.arc;
      const y = a.y + (z.y - a.y) * e + Math.sin(Math.PI * k) * (top - Math.max(a.y, z.y)) * 0.9;
      const yaw = Math.atan2(z.x - a.x, z.z - a.z);
      b.setPose({ x: a.x + (z.x - a.x) * e, y, z: a.z + (z.z - a.z) * e, yaw, flying: k < 0.97, asleep: false, flightProgress: k });
    });
    if (done) {
      S.flight = null;
      S.perch = F.id;
      S.settle = 0;
      squadAt(F.id, R(ctx.activeDog));
      emit('story:sfx', { name: 'arrulho', x: PER[F.id].x, z: PER[F.id].z, volume: 0.7 });
      if (F.id === 'caixa') corner();
    }
  }
  /** Sem poleiro livre: o bando fica no alto da caixa d'água. */
  function corner() {
    S.phase = 'caixa';
    S.hops = 0;
    say('radhija', 'Encurralados! Mas como a gente sobe lá?', true);
    hints?.now?.(crateIn() ? HINTS.trava : HINTS.caixote, 5, 8);
    emit('objective', obj());
  }
  /** Os pombos olham para quem está mais perto (e o Soneca cochila quando ninguém chega). */
  function animatePerched() {
    if (!S.perch) return;
    let best = null, bd = Infinity;
    for (const n of NAMES) { const c = R(n); if (!c) continue; const d = Math.hypot(c.x - PER[S.perch].x, c.z - PER[S.perch].z); if (d < bd) { bd = d; best = c; } }
    const [cap, far, son] = birds();
    const at = best ? { x: best.x, y: (best.y || 0) + 0.3, z: best.z } : null;
    cap?.lookAt?.(bd < 7 ? at : null);
    far?.lookAt?.(bd < 5 ? at : null);
    son?.setPose?.({ asleep: S.perch !== 'caixa' && bd > 4.5 });
    if (S.perch === 'caixa') { cap?.shiver?.(S.phase === 'subir' ? 0.4 : 0); far?.shiver?.(S.phase === 'subir' ? 0.6 : 0); }
  }

  // ---------------------------------------------------------------- falas e cenas
  function say(who, text, force = false) {
    if (!force && S.sayCd > 0) return;
    S.sayCd = 2.2;
    dir?.say?.(who, text, { mode: 'jogo' });
  }
  /** Pede uma cena ao puzzle (K.startScene, ou a fila S.pending do puzzle). */
  function play(id) {
    if (K.startScene) K.startScene(id);
    else if (K.S) K.S.pending = K.S.pending || id;
  }

  // ---------------------------------------------------------------- o caixote, a trava e a escada
  const crateIn = () => Math.abs(crate.x - LD.x) <= 0.12 && crate.z <= CR.minZ + 0.1;
  /** Onde a Radhija começa a subida: ao sul do caixote, no meio da escada. */
  const climbFoot = () => ({ x: LD.x, z: crate.z + CR.half + 0.3 });
  function dropLadder() {
    if (S.ladderDown) return;
    S.ladderDown = true;
    S.ladderT = 0;
    crate.freeze();
    emit('story:sfx', { name: 'trinco', x: LD.x, z: LD.z });
    emit('door:open', { id: 'telhado-escada', x: LD.x, z: LD.z });
    dir?.onomato?.('CLEC!', { at: { x: LD.x, y: L.ROOF_LATCH.top + 0.25, z: L.ROOF_LATCH.z }, size: 0.8, color: '#ffd23f', rot: -8 });
    hints?.now?.(HINTS.subir, 4.5, 6);
    emit('objective', obj());
  }
  function stepLadder(dt) {
    if (S.ladderT < 0) return;
    S.ladderT += dt;
    const k = Math.min(1, S.ladderT / 0.55);
    // desce com um tranco e quica de leve no caixote
    const e = k < 0.8 ? (k / 0.8) ** 2 : 1 - Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.05;
    P?.ladder?.setDrop?.(e);
    if (k >= 1) {
      S.ladderT = -1;
      P?.ladder?.setDrop?.(1);
      emit('story:sfx', { name: 'pulinho', x: LD.x, z: LD.z, volume: 0.8 });
    }
  }

  // ---------------------------------------------------------------- a subida da Radhija (roteirizada)
  function startClimb() {
    const c = R('radhija');
    const foot = climbFoot();
    // a irmã sai da frente do caixote, se estiver no caminho
    const rha = R('rhaenyra');
    if (rha && Math.hypot(rha.x - foot.x, rha.z - foot.z) < 0.75) effects?.pushTo?.(rha, foot.x + 0.85, foot.z + 0.35, { dur: 0.35, action: 'none', face: { x: LD.x, z: LD.z } });
    const top = PER.caixa;
    const steps = [
      { kind: 'walk', to: foot, dur: 0.45, y: 0 },
      { kind: 'hop', to: { x: LD.x, z: crate.z }, y: CR.height, dur: 0.5 },
      { kind: 'hop', to: { x: LD.x, z: crate.z - 0.08 }, y: 1.2, dur: 0.45 },
      { kind: 'hop', to: { x: LD.x, z: crate.z - 0.12 }, y: 1.95, dur: 0.45 },
      { kind: 'hop', to: { x: LD.x, z: T.z1 - 0.45 }, y: T.h, dur: 0.55 },
      { kind: 'walk', to: { x: top.x - 0.15, z: top.z + 0.72 }, y: T.h, dur: 0.6 },
    ];
    S.climb = { i: 0, t: 0, from: { x: c.x, z: c.z, y: 0 }, steps };
    S.phase = 'subir';
    dir.hold('radhija');
    say('capitao', 'Ela está subindo! Ela está subindo!', true);
    emit('story:sfx', { name: 'pulinho', x: LD.x, z: crate.z });
    emit('objective', obj());
  }
  function stepClimb(dt) {
    const C = S.climb;
    if (!C) return;
    const st = C.steps[C.i];
    if (!st) {
      // lá em cima: a cena da fuga (ela segue segurada até a cena)
      S.climb = null;
      S.phase = 'fuga';
      play(ROOF_SCENES.fuga);
      return;
    }
    C.t += dt;
    const k = Math.min(1, C.t / st.dur);
    const a = dir.actor('radhija');
    const f = C.from, to = st.to;
    const e = k * k * (3 - 2 * k);
    a.x = f.x + (to.x - f.x) * e;
    a.z = f.z + (to.z - f.z) * e;
    const yy = f.y + (st.y - f.y) * e;
    a.y = st.kind === 'hop' ? yy + Math.sin(k * Math.PI) * 0.22 : yy;
    a.airK = st.kind === 'hop' && k < 1 ? k : -1;
    a.press = null;
    const dx = to.x - f.x, dz = to.z - f.z;
    if (Math.hypot(dx, dz) > 0.05) a.yaw = Math.atan2(dx, dz);
    else a.yaw = Math.PI; // de frente para a escada
    a.look = { x: PER.caixa.x, y: PER.caixa.y + 0.2, z: PER.caixa.z };
    a.speed = st.kind === 'walk' ? Math.hypot(dx, dz) / st.dur : 0.8;
    if (k >= 1) {
      if (st.kind === 'hop') emit('story:sfx', { name: 'pulinho', x: a.x, z: a.z, volume: 0.6 });
      C.from = { x: a.x, z: a.z, y: st.y ?? a.y };
      C.i++;
      C.t = 0;
    }
  }

  // ---------------------------------------------------------------- o objetivo do HUD e a nuvem de cheiro
  function obj() {
    if (!S || !roof.active) return null;
    const stage = K.S?.stage ?? 'torre';
    const T2 = (text, p, y = 0.6) => ({ text, target: p ? { x: p.x, y, z: p.z } : null, stage });
    switch (S.phase) {
      case 'caca': return T2(TEXTS.caca, S.perch ? PER[S.perch] : null, (S.perch ? PER[S.perch].y : 1) + 0.45);
      case 'caixa':
        if (!crateIn()) return T2(TEXTS.caixote, { x: crate.x, z: crate.z }, CR.height + 0.4);
        if (!S.ladderDown) return T2(TEXTS.trava, L.ROOF_LATCH, L.ROOF_LATCH.top + 0.3);
        return T2(TEXTS.subir, climbFoot(), 1.0);
      case 'penas': return S.trailSeen ? T2(TEXTS.mirante, L.ROOF_LOOKOUT, 0.9) : T2(TEXTS.farejar, null);
      default: return { text: null, target: null, stage };
    }
  }

  // ---------------------------------------------------------------- a API
  const roof = {
    /** O saguão: começa o terraço (o corte no preto da cena da chegada). */
    enter() {
      if (S.phase !== 'off') return false;
      S.phase = 'chega';
      play(ROOF_SCENES.chega);
      return true;
    },
    /** As dogs estão no terraço (da chegada até o corte de volta)? */
    get active() { return !!S && S.phase !== 'off' && S.phase !== 'fim'; },
    get phase() { return S?.phase ?? 'off'; },
    /** O terraço acabou (as duas de volta na porta da torre)? */
    get done() { return S?.phase === 'fim'; },
    get perch() { return S?.perch ?? null; },
    get crate() { return crate; },
    get crateIn() { return crateIn(); },
    get ladderDown() { return !!S?.ladderDown; },
    /** O E do que dá para fazer aqui (o PROMPTS do puzzle: 'subir'), para o hints.setPrompt do puzzle; ou null. */
    get prompt() {
      if (!roof.active || S.phase !== 'caixa' || !S.ladderDown || S.climb) return null;
      const c = R(ctx.activeDog);
      return c?.name === 'radhija' && near(c, climbFoot(), 0.95) ? 'subir' : null;
    },

    update(dt, { active = null, comp = null, playing = true } = {}) {
      if (!S) return;
      S.time += dt;
      S.sayCd = Math.max(0, S.sayCd - dt);
      S.guardCd = Math.max(0, S.guardCd - dt);
      S.lookHintCd = Math.max(0, S.lookHintCd - dt);
      latch.update(dt);
      stepLadder(dt);
      if (!roof.active) return;
      if (!S.ladderDown) crate.update(dt, { comp });
      if (!playing) return;
      stepClimb(dt);
      if (S.phase === 'caca' || S.phase === 'caixa' || S.phase === 'subir') {
        if (S.flight) stepFlight(dt);
        else if (S.perch) {
          S.settle += dt;
          animatePerched();
          if (S.phase === 'caca' && S.settle >= SETTLE) {
            for (const n of NAMES) {
              const c = R(n);
              if (!c || (c.y || 0) > 0.3) continue;
              if (near(c, PER[S.perch], SCARE_R)) { flee(c); break; }
            }
          }
        }
        // uma irmã de guarda perto de um poleiro: o balão do olho, uma vez por poleiro
        if (S.phase === 'caca') {
          for (const id of LOW) {
            if (S.guardShown.has(id) || !guarded(id)) continue;
            S.guardShown.add(id);
            const who = NAMES.find((n) => ctx.isStaying?.(n) && near(R(n), PER[id], GUARD_R));
            if (who) dir?.balloon?.('olho', { who, life: 1.8 });
          }
        }
      }
      // a Rhaenyra perto do puxador sem o caixote: a dica do caixote
      const act = active ?? R(ctx.activeDog);
      if ((S.phase === 'caca' || S.phase === 'caixa') && act?.name === 'rhaenyra' && !crateIn() && near(act, { x: LD.x, z: LD.z + 0.6 }, 1.0)) hints?.cond?.(HINTS.alto, 4, 10);
      if (S.phase === 'caixa' && crateIn() && !S.ladderDown && act?.name === 'rhaenyra' && near(act, L.ROOF_LATCH, 1.6)) hints?.cond?.(HINTS.trava, 4.5, 14);
      // depois da fuga: o Faro aceso mostra as penas; com elas vistas, o mirante fecha o terraço
      if (S.phase === 'penas') {
        if (!S.trailSeen && (faro?.k ?? 0) > 0.35) roof.onFaro(act);
        if (act && near(act, L.ROOF_LOOKOUT, L.ROOF_LOOKOUT.r)) {
          if (S.trailSeen) { S.phase = 'olha'; play(ROOF_SCENES.olha); } else if (S.lookHintCd <= 0) { S.lookHintCd = 6; hints?.now?.(HINTS.farejar, 4, 6); }
        }
      }
    },

    interact(c) {
      if (!roof.active) return false;
      if (S.climb || S.phase === 'chega' || S.phase === 'fuga' || S.phase === 'olha') return true;
      const foot = climbFoot();
      if (S.ladderDown && near(c, foot, 0.95)) {
        if (c.name !== 'radhija') { say('rhaenyra', 'Essa escada é estreita pra mim… sobe você, Radhija!', true); hints?.now?.(HINTS.subir, 3.6, 5); return true; }
        if (S.phase === 'caixa') { startClimb(); return true; }
        say('radhija', 'Os pombos nem estão lá em cima… primeiro, encurralar!', true);
        return true;
      }
      return false;
    },
    /** O latido perto do poleiro também espanta. */
    onBark(c) {
      if (!roof.active || S.phase !== 'caca' || !S.perch || S.flight || (c.y || 0) > 0.3) return false;
      if (!near(c, PER[S.perch], BARK_R)) return false;
      flee(c);
      return true;
    },
    /** O Faro aceso no terraço (o puzzle repassa; o update também vê o faro.k): as penas mostram a direção da cidade. */
    onFaro(c) {
      if (!roof.active || S.phase !== 'penas' || S.trailSeen) return false;
      S.trailSeen = true;
      faro?.setTrail?.(TRAIL, true);
      say(c?.name || 'radhija', 'As penas… eles voaram para a cidade!', true);
      emit('objective', obj());
      return false; // o Faro segue o caminho normal (o modo liga do mesmo jeito)
    },
    modifyIntent(dt, c, intent, { shift } = {}) {
      if (!roof.active || S.climb || S.ladderDown) return null;
      const r = crate.modifyIntent(dt, c, intent, { shift });
      if (r?.contact) {
        if (r.contact === 'needShift') hints?.cond?.(HINTS.caixote, 3.6, 10);
        return r;
      }
      return null;
    },
    shoveSpots() { return []; },
    /** O puxador da trava, só com o caixote embaixo da escada. */
    wallSpots() {
      if (!roof.active || S.climb || S.ladderDown || !crateIn()) return [];
      // a "parede" é a face sul do caixote, onde ele parou
      latch.spot.z = crate.z + CR.half;
      return [latch.spot];
    },
    onWallTouch(c, spot) {
      if (!roof.active || spot?.id !== latch.id) return false;
      latch.touch();
      dropLadder();
      return true;
    },
    lockFor() { return null; },
    lookTarget(c) {
      if (!roof.active || !S.perch) return null;
      const p = PER[S.perch];
      if (near(c, p, 4.5) || (ctx.isStaying?.(c.name) && near(c, p, GUARD_R + 0.5))) return { x: p.x, y: p.y + 0.15, z: p.z };
      return null;
    },
    navFlags() { return {}; },
    objective: obj,
    /** Para onde a nuvem de cheiro leva no terraço. */
    lead() {
      if (!roof.active) return null;
      if (S.phase === 'penas') return { x: L.ROOF_LOOKOUT.x, z: L.ROOF_LOOKOUT.z, color: SCENT.pombos };
      if (S.phase === 'caixa') return { x: LD.x, z: LD.z + 0.7, color: SCENT.cenoura };
      if (S.perch) return { x: PER[S.perch].x, z: PER[S.perch].z, color: SCENT.cenoura };
      return null;
    },

    // ---------------------------------------------------------------- o que as cenas chamam (nos commits)
    /** Chegada (commit): o bando no primeiro poleiro, o caixote e a escada como estão, a caça começa. */
    begin() {
      S.phase = 'caca';
      S.perch = FIRST;
      S.prev = null;
      S.flight = null;
      S.settle = 0;
      squadAt(FIRST, L.ROOF_ARRIVE.rad);
      emit('objective', obj());
    },
    /** A fuga começa: a subida acaba (a cena segura a Radhija lá em cima). */
    escapeStart() { S.climb = null; S.phase = 'fuga'; },
    /** Fuga (commit): o bando foi embora com a cenoura e a tampa; as penas no chão (a trilha aparece com o Faro). */
    afterEscape() {
      S.climb = null;
      S.flight = null;
      S.perch = null;
      S.phase = 'penas';
      hideSquad();
      P?.lid?.setVisible?.(false);
      P?.feathers?.setVisible?.(true);
      P?.ladder?.setDrop?.(1);
      S.ladderDown = true;
      crate.freeze();
      emit('objective', obj());
    },
    /** O mirante (commit): de volta para a porta da torre, na etapa da portaria. */
    finish() {
      S.phase = 'fim';
      S.climb = null;
      hideSquad();
      faro?.setTrail?.(TRAIL, false);
    },
    /**
     * O mirante (commit da cena 'telhadoOlha'): o corte de volta para fora da porta da torre, na etapa da portaria (como
     * o fim da cena 'terraco' de antes).
     */
    returnToTower() {
      roof.finish();
      K.deduction?.ask?.('rua');
      K.closeTowerDoor?.();
      const D = L.TOWER_DOOR, dz = (D.hinge.z + D.latchPost.z) / 2;
      K.placeAt({ x: D.hinge.x - 1.2, z: dz + 0.2, yaw: -Math.PI / 2 }, { x: D.hinge.x - 1.3, z: dz + 1.2, yaw: -Math.PI / 2 });
      K.setStage?.('portaria');
      dir?.snapFollow?.();
    },
    /** Testes e E2E: o terraço inteiro de uma vez (a pista da tampa, a fuga e a volta), sem as cenas. */
    skipToEnd() {
      if (S.phase === 'off' || S.phase === 'fim') return false;
      book?.add?.('tampa', { silent: true });
      roof.afterEscape();
      roof.returnToTower();
      return true;
    },
    squadAt,
    hideSquad,
    grabCarrot,
    spotsOf: (id) => perchSpots(PER[id]),
    perchOf,
    /** Jumps (testes e ?stage=): o terraço inteiro feito, sem as cenas. */
    skipAll() {
      roof.afterEscape();
      roof.finish();
    },

    info() {
      return {
        phase: S.phase, perch: S.perch, prev: S.prev, flying: !!S.flight, hops: S.hops,
        crate: { x: +crate.x.toFixed(2), z: +crate.z.toFixed(2) }, crateIn: crateIn(), ladderDown: S.ladderDown,
        climb: S.climb ? S.climb.i : null, trailSeen: S.trailSeen, guarded: LOW.filter((id) => guarded(id)),
      };
    },
    reset() {
      S = fresh();
      crate.reset();
      latch.reset();
      P?.ladder?.setDrop?.(0);
      P?.lid?.setVisible?.(true);
      P?.feathers?.setVisible?.(false);
      faro?.setTrail?.(TRAIL, false);
    },
    /** Constantes para as cenas e os testes. */
    SCARE_R, GUARD_R,
  };
  S = fresh();
  return roof;
}
