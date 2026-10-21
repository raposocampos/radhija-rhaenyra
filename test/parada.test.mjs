// Parada por muito tempo (src/game/idle.js; pedido do usuário: "parada muito tempo, coçar, xixi agachada, sentar e
// deitar"): a agenda (xixi às vezes, coçar de tempos em tempos, deitar), o jogo headless (sem mexer nela, ela senta,
// coça e deita; mexeu, levanta) e o que não pode acontecer (com a trava de uma mecânica, no ar, andando).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdle, IDLE } from '../src/game/idle.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { withSeedAsync } from './helpers/seeded.mjs';

const DT = 1 / 60;

test('parada por muito tempo (idle.js): xixi às vezes, em pé; coça sentada de tempos em tempos; deita e fica; mexeu, levanta', () => {
  const events = [];
  const idle = createIdle({ emit: (n, p) => events.push([n, p]), rand: () => 0.1 });
  /** Quadros da dog parada (ou não); devolve o que ela fez em cada um. */
  const run = (sec, still, o = {}) => {
    const seen = [];
    for (let i = 0; i < Math.round(sec / DT); i++) seen.push(idle.step('radhija', DT, { still, canPee: true, at: { x: 1, z: 2 }, ...o })?.kind ?? null);
    return seen;
  };
  // parada: aos IDLE.pee.at s, o xixi (sorteado), em pé; a poça sai no meio dele, onde ela está
  const first = run(IDLE.pee.at + 0.1, true);
  assert.ok(first.slice(0, Math.round(IDLE.pee.at / DT) - 1).every((k) => k === null), 'antes, nada (sentar vem da animação)');
  assert.equal(first.at(-1), 'pee');
  const pee = run(IDLE.pee.dur, true);
  assert.ok(events.some(([n, p]) => n === 'dog:pee' && p.name === 'radhija' && p.x === 1 && p.z === 2), 'emitiu dog:pee com o lugar da poça');
  assert.equal(events.filter(([n]) => n === 'dog:pee').length, 1, 'uma poça');
  assert.ok(pee.includes(null), 'o xixi termina');
  // depois, a parada continua: coça aos IDLE.scratch.first s (sentada), alternando a pata, e deita aos IDLE.lie.at
  const rest = run(IDLE.lie.at + 2, true);
  assert.ok(rest.includes('scratch'), 'coçou');
  assert.equal(rest.at(-1), 'lie', 'deitou');
  const sides = new Set();
  const idle2 = createIdle({ rand: () => 0.9 });
  for (let i = 0; i < Math.round(23 / DT); i++) {
    const a = idle2.step('rhaenyra', DT, { still: true, canPee: true });
    if (a?.kind === 'scratch') sides.add(a.side);
    assert.notEqual(a?.kind, 'pee', 'sem sorteio (rand 0,9), nada de xixi');
  }
  assert.equal(sides.size, 2, 'coçou com as duas patas, uma de cada vez');
  // mexeu: levanta na hora, e a parada recomeça do zero
  assert.deepEqual(run(0.1, false), Array(6).fill(null));
  // o xixi de novo só depois de IDLE.pee.every s
  const again = run(IDLE.pee.at + IDLE.pee.dur, true);
  assert.ok(!again.includes('pee'), 'sem xixi duas vezes seguidas');
  // sem poder (com algo na boca, numa caminha), nunca
  const idle3 = createIdle({ rand: () => 0 });
  for (let i = 0; i < Math.round(10 / DT); i++) assert.notEqual(idle3.step('radhija', DT, { still: true, canPee: false })?.kind, 'pee');
});

test('parada por muito tempo no jogo: sem mexer na ativa, ela senta, coça e deita (a irmã também); mexeu, levanta', async () => {
  await withSeedAsync(7, async () => {
    const h = await createHeadlessGame({ level: 1 });
    const name = h.info().activeDog;
    const anim = (n) => h.dogs[n].anim || {};
    /** O que cada dog fez em `sec` s (o tipo de idle de cada quadro). */
    const watch = (sec) => {
      const seen = { radhija: new Set(), rhaenyra: new Set() };
      for (let i = 0; i < Math.round(sec / DT); i++) {
        h.step();
        for (const n of ['radhija', 'rhaenyra']) seen[n].add(anim(n).idle?.kind ?? 'nada');
      }
      return seen;
    };
    h.run(0.5);
    const seen = watch(IDLE.lie.at + 3);
    assert.ok(seen[name].has('scratch'), `a ativa coçou (${[...seen[name]]})`);
    assert.equal(anim(name).idle?.kind, 'lie', 'e deitou');
    assert.ok(h.info().idle?.[name]?.t > IDLE.lie.at, 'parada há mais tempo que a deitada');
    // a irmã, esperando perto dela, também (sentada pela companheira, coça e deita)
    const sis = name === 'radhija' ? 'rhaenyra' : 'radhija';
    assert.ok(seen[sis].has('scratch') || seen[sis].has('lie'), `a irmã também (${[...seen[sis]]})`);
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
