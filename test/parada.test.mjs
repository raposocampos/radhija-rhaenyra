// Parada por muito tempo (src/game/idle.js; pedido do usuário: "parada muito tempo, coçar, xixi agachada, sentar e
// deitar"; depois, "não deixe ela sentar no mijo, faz ela levantar, dar uma cheirada no mijo e então ela senta em outro
// lugar, tudo andando naturalmente", "deixa essa animação de mijar mais rara" e "deixe mais aleatório entre as irmãs"):
// a agenda (xixi raro, deitar; coçar desligado), a sequência depois do xixi (uma voltinha andando até a poça, a cheirada
// e a saída andando até um lugar novo, sem passar pela poça, sem girar parada e sem encostar na irmã), as irmãs fora de
// compasso e o jogo headless.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdle, IDLE } from '../src/game/idle.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { withSeedAsync } from './helpers/seeded.mjs';

const DT = 1 / 60;
const NAMES = ['radhija', 'rhaenyra'];
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
/** O valor sorteado com rand = u no intervalo [de, até]. */
const at = (r, u) => r[0] + (r[1] - r[0]) * u;

test('parada (idle.js): xixi raro, em pé; deita e fica; mexeu, levanta; coçar fica desligado', () => {
  assert.equal(IDLE.scratch.on, false, 'coçar desligado (a pedido do usuário, a refinar)');
  assert.ok(IDLE.pee.chance <= 0.15 && IDLE.pee.every >= 180, 'xixi raro');
  const events = [];
  const idle = createIdle({ emit: (n, p) => events.push([n, p]), rand: () => 0.1 });
  /** Quadros da dog parada (ou não); devolve o que ela fez em cada um. */
  const run = (sec, still, o = {}) => {
    const seen = [];
    for (let i = 0; i < Math.round(sec / DT); i++) seen.push(idle.step('radhija', DT, { still, canPee: true, at: { x: 1, z: 2 }, ...o })?.kind ?? null);
    return seen;
  };
  // parada: o xixi (sorteado: rand 0,1 < a chance), em pé; a poça sai no meio dele, onde ela está
  const peeAt = at(IDLE.pee.at, 0.1);
  const first = run(peeAt + 0.1, true);
  assert.ok(first.slice(0, Math.round(peeAt / DT) - 1).every((k) => k === null), 'antes, nada (sentar vem da animação)');
  assert.equal(first.at(-1), 'pee');
  const pee = run(IDLE.pee.dur, true);
  assert.ok(events.some(([n, p]) => n === 'dog:pee' && p.name === 'radhija' && p.x === 1 && p.z === 2), 'emitiu dog:pee com o lugar da poça');
  assert.equal(events.filter(([n]) => n === 'dog:pee').length, 1, 'uma poça');
  assert.ok(pee.includes(null), 'o xixi termina');
  // depois, a parada continua (sem os controles, nada de andar) e ela deita
  const rest = run(at(IDLE.lie.at, 0.1) + 2, true);
  assert.ok(!rest.includes('scratch'), 'coçar desligado');
  assert.equal(rest.at(-1), 'lie', 'deitou');
  // mexeu: levanta na hora, e a parada recomeça do zero
  assert.deepEqual(run(0.1, false), Array(6).fill(null));
  // o xixi de novo só depois de IDLE.pee.every s
  const again = run(IDLE.pee.at[1] + IDLE.pee.dur, true);
  assert.ok(!again.includes('pee'), 'sem xixi duas vezes seguidas');
  // sem poder (com algo na boca, numa caminha), nunca; com o sorteio acima da chance, também não (raro)
  for (const [rand, canPee] of [[() => 0, false], [() => IDLE.pee.chance + 0.01, true]]) {
    const idle2 = createIdle({ rand });
    for (let i = 0; i < Math.round(10 / DT); i++) assert.notEqual(idle2.step('radhija', DT, { still: true, canPee })?.kind, 'pee');
  }
});

/** Um controle de mentira (o que idle.js lê e escreve). */
function fakeCtrl(name, x, z, yaw) {
  const big = name === 'rhaenyra';
  return {
    name, x, z, yaw, r: big ? 0.22 : 0.17, size: big ? 'large' : 'small', v: 0, vx: 0, vz: 0, animSpeed: 0, yawRate: 0,
    cfg: { visual: { length: big ? 0.72 : 0.6 }, body: { back: big ? 0.275 : 0.225 } },
  };
}

for (const who of NAMES) {
  test(`depois do xixi (${who}): voltinha andando até a poça, cheirada e senta em outro lugar, sem passar pela poça`, () => {
    const sis = who === 'radhija' ? 'rhaenyra' : 'radhija';
    const c = fakeCtrl(who, 0, 0, 0.4);
    const o = fakeCtrl(sis, 0.9, -0.7, 2.6);
    const L = c.cfg.visual.length;
    const k = L / 0.6;
    const back = c.cfg.body.back * 0.7;
    const events = [];
    // um poste a 1,1 m à frente: o caminho não passa por ele
    const post = { x: 0.35, z: 1.05, r: 0.12 };
    const world = { overlaps: (x, z, r) => Math.hypot(x - post.x, z - post.z) < r + post.r };
    const idle = createIdle({ emit: (n, p) => events.push([n, p]), rand: () => 0.05, ctrls: { [who]: c, [sis]: o }, world: () => world });
    const rump = () => ({ x: c.x - Math.sin(c.yaw) * back, z: c.z - Math.cos(c.yaw) * back });
    let P = null;
    let prev = { x: c.x, z: c.z, yaw: c.yaw };
    const phases = [];
    let sniffAt = null;
    let minAway = Infinity;
    let minSis = Infinity;
    let t = 0;
    let kind = null;
    for (; t < 25; t += DT) {
      const a = idle.step(who, DT, { still: true, canPee: true, at: rump() });
      kind = a?.kind ?? null;
      const inf = idle.info()[who];
      if (!P && inf.puddle) P = inf.puddle;
      const ph = inf.after;
      if (ph && phases.at(-1) !== ph) phases.push(ph);
      const lock = idle.lockFor(who);
      if (ph === 'loop' || ph === 'away') {
        assert.ok(lock?.drive && lock.idle, 'andando, a trava manda o caminho (drive)');
        // andando de verdade: nada de teletransporte e nada de girar parada (girando, ela anda)
        const step = Math.hypot(c.x - prev.x, c.z - prev.z);
        const turn = Math.abs(wrap(c.yaw - prev.yaw));
        assert.ok(step < 1.3 * DT, `passo de ${(step / DT).toFixed(2)} m/s`);
        // (girando, sempre andando uma curva de raio de verdade: nunca no lugar)
        if (step > 1e-4) assert.ok(turn / step < 1 / (0.2 * L), `curva fechada demais (raio ${(step / Math.max(turn, 1e-9)).toFixed(2)} m)`);
        else assert.ok(turn < 1e-3, 'girando parada');
        if (step / DT > 0.05) assert.ok(c.animSpeed > 0.02, 'as patas andam junto');
        assert.ok(!world.overlaps(c.x, c.z, c.r * 0.97), 'não entra no poste');
      }
      if (ph === 'sniff') {
        assert.equal(lock?.action, 'sniff');
        assert.ok(Math.abs(lock.faceX - P.x) < 0.006 && Math.abs(lock.faceZ - P.z) < 0.006, 'cheirando a poça');
        if (!sniffAt) sniffAt = { x: c.x, z: c.z, yaw: c.yaw };
      }
      if (ph === 'away' && P) minAway = Math.min(minAway, Math.hypot(c.x - P.x, c.z - P.z));
      if (P) minSis = Math.min(minSis, Math.hypot(c.x - o.x, c.z - o.z));
      prev = { x: c.x, z: c.z, yaw: c.yaw };
      if (phases.includes('away') && !ph) break;
    }
    assert.ok(P, 'fez xixi (a poça)');
    assert.deepEqual(phases, ['loop', 'sniff', 'away'], `a sequência (${phases})`);
    assert.ok(t < 20, `tudo em ${t.toFixed(1)} s`);
    // a cheirada: de frente para a poça, com o focinho em cima dela
    const dn = Math.hypot(sniffAt.x - P.x, sniffAt.z - P.z);
    assert.ok(Math.abs(dn - 0.55 * L) < 0.07, `cheirando a ${dn.toFixed(2)} m da poça`);
    assert.ok(Math.abs(wrap(Math.atan2(P.x - sniffAt.x, P.z - sniffAt.z) - sniffAt.yaw)) < 0.25, 'de frente para a poça');
    assert.equal(events.filter(([n]) => n === 'dog:sniff').length, 1);
    // saindo, o corpo não passa por cima da poça; o lugar novo fica longe dela (a garupa também) e longe da irmã
    assert.ok(minAway > IDLE.after.clear * k - 0.01, `saindo, a ${minAway.toFixed(2)} m da poça`);
    assert.ok(Math.hypot(c.x - P.x, c.z - P.z) >= 0.5 * k, 'senta longe da poça');
    const r = rump();
    assert.ok(Math.hypot(r.x - P.x, r.z - P.z) >= 0.3 * k, 'a garupa longe da poça');
    assert.ok(minSis > IDLE.after.pass - 0.01, `nunca encosta na irmã (${minSis.toFixed(2)} m entre os centros)`);
    assert.ok(Math.hypot(c.x - o.x, c.z - o.z) >= IDLE.after.space - 1e-6, 'senta com espaço da irmã');
    // e senta ali (a parada continua: já sentada)
    assert.equal(kind, 'sit');
    assert.equal(idle.step(who, DT, { still: true, canPee: true, at: rump() })?.kind, 'sit');
    assert.equal(c.animSpeed, 0, 'parou de andar');
  });
}

test('as irmãs fora de compasso: não deitam juntas; só uma faz xixi; sem espaço para sair da poça, nada de xixi', () => {
  // com o mesmo sorteio, as duas chegariam juntas: a segunda espera
  const idle = createIdle({ rand: () => 0.5 });
  const firstLie = { radhija: -1, rhaenyra: -1 };
  for (let i = 0; i < Math.round(45 / DT); i++) {
    for (const n of NAMES) {
      const a = idle.step(n, DT, { still: true, canPee: false });
      if (a?.kind === 'lie' && firstLie[n] < 0) firstLie[n] = i * DT;
    }
  }
  assert.ok(firstLie.radhija > 0 && firstLie.rhaenyra > 0, 'as duas deitam');
  assert.ok(Math.abs(firstLie.radhija - firstLie.rhaenyra) >= IDLE.apart.within - 0.05, `deitaram com ${Math.abs(firstLie.radhija - firstLie.rhaenyra).toFixed(2)} s de diferença`);
  // xixi: o sorteio passa para as duas, mas só a primeira faz (a outra só bem depois)
  const idle2 = createIdle({ rand: () => 0.05 });
  const peed = new Set();
  for (let i = 0; i < Math.round(8 / DT); i++) {
    for (const n of NAMES) if (idle2.step(n, DT, { still: true, canPee: true })?.kind === 'pee') peed.add(n);
  }
  assert.equal(peed.size, 1, `só uma (${[...peed]})`);
  // encurralada (sem espaço para a voltinha nem para sair dali), não faz xixi
  const c = fakeCtrl('radhija', 0, 0, 0);
  const idle3 = createIdle({ rand: () => 0.05, ctrls: { radhija: c }, world: () => ({ overlaps: (x, z) => Math.hypot(x, z) > 0.12 }) });
  for (let i = 0; i < Math.round(8 / DT); i++) {
    assert.notEqual(idle3.step('radhija', DT, { still: true, canPee: true, at: { x: 0, z: -0.16 } })?.kind, 'pee');
  }
  // com o sorteio de verdade, cada uma tem os seus tempos
  const idle4 = createIdle();
  const lie4 = { radhija: -1, rhaenyra: -1 };
  for (let i = 0; i < Math.round(45 / DT); i++) {
    for (const n of NAMES) if (idle4.step(n, DT, { still: true, canPee: false })?.kind === 'lie' && lie4[n] < 0) lie4[n] = i * DT;
  }
  assert.ok(Math.abs(lie4.radhija - lie4.rhaenyra) > 0.2, 'cada uma no seu tempo');
});

test('parada por muito tempo no jogo: sem mexer na ativa, ela deita (a irmã também); mexeu, levanta', async () => {
  await withSeedAsync(7, async () => {
    const h = await createHeadlessGame({ level: 1 });
    const name = h.info().activeDog;
    const sis = name === 'radhija' ? 'rhaenyra' : 'radhija';
    const anim = (n) => h.dogs[n].anim || {};
    h.run(0.5);
    const seen = { radhija: new Set(), rhaenyra: new Set() };
    for (let i = 0; i < Math.round((IDLE.lie.at[1] + 10) / DT); i++) {
      h.step();
      for (const n of NAMES) seen[n].add(anim(n).idle?.kind ?? 'nada');
    }
    assert.ok(!seen[name].has('scratch') && !seen[sis].has('scratch'), 'coçar desligado');
    assert.equal(anim(name).idle?.kind, 'lie', `a ativa deitou (${[...seen[name]]})`);
    // a irmã, esperando perto dela, também
    assert.ok(seen[sis].has('lie'), `a irmã também (${[...seen[sis]]})`);
    // mexeu: levanta (e anda)
    const c = h.ctrls[name];
    const x0 = c.x, z0 = c.z;
    h.hold([1, 0]);
    h.run(0.3);
    assert.equal(anim(name).idle ?? null, null, 'mexeu: levantou');
    h.run(0.5);
    h.hold(null);
    assert.ok(Math.hypot(c.x - x0, c.z - z0) > 0.3, 'e andou');
    // no ar, nada
    h.run(0.2);
    h.tap('Space');
    assert.equal(anim(name).idle ?? null, null);
  });
});

test('xixi no jogo: ela anda até a poça, cheira e senta em outro lugar, sem atravessar nada nem a irmã', async () => {
  await withSeedAsync(11, async () => {
    const h = await createHeadlessGame({ level: 1, pee: true });
    // no gramado aberto (perto da casa, sem espaço para a voltinha, ela só sai andando dali, sem cheirar)
    h.teleport('radhija', -2.6, -2.6, 0.6);
    h.teleport('rhaenyra', -3.4, -2.8, 0.9);
    h.run(0.3);
    const seeded = Math.random;
    // o sorteio passa (rand abaixo da chance) até alguma das duas começar o xixi
    Math.random = () => 0.05;
    let who = null;
    try {
      for (let i = 0; i < Math.round(8 / DT) && !who; i++) {
        h.step();
        who = NAMES.find((n) => h.dogs[n].anim?.idle?.kind === 'pee') ?? null;
      }
    } finally {
      Math.random = seeded;
    }
    assert.ok(who, 'uma delas fez xixi');
    const sis = who === 'radhija' ? 'rhaenyra' : 'radhija';
    const c = h.ctrls[who];
    const o = h.ctrls[sis];
    const phases = [];
    let P = null;
    let prev = { x: c.x, z: c.z, yaw: c.yaw };
    let minSis = Infinity;
    let done = -1;
    for (let i = 0; i < Math.round(20 / DT); i++) {
      h.step();
      const inf = h.info().idle?.[who];
      if (!P && inf?.puddle) P = inf.puddle;
      if (inf?.after && phases.at(-1) !== inf.after) phases.push(inf.after);
      assert.notEqual(h.dogs[sis].anim?.idle?.kind, 'pee', 'a irmã não faz xixi junto');
      // andando: nada de girar parada, nada de entrar em colisor nem na irmã
      const step = Math.hypot(c.x - prev.x, c.z - prev.z);
      const turn = Math.abs(wrap(c.yaw - prev.yaw));
      if (inf?.after === 'loop' || inf?.after === 'away') {
        if (step > 1e-4) assert.ok(turn / step < 1 / (0.2 * c.cfg.visual.length), `curva fechada demais (raio ${(step / Math.max(turn, 1e-9)).toFixed(2)} m)`);
        else assert.ok(turn < 1e-3, 'girando parada');
        assert.ok(step < 1.3 * DT, 'sem tranco');
      }
      assert.ok(!h.world.overlaps(c.x, c.z, c.r * 0.95, c.size), 'não entra em nada');
      minSis = Math.min(minSis, Math.hypot(c.x - o.x, c.z - o.z));
      prev = { x: c.x, z: c.z, yaw: c.yaw };
      if (phases.length && !inf?.after) {
        done = i;
        break;
      }
    }
    assert.ok(P, 'a poça');
    assert.deepEqual(phases, ['loop', 'sniff', 'away'], `a sequência (${phases})`);
    assert.ok(done > 0, 'terminou');
    assert.ok(minSis > IDLE.after.pass - 0.02, `nunca encostou na irmã (${minSis.toFixed(2)} m entre os centros)`);
    assert.ok(Math.hypot(c.x - P.x, c.z - P.z) >= 0.45, 'longe da poça');
    // sentada no lugar novo, e fica (ninguém a chama de volta logo)
    const kinds = new Set();
    for (let i = 0; i < Math.round(2 / DT); i++) {
      h.step();
      kinds.add(h.dogs[who].anim?.idle?.kind ?? 'nada');
    }
    assert.deepEqual([...kinds], ['sit'], `continua sentada (${[...kinds]})`);
  });
});

test('xixi no jogo: com o Fica, ou esperando a irmã que ela não alcança, a companheira não faz xixi nem sai do lugar', async () => {
  await withSeedAsync(13, async () => {
    const h = await createHeadlessGame({ level: 1, query: 'dog=radhija', pee: true });
    const comp = 'rhaenyra';
    const c = h.ctrls[comp];
    /** `sec` s com o sorteio do xixi passando (rand abaixo da chance) e a líder "mexida" (um toque a cada quadro). */
    const run = (sec, what, { still = true, wantPee = false } = {}) => {
      const x0 = c.x, z0 = c.z;
      const seeded = Math.random;
      Math.random = () => 0.05;
      let peed = false;
      try {
        for (let i = 0; i < Math.round(sec / DT); i++) {
          h.keyDown('KeyZ');
          h.step();
          h.keyUp('KeyZ');
          if (h.dogs[comp].anim?.idle?.kind === 'pee') peed = true;
        }
      } finally {
        Math.random = seeded;
      }
      assert.equal(peed, wantPee, `${what}: ${wantPee ? 'faz' : 'sem'} xixi`);
      if (still) assert.ok(Math.hypot(c.x - x0, c.z - z0) < 0.05, `${what}: não saiu do lugar`);
    };
    // com o Fica, perto da irmã
    h.teleport('radhija', -2.6, -2.6, 0.6);
    h.teleport(comp, -3.4, -2.8, 0.9);
    h.game.setStay(comp, true);
    h.run(0.5);
    run(8, 'com o Fica');
    // a irmã do outro lado da cerca (o vão é só da Radhija): a Rhaenyra espera no lugar mais perto que alcança
    h.game.setStay(comp, false);
    const F = h.layout.FENCE;
    h.teleport('radhija', F.x + 1.0, F.gap.center, 0);
    h.teleport(comp, F.x - 1.6, F.gap.center + 0.6, Math.PI / 2);
    run(6, 'indo esperar', { still: false });
    assert.equal(h.game.debug.brains[comp].mode, 'wait', 'esperando a irmã');
    run(8, 'esperando a irmã que ela não alcança');
    // controle: seguindo a irmã de perto (o caso de sempre), com o mesmo sorteio, ela faz
    h.teleport('radhija', -2.6, -2.6, 0.6);
    h.teleport(comp, -3.4, -2.8, 0.9);
    h.run(1);
    run(8, 'seguindo a irmã de perto', { still: false, wantPee: true });
  });
});
