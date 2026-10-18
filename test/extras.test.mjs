// Extras escondidos (src/game/extras.js): o cocô (C no teclado, R3 no controle) só depois dos ossinhos todos da
// fase e uma vez por tentativa; as animações do cenário com E perto de cada ponto; nada disso aparece em texto do
// jogo nem no README. Jogo headless, nas oito fases.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHeadlessGame } from './helpers/headless.mjs';
import { LEVELS } from '../src/levels/index.js';
import { POOP_PRE, POOP_TIME, EXTRA_TIME } from '../src/game/extras.js';
import { PAD } from '../src/game/input.js';

const ex = (h) => h.info().extras;

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
    const at = { x: c.x, z: c.z };
    h.clearLog();
    h.tap('KeyC');
    assert.equal(h.log('extra:start').at(-1)?.kind, 'poop', 'C com os ossinhos: começa');
    assert.equal(ex(h).poop?.who, who);
    // antes de agachar: fareja e dá uma voltinha no lugar
    h.run(POOP_PRE * 0.6);
    assert.equal(h.dogs[who].anim.action, 'sniff', 'farejando antes');
    assert.equal(h.dogs[who].anim.poopK, -1);
    // travada no lugar durante a sequência, com a animação recebendo o progresso
    h.hold([1, 0]);
    h.run(POOP_PRE * 0.4 + POOP_TIME * 0.5);
    assert.ok(Math.hypot(c.x - at.x, c.z - at.z) < 0.02, 'fica parada fazendo força');
    const k = h.dogs[who].anim.poopK;
    assert.ok(k > 0.3 && k < 0.7, `a animação recebe o progresso (${k})`);
    h.tap('KeyQ');
    assert.equal(h.info().activeDog, who, 'não troca de dog no meio');
    h.hold(null);
    assert.ok(h.run(POOP_TIME, { until: () => !ex(h).poop }), 'a sequência termina');
    assert.equal(h.log('extra:plop').length, 1, 'um cocozinho');
    assert.equal(ex(h).poops, 1);
    assert.equal(h.log('extra:relief').length, 1);
    assert.ok(h.log('extra:scratch').length >= 4, 'cava com as traseiras');
    assert.equal(h.log('hint').length, 0, 'nenhum texto na tela');
    assert.equal(h.dogs[who].anim.poopK, -1);
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
  h.run(POOP_PRE + POOP_TIME + 0.2);
  assert.equal(ex(h).poops, 1);
});

test('extras: a irmã por perto vira a cara para o cocô', async () => {
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
  h.run(POOP_PRE + POOP_TIME * 0.6);
  assert.equal(h.log('dog:yuck').filter((e) => e.name === b).length, 1, 'a irmã fez "eca"');
  assert.equal(h.dogs[b].anim.action, 'yuck');
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
