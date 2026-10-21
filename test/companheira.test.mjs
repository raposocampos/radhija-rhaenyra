// A irmã que segue (companheira, IA) com a líder parada num lugar aonde ela não chega: atrás dos caixotes da despensa,
// num vão onde só a Radhija cabe, dentro do cercadinho que só se alcança pulando, do outro lado do portão fechado.
// Retorno do usuário: ela ficava andando em círculos, indo e voltando, empurrando o colisor. Agora vai até o ponto
// alcançável mais perto, espera ali olhando para a irmã e volta a seguir quando surge caminho. Jogo headless de
// verdade (game.js, puzzles, colisão do peito e da garupa), sorteios com semente.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { mulberry32, withSeedAsync } from './helpers/seeded.mjs';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';

const ALL = [...LEVELS, ...DEV_LEVELS];
const other = (n) => (n === 'radhija' ? 'rhaenyra' : 'radhija');
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const DT = 1 / 60;

/** Limites de "nada de loop" na janela de medida, com a líder parada: quase sem andar e sem ficar girando. */
const MAX_PATH = 0.45; // m andados
const MAX_TURN = 1.0; // rad de giro acumulado (virar para a irmã uma vez cabe)

/** Fase pelo id, carregada no jogo headless com a dog ativa `leader`. */
async function load(id, leader, query = '') {
  const idx = ALL.findIndex((d) => d.id === id);
  assert.ok(idx >= 0, `fase ${id}`);
  const q = [`dog=${leader}`, query].filter(Boolean).join('&');
  return createHeadlessGame({ level: idx + 1, levels: ALL, query: q });
}

/**
 * Roda `secs` segundos medindo a companheira: caminho andado, deslocamento líquido, giro acumulado, saltos
 * (reposicionamento), encostou num bicho, quanto a líder se mexeu, distância e ângulo até a líder no fim.
 */
function watch(h, comp, secs) {
  const c = h.ctrls[comp];
  const L = h.ctrls[other(comp)];
  const x0 = c.x;
  const z0 = c.z;
  const lx0 = L.x;
  const lz0 = L.z;
  let px = c.x;
  let pz = c.z;
  let pyaw = c.yaw;
  let path = 0;
  let turn = 0;
  let jumps = 0;
  let npc = false;
  const modes = new Set();
  for (let i = 0, n = Math.round(secs / DT); i < n; i++) {
    h.step(DT);
    const d = Math.hypot(c.x - px, c.z - pz);
    if (d > 0.5) jumps++;
    else path += d;
    turn += Math.abs(wrap(c.yaw - pyaw));
    if (c.hits?.some((k) => k.kind === 'npc')) npc = true;
    modes.add(h.game.debug.brains[comp].mode);
    px = c.x;
    pz = c.z;
    pyaw = c.yaw;
  }
  return {
    path, turn, jumps, npc,
    net: Math.hypot(c.x - x0, c.z - z0),
    leaderMoved: Math.hypot(L.x - lx0, L.z - lz0),
    dist: Math.hypot(c.x - L.x, c.z - L.z),
    facing: Math.abs(wrap(Math.atan2(L.x - c.x, L.z - c.z) - c.yaw)),
    modes: [...modes],
    at: { x: +c.x.toFixed(2), z: +c.z.toFixed(2) },
  };
}

/** Líder em `lead`, companheira em `comp`; espera `settle` s e mede `win` s. */
function scene(h, leader, lead, comp, { settle = 9, win = 5 } = {}) {
  const compName = other(leader);
  h.teleport(leader, lead.x, lead.z, lead.yaw ?? 0);
  h.teleport(compName, comp.x, comp.z, comp.yaw ?? 0);
  watch(h, compName, settle);
  return watch(h, compName, win);
}

/** Sem loop na janela: parada (ou quase), sem girar, sem ser reposicionada. */
function assertCalm(m, what) {
  const info = JSON.stringify({ ...m, path: +m.path.toFixed(2), turn: +m.turn.toFixed(2), net: +m.net.toFixed(2), dist: +m.dist.toFixed(2) });
  assert.equal(m.jumps, 0, `${what}: reposicionada no meio da espera ${info}`);
  assert.ok(m.path <= MAX_PATH, `${what}: andando em loop (${m.path.toFixed(2)} m na janela) ${info}`);
  assert.ok(m.turn <= MAX_TURN, `${what}: girando em loop (${m.turn.toFixed(2)} rad na janela) ${info}`);
}

/** Esperando: parada, olhando para a irmã. */
function assertWaiting(m, what) {
  assertCalm(m, what);
  assert.ok(m.facing < 0.6, `${what}: olhando para a irmã (desvio ${m.facing.toFixed(2)} rad) ${JSON.stringify(m.at)}`);
}

// ------------------------------------------------------------------------------------------------- casos do retorno
test('companheira: despensa da fase 10 (imagem do retorno) — contorna os caixotes da escadinha e não fica em loop', async () => {
  await withSeedAsync(101, async () => {
    for (const leader of ['radhija', 'rhaenyra']) {
      const h = await load('fase10', leader);
      const L = h.layout;
      const CR = L.PANTRY_CRATES;
      h.puzzle.debugSet('stairs'); // os três caixotes na marca, em fila na frente do armário (a escadinha)
      h.run(0.2);
      const r = L.DOGS[leader].radius;
      const east = { x: L.PANTRY.x1 - 0.1 - r - 0.08, z: CR.list[1].z }; // no vão entre os caixotes e a parede leste
      const foot = { x: CR.x1, z: CR.list[2].z + CR.hz + 0.3 }; // o pé da escadinha (imagem)
      const west = { x: CR.x1 - 1.45, z: CR.list[1].z }; // do outro lado dos caixotes
      for (const [name, lead, comp] of [['lado leste', east, west], ['pé da escadinha', foot, west], ['lado oeste', west, east]]) {
        const m = scene(h, leader, lead, comp, { settle: 10 });
        assertCalm(m, `fase 10, despensa, ${leader} no ${name}`);
        // há caminho (pelo sul dos caixotes): ela chega perto da irmã
        assert.ok(m.dist < 1.45, `fase 10, despensa, ${leader} no ${name}: a irmã chegou perto (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
      }
    }
  });
});

test('companheira: vão atrás do sofá da fase 10 (só a Radhija cabe) — a Rhaenyra espera na ponta, olhando', async () => {
  await withSeedAsync(102, async () => {
    const h = await load('fase10', 'radhija');
    const L = h.layout;
    const S = L.SOFA;
    const gapZ = (S.z + S.hz + L.HOUSE.zS - L.WALLS.t / 2) / 2;
    const m = scene(h, 'radhija', { x: S.x + 0.35, z: gapZ, yaw: Math.PI / 2 }, { x: L.NAV_NODES.L_mid.x, z: L.NAV_NODES.L_mid.z });
    assertWaiting(m, 'fase 10, atrás do sofá');
    assert.ok(m.dist < 2.0, `espera perto da irmã (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
  });
});

test('companheira: cercadinho da fase 5 (só pulando) — a Radhija espera na cerca, olhando para a irmã', async () => {
  await withSeedAsync(103, async () => {
    const h = await load('fase5', 'rhaenyra');
    const P = h.layout.PEN;
    const inside = { x: (P.x0 + P.x1) / 2 + 0.2, z: (P.z0 + P.z1) / 2 - 0.25 }; // longe do ossinho do meio
    for (const comp of [h.layout.DOGS.radhija.start, { x: P.x1 + 1.6, z: P.z1 - 0.2 }, { x: P.x0 - 0.2, z: P.z0 - 1.4 }]) {
      const m = scene(h, 'rhaenyra', inside, comp);
      assertWaiting(m, `fase 5, cercadinho (de ${JSON.stringify(comp)})`);
      assert.ok(m.dist < 1.6, `espera junto à cerca (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
    }
  });
});

test('companheira: debaixo da mesa da fase 5 (só a Radhija cabe) — a Rhaenyra espera do lado, sem empurrar a toalha', async () => {
  await withSeedAsync(104, async () => {
    const h = await load('fase5', 'radhija', 'stage=boxClear');
    const T = h.layout.TABLE;
    const N = h.layout.NAV_NODES;
    const m = scene(h, 'radhija', { x: T.x - 0.15, z: T.z }, { x: N.K_door.x, z: N.K_door.z });
    assertWaiting(m, 'fase 5, debaixo da mesa');
    assert.ok(m.dist < 1.6, `espera perto da mesa (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
  });
});

test('companheira: cantinho da fase 3 (só a Radhija) — a Rhaenyra espera na entrada', async () => {
  await withSeedAsync(105, async () => {
    const h = await load('fase3', 'radhija');
    const N = h.layout.NAV_NODES;
    const m = scene(h, 'radhija', N.A_nookIn, N.A_mid);
    assertWaiting(m, 'fase 3, cantinho');
  });
});

test('companheira: portãozinho fechado na fase 5 — espera na sala; com o portão aberto pela trava, volta a seguir', async () => {
  await withSeedAsync(106, async () => {
    const h = await load('fase5', 'rhaenyra');
    const L = h.layout;
    const N = L.NAV_NODES;
    const LT = L.LATCH;
    // a Rhaenyra pulou para o corredor e ficou na frente da trava; a Radhija não pula: espera na sala
    const atLatch = { x: LT.x + 0.32, z: LT.z + 0.05, yaw: -Math.PI / 2 };
    let m = scene(h, 'rhaenyra', atLatch, N.S_mid);
    assertWaiting(m, 'fase 5, portãozinho fechado');
    const rad = h.ctrls.radhija;
    assert.ok(rad.x < L.WALL_SH.x, 'a Radhija continua na sala');
    assert.ok(m.dist < 1.8, `espera junto ao portãozinho (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
    // a Rhaenyra puxa a trava: o portão abre e fica aberto
    h.tap('KeyE');
    assert.ok(h.run(3, { until: () => h.puzzle.navFlags().petGate }), 'o portãozinho abriu');
    // ela vai para a cozinha (porta ainda bloqueada): a irmã atravessa o portãozinho e vem atrás
    h.walkTo(N.H_box.x - 0.2, N.H_box.z);
    h.run(5);
    assert.ok(rad.x > L.WALL_SH.x + 0.3, `a Radhija passou pelo portãozinho (${rad.x.toFixed(2)}, ${rad.z.toFixed(2)})`);
    m = watch(h, 'radhija', 3);
    assert.ok(m.dist < 1.6, `veio atrás da irmã (${m.dist.toFixed(2)} m)`);
    assertCalm(m, 'fase 5, depois do portão');
  });
});

test('companheira: a irmã volta para perto — a que esperava volta a seguir na hora', async () => {
  await withSeedAsync(107, async () => {
    const h = await load('fase5', 'rhaenyra');
    const P = h.layout.PEN;
    const inside = { x: (P.x0 + P.x1) / 2 + 0.2, z: (P.z0 + P.z1) / 2 - 0.25 };
    scene(h, 'rhaenyra', inside, h.layout.DOGS.radhija.start);
    // a Rhaenyra sai do cercadinho (pulo) e vai para longe, no meio da sala: a Radhija vai atrás
    h.teleport('rhaenyra', -4.2, -0.6, 0);
    const m = watch(h, 'radhija', 5);
    assert.ok(m.dist < 1.5, `seguiu a irmã de novo (${m.dist.toFixed(2)} m, em ${JSON.stringify(m.at)})`);
  });
});

// ------------------------------------------------------------------------------------- sorteio em todas as fases
/** Um lugar livre para uma dog de raio r (perto de `near`, entre minD e maxD dele, se dado). */
function freeSpot(world, rnd, r, size, near = null, minD = 0, maxD = Infinity) {
  const B = world.bounds;
  for (let i = 0; i < 600; i++) {
    let x;
    let z;
    if (near) {
      const a = rnd() * Math.PI * 2;
      const d = minD + rnd() * (maxD - minD);
      x = near.x + Math.sin(a) * d;
      z = near.z + Math.cos(a) * d;
    } else {
      x = B.minX + r + rnd() * (B.maxX - B.minX - 2 * r);
      z = B.minZ + r + rnd() * (B.maxZ - B.minZ - 2 * r);
    }
    if (!world.overlaps(x, z, r + 0.04, size)) return { x, z };
  }
  return null;
}

const SAMPLES = 4; // por fase (a líder alterna entre as duas)

for (const def of ALL) {
  test(`companheira: ${def.id} — líder parada em lugares sorteados, a irmã nunca fica em loop`, async () => {
    await withSeedAsync(500 + ALL.indexOf(def), async () => {
      const rnd = mulberry32(9100 + ALL.indexOf(def));
      let valid = 0;
      const skipped = [];
      for (let s = 0; s < SAMPLES; s++) {
        const leader = s % 2 ? 'rhaenyra' : 'radhija';
        const h = await load(def.id, leader);
        const L = h.layout;
        const comp = other(leader);
        const lead = freeSpot(h.world, rnd, L.DOGS[leader].radius, L.DOGS[leader].size);
        assert.ok(lead, 'lugar sorteado para a líder');
        const start = freeSpot(h.world, rnd, L.DOGS[comp].radius, L.DOGS[comp].size, lead, 1.6, 6) || L.DOGS[comp].start;
        const m = scene(h, leader, { ...lead, yaw: rnd() * 6.28 }, { ...start, yaw: rnd() * 6.28 }, { settle: 12, win: 5 });
        const where = `${def.id} #${s} (${leader} em ${lead.x.toFixed(2)}, ${lead.z.toFixed(2)}; irmã de ${start.x.toFixed(2)}, ${start.z.toFixed(2)})`;
        // um bicho (porco, gansa…) empurrou alguém, ou a fase mexeu na líder: não é a IA da irmã
        if (m.npc || m.leaderMoved > 0.15) { skipped.push(where); continue; }
        assertCalm(m, where);
        valid++;
      }
      assert.ok(valid >= SAMPLES / 2, `amostras válidas demais descartadas: ${skipped.join(' · ')}`);
    });
  });
}
