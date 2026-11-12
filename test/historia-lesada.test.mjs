// Modo História: a Rhaenyra distraída, a "lesada" (src/story/scene/lesada.js), no jogo de verdade (headless, com o
// cenário do Recanto):
//  - FREQUÊNCIA: com a Radhija parada, de vez em quando (a primeira depois de ~16 s, depois de ~40 em ~40 s ou mais),
//    uma de cada vez, e a mesma não repete em seguida;
//  - VOLTA À IRMÃ: a companheira nunca fica para trás (começa perto; a irmã saiu andando, ela larga tudo e alcança);
//  - NADA ATRAVESSA NADA: em cada distração e em cada quadro, nenhuma dog dentro de colisor nem uma dentro da outra;
//  - A VOLTINHA DO RABO NÃO É GIRO PARADO: o meio do corpo anda um círculo de verdade (raio, passada e giro por metro
//    de andar a trote), com o corpo curvado (o gesto chaseTail na animação);
//  - a borboleta e as bolhas (o bote, o PLOC), o farejar, o tropeço, o focinho na porta fechada e o "Hã?" atrasado;
//  - nada nas cenas, e lesada.setOn(false) desliga o sorteio.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, storyInfo, intrusions, playScene, become } from './helpers/historia.mjs';
import { LESADA } from '../src/story/scene/lesada.js';

const L = (h) => storyInfo(h).lesada;
const dist = (h) => Math.hypot(h.ctrls.radhija.x - h.ctrls.rhaenyra.x, h.ctrls.radhija.z - h.ctrls.rhaenyra.z);

/** O jogo na etapa, a Radhija com a jogadora, a irmã já parada perto dela. */
async function at(stage, settle = 3) {
  const h = await createStoryGame();
  h.game.debug.setStage(stage, 'radhija');
  h.run(settle);
  return h;
}
/** Roda até a distração acabar (ou `max` s), conferindo cada quadro; → { frames, bad, phases, track }. */
function runOut(h, max = 8, each = null) {
  const bad = new Set();
  const phases = [];
  const track = [];
  let frames = 0;
  let last = null;
  while (h.puzzle.lesada.run && frames < max * 60) {
    h.step();
    frames++;
    for (const m of intrusions(h)) bad.add(m);
    const r = h.puzzle.lesada.run;
    if (r && r.ph !== last) { phases.push(r.ph); last = r.ph; }
    const c = h.ctrls.rhaenyra;
    // o que a animação recebeu neste quadro (o gesto é o mesmo objeto, mexido a cada quadro: copia)
    const an = h.dogs.rhaenyra.anim || {};
    const g = an.gesture ? { kind: an.gesture.kind, side: an.gesture.side } : null;
    track.push({ ph: r?.ph ?? null, x: c.x, z: c.z, yaw: c.yaw, y: c.y || 0, v: c.animSpeed, anim: { speed: an.speed, gesture: g }, d: dist(h) });
    each?.(h);
  }
  return { frames, bad: [...bad], phases, track };
}

test('lesada: de vez em quando, uma de cada vez, sem repetir a mesma em seguida e sem ninguém atravessar nada', async () => {
  const h = await at('varal', 0.5);
  const starts = [];
  const bad = new Set();
  let last = null;
  let worst = 0;
  const T = 230;
  for (let i = 0; i < T * 60; i++) {
    h.step();
    for (const m of intrusions(h)) bad.add(m);
    const r = h.puzzle.lesada.run;
    if (r && r.kind !== last) starts.push({ t: i / 60, kind: r.kind });
    last = r?.kind ?? null;
    worst = Math.max(worst, dist(h));
  }
  console.log(`  ${T} s com a Radhija parada: ${starts.map((s) => `${s.t.toFixed(0)} s ${s.kind}`).join(', ')}`);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
  assert.ok(starts.length >= 2 && starts.length <= 6, `poucas distrações em ${T} s (${starts.length})`);
  assert.ok(starts[0].t >= LESADA.first[0], `a primeira não vem logo (${starts[0].t.toFixed(1)} s)`);
  for (let i = 1; i < starts.length; i++) {
    assert.ok(starts[i].t - starts[i - 1].t >= LESADA.every[0] - 1, `entre uma e outra, pelo menos ~${LESADA.every[0]} s (${(starts[i].t - starts[i - 1].t).toFixed(1)})`);
    assert.notEqual(starts[i].kind, starts[i - 1].kind, 'a mesma não repete em seguida');
  }
  assert.ok(worst < LESADA.far, `a Rhaenyra fica perto da irmã (no máximo ${worst.toFixed(2)} m)`);
  // a Radhija chama e a Rhaenyra fala
  const says = h.log('story:say');
  assert.ok(says.some((p) => p.who === 'radhija' && /Rhaenyra|Foco/.test(p.text) && p.mode === 'jogo'), 'a Radhija chama (legenda do jogo)');
  assert.ok(says.some((p) => p.who === 'rhaenyra' && p.mode === 'jogo'), 'a Rhaenyra fala');
});

test('lesada: a voltinha atrás do rabo é andada a trote num círculo de verdade (nada de girar parada), com o corpo curvado', async () => {
  for (const stage of ['varal', 'quarto']) {
    const h = await at(stage);
    assert.equal(h.puzzle.lesada.start('rabo'), true, `${stage}: a voltinha cabe`);
    const r = runOut(h);
    assert.deepEqual(r.bad, [], `${stage}: ninguém atravessa nada`);
    assert.deepEqual(r.phases, ['olha', 'volta', 'tonta'], `${stage}: olha o rabo, dá a volta e fica tonta`);
    const loop = r.track.filter((p) => p.ph === 'volta');
    assert.ok(loop.length > 60, `${stage}: a volta leva tempo (${loop.length} quadros)`);
    let len = 0, turn = 0, cx = 0, cz = 0;
    for (let i = 1; i < loop.length; i++) {
      len += Math.hypot(loop[i].x - loop[i - 1].x, loop[i].z - loop[i - 1].z);
      turn += Math.atan2(Math.sin(loop[i].yaw - loop[i - 1].yaw), Math.cos(loop[i].yaw - loop[i - 1].yaw));
    }
    for (const p of loop) { cx += p.x / loop.length; cz += p.z / loop.length; }
    const radius = loop.reduce((a, p) => a + Math.hypot(p.x - cx, p.z - cz), 0) / loop.length;
    const secs = loop.length / 60;
    console.log(`  ${stage}: ${len.toFixed(2)} m em ${secs.toFixed(2)} s, ${(turn / (2 * Math.PI)).toFixed(2)} volta, raio ${radius.toFixed(2)} m`);
    assert.ok(Math.abs(turn) > 2 * Math.PI * 0.95 && Math.abs(turn) < 2 * Math.PI * 1.25, `${stage}: uma volta (${turn.toFixed(2)} rad)`);
    assert.ok(len > 1.8, `${stage}: o meio do corpo anda o círculo (${len.toFixed(2)} m)`);
    assert.ok(radius > 0.24, `${stage}: num círculo de verdade, não no lugar (raio ${radius.toFixed(2)} m)`);
    assert.ok(Math.abs(turn) / len < 1 / 0.28, `${stage}: o giro acompanha o quanto ela anda (${(Math.abs(turn) / len).toFixed(2)} rad/m)`);
    assert.ok(len / secs > 0.85, `${stage}: a trote (${(len / secs).toFixed(2)} m/s)`);
    // as patas andam de verdade (a passada da animação) e o corpo vai curvado para dentro da volta
    const mid = loop.slice(20, -20);
    assert.ok(mid.every((p) => p.anim.speed > 0.6), 'a passada acompanha a volta');
    assert.ok(mid.every((p) => p.anim.gesture?.kind === 'chaseTail' && Math.sign(p.anim.gesture.side) === Math.sign(turn)), 'o corpo curvado para o lado da volta (chaseTail)');
    assert.equal(h.puzzle.lockFor('rhaenyra'), null, 'no fim, sem trava');
    assert.ok(dist(h) < LESADA.far, 'perto da irmã');
  }
});

test('lesada: a borboleta, as bolhas e o farejar, cada um até o fim sem ninguém atravessar nada', async () => {
  for (const [kind, phases, line] of [
    ['borboleta', ['chega', 'nota', 'corre', 'bote', 'ha'], /Borboleta/],
    ['bolha', ['chega', 'nota', 'corre', 'bote', 'ha'], /[Bb]olha/],
    ['cheiro', ['vai', 'fareja', 'ha'], /cheiro|cheira|migalha/],
  ]) {
    const h = await at('piscina');
    assert.equal(h.puzzle.lesada.start(kind), true, `${kind}: começa`);
    let hopUp = 0;
    const r = runOut(h, 8, () => { hopUp = Math.max(hopUp, h.ctrls.rhaenyra.y || 0); });
    assert.deepEqual(r.bad, [], `${kind}: ninguém atravessa nada`);
    assert.deepEqual(r.phases, phases, `${kind}: a sequência inteira`);
    assert.ok(r.frames / 60 < 6, `${kind}: curtinha (${(r.frames / 60).toFixed(1)} s)`);
    assert.ok(h.log('story:say').some((p) => p.who === 'rhaenyra' && line.test(p.text)), `${kind}: a Rhaenyra fala`);
    assert.equal(h.ctrls.rhaenyra.y || 0, 0, `${kind}: termina no chão`);
    if (kind !== 'cheiro') assert.ok(hopUp > 0.1, `${kind}: o bote é um pulinho (${hopUp.toFixed(2)} m)`);
    if (kind === 'bolha') assert.ok(h.log('story:onomato').some((p) => p.text === 'PLOC!'), 'a bolha estoura: PLOC!');
    if (kind === 'cheiro') assert.ok(r.track.some((p) => p.anim.gesture?.kind === 'sniffGround'), 'o focinho no chão');
    if (kind === 'borboleta') {
      const bf = h.puzzle.flutter.visitor;
      h.run(3);
      assert.ok(!bf.object.visible || bf.pos.y > 1.2, 'a borboleta que veio de fora vai embora pelo alto');
    }
    assert.equal(h.puzzle.lockFor('rhaenyra'), null, `${kind}: sem trava no fim`);
  }
});

test('lesada: a irmã sai andando no meio da distração; a Rhaenyra larga tudo e alcança (nunca fica para trás)', async () => {
  const h = await at('piscina');
  assert.equal(h.puzzle.lesada.start('borboleta'), true);
  h.run(0.8);
  const a = h.ctrls.radhija;
  // a Radhija sai correndo para longe da irmã (para o lado contrário dela)
  const dx = a.x - h.ctrls.rhaenyra.x, dz = a.z - h.ctrls.rhaenyra.z, n = Math.hypot(dx, dz) || 1;
  let ended = null;
  const bad = new Set();
  for (let i = 0; i < 150; i++) {
    h.hold([dx / n, dz / n]);
    h.step();
    for (const m of intrusions(h)) bad.add(m);
    if (!h.puzzle.lesada.run && ended === null) ended = dist(h);
  }
  h.hold(null);
  h.run(3.5);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
  assert.ok(ended !== null && ended < LESADA.far + 0.5, `ela larga a distração antes de ficar longe (${ended?.toFixed(2)} m)`);
  assert.ok(dist(h) < 2.0, `e alcança a irmã (${dist(h).toFixed(2)} m)`);
});

test('lesada: correndo atrás da irmã, o tropeço (o peito mergulha) e ela segue', async () => {
  const h = await at('piscina');
  const a = h.ctrls.radhija;
  // a Radhija corre para longe: a irmã sai correndo atrás
  const b = h.ctrls.rhaenyra;
  const dx = a.x - b.x, dz = a.z - b.z, n = Math.hypot(dx, dz) || 1;
  let started = false;
  const bad = new Set();
  let stumble = 0;
  for (let i = 0; i < 300; i++) {
    h.hold([dx / n, dz / n]);
    h.step();
    for (const m of intrusions(h)) bad.add(m);
    if (!started && b.animSpeed > 1.3 && dist(h) > 1.2) started = h.puzzle.lesada.start('tropeco');
    if (h.dogs.rhaenyra.anim?.gesture?.kind === 'stumble') stumble++;
  }
  h.hold(null);
  h.run(2.5);
  assert.ok(started, 'correndo, ela tropeça');
  assert.ok(stumble > 20, `o tropeço na animação (${stumble} quadros)`);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
  assert.equal(h.puzzle.lockFor('rhaenyra'), null, 'e segue livre');
  assert.ok(dist(h) < 2.0, `e alcança a irmã (${dist(h).toFixed(2)} m)`);
});

test('lesada: correndo de encontro à porta fechada, a Rhaenyra bate o focinho (TÓIM!), recua zonza e volta ao controle', async () => {
  const h = await at('torre');
  become(h, 'rhaenyra');
  const D = h.layout.TOWER_DOOR;
  const mz = (D.hinge.z + D.latchPost.z) / 2;
  h.teleport('rhaenyra', D.hinge.x - 2.2, mz, Math.PI / 2);
  h.run(0.3);
  h.clearLog();
  const bad = new Set();
  let bonked = false;
  let minX = Infinity, maxXAfter = -Infinity;
  for (let i = 0; i < 120; i++) {
    h.hold([1, 0]);
    h.step();
    for (const m of intrusions(h)) bad.add(m);
    const r = h.puzzle.lesada.run;
    if (r?.kind === 'bonk') { bonked = true; minX = Math.min(minX, h.ctrls.rhaenyra.x); }
  }
  h.hold(null);
  assert.ok(bonked, 'bateu o focinho na porta da torre (fechada)');
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
  assert.ok(h.log('story:onomato').some((p) => p.text === 'TÓIM!'), 'TÓIM!');
  assert.ok(h.log('story:sfx').some((p) => p.name === 'bonk'), 'o som da batida');
  assert.ok(h.log('story:say').some((p) => p.who === 'rhaenyra' && /porta|bem/.test(p.text)), 'e ela fala');
  assert.ok(storyInfo(h).lesada.count.bonk === 1, 'uma batida só (segurando contra a porta, não repete)');
  h.run(1.2);
  assert.equal(h.puzzle.lockFor('rhaenyra'), null, 'o controle volta');
  // e anda de novo (para longe da porta)
  const x0 = h.ctrls.rhaenyra.x;
  h.hold([-1, 0]);
  h.run(0.6);
  h.hold(null);
  maxXAfter = h.ctrls.rhaenyra.x;
  assert.ok(x0 - maxXAfter > 0.3, `ela anda de novo (${(x0 - maxXAfter).toFixed(2)} m)`);
  void minX;
});

test('lesada: a Radhija late e a irmã demora a entender ("Hã?"), às vezes; nada nas cenas; setOn(false) desliga', async () => {
  // o "Hã?" atrasado
  const h = await at('piscina', 5);
  let ha = null;
  for (let k = 0; k < 10 && !ha; k++) {
    h.clearLog();
    h.events.emit('dog:bark', { name: 'radhija', x: h.ctrls.radhija.x, z: h.ctrls.radhija.z });
    for (let i = 0; i < 90; i++) {
      h.step();
      const r = h.puzzle.lesada.run;
      if (r?.kind === 'ha' && !ha) ha = { delay: i / 60 };
    }
  }
  assert.ok(ha, 'em alguns latidos, ela reage');
  assert.ok(ha.delay >= LESADA.ha.delay[0] - 0.02, `atrasada (${ha.delay.toFixed(2)} s depois do latido)`);
  h.run(1.2);
  assert.ok(h.log('story:say').some((p) => p.who === 'rhaenyra' && /^Hã/.test(p.text)), '"Hã?"');

  // nada nas cenas: o porteiro (cena longa) com a irmã de companheira
  const s = await at('portaria');
  s.game.debug.setStage('portaria', 'radhija');
  s.run(0.3);
  s.puzzle.lesada.start('rabo');
  const V = s.layout.BOOTH_VENT;
  s.teleport('radhija', V.x - 0.75, V.z, Math.PI / 2);
  s.run(0.3);
  s.tap('KeyR');
  let inScene = 0, lesadaInScene = 0;
  playScene(s, { each(x) { inScene++; if (x.puzzle.lesada.run) lesadaInScene++; } });
  assert.ok(inScene > 30, 'a cena tocou');
  assert.equal(lesadaInScene, 0, 'nada de distração durante a cena');

  // desligada: nada em 3 minutos
  const off = await at('varal', 0.5);
  off.puzzle.lesada.setOn(false);
  let any = 0;
  for (let i = 0; i < 180 * 60; i++) { off.step(); if (off.puzzle.lesada.run) any++; }
  assert.equal(any, 0, 'desligada, nenhuma distração');
});
