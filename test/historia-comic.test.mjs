// A camada de HQ das cenas do Modo História (pedido do usuário em 2026-11-10: diálogos "estilo mangá ou Scott
// Pilgrim, como se estivéssemos lendo uma HQ dentro do game"). Só a parte pura (src/story/ui/comicMath.js), sem DOM:
//  - os layouts viram quadros dentro da tela, sem se sobrepor, com calha entre eles e na ordem de leitura;
//  - o viewOffset centra o plano no quadro (o recorte "cover" do que a câmera mostraria em tela cheia);
//  - as entradas do quadro ao vivo começam e terminam onde devem; a saída devolve a tela inteira;
//  - o balão cabe no quadro, desvia de outro balão e aponta para quem fala (ou para fora, com o nome);
//  - o tempo de digitar (o mesmo da voz), de ler e de sumir; a fila de onomatopeias;
//  - sem nenhum evento, nada muda: o canvas fica sem clip-path e a câmera sem viewOffset.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {
  LAYOUTS, SLOTS, ENTER, EXIT_DUR, OUT_DUR, READ_MIN, animatePanel, balloonShape, bboxOf, burstPath, centroid, clipCss,
  cloudPath, contentBox, createLiveDriver, createOnomatoQueue, createStage, frameMetrics, inkPath, inside, needsNewPage,
  ovalPath, placeBalloon, placeCorner, rectPoly, sayTiming, slotPoly, tailPath, typeTimes, typedCount, viewOffsetFor,
  voiceMarks, overlap, projectPoint, headBox, tipGap, HEAD_HALF,
} from '../src/story/ui/comicMath.js';
import { createDirector } from '../src/story/scene/director.js';

/** As telas que importam: celular deitado (Infinix compacto), iPhone 13 deitado com entalhe, PC. */
const SCREENS = [
  { name: 'celular 759×334', W: 759, H: 334 },
  { name: 'iPhone 13 844×390', W: 844, H: 390, insets: { l: 47, r: 47, b: 21 } },
  { name: 'PC 1920×1080', W: 1920, H: 1080 },
];
const near = (a, b, eps = 0.5) => Math.abs(a - b) <= eps;

test('layouts: cada quadro dentro da página, sem sobrepor os outros, com calha e na ordem de leitura', () => {
  assert.deepEqual(LAYOUTS, ['full', '2h', '2v', '3a', '3b', '4']);
  assert.deepEqual(SLOTS, { full: 1, '2h': 2, '2v': 2, '3a': 3, '3b': 3, '4': 4 });
  for (const g of SCREENS) {
    const box = contentBox(g);
    const { gutter } = frameMetrics(g.W, g.H);
    for (const layout of LAYOUTS) {
      const slots = Array.from({ length: SLOTS[layout] }, (_, s) => slotPoly(layout, s, g));
      for (const [i, s] of slots.entries()) {
        assert.ok(s.poly.length >= 3, `${g.name} ${layout}/${i}: polígono`);
        // dentro da área útil (a margem e o entalhe ficam de fora)
        for (const p of s.poly) {
          assert.ok(p[0] >= box.x - 0.01 && p[0] <= box.x + box.w + 0.01 && p[1] >= box.y - 0.01 && p[1] <= box.y + box.h + 0.01,
            `${g.name} ${layout}/${i}: ponto ${p} fora da página`);
        }
        // grande o bastante para um plano (o menor quadro do celular ainda tem um terço da altura)
        assert.ok(s.bbox.w > g.W * 0.25 && s.bbox.h > g.H * 0.3, `${g.name} ${layout}/${i}: quadro pequeno demais ${JSON.stringify(s.bbox)}`);
        assert.ok(near(s.frac.w, s.bbox.w / g.W, 1e-9) && near(s.frac.x, s.bbox.x / g.W, 1e-9), 'frações da tela');
        // nenhum canto entra em outro quadro, e a calha fica entre eles
        for (const [j, o] of slots.entries()) {
          if (i === j) continue;
          for (const p of s.poly) assert.ok(!inside(o.poly, p[0], p[1], -gutter * 0.4), `${g.name} ${layout}: ${i} invade ${j}`);
        }
      }
      // ordem de leitura: o primeiro fica mais acima/à esquerda que o último
      if (slots.length > 1) {
        const a = centroid(slots[0].poly), z = centroid(slots[slots.length - 1].poly);
        assert.ok(a[0] + a[1] < z[0] + z[1], `${g.name} ${layout}: ordem de leitura`);
      }
    }
  }
  // as divisórias são inclinadas (página dinâmica): no 2v o lado de dentro do quadro da esquerda não é vertical
  const left = slotPoly('2v', 0, SCREENS[0]).poly;
  const xs = left.map((p) => p[0]).sort((a, b) => b - a);
  assert.ok(xs[0] - xs[1] > 5, 'a calha do 2v é inclinada');
  // layout desconhecido = full; quadro fora do layout = o último
  assert.deepEqual(slotPoly('xyz', 3, SCREENS[0]).poly, slotPoly('full', 0, SCREENS[0]).poly);
  assert.deepEqual(slotPoly('2h', 9, SCREENS[0]).poly, slotPoly('2h', 1, SCREENS[0]).poly);
});

test('inclinação: o quadro gira (tilt em graus) e continua dentro da sua célula', () => {
  for (const g of SCREENS) {
    for (const layout of ['full', '2v', '4']) {
      const flat = slotPoly(layout, 0, g).poly;
      const tilted = slotPoly(layout, 0, g, 5).poly;
      for (const p of tilted) assert.ok(inside(flat, p[0], p[1], 0.05), `${g.name} ${layout}: o quadro inclinado sai da célula`);
      // o lado de cima ficou inclinado uns 5°
      const [a, b] = [tilted[0], tilted[1]];
      const ang = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
      const flatAng = (Math.atan2(flat[1][1] - flat[0][1], flat[1][0] - flat[0][0]) * 180) / Math.PI;
      assert.ok(Math.abs(ang - flatAng) > 2.5, `${g.name} ${layout}: inclinou ${ang - flatAng}°`);
      // e não encolheu demais (escala separada em x e y, a maior área)
      assert.ok(bboxOf(tilted).w * bboxOf(tilted).h > bboxOf(flat).w * bboxOf(flat).h * 0.55, `${g.name} ${layout}: encolheu demais`);
    }
  }
});

test('viewOffset: o plano fica centrado no quadro, no recorte "cover" da tela cheia', () => {
  for (const g of SCREENS) {
    const { W, H } = g;
    // a tela inteira: nada muda
    const id = viewOffsetFor({ x: 0, y: 0, w: W, h: H }, W, H);
    assert.ok(near(id.fullWidth, W, 1e-6) && near(id.fullHeight, H, 1e-6) && near(id.x, 0, 1e-6) && near(id.y, 0, 1e-6));
    for (const layout of LAYOUTS) {
      for (let s = 0; s < SLOTS[layout]; s++) {
        const r = slotPoly(layout, s, g).bbox;
        const v = viewOffsetFor(r, W, H);
        const cam = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
        cam.position.set(0, 0, 0);
        cam.lookAt(0, 0, -1);
        cam.updateMatrixWorld();
        cam.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
        const toScreen = (x, y, z) => {
          const p = new THREE.Vector3(x, y, z).project(cam);
          return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H];
        };
        // o eixo da câmera (o centro do plano) cai no centro do quadro
        const c = toScreen(0, 0, -5);
        assert.ok(near(c[0], r.x + r.w / 2, 0.05) && near(c[1], r.y + r.h / 2, 0.05), `${g.name} ${layout}/${s}: centro ${c}`);
        // cover: o que a câmera mostraria na tela cheia cobre o quadro inteiro (nada de fundo vazio nas bordas)
        const full = new THREE.PerspectiveCamera(38, W / H, 0.1, 200);
        full.lookAt(0, 0, -1);
        full.updateMatrixWorld();
        full.updateProjectionMatrix();
        const corner = new THREE.Vector3(1, 1, 0.5).unproject(full); // canto da tela cheia, no mundo
        const k = toScreen(corner.x, corner.y, corner.z);
        assert.ok(k[0] >= r.x + r.w - 0.5 && k[1] <= r.y + 0.5, `${g.name} ${layout}/${s}: o recorte não cobre o quadro`);
        // e quadros parecidos com a tela mostram tudo (um lado encosta)
        const fits = near(v.fullHeight, r.h, 1e-6) || near(v.fullWidth, r.w, 1e-6);
        assert.ok(fits, `${g.name} ${layout}/${s}: cover justo`);
        cam.clearViewOffset();
      }
    }
  }
});

test('entradas do quadro ao vivo: começam do jeito certo e terminam no quadro', () => {
  const g = SCREENS[0];
  const { poly, bbox } = slotPoly('2v', 1, g);
  const end = (kind) => animatePanel(poly, kind, 1, g);
  for (const kind of Object.keys(ENTER)) assert.deepEqual(end(kind).poly, poly, `${kind} termina no quadro`);
  // shrink: começa na tela inteira (o plano de cinema vira o quadro sem corte)
  const s0 = animatePanel(poly, 'shrink', 0, g);
  const b0 = bboxOf(s0.poly);
  assert.ok(near(b0.x, 0) && near(b0.y, 0) && near(b0.w, g.W) && near(b0.h, g.H), 'shrink começa na tela cheia');
  assert.deepEqual(s0.content, { x: 0, y: 0, w: g.W, h: g.H });
  // wipe: começa vazio e o conteúdo fica parado
  const w0 = animatePanel(poly, 'wipe', 0, g);
  assert.ok(w0.poly.length < 3 || bboxOf(w0.poly).w < 1, 'wipe começa sem nada');
  assert.deepEqual(animatePanel(poly, 'wipe', 0.5, g).content, bbox);
  assert.ok(bboxOf(animatePanel(poly, 'wipe', 0.5, g).poly).w > 1, 'wipe pela metade mostra um pedaço');
  // zoom e pop: nascem pequenos no centro do quadro
  for (const kind of ['zoom', 'pop']) {
    const b = bboxOf(animatePanel(poly, kind, 0, g).poly);
    assert.ok(b.w < bbox.w * 0.7, `${kind} começa pequeno`);
    const c = centroid(animatePanel(poly, kind, 0, g).poly), c1 = centroid(poly);
    assert.ok(near(c[0], c1[0], 1) && near(c[1], c1[1], 1), `${kind} cresce do centro`);
  }
  // slide: entra pelo lado do quadro (o da direita, pela direita)
  const sl = createStage();
  sl.setGeom(g);
  sl.open(0, { layout: '2v', slot: 1, enter: 'slide' });
  assert.ok(bboxOf(sl.frame(0).clip).x > bbox.x + 100, 'o quadro da direita entra pela direita');
  sl.open(0, { layout: '2v', slot: 0, enter: 'slide' });
  assert.ok(bboxOf(sl.frame(0).clip).x < slotPoly('2v', 0, g).bbox.x - 100, 'o da esquerda, pela esquerda');
});

test('o palco: sem evento nada; abrir, trocar e fechar a HQ (a saída devolve a tela inteira)', () => {
  const g = SCREENS[1];
  const st = createStage();
  st.setGeom(g);
  for (let t = 0; t < 5; t += 0.1) assert.equal(st.frame(t), null, 'sem quadro, nada');
  assert.equal(st.busy, false);
  assert.equal(st.open(1, { layout: 'full', slot: 0, enter: 'shrink' }), null);
  const f0 = st.frame(1);
  assert.ok(f0 && f0.live && f0.k === 0);
  const fEnd = st.frame(1 + ENTER.shrink + 0.01);
  assert.deepEqual(fEnd.clip, slotPoly('full', 0, g).poly);
  const prev = st.open(3, { layout: '3a', slot: 1, tilt: 3, enter: 'pop' });
  assert.equal(prev.layout, 'full', 'devolve o quadro anterior (para congelar)');
  assert.equal(st.live.layout, '3a');
  st.close(4);
  assert.ok(st.busy);
  const mid = st.frame(4 + EXIT_DUR * 0.999);
  const b = bboxOf(mid.clip);
  assert.ok(b.w > g.W * 0.98 && b.h > g.H * 0.98, 'no fim da saída, o quadro já é a tela');
  assert.equal(st.frame(4 + EXIT_DUR + 0.01), null);
  assert.equal(st.busy, false);
  // fechar sem quadro aberto, ou na hora, não deixa nada
  st.open(5, {});
  st.close(5, true);
  assert.equal(st.frame(5.1), null);
});

test('sem nenhum evento, o canvas fica sem clip-path e a câmera sem viewOffset', () => {
  const g = SCREENS[0];
  const st = createStage();
  st.setGeom(g);
  const driver = createLiveDriver(st);
  const calls = [];
  const style = {};
  const camera = { aspect: g.W / g.H, setViewOffset: (...a) => calls.push(['set', ...a]), clearViewOffset: () => calls.push(['clear']) };
  const target = { style, camera };
  for (let t = 0; t < 3; t += 1 / 60) assert.equal(driver.step(t, target, g), null);
  assert.deepEqual(style, {}, 'nada escrito no estilo do canvas');
  assert.deepEqual(calls, [], 'nada na câmera');
  assert.equal(driver.applied, false);

  // com um quadro: o plano e o recorte saem juntos, no mesmo desenho
  st.open(3, { layout: '2h', slot: 0, enter: 'none' });
  driver.step(3, target, g);
  assert.equal(style.clipPath, clipCss(slotPoly('2h', 0, g).poly));
  const v = viewOffsetFor(slotPoly('2h', 0, g).bbox, g.W, g.H, g.W / g.H);
  assert.deepEqual(calls.at(-1).slice(1), [v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height]);

  // fecha: cresce até a tela inteira e depois desfaz tudo
  st.close(4);
  for (let t = 4; t < 4 + EXIT_DUR + 0.2; t += 1 / 60) driver.step(t, target, g);
  assert.equal(style.clipPath, '');
  assert.equal(style.transform, '');
  assert.equal(style.filter, '');
  assert.equal(calls.at(-1)[0], 'clear');
  assert.equal(driver.applied, false);
  const n = calls.length;
  for (let t = 5; t < 6; t += 1 / 60) driver.step(t, target, g);
  assert.equal(calls.length, n, 'parado de novo: nada mais');

  // pular a cena: reset corta na hora
  st.open(7, { layout: 'full' });
  driver.step(7, target, g);
  st.clear();
  driver.reset(target);
  assert.equal(style.clipPath, '');
  assert.equal(calls.at(-1)[0], 'clear');
});

test('laço aos saltos (capturas): o primeiro desenho depois do quadro novo já mostra o quadro inteiro, com o plano dele', () => {
  // o jogo anda 2 s sem desenhar (o quadro novo chegou no meio): o desenho seguinte mostra o fim da entrada, e o recorte
  // e o plano são os do mesmo instante (nunca o estado do começo da animação)
  for (const enter of ['slide', 'pop', 'zoom', 'wipe', 'shrink']) {
    for (const [layout, slot] of [['3b', 1], ['3b', 2], ['2h', 0], ['2v', 0], ['2v', 1], ['full', 0]]) {
      const g = SCREENS[2];
      const st = createStage();
      st.setGeom(g);
      const driver = createLiveDriver(st);
      const style = {};
      let view = null;
      const camera = { aspect: g.W / g.H, setViewOffset: (...a) => { view = a; }, clearViewOffset: () => { view = null; } };
      st.open(10, { layout, slot, enter, tilt: 1.5 });
      const f = driver.step(12, { style, camera }, g);
      const { poly, bbox } = slotPoly(layout, slot, g, 1.5);
      assert.equal(style.clipPath, clipCss(poly), `${enter} ${layout}/${slot}: o quadro inteiro no lugar`);
      const v = viewOffsetFor(bbox, g.W, g.H);
      assert.deepEqual(view, [v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height], `${enter} ${layout}/${slot}: o plano do quadro`);
      assert.equal(f.k, 1);
    }
  }
});

test('página nova: outro layout ou quadro já usado; hold reabre o quadro na mesma página', () => {
  const page = { layout: '3a', used: new Set([0, 1]) };
  assert.equal(needsNewPage(null, { layout: 'full', slot: 0 }), true);
  assert.equal(needsNewPage(page, { layout: '3a', slot: 2 }), false);
  assert.equal(needsNewPage(page, { layout: '3a', slot: 0 }), true);
  assert.equal(needsNewPage(page, { layout: '3a', slot: 0, hold: true }), false);
  assert.equal(needsNewPage(page, { layout: '2v', slot: 2 }), true);
});

test('balão: cabe no quadro, fica acima de quem fala, desvia de outro balão e aponta para a cabeça', () => {
  for (const g of SCREENS) {
    for (const [layout, slot] of [['full', 0], ['2v', 1], ['4', 3], ['3a', 2]]) {
      const { poly, bbox } = slotPoly(layout, slot, g, layout === '4' ? 4 : 0);
      const w = Math.min(160, bbox.w * 0.38), h = 54;
      const head = { x: bbox.x + bbox.w * 0.5, y: bbox.y + bbox.h * 0.62, front: true };
      const a = placeBalloon({ anchor: head, w, h, poly });
      const corners = [[a.x, a.y], [a.x + w, a.y], [a.x + w, a.y + h], [a.x, a.y + h]];
      for (const p of corners) assert.ok(inside(poly, p[0], p[1], 1), `${g.name} ${layout}/${slot}: canto ${p} fora do quadro`);
      assert.equal(a.out, false);
      assert.ok(a.y + h <= head.y, `${g.name} ${layout}/${slot}: o balão fica acima da cabeça`);
      // o rabicho vai na direção da cabeça
      const cx = a.x + w / 2, cy = a.y + h / 2;
      const d1 = Math.hypot(head.x - cx, head.y - cy), d2 = Math.hypot(head.x - a.tip.x, head.y - a.tip.y);
      assert.ok(d2 < d1, 'a ponta do rabicho chega mais perto da cabeça');
      // um segundo balão (a outra dog, ao lado) não cobre o primeiro
      const head2 = { x: head.x + 30, y: head.y, front: true };
      const b = placeBalloon({ anchor: head2, w, h, poly, others: [{ x: a.x, y: a.y, w, h }] });
      const ov = overlap({ x: a.x, y: a.y, w, h }, { x: b.x, y: b.y, w, h });
      assert.ok(ov < w * h * 0.15, `${g.name} ${layout}/${slot}: os balões se cobrem (${ov.toFixed(0)} px²)`);
    }
  }
  // quem fala fora do quadro (ou atrás da câmera): na borda mais perto, rabicho para fora, com o nome
  const g = SCREENS[0];
  const { poly, bbox } = slotPoly('2v', 0, g);
  const w = 120, h = 46;
  const outR = placeBalloon({ anchor: { x: g.W + 200, y: bbox.y + bbox.h / 2, front: true }, w, h, poly });
  assert.equal(outR.out, true);
  assert.ok(outR.x + w > bbox.x + bbox.w * 0.6, 'encosta na borda da direita');
  assert.ok(outR.tip.x > outR.x + w, 'o rabicho aponta para fora, para a direita');
  for (const p of [[outR.x, outR.y], [outR.x + w, outR.y + h]]) assert.ok(inside(poly, p[0], p[1], 1));
  const behind = placeBalloon({ anchor: { x: -1e4, y: g.H * 2, front: false }, w, h, poly });
  assert.equal(behind.out, true);
  assert.ok(behind.tip.y > behind.y + h / 2, 'atrás da câmera: o rabicho aponta para baixo');
  // a cabeça logo acima da borda (cortada pelo quadro) conta como dentro: sem etiqueta, balão perto
  const top = placeBalloon({ anchor: { x: bbox.x + bbox.w * 0.5, y: bbox.y - 6, front: true }, w, h, poly });
  assert.equal(top.out, false, 'cabeça cortada pela borda de cima: dentro');
  // duas falas com quem fala fora do quadro (o caso das capturas): uma não cobre a outra
  const big = slotPoly('2h', 0, { W: 1280, H: 720 }, 1);
  const r1 = placeBalloon({ anchor: { x: 680, y: -40, front: true }, w: 220, h: 66, poly: big.poly });
  const r2 = placeBalloon({ anchor: { x: 650, y: -40, front: true }, w: 150, h: 54, poly: big.poly, others: [{ x: r1.x, y: r1.y, w: 220, h: 66 }] });
  assert.ok(overlap({ x: r1.x, y: r1.y, w: 220, h: 66 }, { x: r2.x, y: r2.y, w: 150, h: 54 }) < 150 * 54 * 0.05, 'fora do quadro, uma fala não cobre a outra');
  const none = placeBalloon({ anchor: null, w, h, poly });
  assert.equal(none.out, true);
  assert.equal(none.tip, null);
  // o canto da narração/legenda cabe mesmo com a borda inclinada
  for (const pos of ['tl', 'tr', 'bl', 'br', 'center']) {
    const s = slotPoly('3b', 1, g, 4).poly;
    const c = placeCorner(s, 110, 40, pos);
    for (const p of [[c.x, c.y], [c.x + 110, c.y], [c.x + 110, c.y + 40], [c.x, c.y + 40]]) assert.ok(inside(s, p[0], p[1], 1), `canto ${pos}`);
  }
});

test('formas: oval, explosão, nuvem, rabicho e nanquim saem como caminhos de SVG fechados', () => {
  const sh = balloonShape(120, 36, 'normal');
  assert.ok(sh.w > 120 && sh.h > 36);
  assert.ok(balloonShape(120, 36, 'grito').w > sh.w, 'o grito é maior (espinhos)');
  for (const d of [ovalPath(80, 40, 70, 30, 3), burstPath(80, 40, 70, 30, 3), cloudPath(80, 40, 70, 30), tailPath(80, 40, 200, 160, 18, 20)]) {
    assert.match(d, /^M[-\d.]+ [-\d.]+/);
    assert.match(d, /Z$/);
    assert.doesNotMatch(d, /NaN|Infinity/);
  }
  const p = slotPoly('4', 2, SCREENS[2]).poly;
  assert.equal(inkPath(p, 9), inkPath(p, 9), 'o tremido do nanquim é estável');
  assert.notEqual(inkPath(p, 9), inkPath(p, 10));
  assert.equal(inkPath([], 1), '');
  assert.equal(clipCss([]), 'polygon(0px 0px, 0px 0px, 0px 0px)');
  assert.match(clipCss(rectPoly({ x: 1, y: 2, w: 3, h: 4 })), /^polygon\(1\.0px 2\.0px, 4\.0px 2\.0px, 4\.0px 6\.0px, 1\.0px 6\.0px\)$/);
});

test('texto: ~45 letras/s com respiro na pontuação, o mesmo tempo da voz; some depois de ler', async () => {
  const text = 'Cadê a cenoura? Ela estava aqui, juro!';
  const times = typeTimes(text);
  assert.equal(times.length, text.length);
  assert.equal(times[0], 0);
  for (let i = 1; i < times.length; i++) assert.ok(times[i] > times[i - 1]);
  // 45 por segundo, mais as pausas (depois do "?" e da vírgula)
  const plain = 'a'.repeat(45);
  assert.ok(near(typeTimes(plain).at(-1), 44 / 45, 1e-9));
  const q = text.indexOf('?');
  assert.ok(times[q + 1] - times[q] > 1 / 45 + 0.1, 'respiro depois da pergunta');
  assert.equal(typedCount(times, -1), 0);
  assert.equal(typedCount(times, 0), 1);
  assert.equal(typedCount(times, 99), text.length);
  // o balão e a voz de sílabas (storyHud) contam igual
  const sub = await import('../src/story/ui/subtitles.js').catch(() => null);
  if (sub?.charTimes) assert.deepEqual(typeTimes(text), sub.charTimes(text), 'mesma conta de subtitles.js');
  // some no dur do evento, mas nunca antes de terminar de digitar e dar tempo de ler
  const longT = sayTiming(text, 0.5);
  assert.ok(near(longT.hideAt, longT.typeEnd + READ_MIN, 1e-9));
  assert.ok(near(longT.goneAt, longT.hideAt + OUT_DUR, 1e-9));
  assert.equal(sayTiming(text, 9).hideAt, 9);
  assert.ok(sayTiming(text, undefined).hideAt > sayTiming(text, undefined).typeEnd + 1);
  assert.deepEqual(voiceMarks('Oi, eu!'), [0, 4]);
});

test('onomatopeias: até três na tela, cada uma com sua vida; no mesmo lugar, em escadinha', () => {
  const q = createOnomatoQueue({ max: 3, life: 1 });
  const a = q.push(0, { text: 'FLAP', sx: 0.3, sy: 0.3 }).item;
  const b = q.push(0.1, { text: 'FLAP', sx: 0.31, sy: 0.3 }).item;
  assert.ok(b.dx > a.dx && b.dy < a.dy, 'a segunda no mesmo lugar entra deslocada');
  const c = q.push(0.2, { text: 'CRASH!', sx: 0.8, sy: 0.7, dur: 2 }).item;
  assert.equal(c.dx, 0, 'longe das outras, no lugar pedido');
  const { evicted } = q.push(0.3, { text: 'BUM!', anchor: { x: 1, y: 0.5, z: 2 } });
  assert.deepEqual(evicted.map((e) => e.id), [a.id], 'a quarta tira a mais antiga');
  assert.deepEqual(q.active(1.15).map((e) => e.text), ['CRASH!', 'BUM!'], 'as de 1 s já sumiram');
  assert.deepEqual(q.active(2.5).map((e) => e.text), []);
  // cores vivas e inclinações que variam; o que veio no evento manda
  const d = q.push(3, { text: 'ZZZ', color: '#123456', rot: 12, size: 2, style: 'shake' }).item;
  assert.equal(d.color, '#123456');
  assert.equal(d.rot, 12);
  assert.equal(d.size, 2);
  assert.equal(d.style, 'shake');
  const e = q.push(3, { text: 'SNIF', style: 'qualquer' }).item;
  assert.equal(e.style, 'pop');
  assert.match(e.color, /^#[0-9A-F]{6}$/i);
  q.clear();
  assert.deepEqual(q.active(3), []);
});

// ---------------------------------------------------------------------------------------------- balão alinhado
// Pedido de 2026-11-11: "os balões estão meio desalinhados com as personagens". Com a câmera de verdade (lente dos
// closes, o viewOffset do quadro), a ponta do rabicho termina na cabeça de quem fala, o balão não cobre a cabeça e,
// empurrado por outro balão, o rabicho continua chegando até ela.
const RAD = { headTop: 0.48, Hc: { y: 0.388, z: 0.248 } };
/** A câmera do jogo (38° de padrão, 30° nos closes) num plano do diretor, com o viewOffset do quadro (como comic.js). */
function shotCam(g, layout, slot, from, look, fov = 30) {
  const cam = new THREE.PerspectiveCamera(fov, g.W / g.H, 0.1, 220);
  cam.position.set(from.x, from.y, from.z);
  cam.lookAt(look.x, look.y, look.z);
  cam.updateMatrixWorld();
  const { poly, bbox } = slotPoly(layout, slot, g, 1.5);
  const v = viewOffsetFor(bbox, g.W, g.H, cam.aspect);
  cam.setViewOffset(v.fullWidth, v.fullHeight, v.x, v.y, v.width, v.height);
  return { cam, poly };
}

test('balão com câmera de verdade: a projeção bate com o 3D do quadro, o rabicho termina na cabeça e o balão não a cobre', () => {
  const g = { W: 1280, H: 720 };
  // a Radhija em pé na origem, olhando para +z: o alto da cabeça e o centro dela
  const top = { x: 0, y: RAD.headTop + 0.02, z: RAD.Hc.z };
  const center = { x: 0, y: RAD.Hc.y, z: RAD.Hc.z };
  const cases = [
    // o close da cena da janela (a câmera a 1,2 m da cara, olhando para a cabeça), no quadro de cima do 3b
    ['close 3b/0', '3b', 0, { x: 0.25, y: 0.5, z: 1.2 + RAD.Hc.z }, { x: 0, y: RAD.headTop - 0.1, z: RAD.Hc.z }, 30],
    ['close 2v/1', '2v', 1, { x: 0.35, y: 0.62, z: 1.75 }, { x: 0, y: RAD.headTop - 0.18, z: RAD.Hc.z }, 30],
    ['aberto full', 'full', 0, { x: 1.4, y: 0.85, z: 2.6 }, { x: 0, y: 0.36, z: 0.2 }, 38],
  ];
  for (const [name, layout, slot, from, look, fov] of cases) {
    const { cam, poly } = shotCam(g, layout, slot, from, look, fov);
    // a projeção da camada de HQ é a mesma do three (com o viewOffset do quadro)
    const a = projectPoint(top, cam, g.W, g.H);
    const t3 = new THREE.Vector3(top.x, top.y, top.z).project(cam);
    assert.ok(near(a.x, ((t3.x + 1) / 2) * g.W, 1e-6) && near(a.y, ((1 - t3.y) / 2) * g.H, 1e-6), `${name}: projeção igual à do three`);
    assert.ok(a.front && a.ppm > 0);
    // o plano olha para a cabeça: ela cai dentro do quadro
    assert.ok(inside(poly, a.x, a.y, 0), `${name}: a cabeça (${a.x.toFixed(0)}, ${a.y.toFixed(0)}) dentro do quadro`);
    const c = projectPoint(center, cam, g.W, g.H);
    assert.ok(c.y > a.y, `${name}: o centro da cabeça fica embaixo do alto dela`);
    // o encaixe, com as mesmas contas da camada (gap pela altura do balão, folga pela cabeça na tela)
    const w = 230, h = 70;
    const gap = Math.min(40, Math.max(14, h * 0.42));
    const pb = bboxOf(poly);
    const clear = Math.min(Math.max(HEAD_HALF * a.ppm, gap * 0.8), Math.min(pb.w, pb.h) * 0.22);
    const p = placeBalloon({ anchor: a, w, h, poly, gap, clear });
    assert.equal(p.out, false, name);
    const miss = Math.hypot(p.tip.x - a.x, p.tip.y - a.y);
    assert.ok(miss <= tipGap(gap) + 0.5, `${name}: o rabicho termina a ${miss.toFixed(1)} px da cabeça`);
    // o balão não cobre a cabeça (nem o alto, nem o centro)
    for (const q of [a, c]) assert.ok(!(q.x > p.x && q.x < p.x + w && q.y > p.y && q.y < p.y + h), `${name}: o balão cobre a cabeça`);
    assert.ok(overlap({ x: p.x, y: p.y, w, h }, headBox(a.x, a.y, clear)) < w * h * 0.05, `${name}: o balão invade a cabeça`);
    // outro balão no lugar preferido: este vai para outro canto, e o rabicho ainda chega à cabeça
    const other = { x: p.x, y: p.y, w, h };
    const q2 = placeBalloon({ anchor: a, w, h, poly, gap, clear, others: [other] });
    assert.ok(overlap(other, { x: q2.x, y: q2.y, w, h }) < w * h * 0.2, `${name}: desviou do outro balão`);
    const miss2 = Math.hypot(q2.tip.x - a.x, q2.tip.y - a.y);
    assert.ok(miss2 <= tipGap(gap) + 0.5, `${name}: longe, o rabicho ainda termina na cabeça (${miss2.toFixed(1)} px)`);
    cam.clearViewOffset();
  }
});

// ---------------------------------------------------------------------------------------------- a cabeça no diretor
/** Um dublê do modelo v2: o objeto da dog, o osso do corpo e o da cabeça (pose de descanso como no desenho), a boca no osso
 * da cabeça e o marcador sobre o centro dela. O esqueleto é ligado com a dog na origem (como no modelo de verdade). */
function fakeDog({ headTop = RAD.headTop, rest = { y: RAD.Hc.y - 0.028, z: RAD.Hc.z - 0.018 }, hz = RAD.Hc.z } = {}) {
  const object = new THREE.Group();
  const inner = new THREE.Group();
  object.add(inner);
  const body = new THREE.Bone();
  body.position.set(0, 0.245, 0);
  const headBone = new THREE.Bone();
  headBone.position.set(0, rest.y - 0.245, rest.z);
  body.add(headBone);
  inner.add(body);
  inner.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([body, headBone]);
  const mouthSocket = new THREE.Object3D();
  mouthSocket.position.set(0, -0.02, 0.12);
  headBone.add(mouthSocket);
  const markerAnchor = new THREE.Object3D();
  markerAnchor.position.set(0, headTop + 0.14, hz);
  object.add(markerAnchor);
  return { object, body, headBone, skeleton, mouthSocket, markerAnchor };
}

test('diretor: head() segue o osso da cabeça (em pé, deitada, virada) e, sem modelo, mira o centro da cabeça', () => {
  const vis = { length: 0.6, headTop: RAD.headTop };
  const ctrl = { x: 1.2, z: -0.7, y: 0, yaw: 0.6, cfg: { visual: vis } };
  const dog = fakeDog();
  // a dog no lugar do controlador
  dog.object.position.set(ctrl.x, 0, ctrl.z);
  dog.object.rotation.y = ctrl.yaw;
  const scene = new THREE.Scene();
  scene.add(dog.object);
  const dir = createDirector({ ctx: /** @type {any} */ ({ ctrls: { radhija: ctrl }, cam: {}, dogs: { radhija: dog } }), emit: () => {} });
  // em pé: o alto da cabeça, por cima do centro dela
  dog.object.updateMatrixWorld(true);
  const want = dog.object.localToWorld(new THREE.Vector3(0, RAD.headTop, RAD.Hc.z));
  let h = dir.head('radhija', 0);
  assert.ok(Math.hypot(h.x - want.x, h.y - want.y, h.z - want.z) < 1e-6, `em pé: ${JSON.stringify(h)} × ${want.toArray()}`);
  assert.ok(near(dir.head('radhija', 0.12).y, want.y + 0.12, 1e-9), 'up: acima do alto da cabeça');
  // a cabeça desce (deitada na caminha): o ponto desce junto, sem precisar de nova matriz (head() atualiza)
  dog.headBone.position.y -= 0.2;
  h = dir.head('radhija', 0);
  assert.ok(near(h.y, want.y - 0.2, 1e-6), `deitada: ${h.y.toFixed(3)}`);
  // a cabeça vira para o lado: o ponto gira com ela
  dog.headBone.position.y += 0.2;
  dog.headBone.rotation.set(0.5, 0.9, 0);
  h = dir.head('radhija', 0);
  dog.headBone.updateWorldMatrix(true, false);
  const turned = dog.headBone.localToWorld(new THREE.Vector3(0, RAD.headTop - (RAD.Hc.y - 0.028), 0.018));
  assert.ok(Math.hypot(h.x - turned.x, h.y - turned.y, h.z - turned.z) < 1e-6, 'virada: o alto do crânio gira com o osso');
  // sem modelo (dublês): a conta da pose em pé, no centro da cabeça (não mais na nuca, a 32%)
  const bare = createDirector({ ctx: /** @type {any} */ ({ ctrls: { radhija: ctrl }, cam: {}, dogs: {} }), emit: () => {} });
  const b = bare.head('radhija', 0.1);
  const fwd = Math.hypot(b.x - ctrl.x, b.z - ctrl.z);
  assert.ok(Math.abs(fwd - RAD.Hc.z) < 0.01, `sem modelo, o centro da cabeça fica a ${fwd.toFixed(3)} m à frente`);
  assert.ok(near(Math.atan2(b.x - ctrl.x, b.z - ctrl.z), ctrl.yaw, 1e-9), 'na direção do rumo');
  assert.ok(near(b.y, RAD.headTop + 0.1, 1e-9));
  // o modelo longe da dog (fora da cena, outra fase): vale a conta
  dog.headBone.rotation.set(0, 0, 0);
  dog.object.position.set(40, 0, 40);
  const far = dir.head('radhija', 0);
  assert.ok(Math.hypot(far.x - ctrl.x, far.z - ctrl.z) < vis.length, 'modelo longe: a conta da pose em pé');
});
