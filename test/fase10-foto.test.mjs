// Fase 10: a foto do quadro do cantinho vem da rede no load() da fase, antes da montagem. O quadro nasce com a
// textura e o aquecimento da GPU na carga (engine.prepare) a leva junto com o resto. Antes, se a imagem chegasse
// depois do aquecimento, o programa do material com mapa e a textura só subiam na primeira vez que a dog entrava lá
// (E2E "Primeira passagem — fase 10": "1 programas compilados depois da carga / 1 texturas enviadas depois da carga").
// Arquivo próprio: a foto fica guardada no módulo entre as cargas, e cada arquivo de teste é um processo.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import fase10 from '../src/levels/fase10/index.js';
import layout from '../src/levels/fase10/layout.js';

// Imagens falsas: cada uma só termina de "baixar" quando o teste manda (load ou error).
/** @type {FakeImage[]} */
const requested = [];
class FakeImage extends EventTarget {
  width = 512;
  height = 640;
  #src = '';
  get src() { return this.#src; }
  set src(value) { this.#src = value; requested.push(this); }
}
installBrowserStubs();
const doc = /** @type {any} */ (globalThis.document);
const createElement = doc.createElement;
doc.createElementNS = (ns, name) => (name === 'img' ? new FakeImage() : createElement(name));

const ticks = async (n = 20) => { for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r)); };
/** O quadro: o plano do tamanho da foto, no grupo do cantinho. */
function photoMesh(root) {
  /** @type {THREE.Mesh | null} */
  let found = null;
  root.traverse((o) => {
    const g = /** @type {any} */ (o).geometry;
    if (g?.type === 'PlaneGeometry' && g.parameters.width === layout.SECRET.photo.w && g.parameters.height === layout.SECRET.photo.h) found = /** @type {THREE.Mesh} */ (o);
  });
  assert.ok(found, 'achou o quadro');
  return found;
}

test('fase 10: a foto do quadro chega no load(), e o quadro já nasce com a textura', async () => {
  const building = buildLevelWorld(fase10);
  await ticks();
  assert.equal(requested.length, 1, 'o load() pediu a foto');
  assert.match(requested[0].src, /img\/quintal-quadro\.jpg$/);
  let built = false;
  void building.then(() => { built = true; });
  await ticks();
  assert.equal(built, false, 'a montagem espera a foto');
  requested[0].dispatchEvent(new Event('load'));
  const world = await building;
  try {
    const material = /** @type {THREE.MeshBasicMaterial} */ (photoMesh(world.root).material);
    assert.ok(material.map, 'o material já tem o mapa na montagem (o aquecimento compila e envia junto)');
    assert.equal(material.map.image, requested[0]);
    assert.equal(material.map.colorSpace, THREE.SRGBColorSpace);
    assert.equal(material.color.getHexString(), 'ffffff');
  } finally {
    world.dispose();
  }
  // na próxima carga a foto já está guardada: não baixa de novo nem espera
  const again = await buildLevelWorld(fase10);
  try {
    assert.equal(requested.length, 1, 'não pediu a foto de novo');
    assert.equal(/** @type {THREE.MeshBasicMaterial} */ (photoMesh(again.root).material).map?.image, requested[0]);
  } finally {
    again.dispose();
  }
});

test('fase 10: sem a foto a tempo, a carga segue e ela entra quando chegar; falhando, a próxima carga tenta de novo', async () => {
  // um módulo novo do cantinho (sem a foto guardada)
  const secret = await import('../src/levels/fase10/world/secret.js?sem-foto');
  const before = requested.length;
  const t0 = Date.now();
  await secret.preloadSecret(30);
  assert.ok(Date.now() - t0 < 2000, 'o prazo solta a carga');
  assert.equal(requested.length, before + 1);
  const root = new THREE.Group();
  secret.buildSecret(root, layout);
  const material = /** @type {THREE.MeshBasicMaterial} */ (photoMesh(root).material);
  assert.equal(material.map, null, 'montou sem a foto');
  requested.at(-1).dispatchEvent(new Event('load'));
  await ticks();
  assert.equal(material.map?.image, requested.at(-1), 'a foto entra quando chega');

  const failing = await import('../src/levels/fase10/world/secret.js?falha');
  const loading = failing.preloadSecret(5000);
  await ticks();
  const first = requested.at(-1);
  first.dispatchEvent(new Event('error'));
  await loading;
  const root2 = new THREE.Group();
  failing.buildSecret(root2, layout);
  assert.equal(/** @type {THREE.MeshBasicMaterial} */ (photoMesh(root2).material).map, null, 'sem a foto, fica a moldura com o fundo claro');
  assert.notEqual(requested.at(-1), first, 'a montagem sem foto pediu de novo');
});
