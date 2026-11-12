// Modo História: a CASA MAIOR e os quatro puzzles dela (4ª rodada, pedido do usuário em 2026-11-11: "precisamos de uma
// casa maior, com mais detalhes, pensar em puzzles que se enquadrem melhor na casa"), no jogo de verdade (headless,
// cenário do Recanto), com os controles de verdade e "ninguém atravessa nada" quadro a quadro:
//  - o ASPIRADOR ROBÔ acorda quando a porta da cozinha abre (a cena), anda pelo corredor sem encostar em ninguém, a
//    Radhija não entra; o latido da Rhaenyra, ou ela no caminho dele com o Fica, o manda para a base;
//  - a DESPENSA no escuro: a Radhija não entra; o impulso da Rhaenyra no interruptor acende a luz e a goteira aparece;
//  - a TOALHA: a Radhija morde e puxa; a LATA escorrega, cai (sem atravessar a mesa, as cadeiras nem as paredes) e dela
//    saem o petisco e a etiqueta (a pista);
//  - o PUFE até o sofá (a Rhaenyra), a subida da Radhija até o TRINCO pelo parapeito e a porta dos fundos empurrada pela
//    Rhaenyra: a saída para o quintal.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createStoryGame, storyInfo, intrusions, become, push, holdWorld, playScene, skipScene, examine } from './helpers/historia.mjs';

const near = (c, p, r) => Math.hypot(c.x - p.x, c.z - p.z) <= r;
/** A Rhaenyra pula na parede, na frente do botão (ou da alavanca) `spot`, e espera voltar ao chão. */
function boost(h, spot) {
  h.teleport('rhaenyra', spot.x + spot.nx * 0.44, spot.z + spot.nz * 0.44, Math.atan2(-spot.nx, -spot.nz));
  h.run(0.25);
  h.tap('Space');
  h.run(1.5);
}
/** Ninguém dentro de nada e o aspirador sem encostar em nenhuma dog (com a folga dele). */
function watcher(h, bad, tag) {
  const V = h.layout.VACUUM;
  return () => {
    for (const m of intrusions(h)) bad.add(`[${tag}] ${m}`);
    const v = storyInfo(h).casa.vac;
    for (const n of ['radhija', 'rhaenyra']) {
      const c = h.ctrls[n];
      if ((c.y || 0) > 0.3) continue;
      const d = Math.hypot(c.x - v.x, c.z - v.z) - (V.r + c.r);
      if (d < -0.005) bad.add(`[${tag}] o aspirador encostou na ${n} (${d.toFixed(3)} m)`);
    }
  };
}

test('casa: a porta da cozinha acorda o aspirador; a Radhija não entra no corredor; o latido da Rhaenyra o manda para a base', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = watcher(h, bad, 'aspirador');
  // antes: o aspirador dorme na base, com a porta da cozinha fechada (o interruptor ainda não vale)
  assert.equal(S().casa.vacuum, 'sleep');
  assert.ok(!h.puzzle.wallSpots().some((s) => s.id === 'interruptor-despensa'), 'com a porta fechada, o interruptor não vale');
  // a grade e o saco de ração: a Rhaenyra empurra o saco para o leste e pula na maçaneta
  h.puzzle.casa; // (a casa existe no puzzle)
  become(h, 'radhija');
  h.teleport('radhija', L.PET_PEDAL.x - 0.5, L.PET_PEDAL.z + 0.3, 0);
  h.run(0.2);
  h.walkTo(L.PET_PEDAL.x, L.PET_PEDAL.z, { timeout: 5, tol: 0.12, until: () => S().flags.petGateOpen });
  h.run(1.2);
  assert.ok(S().flags.petGateOpen, 'o pedal solta a grade');
  become(h, 'rhaenyra');
  const Sk = L.FOOD_SACK;
  h.teleport('rhaenyra', Sk.start.x - Sk.half - 0.26, Sk.start.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 8, () => S().flags.sackFree), `o saco sai da frente da maçaneta (${JSON.stringify(S().pushables.sack)})`);
  boost(h, L.KITCHEN_HANDLE);
  assert.ok(S().flags.kitchenOpen, 'a porta da cozinha abre');
  assert.equal(S().stage, 'casa', 'a casa continua: a porta dá no corredor');
  // a cena: o aspirador acorda e sai pelo corredor
  const r = playScene(h, { skip: false, each: watch });
  assert.equal(r.id, 'aspirador');
  assert.deepEqual(r.bad, []);
  assert.equal(S().casa.vacuum, 'patrol', 'depois da cena, ele anda pelo corredor');
  assert.equal(h.log('objective').at(-1)?.text, 'Um aspirador robô! A Radhija morre de medo dele');
  // a Radhija não entra no corredor: ela trava de medo (com a fala) e fica do lado da cozinha (a irmã longe da porta)
  h.teleport('rhaenyra', -14.6, 6.9, 0);
  become(h, 'radhija');
  const KD = L.KITCHEN_DOOR, kx = (KD.hinge.x + KD.latchPost.x) / 2;
  h.teleport('radhija', kx, KD.hinge.z - 0.8, 0);
  h.run(0.2);
  h.clearLog();
  holdWorld(h, [0, 1], 2.0, () => { watch(); return false; });
  assert.ok(h.ctrls.radhija.z < L.VACUUM.fear.z0, `a Radhija não entra no corredor (z ${h.ctrls.radhija.z.toFixed(2)})`);
  assert.ok(h.log('story:say').some((p) => p.who === 'radhija'), 'ela fala com medo');
  assert.ok(h.log('story:balloon').length + h.log('hint').length >= 1, 'o balão do medo ou a dica');
  // o aspirador anda alguns segundos sem sair da trilha do corredor
  const Co = L.SMALL_ROOMS.corredor;
  h.run(4, { until: () => { watch(); const v = S().casa.vac; assert.ok(v.x > Co.x0 + 0.2 && v.x < Co.x1 - 0.2 && v.z > Co.z0 + 0.2 && v.z < Co.z1 - 0.2, `no corredor (${v.x}, ${v.z})`); return false; } });
  // o latido fino da Radhija não adianta
  h.tap('KeyE');
  h.run(0.3);
  assert.notEqual(S().casa.vacuum, 'scared', 'o latido da Radhija não assusta');
  // o latido grosso da Rhaenyra, perto dele: susto e volta para a base
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', kx - 0.1, KD.hinge.z + 0.85, 0);
  h.run(0.2);
  h.run(8, { until: () => { watch(); const v = S().casa.vac; return Math.hypot(v.x - h.ctrls.rhaenyra.x, v.z - h.ctrls.rhaenyra.z) < L.VACUUM.barkR - 0.4; } });
  h.tap('KeyE');
  h.run(0.2);
  assert.equal(S().casa.vacuum, 'scared', 'o latido grosso assusta o aspirador');
  assert.ok(h.run(15, { until: () => { watch(); return S().casa.vacuum === 'docked'; } }), 'ele volta para a base');
  const D = L.VACUUM.dock;
  assert.ok(near(S().casa.vac, D, 0.02), 'e fica lá');
  assert.equal(h.puzzle.navFlags().vacuumAway, true);
  // agora a Radhija passa pelo corredor até a porta da despensa
  become(h, 'radhija');
  h.teleport('radhija', kx, KD.hinge.z - 0.6, 0);
  h.run(0.2);
  h.walkTo(-13.3, 13.4, { timeout: 10, tol: 0.25 });
  assert.ok(h.ctrls.radhija.z > 12.5, `a Radhija atravessa o corredor (z ${h.ctrls.radhija.z.toFixed(2)})`);
  watch();
  assert.deepEqual([...bad], [], 'ninguém atravessa nada, e o aspirador nunca encosta em ninguém');
});

test('casa: a Rhaenyra no caminho do aspirador, com o Fica, o manda de volta; sem o Fica ele desvia', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const bad = new Set();
  const watch = watcher(h, bad, 'fica');
  h.puzzle.casa.jump('aspirador');
  h.run(0.3);
  assert.equal(S().casa.vacuum, 'patrol');
  // sem o Fica, no meio da trilha: ele trombar e dar meia-volta (sem atravessar)
  become(h, 'rhaenyra');
  const LN = L.VACUUM.lane;
  h.teleport('rhaenyra', LN.x, 10.0, 0);
  h.run(0.2);
  assert.ok(h.run(12, { until: () => { watch(); return S().casa.bumps >= 1; } }), 'ele tromba na Rhaenyra parada');
  assert.equal(S().casa.vacuum === 'scared' || S().casa.vacuum === 'home', false, 'sem o Fica, uma trombada não basta');
  // com o Fica: a jogadora troca para a Radhija (na cozinha) e manda a irmã ficar (F); na próxima trombada, ele desiste
  become(h, 'radhija');
  h.tap('KeyF');
  h.run(0.1);
  assert.equal(h.game.stay.rhaenyra, true, 'a Rhaenyra no Fica');
  h.teleport('rhaenyra', LN.x, 10.0, 0);
  assert.ok(h.run(20, { until: () => { watch(); return S().casa.vacuum === 'scared' || S().casa.vacuum === 'home'; } }), 'com ela no caminho, ele desiste');
  assert.ok(h.run(15, { until: () => { watch(); return S().casa.vacuum === 'docked'; } }), 'e volta para a base');
  assert.deepEqual([...bad], []);
});

test('casa: a despensa no escuro; o interruptor alto acende a luz e a goteira aparece (pista escondida)', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  h.puzzle.casa.jump('despensa');
  h.run(0.3);
  assert.equal(h.log('objective').at(-1)?.text, 'A despensa está no escuro: acendam a luz');
  // a Radhija para na porta (medo do escuro)
  become(h, 'radhija');
  const DD = L.DOORWAYS.despensa, dz = (DD.z0 + DD.z1) / 2;
  h.teleport('radhija', DD.x + 0.6, dz, -Math.PI / 2);
  h.run(0.2);
  h.clearLog();
  holdWorld(h, [-1, 0], 1.5, () => false);
  assert.ok(h.ctrls.radhija.x > DD.x + 0.1, `a Radhija não entra no escuro (x ${h.ctrls.radhija.x.toFixed(2)})`);
  assert.ok(h.log('story:say').some((p) => p.who === 'radhija'), 'ela fala com medo do escuro');
  // a Rhaenyra entra (é corajosa) e volta
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', DD.x + 0.6, dz, -Math.PI / 2);
  h.run(0.2);
  h.walkTo(DD.x - 0.8, dz, { timeout: 4 });
  assert.ok(h.ctrls.rhaenyra.x < DD.x - 0.4, 'a Rhaenyra entra no escuro');
  // o pulo no chão não alcança; o impulso na parede, sim
  assert.ok(h.puzzle.wallSpots().some((s) => s.id === 'interruptor-despensa'), 'o interruptor vale para o impulso');
  boost(h, L.PANTRY.switch);
  assert.equal(S().casa.pantryLit, true, 'a luz acende');
  assert.ok(h.props.pantry.lit > 0.9, 'a despensa clareia');
  assert.ok(S().revealed.includes('goteira'), 'com a luz, a goteira brilha (dá para examinar)');
  assert.equal(h.puzzle.navFlags().pantryLit, true);
  // a Radhija entra, atravessa e examina a goteira
  become(h, 'radhija');
  h.teleport('radhija', DD.x + 0.6, dz, -Math.PI / 2);
  h.run(0.2);
  h.walkTo(L.DOORWAYS.despensaJantar.x - 0.7, dz, { timeout: 8 });
  assert.ok(h.ctrls.radhija.x < L.DOORWAYS.despensaJantar.x - 0.3, 'pela despensa, ela chega à sala de jantar');
  assert.ok(examine(h, 'goteira'), 'a goteira examinada vira pista');
  assert.deepEqual(intrusions(h), []);
});

test('casa: a Radhija puxa a toalha; a lata cai sem atravessar nada e dela saem o petisco e a etiqueta', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  // o jogo de verdade reseta ao começar: o reset do cenário solta a ponta da toalha da boca, e o da casa a religa
  h.puzzle.reset();
  h.game.debug.setStage('casa', 'radhija');
  h.puzzle.casa.jump('jantar');
  h.run(0.3);
  const T = L.DINING_TABLE, TC = L.TABLECLOTH, CK = L.COOKIE_TIN;
  /** A distância da boca da Radhija até o ponto da toalha mais perto dela. */
  const mouth = new THREE.Vector3();
  const clothGap = () => {
    h.dogs.radhija.mouthSocket.getWorldPosition(mouth);
    const p = h.props.tablecloth.object.geometry.attributes.position;
    let best = Infinity;
    for (let i = 0; i < p.count; i++) best = Math.min(best, Math.hypot(p.getX(i) - mouth.x, p.getY(i) - mouth.y, p.getZ(i) - mouth.z));
    return best;
  };
  const bad = new Set();
  /** A lata, a toalha e as dogs: nada atravessa a mesa, as cadeiras nem as paredes. */
  const tinBad = () => {
    for (const m of intrusions(h)) bad.add(m);
    // a caixa da lata (o corpo) no mundo: em cima da mesa, nunca abaixo do tampo; no chão, fora dos colisores
    const box = new THREE.Box3().setFromObject(h.props.cookieTin.body);
    const c = box.getCenter(new THREE.Vector3());
    const overTable = box.max.x > T.x - T.hx + 0.02 && box.min.x < T.x + T.hx - 0.02 && box.max.z > T.z - T.hz + 0.02 && box.min.z < T.z + T.hz - 0.02;
    if (overTable && box.min.y < T.h - 0.005) bad.add(`a lata dentro da mesa em (${c.x.toFixed(2)}, ${box.min.y.toFixed(2)}, ${c.z.toFixed(2)})`);
    if (box.max.y < 0.3) for (const k of h.world.contacts(c.x, c.z, CK.r * 0.7, 'large')) if (k.id !== 'lata' && k.depth > 0.02) bad.add(`a lata dentro de ${k.id}`);
    if (box.min.y < -0.01) bad.add(`a lata abaixo do chão (${box.min.y.toFixed(3)})`);
    // a toalha: nenhum ponto dela dentro do tampo
    const p = h.props.tablecloth.object.geometry.attributes.position;
    for (let i = 0; i < p.count; i += 7) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      if (Math.abs(x - T.x) < T.hx - 0.01 && Math.abs(z - T.z) < T.hz - 0.01 && y < T.h - 0.005) bad.add(`a toalha dentro da mesa em (${x.toFixed(2)}, ${y.toFixed(2)}, ${z.toFixed(2)})`);
      if (y < 0) bad.add('a toalha abaixo do chão');
    }
  };
  // o petisco ainda está escondido dentro da lata: não aparece nem dá para pegar
  const item = h.props.collectibles.find((c) => c.id === 'lata');
  assert.equal(item.object.visible, false, 'o petisco começa escondido na lata');
  // a Rhaenyra não puxa (traria a mesa junto)
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', TC.bite.x + 0.5, TC.bite.z - 0.05, -Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.3);
  assert.equal(S().tugWhat, null, 'a Rhaenyra não morde a toalha');
  h.teleport('rhaenyra', TC.bite.x + 1.3, TC.bite.z + 0.9, -Math.PI / 2);
  // a Radhija morde a ponta e puxa para trás
  become(h, 'radhija');
  h.teleport('radhija', TC.bite.x + 0.45, TC.bite.z + 0.05, -Math.PI / 2);
  h.run(0.3);
  assert.equal(h.puzzle.casa.prompt, 'Puxar a toalha');
  h.tap('KeyE');
  assert.ok(h.run(3, { until: () => !!h.puzzle.lockFor('radhija')?.pull }), `a toalha na boca (fase ${S().tug})`);
  assert.equal(S().tugWhat, 'toalha');
  const lock = h.puzzle.lockFor('radhija');
  let worstGap = 0;
  assert.ok(holdWorld(h, [lock.pull.ax, lock.pull.az], 6, () => {
    tinBad();
    if (h.puzzle.lockFor('radhija')?.pull && S().casa.tin === 'mesa') worstGap = Math.max(worstGap, clothGap());
    return S().casa.tin !== 'mesa';
  }), `puxando, a lata cai (toalha ${S().casa.cloth} m)`);
  assert.ok(worstGap < 0.05, `a ponta da toalha na boca o puxão inteiro (pior distância ${(worstGap * 100).toFixed(1)} cm)`);
  assert.ok(h.run(3, { until: () => { tinBad(); return S().casa.tin === 'chao'; } }), 'a lata para no chão');
  h.run(0.3);
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a toalha solta sozinha');
  assert.deepEqual([...bad], [], 'nada atravessa nada');
  // o petisco aparece no chão e a etiqueta brilha
  assert.equal(item.object.visible, true, 'o petisco saiu da lata');
  assert.ok(S().revealed.includes('etiqueta'), 'a etiqueta brilha');
  const before = h.puzzle.collected;
  h.walkTo(CK.treat.x, CK.treat.z, { timeout: 5 });
  assert.equal(h.puzzle.collected, before + 1, 'o petisco da lata');
  assert.ok(examine(h, 'etiqueta'), 'a etiqueta da cenoura vira pista');
  // a lata no chão colide (ninguém passa por dentro dela)
  assert.ok(h.world.contacts(CK.rest.x, CK.rest.z, 0.05, 'small').some((k) => k.id === 'lata'), 'a lata caída colide');
  assert.deepEqual(intrusions(h), []);
});

test('casa: o pufe até o sofá, a Radhija sobe até o trinco e a Rhaenyra empurra a porta dos fundos para o quintal', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  h.puzzle.casa.jump('sala');
  h.run(0.3);
  const bad = new Set();
  const watch = () => { for (const m of intrusions(h)) bad.add(m); };
  const PF = L.POUF, EX = L.HOUSE_EXIT, mz = (EX.z0 + EX.z1) / 2;
  assert.equal(h.log('objective').at(-1)?.text, 'O trinco da porta é alto: levem o pufe até o sofá');
  // trancada: a Rhaenyra empurra e não abre (o trinco lá em cima)
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', EX.x - 0.5, mz, Math.PI / 2);
  h.run(0.2);
  holdWorld(h, [1, 0], 1.2, () => false, ['ShiftLeft']);
  assert.ok(S().casa.exit < 0.05, 'trancada, a porta não abre');
  // a Radhija não sobe sem o pufe no lugar, e não empurra o pufe
  become(h, 'radhija');
  h.teleport('radhija', PF.start.x - PF.half - 0.3, PF.start.z, Math.PI / 2);
  h.run(0.2);
  h.tap('KeyE');
  h.run(0.2);
  assert.equal(S().casa.climb, null, 'sem o pufe no sofá, ela não sobe');
  holdWorld(h, [1, 0], 1.0, () => false, ['ShiftLeft']);
  assert.ok(Math.abs(S().casa.pouf.x - PF.start.x) < 0.02, 'a Radhija não empurra o pufe');
  h.teleport('radhija', -15.6, 16.2, Math.PI / 2);
  // a Rhaenyra empurra o pufe para o norte e depois para o leste, até encostar no sofá
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', PF.start.x, PF.start.z + PF.half + 0.26, Math.PI);
  h.run(0.2);
  assert.ok(push(h, [0, -1], 8, () => S().casa.pouf.z <= PF.minZ + 0.02), `o pufe vai para o norte (${JSON.stringify(S().casa.pouf)})`);
  watch();
  h.teleport('rhaenyra', S().casa.pouf.x - PF.half - 0.26, S().casa.pouf.z, Math.PI / 2);
  h.run(0.2);
  assert.ok(push(h, [1, 0], 10, () => S().casa.poufAtSofa), `o pufe encosta no sofá (${JSON.stringify(S().casa.pouf)})`);
  watch();
  assert.equal(h.log('objective').at(-1)?.text, 'A Radhija sobe pelo pufe até o trinco');
  // a Rhaenyra não sobe (grande demais)
  h.tap('KeyE');
  h.run(0.2);
  assert.equal(S().casa.climb, null, 'a Rhaenyra não sobe');
  h.teleport('rhaenyra', -14.0, 18.9, Math.PI / 2);
  // a Radhija sobe: pufe, assento, encosto, parapeito, a pata no trinco, e desce
  become(h, 'radhija');
  h.teleport('radhija', S().casa.pouf.x - 0.7, S().casa.pouf.z, Math.PI / 2);
  h.run(0.3);
  assert.equal(h.puzzle.casa.prompt, 'Subir');
  h.tap('KeyE');
  h.run(0.1);
  assert.notEqual(S().casa.climb, null, 'a Radhija sobe');
  let top = 0;
  assert.ok(h.run(10, { until: () => { top = Math.max(top, h.ctrls.radhija.y || 0); watch(); return S().casa.climb === null; } }), 'a subida termina');
  assert.ok(top > L.LIVING_SILL.y, `ela chegou ao parapeito (${top.toFixed(2)} m)`);
  assert.equal(S().casa.latchOpen, true, 'o trinco abre');
  assert.equal(h.puzzle.lockFor('radhija'), null, 'a Radhija volta ao controle');
  assert.equal(h.ctrls.radhija.y || 0, 0, 'no chão');
  // a Radhija não empurra a porta (pesada); a Rhaenyra sim, e a cena da saída leva ao quintal
  h.teleport('radhija', EX.x - 0.45, mz, Math.PI / 2);
  h.run(0.2);
  holdWorld(h, [1, 0], 1.0, () => false, ['ShiftLeft']);
  assert.ok(S().casa.exit < 0.05, 'a Radhija não abre a porta');
  h.teleport('radhija', EX.x - 1.4, mz - 0.6, Math.PI / 2);
  become(h, 'rhaenyra');
  h.teleport('rhaenyra', EX.x - 0.5, mz, Math.PI / 2);
  h.run(0.2);
  assert.ok(holdWorld(h, [1, 0], 4, () => !!S().scene, ['ShiftLeft']), 'destrancada, a Rhaenyra empurra a porta');
  skipScene(h, 'portaFundos');
  assert.equal(S().stage, 'quintal');
  assert.equal(h.puzzle.navFlags().exitOpen, true);
  // as duas saem pela porta dos fundos
  h.walkTo(EX.x + 1.2, mz, { timeout: 6 });
  assert.ok(h.ctrls.rhaenyra.x > EX.x + 0.6, 'a Rhaenyra sai para o quintal');
  assert.deepEqual([...bad], [], 'ninguém atravessa nada');
});

test('casa: o Faro leva ao próximo passo da casa, e o ?stage=quintal deixa a casa toda resolvida', async () => {
  const h = await createStoryGame({ query: 'stage=casa' });
  const L = h.layout;
  const S = () => storyInfo(h);
  const leadAt = (step) => {
    if (step) h.puzzle.casa.jump(step);
    h.run(1.4);
    if (!S().faroMode?.on) h.tap('KeyV');
    h.run(0.4);
    const l = S().cloud.lead;
    h.tap('KeyV');
    h.run(0.2);
    return l;
  };
  become(h, 'rhaenyra');
  assert.ok(near(leadAt(null), { x: (L.PET_GATE.hinge.x + L.PET_GATE.latchPost.x) / 2, z: (L.PET_GATE.hinge.z + L.PET_GATE.latchPost.z) / 2 }, 0.1), 'no começo: a grade');
  for (const [step, want, what] of [['despensa', { x: L.PANTRY.switch.x + 0.12, z: L.PANTRY.switch.z }, 'o interruptor'], ['sala', { x: L.POUF.start.x, z: L.POUF.start.z }, 'o pufe'], ['porta', { x: L.HOUSE_EXIT.x - 0.3, z: (L.HOUSE_EXIT.z0 + L.HOUSE_EXIT.z1) / 2 }, 'a porta dos fundos']]) {
    h.game.debug.setStage('casa', 'rhaenyra');
    h.run(0.2);
    assert.ok(near(leadAt(step), want, 0.15), `${step}: a nuvem leva até ${what}`);
  }
  // a etapa do quintal: a casa inteira resolvida (o aspirador na base, a luz acesa, o trinco e a porta abertos)
  h.game.debug.setStage('quintal', 'radhija');
  h.run(0.3);
  const c = S().casa;
  assert.deepEqual({ v: c.vacuum, lit: c.pantryLit, latch: c.latchOpen, exit: c.exitOpen, sofa: c.poufAtSofa }, { v: 'docked', lit: true, latch: true, exit: true, sofa: true });
  assert.ok(h.ctrls.radhija.x > L.HOUSE_EXIT.x, 'as duas começam do lado de fora da porta dos fundos');
  assert.deepEqual(intrusions(h), []);
});
