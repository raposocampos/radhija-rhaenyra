// Modo História: o TERRAÇO DA TORRE jogável (src/story/areas/recanto/rooftop.js, scenesTelhado.js, world/telhado.js),
// jogado no jogo headless com as teclas de verdade:
//   saguão → corte para o terraço (cena da chegada) → os pombos fogem de poleiro em poleiro → a Rhaenyra de guarda
//   (Fica) num poleiro e a Radhija espantando: encurralados na caixa d'água → a Rhaenyra empurra o caixote até embaixo
//   da escada e dá o impulso no puxador da trava → a escada desce → a Radhija sobe → a fuga (a pista 'tampa') → o Faro
//   mostra as penas → o mirante → o corte de volta para a porta da torre (etapa 'portaria');
// e, quadro a quadro, ninguém atravessa nada (intrusions).
// Enquanto o puzzle.js não delega ao terraço (puzzle.rooftop), o teste monta a mesma ligação por fora (harness), com
// um diretor, a lupa e as dicas próprios; com a ligação feita no puzzle, ele usa a de verdade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createStoryGame, STORY, storyInfo, intrusions, become, holdWorld } from './helpers/historia.mjs';
import { createRooftop, ROOF_SCENES, perchSpots, SCARE_R, GUARD_R } from '../src/story/areas/recanto/rooftop.js';
import { createRooftopScenes } from '../src/story/areas/recanto/scenesTelhado.js';
import { createDirector } from '../src/story/scene/director.js';
import { createClueBook, CLUES, CHAPTER1_CLUES } from '../src/story/clues.js';
import { PICTOS } from '../src/story/ui/pictos.js';
import { createHints } from '../src/game/puzzleKit.js';
import { createDogEffects } from '../src/game/mechanics/index.js';
import { createKit } from '../src/levels/mapa/world/kit.js';
import { buildTelhado } from '../src/story/areas/recanto/world/telhado.js';
import L from '../src/story/areas/recanto/layout.js';

/**
 * A área com o terraço ligado por fora do puzzle (o que puzzle.js faz quando delega): o mesmo createRooftop e as mesmas
 * cenas, um diretor e a lupa próprios, e os ganchos do puzzle passando primeiro pelo terraço.
 */
function harnessStory() {
  const H = { roof: null, K: null, scenes: null, run: { scene: null }, stage: null, log: [] };
  const story = {
    ...STORY,
    // o cenário do terraço (world/telhado.js), se o world/index.js ainda não monta a peça
    async load() {
      const { build } = await STORY.load();
      return {
        build(args) {
          const w = build(args);
          if (w.props.rooftop) return w;
          const kit = createKit(args.root);
          const part = buildTelhado(kit, args.root, args.layout);
          kit.finish();
          Object.assign(w.props, part.props);
          const up = w.update, rs = w.props.reset;
          w.update = (dt, t) => { up?.(dt, t); part.update?.(dt, t); };
          w.props.reset = () => { rs?.(); part.reset?.(); };
          return w;
        },
      };
    },
    createPuzzle(ctx) {
      const puzzle = STORY.createPuzzle(ctx);
      if (puzzle.rooftop) { H.roof = puzzle.rooftop; H.integrated = true; return puzzle; }
      const dir = createDirector({ ctx, emit: ctx.emit });
      for (const k of ['say', 'clearSay', 'comic', 'panel', 'onomato', 'caption', 'fx', 'lens']) dir[k] = (...a) => { H.log.push([k, ...a]); };
      const book = createClueBook({ emit: ctx.emit });
      const S = { pending: null };
      const K = {
        ctx, dir, props: ctx.props, L: ctx.layout, emit: ctx.emit, book, deduction: null, faro: null,
        get S() { return S; },
        placeAt(rad, rha) {
          ctx.place('radhija', rad.x, rad.z, rad.yaw ?? 0);
          ctx.place('rhaenyra', rha.x, rha.z, rha.yaw ?? 0);
          for (const n of ['radhija', 'rhaenyra']) ctx.setStay(n, false);
        },
        setStage(st) { H.stage = st; },
        closeTowerDoor() {},
      };
      const hints = createHints(ctx.emit, { hint: {}, prompt: {} });
      const effects = createDogEffects({ world: ctx.world, dogs: ctx.dogs });
      const roof = createRooftop(K, { world: ctx.world, root: ctx.root, emit: ctx.emit, effects, ctx, props: ctx.props, dir, hints });
      const scenes = createRooftopScenes(K, roof);
      Object.assign(H, { roof, K, scenes, book });
      const base = {};
      for (const k of ['update', 'interact', 'onBark', 'onFaro', 'wallSpots', 'onWallTouch', 'modifyIntent', 'shoveSpots', 'lockFor', 'lookTarget', 'cinematic', 'info', 'reset', 'navFlags']) base[k] = puzzle[k]?.bind(puzzle);
      const run = H.run;
      const busy = () => !!run.scene?.active || !!S.pending;
      Object.assign(puzzle, {
        update(dt, o) {
          hints.frame(dt);
          if (!run.scene?.active && S.pending) { const id = S.pending; S.pending = null; run.scene = scenes[id]; run.scene.start({}); }
          if (run.scene?.active) { run.scene.update(dt); if (!run.scene.active) run.scene = null; }
          const playing = !run.scene?.active && !S.pending;
          // a entrada no saguão (a linha que troca a cena 'terraco' de antes)
          const rad = ctx.ctrls.radhija, T = L.TOWER_LOBBY;
          if (!roof.active && !roof.done && puzzle.stage === 'torre' && rad.x >= T.x0 && rad.x <= T.x1 && rad.z >= T.z0 && rad.z <= T.z1) roof.enter();
          if (roof.active || busy()) roof.update(dt, { active: o.active, comp: o.comp, playing });
          else base.update(dt, o);
          dir.update(dt);
          effects.update(dt, o.ctrls);
          return null;
        },
        interact(c) { if (busy()) return true; return roof.active ? roof.interact(c) : base.interact(c); },
        onBark(c) { if (roof.active) roof.onBark(c); else base.onBark(c); },
        onFaro(c) { if (roof.active) roof.onFaro(c); return base.onFaro(c); },
        wallSpots() { return roof.active ? roof.wallSpots() : base.wallSpots(); },
        onWallTouch(c, spot) { if (!roof.onWallTouch(c, spot)) base.onWallTouch(c, spot); },
        modifyIntent(dt, c, intent, o) { if (busy()) return null; return roof.active ? roof.modifyIntent(dt, c, intent, o) : base.modifyIntent(dt, c, intent, o); },
        shoveSpots() { return roof.active ? [] : base.shoveSpots(); },
        lockFor(n) { return dir.lockFor(n) || effects.lockFor(n) || base.lockFor(n); },
        lookTarget(c) { return dir.lockFor(c.name)?.look || (roof.active ? roof.lookTarget(c) : null) || base.lookTarget(c); },
        cinematic() { return busy() || base.cinematic(); },
        navFlags() { return { ...base.navFlags(), ...roof.navFlags() }; },
        info() {
          const i = base.info();
          if (run.scene?.active) { i.story.scene = run.scene.id; i.story.beat = run.scene.beat; }
          i.story.clues = [...new Set([...i.story.clues, ...book.found])];
          i.story.roof = roof.info();
          return i;
        },
        reset() { run.scene?.abort?.(); run.scene = null; S.pending = null; base.reset(); roof.reset(); },
      });
      puzzle.reset();
      return puzzle;
    },
  };
  return { story, H };
}

/** O jogo na etapa da torre, com o terraço ligado (de verdade ou pelo harness). */
async function roofGame() {
  const { story, H } = harnessStory();
  const h = await createStoryGame({ story, query: 'stage=torre' });
  const roof = H.roof;
  assert.ok(roof, 'o terraço existe');
  return { h, H, roof };
}

/** Toca a cena que está rodando (ou para começar) até o fim, conferindo as intrusões. */
function watchScene(h, bad, max = 40) {
  for (let i = 0; i < 90 && !storyInfo(h).scene; i++) h.step();
  const id = storyInfo(h).scene;
  let n = 0;
  while (storyInfo(h).scene && n < max * 60) {
    h.step();
    n++;
    for (const m of intrusions(h)) bad.add(`[${id}/${storyInfo(h).beat}] ${m}`);
  }
  h.step();
  for (const m of intrusions(h)) bad.add(`[${id}/depois] ${m}`);
  return id;
}

test('telhado: o layout tem os poleiros afastados, o caminho do caixote livre e a pista nova da tampa', () => {
  const P = L.ROOF_PERCHES;
  const low = Object.keys(P).filter((id) => !P[id].high);
  assert.equal(low.length, 3, 'três poleiros baixos (com uma de guarda e outra espantando, eles acabam na caixa d’água)');
  for (const a of low) for (const b of low) if (a < b) assert.ok(Math.hypot(P[a].x - P[b].x, P[a].z - P[b].z) > GUARD_R + SCARE_R + 0.5, `${a} e ${b} longe um do outro`);
  assert.ok(P.caixa.high && P.caixa.y > 2, 'o alto da caixa d’água é o poleiro alto');
  for (const id of Object.keys(P)) assert.equal(perchSpots(P[id]).length, 3);
  // o terraço fica dentro dos limites, fora do condomínio, e o muro leste continua fechado
  const B = L.WORLD.bounds, R = L.ROOFTOP;
  assert.ok(R.x1 <= B.maxX && R.x0 > L.WALL.maxX + 20 && R.z0 >= B.minZ && R.z1 <= B.maxZ);
  assert.ok(L.STATIC_COLLIDERS.some((c) => c.id === 'muro-leste'), 'o muro leste');
  // a nova pista
  assert.equal(CLUES.tampa?.case, 'C1');
  assert.ok(CHAPTER1_CLUES.includes('tampa') && PICTOS.tampa, 'a tampa tem cartão e desenho');
});

test('telhado: o pega-pega dos pombos, o caixote, a trava, a subida, a fuga e a volta para a porta da torre', async () => {
  const { h, H, roof } = await roofGame();
  const S = () => storyInfo(h);
  const RI = () => roof.info();
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(`[${RI().phase}] ${m}`); };
  const walk = (pts, opts = {}) => { for (const [x, z] of pts) { h.walkTo(x, z, { timeout: 10, tol: 0.2, ...opts }); watch(); } };
  const P = L.ROOF_PERCHES;

  // 0. o saguão: a Radhija entrando começa o terraço (o corte no preto)
  become(h, 'radhija');
  const T = L.TOWER_LOBBY;
  h.teleport('radhija', (T.x0 + T.x1) / 2 + 0.2, (T.z0 + T.z1) / 2 + 0.6, Math.PI / 2);
  h.step();
  assert.equal(roof.phase, 'chega');
  assert.equal(watchScene(h, bad), ROOF_SCENES.chega);
  assert.equal(roof.phase, 'caca', 'a caça começa');
  assert.equal(RI().perch, 'varal', 'o bando no varal');
  assert.ok(h.ctrls.radhija.x > L.ROOFTOP.x0 && h.ctrls.rhaenyra.x > L.ROOFTOP.x0, 'as duas no terraço');
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a Radhija volta ao controle');
  assert.ok(h.props.squad.far.object.visible && h.props.carrot.object.visible, 'o Farelo com a cenoura');

  // 1. a Rhaenyra fica de guarda perto da antena (Fica), longe do varal
  become(h, 'rhaenyra');
  walk([[65.0, -5.6], [66.6, -8.6]]);
  const rha = h.ctrls.rhaenyra;
  assert.ok(Math.hypot(rha.x - P.antena.x, rha.z - P.antena.z) <= GUARD_R && Math.hypot(rha.x - P.antena.x, rha.z - P.antena.z) > SCARE_R, `a Rhaenyra perto da antena (${rha.x.toFixed(2)}, ${rha.z.toFixed(2)})`);
  assert.equal(RI().perch, 'varal', 'o bando continua no varal');
  become(h, 'radhija');
  h.tap('KeyF');
  h.run(0.3);
  assert.equal(h.game.stay.rhaenyra, true, 'a Rhaenyra no Fica');
  assert.deepEqual(RI().guarded, ['antena'], 'a antena está guardada');

  // 2. a Radhija espanta: do varal eles vão para o ar-condicionado (a antena está guardada)
  walk([[68.6, -4.9]]);
  h.run(0.4, { until: () => RI().flying });
  assert.ok(RI().flying || RI().perch === 'ar', `o bando voa (${JSON.stringify(RI())})`);
  h.run(2.5, { until: () => RI().perch === 'ar' });
  assert.equal(RI().perch, 'ar', 'no ar-condicionado');
  // de novo: sem poleiro livre (o varal é de onde vieram, a antena está guardada), eles sobem na caixa d'água
  walk([[72.4, -3.0], [74.5, -4.0]]);
  h.run(4, { until: () => RI().perch === 'caixa' });
  assert.equal(RI().perch, 'caixa', `encurralados na caixa d’água (${JSON.stringify(RI())})`);
  assert.equal(roof.phase, 'caixa');

  // 3. sem o caixote embaixo, o puxador não vale; a Rhaenyra empurra o caixote: para o leste e para o norte
  assert.deepEqual(h.puzzle.wallSpots(), [], 'sem o caixote, o puxador é alto demais');
  become(h, 'rhaenyra');
  assert.equal(h.game.stay.rhaenyra, false, 'quem vira ativa perde o Fica');
  const C = L.ROOF_CRATE;
  walk([[69.0, -7.6], [68.6, -4.4], [C.start.x - C.half - 0.32, C.start.z]]);
  h.teleport('rhaenyra', C.start.x - C.half - 0.27, C.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(holdWorld(h, [1, 0], 10, () => RI().crate.x >= C.maxX - 0.01, ['ShiftLeft']), `o caixote vai para o leste (${JSON.stringify(RI().crate)})`);
  h.run(0.3);
  watch();
  walk([[73.4, -2.6], [C.maxX, -2.75]]);
  h.teleport('rhaenyra', C.maxX, RI().crate.z + C.half + 0.27, Math.PI);
  h.run(0.2);
  assert.ok(holdWorld(h, [0, -1], 12, () => roof.crateIn, ['ShiftLeft']), `o caixote vai para baixo da escada (${JSON.stringify(RI().crate)})`);
  h.hold(null);
  h.run(0.4);
  watch();
  assert.equal(h.puzzle.wallSpots().length, 1, 'com o caixote embaixo, o puxador fica ao alcance do impulso');

  // 4. o impulso da Rhaenyra no puxador: a escada desce
  const LT = L.ROOF_LATCH;
  h.teleport('rhaenyra', LT.x - 0.1, LT.z + 0.42, Math.PI);
  h.run(0.25);
  h.tap('Space');
  h.run(1.6);
  watch();
  assert.equal(RI().ladderDown, true, `a escada desce (${JSON.stringify({ impulsos: h.log('dog:wallJump').length, rha: [h.ctrls.rhaenyra.x, h.ctrls.rhaenyra.z], roof: RI() })})`);
  assert.equal(h.ctrls.rhaenyra.y || 0, 0, 'a Rhaenyra volta ao chão');

  // 5. a Rhaenyra não cabe na escada; a Radhija sobe
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(RI().climb, null, 'a Rhaenyra não sobe');
  become(h, 'radhija');
  h.walkTo(73.75, -7.0, { timeout: 8, tol: 0.25 });
  watch();
  h.tap('KeyE');
  h.run(0.1);
  assert.notEqual(RI().climb, null, `a Radhija sobe (${JSON.stringify({ rad: [h.ctrls.radhija.x, h.ctrls.radhija.z], roof: RI() })})`);
  assert.ok(h.run(8, { until: () => { watch(); return !!S().scene || roof.phase === 'fuga'; } }), 'a subida chega lá em cima');
  assert.ok(h.ctrls.radhija.y > 2.5, `lá no alto (y ${h.ctrls.radhija.y.toFixed(2)})`);

  // 6. a fuga: o bando vai embora com a cenoura e a tampa; a pista nova
  assert.equal(watchScene(h, bad), ROOF_SCENES.fuga);
  assert.equal(roof.phase, 'penas');
  assert.ok(S().clues.includes('tampa'), 'a pista da tampa de borracha');
  assert.equal(h.props.squad.far.object.visible, false, 'o bando foi embora');
  assert.equal(h.props.rooftop.lid.object.visible, false, 'a tampa sumiu');
  assert.equal(h.props.rooftop.feathers.object.visible, true, 'as penas no chão');
  assert.equal(h.ctrls.radhija.y || 0, 0, 'as duas embaixo');

  // 7. sem o Faro, o mirante só dá a dica; com o Faro, as penas mostram a cidade e o mirante fecha o terraço
  const LK = L.ROOF_LOOKOUT;
  walk([[71.0, -8.6], [LK.x, LK.z + 0.2]]);
  h.run(0.5);
  assert.equal(roof.phase, 'penas', 'sem farejar, ainda não');
  walk([[70.6, -9.4]]);
  h.puzzle.onFaro(h.ctrls[h.game.activeDog]);
  h.run(0.5);
  assert.equal(RI().trailSeen, true, 'o Faro mostra as penas');
  walk([[LK.x, LK.z + 0.2]], { until: () => !!storyInfo(h).scene });
  assert.equal(watchScene(h, bad), ROOF_SCENES.olha);
  assert.equal(roof.done, true, 'o terraço acabou');
  const D = L.TOWER_DOOR;
  assert.ok(h.ctrls.radhija.x < D.hinge.x && Math.abs(h.ctrls.radhija.z - (D.hinge.z + D.latchPost.z) / 2) < 1.5, 'as duas do lado de fora da porta da torre');
  if (H.integrated) assert.equal(S().stage, 'portaria');
  else assert.equal(H.stage, 'portaria', 'a etapa da portaria');
  assert.equal(h.puzzle.lockFor('radhija'), null);
  assert.equal(h.puzzle.lockFor('rhaenyra'), null);
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
});

test('telhado: pular a cena da chegada deixa tudo igual a assistir', async () => {
  const snap = (h, roof) => ({ roof: roof.info(), rad: [+h.ctrls.radhija.x.toFixed(3), +h.ctrls.radhija.z.toFixed(3)], rha: [+h.ctrls.rhaenyra.x.toFixed(3), +h.ctrls.rhaenyra.z.toFixed(3)] });
  const out = [];
  for (const skip of [false, true]) {
    const { h, H, roof } = await roofGame();
    roof.enter();
    for (let i = 0; i < 60 && !storyInfo(h).scene; i++) h.step();
    if (skip) {
      h.run(1.0); // o preto (noSkip) acaba
      if (H.integrated) { h.keyDown('KeyE'); h.run(2); h.keyUp('KeyE'); } else H.run.scene.skip();
    }
    h.run(30, { until: () => !storyInfo(h).scene });
    h.step();
    out.push(snap(h, roof));
    assert.equal(h.puzzle.lockFor('radhija'), null);
  }
  assert.deepEqual(out[1], out[0]);
});

test('telhado: sozinha, a Radhija não encurrala o bando (ele roda entre os três poleiros); o latido também espanta', async () => {
  const { h, roof } = await roofGame();
  roof.enter();
  h.run(30, { until: () => roof.phase === 'caca' && !storyInfo(h).scene });
  h.step();
  assert.equal(roof.phase, 'caca');
  const P = L.ROOF_PERCHES;
  const cx = (L.ROOFTOP.x0 + L.ROOFTOP.x1) / 2, cz = (L.ROOFTOP.z0 + L.ROOFTOP.z1) / 2;
  const seen = [];
  become(h, 'radhija');
  for (let i = 0; i < 5; i++) {
    const id = roof.info().perch;
    seen.push(id);
    const p = P[id], d = Math.hypot(cx - p.x, cz - p.z);
    // as duas perto do poleiro (a companheira segue a ativa), do lado de dentro do terraço
    h.teleport('radhija', p.x + ((cx - p.x) / d) * 1.2, p.z + ((cz - p.z) / d) * 1.2);
    h.teleport('rhaenyra', p.x + ((cx - p.x) / d) * 1.9, p.z + ((cz - p.z) / d) * 1.9);
    h.run(3, { until: () => !roof.info().flying && roof.info().perch && roof.info().perch !== id });
    assert.notEqual(roof.info().perch, 'caixa', `sem ninguém de guarda, eles não ficam encurralados (${seen.join(' → ')})`);
  }
  assert.ok(new Set(seen).size === 3, `rodam pelos três poleiros (${seen.join(' → ')})`);
  // o latido de perto (a uns 3 m) também espanta
  const id = roof.info().perch, p = P[id], d = Math.hypot(cx - p.x, cz - p.z);
  h.teleport('radhija', p.x + ((cx - p.x) / d) * 2.9, p.z + ((cz - p.z) / d) * 2.9);
  h.teleport('rhaenyra', p.x + ((cx - p.x) / d) * 3.6, p.z + ((cz - p.z) / d) * 3.6);
  h.run(1.0);
  assert.equal(roof.info().perch, id, 'de longe, sem latir, eles ficam');
  h.tap('KeyE');
  h.run(0.2);
  assert.ok(roof.info().flying || roof.info().perch !== id, 'o latido espanta o bando');
});

test('telhado: skipToEnd (testes e E2E) deixa o terraço feito, com a pista da tampa, na porta da torre', async () => {
  const { h, H, roof } = await roofGame();
  roof.enter();
  h.run(30, { until: () => roof.phase === 'caca' && !storyInfo(h).scene });
  h.step();
  assert.equal(roof.skipToEnd(), true);
  h.run(0.3);
  assert.equal(roof.done, true);
  assert.ok(storyInfo(h).clues.includes('tampa'));
  if (H.integrated) assert.equal(storyInfo(h).stage, 'portaria');
  else assert.equal(H.stage, 'portaria');
  const D = L.TOWER_DOOR;
  assert.ok(h.ctrls.radhija.x < D.hinge.x && h.ctrls.rhaenyra.x < D.hinge.x, 'do lado de fora da porta da torre');
  assert.deepEqual(intrusions(h), []);
});
