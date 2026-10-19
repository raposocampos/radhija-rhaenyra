// Extras escondidos (src/game/extras.js): o cocô (C no teclado, R3 no controle) só depois dos ossinhos todos da
// fase e uma vez por tentativa, com a voltinha andando de verdade antes (sem atravessar nada e sem girar parada) e a
// comemoração depois; as animações do cenário com E perto de cada ponto; nada disso aparece em texto do jogo nem no
// README. Jogo headless, nas oito fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import { POOP_PRE, POOP_TIME, PARTY_MAX, EXTRA_TIME } from '../src/game/extras.js';
import { PAD } from '../src/game/input.js';

const ex = (h) => h.info().extras;
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const TAU = Math.PI * 2;
const FULL = POOP_PRE + POOP_TIME + PARTY_MAX + 0.5;
/** Encosta em algum colisor fixo? (os que se mexem, como a gansa, ficam de fora: não são culpa dela) */
const hitsStatic = (h, x, z, r, size) => h.world.overlaps(x, z, r, size, { ignore: new Set(h.world.dynamics.map((d) => d.id)) });

/**
 * Pega os ossinhos da fase levando a dog ativa (e, se precisar, a outra) até cada um; depois as duas voltam ao
 * começo da fase (longe de irrigador, lama e gansa, que travam a dog e impedem o cocô).
 */
function collectAll(h) {
  for (const c of h.layout.COLLECTIBLES) {
    for (const name of [h.info().activeDog, h.info().activeDog === 'radhija' ? 'rhaenyra' : 'radhija']) {
      const before = h.info().collected;
      if (name !== h.info().activeDog) h.tap('KeyQ');
      h.teleport(name, c.x, c.z);
      h.run(0.2);
      if (h.info().collected > before) break;
    }
  }
  for (const n of ['radhija', 'rhaenyra']) {
    const st = h.layout.DOGS[n].start;
    h.teleport(n, st.x, st.z, st.yaw);
  }
  h.run(1.2); // seca, assenta e para
  return h.info().collected;
}

/**
 * Roda a voltinha quadro a quadro conferindo que ela anda de verdade: o passo (animSpeed) é o deslocamento real, ela
 * nunca gira sem andar e não atravessa nada. → { moved (m), turned (rad), sniff (quadros farejando), yaw (no fim) }
 */
function watchCircle(h, who) {
  const c = h.ctrls[who];
  const out = { moved: 0, turned: 0, sniff: 0, yaw: c.yaw };
  let prev = { x: c.x, z: c.z, yaw: c.yaw };
  for (let n = 0; n < POOP_PRE * 60 + 30 && ex(h).poop?.phase === 'pre'; n++) {
    h.step();
    if (ex(h).poop?.phase !== 'pre') break;
    const d = Math.hypot(c.x - prev.x, c.z - prev.z);
    const a = h.dogs[who].anim;
    out.moved += d;
    out.turned += wrap(c.yaw - prev.yaw);
    if (a.action === 'sniff') out.sniff++;
    assert.equal(a.poopK, -1, 'ainda não agachou');
    assert.ok(a.poopPre >= 0 && a.poopPre <= 1, 'a animação recebe o progresso da voltinha');
    assert.ok(Math.abs(d * 60 - c.animSpeed) < 0.08, `o passo acompanha o deslocamento (${(d * 60).toFixed(3)} m/s × ${c.animSpeed.toFixed(3)})`);
    assert.ok(Math.abs(c.yawRate) <= c.animSpeed * 11 + 1e-6, `não gira sem andar (${c.yawRate.toFixed(2)} rad/s a ${c.animSpeed.toFixed(2)} m/s)`);
    assert.ok(!hitsStatic(h, c.x, c.z, c.r * 0.98, c.size), `a voltinha não atravessa nada (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
    prev = { x: c.x, z: c.z, yaw: c.yaw };
  }
  out.yaw = c.yaw;
  return out;
}

/** Roda a comemoração até o fim conferindo que não atravessa nada nem pisa no cocô. → quadros em que ela correu */
function watchParty(h, who) {
  const c = h.ctrls[who];
  const plop = h.log('extra:plop')[0];
  let fast = 0;
  for (let n = 0; n < (PARTY_MAX + 0.5) * 60 && ex(h).poop; n++) {
    h.step();
    if (ex(h).poop?.phase !== 'party') continue;
    assert.ok(!hitsStatic(h, c.x, c.z, c.r * 0.98, c.size), `a comemoração não atravessa nada (${c.x.toFixed(2)}, ${c.z.toFixed(2)})`);
    assert.ok(Math.hypot(c.x - plop.x, c.z - plop.z) > c.r + 0.05, 'não pisa no cocô');
    if (c.animSpeed > 1.5) fast++;
  }
  return fast;
}

/** O lugar mais aberto da fase (procura numa grade, de 2,6 m livres em volta para baixo). */
function openSpot(h, size) {
  const b = h.world.bounds;
  for (const r of [2.6, 2.4, 2.2, 2.0]) {
    for (let z = b.minZ + r; z <= b.maxZ - r; z += 0.25) {
      for (let x = b.minX + r; x <= b.maxX - r; x += 0.25) if (!h.world.overlaps(x, z, r, size)) return { x, z, r };
    }
  }
  return null;
}

for (const [i, def] of LEVELS.entries()) {
  test(`extras · ${def.id}: três ossinhos, o cocô só depois deles e uma vez por tentativa`, async () => {
    assert.equal(def.layout.COLLECTIBLES.length, 3, 'a fase tem 3 ossinhos');
    assert.ok((def.extras || []).length >= 1, 'a fase tem pelo menos uma animação do cenário');
    const h = await createHeadlessGame({ level: i + 1 });
    h.run(0.3);
    // sem os ossinhos: nada acontece
    h.clearLog();
    h.tap('KeyC');
    h.run(0.3);
    assert.equal(h.log('extra:start').length, 0, 'antes dos ossinhos o C não faz nada');
    assert.equal(ex(h).used, false);
    assert.equal(collectAll(h), 3, 'pegou os 3 ossinhos');
    const who = h.info().activeDog;
    const c = h.ctrls[who];
    h.clearLog();
    h.tap('KeyC');
    assert.equal(h.log('extra:start').at(-1)?.kind, 'poop', 'C com os ossinhos: começa');
    const P0 = ex(h).poop;
    assert.equal(P0?.who, who);
    assert.ok(P0.pre > 0.9 && P0.pre <= POOP_PRE, `voltinha de ${P0.pre} s`);
    // antes de agachar: fareja e anda a voltinha (as setas não mexem nela)
    h.hold([1, 0]);
    const W = watchCircle(h, who);
    assert.ok(W.sniff > 20, 'farejando o chão');
    if (P0.circle > 0) {
      assert.ok(W.moved > Math.min(0.3, P0.circle * 0.9), `andou a voltinha (${W.moved.toFixed(2)} de ${P0.circle} m)`);
      assert.ok(Math.abs(W.turned) > 0.7, `virou andando (${W.turned.toFixed(2)} rad)`);
    }
    // agachada: travada no lugar onde a voltinha terminou, com a animação recebendo o progresso
    assert.equal(ex(h).poop?.phase, 'squat');
    const at = { x: c.x, z: c.z };
    h.run(POOP_TIME * 0.5);
    assert.ok(Math.hypot(c.x - at.x, c.z - at.z) < 0.02, 'fica parada fazendo força');
    const k = h.dogs[who].anim.poopK;
    assert.ok(k > 0.3 && k < 0.7, `a animação recebe o progresso (${k})`);
    h.tap('KeyQ');
    assert.equal(h.info().activeDog, who, 'não troca de dog no meio');
    h.hold(null);
    assert.ok(h.run(POOP_TIME, { until: () => ex(h).poop?.phase === 'party' }), 'depois da cavada vem a comemoração');
    assert.equal(h.log('extra:plop').length, 1, 'um cocozinho');
    assert.equal(ex(h).poops, 1);
    assert.equal(h.log('extra:relief').length, 1);
    assert.ok(h.log('extra:scratch').length >= 4, 'cava com as traseiras');
    watchParty(h, who);
    assert.ok(!ex(h).poop, 'a sequência termina');
    assert.equal(h.log('extra:secret').length, 1, 'a recompensa: brilho dourado e jingle');
    assert.equal(h.log('extra:yip').length, 1, 'latidinho feliz na reverência');
    assert.ok(h.log('extra:bounce').length >= 2, 'pulinhos de alegria');
    assert.equal(h.log('extra:end').at(-1)?.kind, 'poop');
    assert.equal(h.log('hint').length, 0, 'nenhum texto na tela');
    assert.equal(h.dogs[who].anim.poopK, -1);
    assert.equal(h.dogs[who].anim.party, null);
    // de novo na mesma tentativa: nada
    h.clearLog();
    h.tap('KeyC');
    h.run(0.3);
    assert.equal(h.log('extra:start').length, 0, 'só uma vez por tentativa');
    // reiniciar libera de novo e tira o cocô do chão
    h.events.emit('ui:restart', {});
    h.run(0.2);
    assert.equal(ex(h).used, false);
    assert.equal(ex(h).poops, 0);
  });
}

for (const name of ['radhija', 'rhaenyra']) {
  test(`extras: com espaço, a ${name} anda uma volta inteira, agacha de perfil e comemora com zoomies`, async () => {
    const h = await createHeadlessGame({ level: 1 });
    h.run(0.3);
    collectAll(h);
    if (h.info().activeDog !== name) h.tap('KeyQ');
    const sis = name === 'radhija' ? 'rhaenyra' : 'radhija';
    const spot = openSpot(h, 'large');
    assert.ok(spot, 'a fase 1 tem um lugar aberto');
    // a irmã sentada (Fica) a ~3,5 m, longe do caminho
    h.teleport(sis, spot.x + 2.6, spot.z + 2.4);
    h.game.setStay(sis, true);
    h.teleport(name, spot.x, spot.z, 0.4);
    h.run(0.6);
    const c = h.ctrls[name];
    const start = { x: c.x, z: c.z, yaw: c.yaw };
    const cam = { ...h.engine.camera.position };
    h.clearLog();
    h.tap('KeyC');
    const P0 = ex(h).poop;
    const R = 0.5 * c.cfg.visual.length;
    assert.ok(P0.circle > TAU * R * 0.75, `o caminho é uma volta inteira (${P0.circle} m)`);
    const W = watchCircle(h, name);
    assert.ok(Math.abs(W.turned) >= TAU * 0.78 && Math.abs(W.turned) <= TAU * 1.32, `uma volta a uma volta e um terço (${(W.turned / TAU).toFixed(2)})`);
    assert.ok(W.moved > TAU * R * 0.75, `andou de verdade (${W.moved.toFixed(2)} m)`);
    assert.ok(Math.hypot(c.x - start.x, c.z - start.z) < R * 2.2, 'a voltinha é pequena: agacha perto de onde estava');
    // termina de perfil para a câmera (a agachada se lê de lado)
    const view = Math.atan2(start.x - cam.x, start.z - cam.z);
    assert.ok(Math.abs(Math.cos(c.yaw - view)) < 0.2, `de perfil para a câmera (${Math.cos(c.yaw - view).toFixed(2)})`);
    assert.ok(h.run(POOP_TIME + 0.5, { until: () => ex(h).poop?.phase === 'party' }));
    const fast = watchParty(h, name);
    assert.ok(h.log('extra:zoom').length === 1 && fast > 10, `zoomies correndo (${fast} quadros)`);
    assert.equal(h.log('extra:skid').length, 1, 'freia no fim dos zoomies');
    // termina de frente para o cocô, toda orgulhosa
    const plop = h.log('extra:plop')[0];
    const face = wrap(Math.atan2(plop.x - c.x, plop.z - c.z) - c.yaw);
    assert.ok(Math.abs(face) < 0.3, `de frente para o cocô (${face.toFixed(2)} rad)`);
    // a irmã viu: espanto e coraçõezinhos (só uma vez)
    assert.equal(h.log('extra:cheer').length, 1, 'a irmã comemora junto');
    assert.equal(h.log('extra:cheer')[0].name, sis);
  });
}

test('extras: sem espaço ela nem gira (fareja e agacha ali), sem atravessar nada, e comemora com um pulinho virando', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.run(0.3);
  collectAll(h);
  const who = h.info().activeDog;
  const sis = who === 'radhija' ? 'rhaenyra' : 'radhija';
  const b = h.world.bounds;
  h.teleport(sis, b.maxX - 1, b.maxZ - 1);
  h.game.setStay(sis, true);
  const c = h.ctrls[who];
  // encostada na beirada da fase, de frente para ela (não cabe nem um passo para a frente)
  const want = { x: (b.minX + b.maxX) / 2, z: b.minZ - 0.5 };
  const p = h.teleport(who, want.x, want.z);
  h.ctrls[who].yaw = Math.atan2(want.x - p.x, want.z - p.z);
  h.run(0.4);
  h.ctrls[who].yaw = Math.atan2(want.x - c.x, want.z - c.z);
  h.clearLog();
  h.tap('KeyC');
  assert.ok(ex(h).poop, 'começa mesmo sem espaço');
  assert.equal(ex(h).poop.circle, 0, 'não cabe nem um pedacinho de volta');
  const W = watchCircle(h, who);
  assert.ok(W.moved < 0.01 && Math.abs(W.turned) < 0.01, 'fica no lugar: nada de girar sem andar');
  assert.ok(h.run(POOP_TIME + 0.5, { until: () => ex(h).poop?.phase === 'party' }));
  const yaw0 = c.yaw;
  assert.equal(ex(h).poop.zoom, false, 'sem espaço para os zoomies');
  watchParty(h, who);
  assert.ok(!ex(h).poop, 'termina');
  assert.ok(Math.abs(Math.abs(wrap(c.yaw - yaw0)) - Math.PI) < 0.05, 'o pulinho vira meia volta');
  assert.ok(h.log('extra:hop').length >= 1 && h.log('dog:land').length >= 1, 'pula e pousa');
  const plop = h.log('extra:plop')[0];
  assert.ok(!hitsStatic(h, plop.x, plop.z, 0.03, c.size), 'o cocô cai no chão livre');
});

test('extras: andando o C não começa; parada, sim', async () => {
  const h = await createHeadlessGame({ level: 5 });
  h.run(0.3);
  collectAll(h);
  h.hold([1, 0]);
  h.run(0.6);
  h.clearLog();
  h.tap('KeyC');
  assert.equal(h.log('extra:start').length, 0, 'correndo: nada');
  h.hold(null);
  h.run(0.8);
  h.tap('KeyC');
  assert.equal(h.log('extra:start').at(-1)?.kind, 'poop', 'parada: começa');
});

test('extras: R3 no controle também faz o cocô', async () => {
  const h = await createHeadlessGame({ level: 1 });
  h.run(0.3);
  collectAll(h);
  h.setPad(h.pad({ down: [PAD.RS] }));
  h.step();
  h.setPad(h.pad());
  h.run(0.1);
  assert.equal(ex(h).poop?.who, h.info().activeDog, 'R3 começa');
  h.setPad(null);
  assert.ok(h.run(FULL, { until: () => !ex(h).poop }), 'a sequência termina');
  assert.equal(ex(h).poops, 1);
});

test('extras: a irmã por perto vira a cara para o cocô e depois se alegra', async () => {
  const h = await createHeadlessGame({ level: 2 });
  h.run(0.3);
  collectAll(h);
  const a = h.info().activeDog;
  const b = a === 'radhija' ? 'rhaenyra' : 'radhija';
  const A = h.ctrls[a];
  h.teleport(b, A.x + 0.9, A.z);
  h.run(0.3);
  h.clearLog();
  h.tap('KeyC');
  assert.ok(h.run(FULL, { until: (i) => i.extras.poop?.phase === 'squat' && i.extras.poop.t > POOP_TIME * 0.6 }));
  assert.equal(h.log('dog:yuck').filter((e) => e.name === b).length, 1, 'a irmã fez "eca"');
  assert.equal(h.dogs[b].anim.action, 'yuck');
  assert.ok(h.run(FULL, { until: (i) => (i.extras.poop?.party ?? -1) > 0.6 }), 'chega a comemoração');
  assert.ok(ex(h).poop.cheer, 'a irmã viu');
  assert.ok(h.dogs[b].anim.cheer > 0, 'a animação da irmã reage');
  assert.ok(h.run(FULL, { until: () => !ex(h).poop }));
  assert.equal(h.log('extra:cheer').filter((e) => e.name === b).length, 1, 'coraçõezinhos uma vez');
  assert.equal(h.dogs[b].anim.cheer, -1, 'depois volta ao normal');
});

/**
 * Onde chegar para usar o ponto: perto do `stand` (se ela não pula para dentro) ou do lado de fora do ponto, na
 * direção oposta a `face` (sul quando o ponto não tem `face`).
 */
export function approachOf(sp) {
  if (sp.stand && !sp.hop) return { x: sp.stand.x, z: sp.stand.z + 0.12 };
  const face = sp.face ?? sp;
  const away = Math.hypot(sp.x - face.x, sp.z - face.z) > 1e-3 ? Math.atan2(sp.x - face.x, sp.z - face.z) : 0;
  const d = (sp.r ?? 0.6) - 0.15;
  return { x: sp.x + Math.sin(away) * d, z: sp.z + Math.cos(away) * d };
}

/** Leva a dog certa até perto do ponto, de frente para ele. */
function goTo(h, sp) {
  const want = sp.size === 'large' ? 'rhaenyra' : sp.size === 'small' ? 'radhija' : h.info().activeDog;
  if (h.info().activeDog !== want) h.tap('KeyQ');
  const face = sp.face ?? sp;
  const a = approachOf(sp);
  const p = h.teleport(want, a.x, a.z);
  h.ctrls[want].yaw = Math.atan2(face.x - p.x, face.z - p.z);
  h.run(0.1);
  return want;
}

for (const [i, def] of LEVELS.entries()) {
  test(`extras · ${def.id}: E perto de cada ponto do cenário toca a animação (sem texto)`, async () => {
    const h = await createHeadlessGame({ level: i + 1 });
    h.run(0.3);
    for (const sp of def.extras) {
      if (sp.when) {
        // fora da condição o E não toca a animação
        goTo(h, sp);
        h.clearLog();
        h.tap('KeyE');
        assert.equal(h.log('extra:start').length, 0, `${sp.id}: só quando "${sp.when}"`);
        assert.ok(h.game.debug.puzzle.navFlags, 'a fase informa as flags');
        const stage = { sprinklersOff: 'sprinklersOff' }[sp.when];
        assert.ok(stage && h.game.debug.setStage(stage), `etapa para ${sp.when}`);
        h.run(0.2);
      }
      const who = goTo(h, sp);
      h.clearLog();
      h.tap('KeyE');
      const st = h.log('extra:start').at(-1);
      assert.equal(st?.kind, sp.kind, `${sp.id}: começou`);
      assert.equal(st?.id, sp.id);
      assert.equal(ex(h).act?.who, who);
      const dur = EXTRA_TIME[sp.kind];
      h.run(dur * 0.5);
      if (sp.kind !== 'swing' && sp.kind !== 'spurt') assert.equal(h.dogs[who].anim.extra?.kind, sp.kind, `${sp.id}: animação`);
      assert.ok(h.run(dur, { until: () => !ex(h).act }), `${sp.id}: terminou`);
      assert.equal(h.log('extra:end').at(-1)?.kind, sp.kind);
      assert.ok(!h.world.overlaps(h.ctrls[who].x, h.ctrls[who].z, h.ctrls[who].r * 0.9, h.ctrls[who].size), `${sp.id}: termina fora dos colisores`);
      assert.equal(h.ctrls[who].y || 0, 0, `${sp.id}: de volta ao chão`);
    }
  });
}

test('extras: o módulo nunca mostra texto (dica, prompt ou objetivo)', () => {
  const src = readFileSync('src/game/extras.js', 'utf8');
  assert.doesNotMatch(src, /emit\('(hint|objective|prompt)'/, 'extras.js não emite dica nem objetivo');
  assert.doesNotMatch(src, /setPrompt|hints\./, 'extras.js não usa prompts nem dicas');
});

test('extras: nada no jogo nem no README cita o segredo', () => {
  const texts = [readFileSync('README.md', 'utf8'), readFileSync('index.html', 'utf8')];
  for (const f of readdirSync('src/ui')) if (/\.(js|css)$/.test(f)) texts.push(readFileSync(`src/ui/${f}`, 'utf8'));
  for (const t of texts) {
    assert.doesNotMatch(t, /KeyC|\bR3\b|\bcoc[ôo](?![a-z])|poop/i, 'sem menção ao segredo na UI ou no README');
  }
});
