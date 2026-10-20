// Largar e pegar de novo, em todas as fases (pedido do usuário, 2026-10-20): com o item na boca, E larga no chão à
// frente (quando não há outra ação ali) e E perto pega de volta. O item cai num ponto que a dog alcança de novo: fora de
// colisores (parede, móvel, cerca, água), dentro do mapa e nunca do outro lado de uma cerca ou porta; algo que passe por
// cima dele o empurra para fora; largado de frente para a entrega, entrega. Headless, com semente nos sorteios.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHeadlessGame } from './helpers/headless.mjs';
import { withSeedAsync, mulberry32 } from './helpers/seeded.mjs';
import { reach, FLOOR_REACH, inZones } from '../src/game/puzzleKit.js';
import { LEVELS } from '../src/levels/index.js';
import fase1 from '../src/levels/fase1/index.js';
import fase2 from '../src/levels/fase2/index.js';
import fase3 from '../src/levels/fase3/index.js';
import fase4 from '../src/levels/fase4/index.js';
import fase5 from '../src/levels/fase5/index.js';
import fase6 from '../src/levels/fase6/index.js';
import fase7 from '../src/levels/fase7/index.js';
import fase8 from '../src/levels/fase8/index.js';
import fase9 from '../src/levels/fase9/index.js';
import fase10 from '../src/levels/fase10/index.js';

const level = (def) => LEVELS.indexOf(def) + 1;
const seeded = (name, seed, fn) => test(name, () => withSeedAsync(seed, fn));

/** Fica ativa a dog `name` (Q se precisar). */
function as(h, name) {
  if (h.info().activeDog !== name) h.tap('KeyQ');
  assert.equal(h.info().activeDog, name);
}
/** Põe a dog em (x, z) olhando para `yaw` e deixa um quadro passar. */
function put(h, name, x, z, yaw) {
  h.teleport(name, x, z, yaw);
  h.run(1 / 60);
}
/** Espera a dog ficar livre (sem susto, empurrão ou ação roteirizada da fase) para o E valer. */
function waitFree(h, name, sec = 3) {
  h.run(sec, { until: () => !h.game.debug.puzzle.lockFor(name) });
}
/** Os bichos que andam (gansa, porcos, galinhas, o gato) não seguram o item: os testes também os ignoram. */
const movers = (h) => new Set(h.world.dynamics.filter((d) => d.kind === 'npc').map((d) => d.id));
/** O objetivo de agora para a dog ativa. */
const objective = (h) => h.puzzle.objective(h.game.activeDog).text;

/**
 * O ponto onde o item ficou é bom: no chão, fora de colisores, dentro do mapa, sem nada entre a dog e ele (nunca do
 * outro lado de uma cerca) e ao alcance de quem o largou (dali mesmo ela pega de volta).
 */
function assertGoodSpot(h, who, f, msg) {
  const c = h.ctrls[who];
  assert.ok(f, `${msg}: o item está no chão`);
  const ignore = movers(h);
  assert.ok(!h.world.overlaps(f.x, f.z, 0.04, c.size, { ignore }), `${msg}: fora de colisores (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
  assert.ok(h.world.segmentClear(c.x, c.z, f.x, f.z, 0.03, c.size, { ignore }), `${msg}: nada entre a dog (${c.x.toFixed(2)}, ${c.z.toFixed(2)}) e o item (${f.x.toFixed(2)}, ${f.z.toFixed(2)})`);
  assert.ok(reach(c, f.x, f.z) < FLOOR_REACH, `${msg}: ao alcance (${reach(c, f.x, f.z).toFixed(2)} m)`);
  const B = h.world.bounds;
  assert.ok(f.x > B.minX && f.x < B.maxX && f.z > B.minZ && f.z < B.maxZ, `${msg}: dentro do mapa`);
}

/** Fase 10: com água e energia, o barquinho chega na borda e a Radhija pega o chapeuzinho. */
function takeHat(h) {
  const L = fase10.layout;
  const P = h.game.debug.puzzle;
  P.debugSet('water');
  P.debugSet('power');
  assert.ok(h.run(5, { until: (i) => i.quintal.boat.docked }), 'o barquinho chegou na borda');
  as(h, 'radhija');
  put(h, 'radhija', L.BOAT.dock.x + 0.65, L.BOAT.dock.z, -Math.PI / 2);
  h.tap('KeyE');
  assert.equal(h.info().hat.holder, 'radhija', 'pegou o chapeuzinho');
}

/**
 * Uma fase: como pôr o item na boca (?stage= ou setup), de onde largar (`from`), o item na info de depuração, os
 * prompts de largar e de pegar, o objetivo "pegue de volta" e onde fica a entrega (para conferir que ela continua).
 */
const CASES = [
  {
    name: 'fase 1 (cenoura)', def: fase1, query: 'stage=carrying&dog=rhaenyra', item: (i) => i.carrot,
    drop: 'drop', pick: 'carrot', again: 'pickAgain', deliverAt: { x: -3.6, z: -3.7 },
  },
  {
    name: 'fase 2 (bolinha)', def: fase2, query: 'stage=carrying&dog=rhaenyra', item: (i) => i.ball,
    drop: 'drop', pick: 'ball', again: 'pickAgain', deliverAt: { x: -5.0, z: -3.4 },
  },
  {
    name: 'fase 3 (pantufa)', def: fase3, query: 'stage=carrying&dog=rhaenyra', item: (i) => i.slipper,
    drop: 'drop', pick: 'slipper', again: 'pickAgain', deliverAt: { x: -5.0, z: -3.6 },
  },
  {
    name: 'fase 4 (patinho)', def: fase4, query: 'stage=carrying&dog=radhija', item: (i) => i.duck,
    drop: 'drop', pick: 'duck', again: 'pickAgain', deliverAt: { x: -5.0, z: -2.4 },
  },
  {
    name: 'fase 5 (ursinho)', def: fase5, query: 'stage=carrying&dog=radhija', item: (i) => i.bear,
    drop: 'drop', pick: 'bear', again: 'pickAgain', deliverAt: { x: -5.25, z: 2.4 },
  },
  {
    name: 'fase 6 (bolinha-planeta)', def: fase6, query: 'stage=carrying&dog=radhija', item: (i) => i.ball,
    drop: 'dropPlanet', pick: 'ball', again: 'pickupFloor', from: { x: 0, z: 2.5, yaw: Math.PI / 2 },
  },
  {
    name: 'fase 7 (frisbee)', def: fase7, query: 'stage=carrying&dog=radhija', item: (i) => i.frisbee,
    drop: 'dropFrisbee', pick: 'frisbee', again: 'frisbeeAgain',
  },
  {
    name: 'fase 8 (meia)', def: fase8, query: 'stage=sock&dog=radhija', item: (i) => i.sock,
    drop: 'dropSock', pick: 'sock', again: 'pickSock',
  },
  {
    name: 'fase 9 (óculos)', def: fase9, query: 'stage=glasses&dog=radhija', item: (i) => i.glasses,
    drop: 'dropGlasses', pick: 'glasses', again: 'pickGlasses', from: { x: -3.0, z: 0.5, yaw: Math.PI / 2 },
  },
  {
    name: 'fase 9 (livro)', def: fase9, query: 'stage=book&dog=rhaenyra', land: 'book:drop',
    item: (i) => ({ holder: i.book.holder, floor: i.biblioteca.book === 'floor' ? i.biblioteca.bookAt : null }),
    drop: 'drop', pick: 'book', again: 'bookRh',
  },
  {
    name: 'fase 10 (chapeuzinho)', def: fase10, query: '', setup: takeHat, from: { x: 1.8, z: 1.4, yaw: Math.PI / 2 },
    item: (i) => ({ holder: i.hat.holder, floor: i.quintal.place.hat === 'floor' ? i.quintal.floor.hat : null }),
    drop: 'drop', pick: 'pick', againText: (T) => T.objective.pickFloor.replace('{item}', 'o chapeuzinho'),
  },
];

/** O jogo da fase com o item na boca da dog ativa, no ponto de largar. → { h, who } */
async function carrying(c) {
  const h = await createHeadlessGame({ level: level(c.def), query: c.query });
  h.run(0.3);
  c.setup?.(h);
  const who = h.game.activeDog;
  if (c.from) put(h, who, c.from.x, c.from.z, c.from.yaw);
  h.run(0.2);
  assert.equal(c.item(h.info()).holder, who, `${c.name}: com o item na boca`);
  return { h, who };
}

for (const c of CASES) {
  seeded(`pegar e largar — ${c.name}: E larga à frente, ele cai no chão e E pega de volta`, 7, async () => {
    const { h, who } = await carrying(c);
    const T = h.puzzle.TEXT;
    assert.equal(h.info().prompt, T.prompt[c.drop], 'prompt de largar');
    const before = objective(h);
    h.clearLog();
    h.tap('KeyE');
    let i = h.info();
    let it = c.item(i);
    assert.equal(it.holder, null, 'E largou o item');
    assertGoodSpot(h, who, it.floor, c.name);
    assert.equal(h.log('item:drop').length, 1, 'item:drop ao soltar');
    assert.equal(h.log('dog:bark').length, 0, 'largar não late');
    assert.notEqual(objective(h), before, 'o objetivo mudou');
    assert.equal(objective(h), c.againText ? c.againText(T) : T.objective[c.again], 'o objetivo manda pegar de volta');
    // cai até o chão (um instante) e fica lá
    h.run(0.8);
    assert.equal(h.log(c.land || 'item:land').length, 1, 'pousou no chão (som e poeirinha)');
    it = c.item(h.info());
    assert.ok(it.floor && it.holder === null, 'continua no chão');
    assert.equal(h.info().prompt, T.prompt[c.pick], 'prompt de pegar de volta');
    h.tap('KeyE');
    i = h.info();
    assert.equal(c.item(i).holder, who, 'E pegou de volta');
    assert.equal(c.item(i).floor, null, 'saiu do chão');
    assert.equal(h.log('item:pickup').length, 1);
    // a entrega continua valendo depois de largar e pegar de novo
    if (c.deliverAt) {
      put(h, who, c.deliverAt.x, c.deliverAt.z, h.ctrls[who].yaw);
      assert.ok(h.run(2, { until: (s) => s.state === 'celebrating' || s.state === 'victory' }), 'entregou: comemoração');
    }
  });
}

seeded('pegar e largar: o item nunca cai do outro lado de uma cerca, de uma porta fechada ou da cerca da horta', 3, async () => {
  // fase 1: a Rhaenyra encostada na cerca, do lado leste, de frente para ela (o focinho passa da cerca)
  {
    const F = fase1.layout.FENCE;
    const { h, who } = await carrying(CASES[0]);
    put(h, who, F.x + 0.3, -0.5, -Math.PI / 2);
    assert.ok(h.ctrls[who].x > F.x, 'do lado leste');
    h.tap('KeyE');
    const f = h.info().carrot.floor;
    assertGoodSpot(h, who, f, 'cerca da fase 1');
    assert.ok(f.x > F.x + 0.03, `a cenoura ficou do lado dela (x = ${f.x.toFixed(2)})`);
  }
  // fase 9: a Rhaenyra presa no escritório com o livro, de frente para a porta fechada
  {
    const W = fase9.layout.WALL_EH;
    const { h, who } = await carrying(CASES[9]);
    put(h, who, W.x - 0.3, 0.3, Math.PI / 2);
    assert.ok(h.ctrls[who].x < W.x && h.info().biblioteca.door.t < 0.05, 'dentro do escritório, a porta fechada');
    h.tap('KeyE');
    const s = h.info().biblioteca;
    assert.equal(s.book, 'floor');
    assertGoodSpot(h, who, s.bookAt, 'porta do escritório');
    assert.ok(s.bookAt.x < W.x - 0.05, `o livro ficou dentro do escritório (x = ${s.bookAt.x.toFixed(2)})`);
  }
  // fase 10: a Radhija com o chapeuzinho, do lado de fora da horta, de frente para a cerca baixa
  {
    const H = fase10.layout.HORTA;
    const { h, who } = await carrying(CASES[10]);
    put(h, who, H.x0 - 0.25, 1.5, Math.PI / 2);
    assert.ok(h.ctrls[who].x < H.x0, 'do lado de fora da horta');
    h.tap('KeyE');
    const f = h.info().quintal.floor.hat;
    assert.equal(h.info().quintal.place.hat, 'floor');
    assertGoodSpot(h, who, f, 'cerca da horta');
    assert.ok(f.x < H.x0 - 0.03, `o chapeuzinho ficou fora da horta (x = ${f.x.toFixed(2)})`);
  }
});

seeded('pegar e largar: largado de frente para a entrega, o item é entregue (caminha da fase 2, toalha da fase 7)', 5, async () => {
  /** Põe a dog fora do círculo da entrega, de frente para ele, com o focinho lá dentro. */
  const facing = (h, who, G) => {
    put(h, who, G.x + G.r + 0.12, G.z, -Math.PI / 2);
    const d = h.ctrls[who];
    put(h, who, d.x, d.z, Math.atan2(G.x - d.x, G.z - d.z));
    const m = { x: d.x + Math.sin(d.yaw) * (d.r + 0.1), z: d.z + Math.cos(d.yaw) * (d.r + 0.1) };
    assert.ok(Math.hypot(d.x - G.x, d.z - G.z) >= G.r, 'a dog fora da entrega');
    assert.ok(Math.hypot(m.x - G.x, m.z - G.z) < G.r, 'o focinho dentro dela');
  };
  {
    const { h, who } = await carrying(CASES[1]);
    facing(h, who, fase2.layout.GOAL);
    assert.equal(h.info().state, 'playing');
    h.tap('KeyE');
    assert.ok(h.run(1, { until: (s) => s.state === 'celebrating' }), 'fase 2: a bolinha largada na caminha termina a fase');
  }
  {
    const { h, who } = await carrying(CASES[6]);
    facing(h, who, fase7.layout.GOAL);
    h.tap('KeyE');
    assert.equal(h.info().lambe.place.frisbee, 'picnic', 'fase 7: o frisbee largado na toalha fica no piquenique');
    assert.equal(h.log('picnic:deliver').length, 1);
  }
});

seeded('pegar e largar: algo que passa por cima do item no chão o empurra para fora (nunca some embaixo)', 9, async () => {
  // fase 6, no assoalho livre ao sul da maquete: a Radhija larga a bolinha-planeta virada para o leste
  const { h, who } = await carrying(CASES[5]);
  h.tap('KeyE');
  h.run(0.8);
  const f0 = h.info().ball.floor;
  assertGoodSpot(h, who, f0, 'bolinha-planeta largada');
  // um caixote (colisor que anda) chega em cima dela, vindo do leste
  const box = h.world.addDynamic({ id: 'teste-caixote', kind: 'crate', shape: 'box', x: f0.x + 0.12, z: f0.z, hx: 0.2, hz: 0.2 });
  h.run(0.1);
  const f1 = h.info().ball.floor;
  assert.ok(f1, 'continua no chão');
  assert.ok(!h.world.overlaps(f1.x, f1.z, 0.04, 'large'), `saiu de baixo do caixote (${f1.x.toFixed(2)}, ${f1.z.toFixed(2)})`);
  assert.ok(f1.x < f0.x && Math.hypot(f1.x - f0.x, f1.z - f0.z) < 0.4, 'foi empurrada para o oeste, só o bastante');
  h.world.removeDynamic(box);
  // a dog ainda alcança: vai até ela e pega de volta
  h.walkTo(f1.x - 0.35, f1.z, { tol: 0.1 });
  waitFree(h, who);
  assert.equal(h.info().prompt, h.puzzle.TEXT.prompt.ball);
  h.tap('KeyE');
  assert.equal(h.info().ball.holder, who, 'pegou de volta');
});

seeded('pegar e largar: quem não carrega não pega do chão; com a irmã carregando, o E da outra continua latindo', 11, async () => {
  // fase 3: a pantufa largada é pesada para a Radhija
  {
    const { h } = await carrying(CASES[2]);
    h.tap('KeyE');
    const f = h.info().slipper.floor;
    h.run(0.6);
    as(h, 'radhija');
    h.clearLog();
    put(h, 'radhija', f.x + 0.3, f.z, -Math.PI / 2);
    assert.equal(objective(h), h.puzzle.TEXT.objective.pickAgainRad, 'objetivo: só a Rhaenyra carrega');
    assert.notEqual(h.info().prompt, h.puzzle.TEXT.prompt.slipper, 'sem prompt de pegar para a Radhija');
    h.tap('KeyE');
    assert.equal(h.info().slipper.holder, null, 'a Radhija não pega');
    assert.ok(h.log('hint').some((x) => x.text === h.puzzle.TEXT.hint.heavy), 'dica: pesada demais');
  }
  // fase 2: a Rhaenyra leva a bolinha; o E da Radhija ativa não larga o que é da irmã
  {
    const { h } = await carrying(CASES[1]);
    as(h, 'radhija');
    h.clearLog();
    h.tap('KeyE');
    assert.equal(h.info().ball.holder, 'rhaenyra', 'a bolinha continua com a Rhaenyra');
    assert.equal(h.log('item:drop').length, 0, 'nada caiu');
  }
});

/**
 * Sorteio: em muitos pontos livres de cada fase, com rumos sorteados, E larga e E pega de volta. Cada largada fica num
 * ponto bom (assertGoodSpot) e a dog pega de volta dali mesmo. Fica longe só do que tem outra ação com E (a entrega, a
 * bandeja, a escadinha, o botão do ventilador, a bolinha no lugar dela, o quadro, a despensa, o campinho) e dos bichos
 * que dão susto (a gansa).
 */
const goose = (g) => ({ x: g.x, z: g.z, r: 2.5 });
const SWEEP = [
  { c: CASES[0] }, { c: CASES[1] }, { c: CASES[2], far: (h) => [goose(h.info().goose)] }, { c: CASES[3] }, { c: CASES[4] },
  { c: CASES[5], far: () => [{ x: fase6.layout.TRAY.x, z: fase6.layout.TRAY.z, r: 1.3 }] },
  {
    c: CASES[6],
    far: () => {
      const { BALL, TUNNEL } = fase7.layout;
      return [{ x: BALL.x, z: BALL.z, r: 1.0 }, { minX: TUNNEL.x0 - 0.3, maxX: TUNNEL.x1 + 0.3, minZ: TUNNEL.z - 0.6, maxZ: TUNNEL.z + 0.6 }];
    },
  },
  { c: CASES[7] },
  { c: CASES[8], far: () => [{ x: fase9.layout.LADDER.minX, z: fase9.layout.LADDER.start.z, r: 1.6 }, { x: fase9.layout.FAN.start.x, z: fase9.layout.FAN.start.z, r: 1.2 }] },
  {
    c: CASES[10],
    far: (h) => {
      const L = fase10.layout;
      return [
        { x: L.PAINTING.x, z: L.PAINTING.z, r: 2.2 }, goose(h.info().quintal.goose),
        { minX: L.PLANTATION.x0 - 0.8, maxX: L.PLANTATION.x1 + 0.8, minZ: L.PLANTATION.z0 - 0.8, maxZ: L.PLANTATION.z1 + 0.8 },
        { minX: L.PANTRY.x0 - 0.3, maxX: L.PANTRY.x1 + 0.3, minZ: L.PANTRY.zN - 0.3, maxZ: L.PANTRY.zS + 0.3 },
      ];
    },
  },
];
for (const { c, far } of SWEEP) {
  seeded(`pegar e largar — ${c.name}: em pontos sorteados, o item sempre cai num lugar bom e volta para a boca`, 21, async () => {
    const { h, who } = await carrying(c);
    const L = c.def.layout;
    const G = L.GOAL;
    const B = h.world.bounds;
    const rnd = mulberry32(1234);
    const d = h.ctrls[who];
    let drops = 0;
    for (let k = 0; k < 400 && drops < 14; k++) {
      const x = B.minX + 0.3 + rnd() * (B.maxX - B.minX - 0.6);
      const z = B.minZ + 0.3 + rnd() * (B.maxZ - B.minZ - 0.6);
      const yaw = (rnd() * 2 - 1) * Math.PI;
      if (h.world.overlaps(x, z, d.r + 0.02, d.size, { ignore: movers(h) })) continue;
      const m = { x: x + Math.sin(yaw) * (d.r + 0.1), z: z + Math.cos(yaw) * (d.r + 0.1) };
      if (Math.hypot(m.x - G.x, m.z - G.z) < G.r + 0.4 || Math.hypot(x - G.x, z - G.z) < G.r + 0.4) continue;
      if (far && inZones(far(h))(x, z)) continue;
      waitFree(h, who);
      put(h, who, x, z, yaw);
      if (Math.hypot(d.x - x, d.z - z) > 0.05) continue; // a posição não coube (colisor perto): sorteia outra
      h.tap('KeyE');
      const it = c.item(h.info());
      assert.equal(it.holder, null, `${c.name} em (${x.toFixed(2)}, ${z.toFixed(2)}) rumo ${yaw.toFixed(2)}: E largou`);
      assertGoodSpot(h, who, it.floor, `${c.name} em (${x.toFixed(2)}, ${z.toFixed(2)}) rumo ${yaw.toFixed(2)}`);
      drops++;
      h.run(0.1);
      waitFree(h, who);
      h.tap('KeyE');
      assert.equal(c.item(h.info()).holder, who, `${c.name} em (${x.toFixed(2)}, ${z.toFixed(2)}): E pegou de volta`);
    }
    assert.ok(drops >= 10, `${c.name}: largadas sorteadas suficientes (${drops})`);
  });
}
