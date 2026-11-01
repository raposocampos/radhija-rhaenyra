// Modo História: o cenário do Recanto das Patinhas montado DE VERDADE no Node (test/helpers/worldBuild.mjs e o jogo
// headless). As mesmas varreduras das fases (test/cenario.test.mjs e test/colisao-cenario.test.mjs):
//  - nenhuma face no mesmo plano de outra, sobreposta (z-fighting: listras tremendo quando a câmera anda);
//  - objetos na altura das dogs têm colisor (nenhuma dog fica com o corpo por cima de um vaso, de um poste, de um móvel);
//  - as peças que se mexem e as dogs começam fora de tudo; os props que o puzzle usa existem.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import STORY from '../src/story/areas/recanto/index.js';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { findCoplanarOverlaps } from './helpers/coplanar.mjs';
import { findLooseObstacles } from './helpers/obstaculos.mjs';
import { createStoryGame } from './helpers/historia.mjs';

const L = STORY.layout;
/** A área que a câmera mostra: o condomínio, a calçada e a rua do fechamento, do chão até o alto da caixa d'água. */
const REGION = { minX: L.WORLD.bounds.minX - 1, maxX: L.WORLD.bounds.maxX + 1, minZ: L.STREET.z1 - 0.5, maxZ: L.WORLD.bounds.maxZ + 1, minY: -0.02, maxY: 4.8 };

// Sem colisor de propósito: nome do desenho (ou de um pai) → motivo.
const SEM_COLISOR = [
  [/(grama|capim|florzinha|folhinha|folhas-soltas|petala|trevo)/, 'capim, florzinhas e folhas soltas: as dogs passam roçando'],
  [/^osso-|petisco/, 'petisco: as dogs passam por cima para pegar'],
  [/(poca|poça|tapete|capacho|mancha|sombra|decalque|entulho)/, 'coisas rentes ao chão (poças, tapete, capacho, o entulho da tempestade)'],
  [/(corda-do-balde|corda-no-chao)/, 'a corda do balde corre rente ao chão: a Radhija morde e puxa'],
  [/(meia-)/, 'meia perdida: o colecionável do capítulo'],
  [/(taboa|junco|vitoria-regia|ninfeia|lago-)/, 'plantas do lago: ficam na água, onde as dogs não entram'],
  [/(pena|borboleta|pombo|esquadrao|cenoura|fantasma|maos|tutora|porteiro|chuva)/, 'atores e efeitos das cenas (escondidos ou no alto)'],
];
const skipped = (o) => {
  for (let p = o; p; p = p.parent) if (p.name && SEM_COLISOR.some(([re]) => re.test(p.name))) return true;
  return false;
};

test('recanto: cenário sem faces coplanares sobrepostas (z-fighting)', async () => {
  const { root, built, dispose } = await buildLevelWorld(STORY);
  try {
    let meshes = 0;
    root.traverse((o) => { if (/** @type {any} */ (o).isMesh) meshes++; });
    assert.ok(meshes > 20, `o cenário foi montado (${meshes} malhas)`);
    console.log(`  recanto: ${meshes} malhas; ${built.env?.meshes ?? '?'} do kit; tempos ${JSON.stringify(built.env?.timings ?? {})}`);
    const found = findCoplanarOverlaps(root, { region: REGION });
    const report = found.map((f) => `\n  • ${f.a}\n    × ${f.b}\n    plano ${f.axis}${f.facing} = ${f.coord} m, ${(f.area * 1e4).toFixed(1)} cm², em ${JSON.stringify(f.at)}`).join('');
    assert.equal(found.length, 0, `faces no mesmo plano se sobrepondo (z-fighting):${report}`);
  } finally {
    dispose();
  }
});

test('recanto: objetos do cenário na altura das dogs têm colisor', async () => {
  // na etapa da cozinha (a abertura feita): portas fechadas, galho, lixeira e barquinho no lugar de começo
  const h = await createStoryGame({ query: 'stage=cozinha' });
  const root = h.engine.scene.getObjectByName('fase:recanto');
  assert.ok(root, 'o cenário da área está na cena');
  const dogs = ['radhija', 'rhaenyra'].map((name) => ({
    name, size: L.DOGS[name].size, r: L.DOGS[name].radius, yMax: L.DOGS[name].visual.headTop * 0.85,
  }));
  const found = findLooseObstacles(root, h.world, { dogs, skip: skipped });
  const fmt = (f) => {
    const s = f.suggest;
    const sug = s.shape === 'circle' ? `circle x ${s.x} z ${s.z} r ${s.r}` : `box x ${s.x} z ${s.z} hx ${s.hx} hz ${s.hz}`;
    return `\n  • (${f.center.x}, ${f.center.z}) desenho x[${f.foot.minX}, ${f.foot.maxX}] z[${f.foot.minZ}, ${f.foot.maxZ}] · y ${f.y[0]}–${f.y[1]}`
      + ` · entra ${f.depth} m (${f.sizes.join(', ')})\n    ${f.meshes.join('\n    ')}\n    sugestão: ${sug}`;
  };
  assert.equal(found.length, 0, `${found.length} desenho(s) na altura das dogs sem colisor${found.map(fmt).join('')}`);
});

test('recanto: os props que o puzzle usa existem e o cenário fica dentro do orçamento de desenhos', async () => {
  const { root, built, dispose } = await buildLevelWorld(STORY);
  try {
    const P = built.props;
    for (const k of ['kitchenDoor', 'kitchenHandle', 'serviceDoor', 'branch', 'windowLeaf', 'bowl', 'towerDoor', 'gateLeaf', 'line',
      'bin', 'boat', 'booth', 'bucket', 'ball', 'rope', 'storageDoor', 'socks', 'squad', 'carrot', 'humans', 'ghosts', 'rain', 'city']) {
      assert.ok(P[k], `prop ${k}`);
    }
    assert.equal(P.socks.length, 3, 'três meias');
    assert.ok(P.booth.windowAnchor && Number.isFinite(P.booth.windowAnchor.x), 'o ponto da janela da guarita (balões do ronco)');
    assert.equal(typeof P.boat.setPos, 'function');
    assert.equal(typeof P.rope.setPull, 'function');
    // nada de luz nova: a área usa o sol e o céu do jogo (luzes de verdade custam caro no celular)
    let lights = 0;
    root.traverse((o) => { if (/** @type {any} */ (o).isLight) lights++; });
    assert.equal(lights, 0, 'sem luzes próprias no cenário');
  } finally {
    dispose();
  }
});
