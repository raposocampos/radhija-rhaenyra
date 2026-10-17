import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createResourceScope, ownResource, shareResource } from '../src/core/resources.js';
import { createScentView } from '../src/fx/scentView.js';
import { createScentField } from '../src/game/mechanics/scent.js';
import { createDebugDraw } from '../src/game/debugDraw.js';
import { createCarryItem } from '../src/game/puzzleKit.js';
import { createHeadlessGame } from './helpers/headless.mjs';
import { brassMat, mat } from '../src/world/util.js';

function disposals(resource) {
  let count = 0;
  resource.addEventListener('dispose', () => { count++; });
  return () => count;
}

test('recursos: libera exclusivos uma vez e preserva cache e textura emprestada', () => {
  const root = new THREE.Group();
  const scope = createResourceScope(root);
  const cachedTexture = new THREE.Texture();
  const cachedMaterial = shareResource(new THREE.MeshBasicMaterial({ map: cachedTexture }));
  const cachedGeometry = shareResource(new THREE.BoxGeometry());
  const privateTexture = cachedTexture.clone();
  const privateMaterial = cachedMaterial.clone();
  privateMaterial.map = privateTexture;
  const borrowed = new THREE.MeshBasicMaterial({ map: cachedTexture });
  const geometry = new THREE.BoxGeometry();
  const resources = [cachedTexture, cachedMaterial, cachedGeometry, privateTexture, privateMaterial, borrowed, geometry];
  const counts = resources.map(disposals);
  root.add(new THREE.Mesh(cachedGeometry, cachedMaterial), new THREE.Mesh(geometry, [privateMaterial, borrowed]), new THREE.Mesh(geometry, privateMaterial));
  scope.dispose();
  scope.dispose();
  assert.deepEqual(counts.map((count) => count()), [0, 0, 0, 1, 1, 1, 1]);
  assert.equal(root.children.length, 0);
});

test('recursos: coleta uniforms, extras de closure e objetos adicionados após build', () => {
  const root = new THREE.Group();
  const scope = createResourceScope(root);
  const closureTexture = ownResource(root, new THREE.Texture());
  const uniformTexture = new THREE.Texture();
  const material = new THREE.ShaderMaterial({ uniforms: { map: { value: uniformTexture }, maps: { value: [uniformTexture] } } });
  const geometry = new THREE.PlaneGeometry();
  const counts = [closureTexture, uniformTexture, material, geometry].map(disposals);
  // A coleta acontece na saída, incluindo objetos criados pelo puzzle.
  root.add(new THREE.Mesh(geometry, material));
  scope.dispose();
  assert.deepEqual(counts.map((count) => count()), [1, 1, 1, 1]);
});

test('recursos: factories reais de cache mantêm identidade e dependências entre duas fases', () => {
  const brass = brassMat();
  const texture = new THREE.Texture();
  const textured = mat('EST05_CACHE', () => new THREE.MeshBasicMaterial({ map: texture }));
  const counts = [brass, textured, texture].map(disposals);
  for (let i = 0; i < 2; i++) {
    const root = new THREE.Group();
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), brassMat()));
    root.add(new THREE.Mesh(new THREE.BoxGeometry(), mat('EST05_CACHE', () => { throw new Error('cache recriado'); })));
    createResourceScope(root).dispose();
    assert.equal(brassMat(), brass);
    assert.equal(mat('EST05_CACHE'), textured);
  }
  assert.deepEqual(counts.map((count) => count()), [0, 0, 0]);
});

test('recursos: preserva geometria global de Sprite e libera buffers de instância e skeleton', () => {
  const root = new THREE.Group();
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial());
  const spriteGeometry = disposals(sprite.geometry);
  const spriteMaterial = disposals(sprite.material);
  const instances = new THREE.InstancedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial(), 2);
  const instanceCount = disposals(instances);
  const skeleton = new THREE.Skeleton([new THREE.Bone()]);
  skeleton.computeBoneTexture();
  const boneTexture = disposals(skeleton.boneTexture);
  const skin = new THREE.SkinnedMesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  skin.skeleton = skeleton;
  root.add(sprite, instances, skin);
  createResourceScope(root).dispose();
  assert.equal(spriteGeometry(), 0);
  assert.equal(spriteMaterial(), 1);
  assert.equal(instanceCount(), 1);
  assert.equal(boneTexture(), 1);
  assert.equal(skeleton.boneTexture, null);
});

test('recursos: uma falha de dispose não deixa outros recursos ou raízes pendurados', () => {
  const scene = new THREE.Scene();
  const root = new THREE.Group();
  const debug = new THREE.Group();
  scene.add(root, debug);
  const texture = ownResource(root, new THREE.Texture());
  texture.addEventListener('dispose', () => { throw new Error('EST05_DISPOSE'); });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
  const geometryCount = disposals(mesh.geometry);
  const materialCount = disposals(mesh.material);
  debug.add(mesh);
  const scope = createResourceScope(root);
  assert.throws(() => scope.dispose(debug), AggregateError);
  assert.deepEqual([geometryCount(), materialCount()], [1, 1]);
  assert.equal(scene.children.length, 0);
  assert.doesNotThrow(() => scope.dispose(debug));
});

test('recursos: cheiro expirado libera esfera fora da árvore e mantém reset distinto de dispose', () => {
  const root = new THREE.Group();
  const view = createScentView(root);
  const scent = createScentField({ view });
  scent.addWind({ id: 'vento', x: 0, z: 0, dirX: 1, dirZ: 0 });
  scent.addNose({ id: 'nariz', x: 0, z: 0, onSmell() {} });
  scent.addDuct({ id: 'duto', inlet: { x: 100, z: 100, r: 1 }, outlet: { x: 100, z: 100, dirX: 1, dirZ: 0 } });
  scent.spawn({ x: 0, z: 0, life: 0.1 });
  scent.update(0.01);
  const cloud = view.group.children.find((child) => child.children[0]?.isMesh && child.children[0].geometry.type === 'SphereGeometry');
  const sphereCount = disposals(cloud.children[0].geometry);
  const cloudMaterialCount = disposals(cloud.children[0].material);
  const preview = view.group.getObjectByName('mira-do-bafo');
  const previewCounts = [preview.children[0], preview.children[0].geometry, preview.children[0].material, preview.children[1].geometry, preview.children[1].material].map(disposals);
  scent.update(1);
  assert.equal(cloud.parent, null);
  assert.equal(cloudMaterialCount(), 1);
  assert.equal(sphereCount(), 0, 'esfera pode ser usada por outra nuvem da mesma fase');
  scent.reset();
  assert.equal(scent.winds.length, 1);
  scent.dispose();
  scent.dispose();
  assert.equal(sphereCount(), 1);
  assert.equal(cloudMaterialCount(), 1);
  assert.deepEqual(previewCounts.map((count) => count()), [1, 1, 1, 1, 1]);
  assert.equal(root.children.length, 0);
  assert.deepEqual([scent.clouds.length, scent.winds.length, scent.noses.length, scent.ducts.length], [0, 0, 0, 0]);
});

test('recursos: debug reutiliza atributos e libera buffer antigo antes de aumentar capacidade', () => {
  const scene = new THREE.Scene();
  const world = { statics: [], dynamics: [] };
  const debug = createDebugDraw(scene, { WORLD: { bounds: { minX: -1, maxX: 1, minZ: -1, maxZ: 1 } }, NAV_EDGES: [] }, world, { nodes: new Map() });
  const ctrl = { x: 0, z: 0, r: 0.2, yaw: 0 };
  const brain = { path: [] };
  const path = debug.group.children.at(-1);
  brain.path = [{ x: 1, z: 1 }];
  debug.update({ dog: ctrl }, { dog: brain }, 'other');
  const first = path.geometry.getAttribute('position');
  let previousOnDispose = null;
  path.geometry.addEventListener('dispose', () => { previousOnDispose = path.geometry.getAttribute('position'); });
  debug.update({ dog: ctrl }, { dog: brain }, 'other');
  assert.equal(path.geometry.getAttribute('position'), first);
  assert.equal(previousOnDispose, null);
  brain.path = Array.from({ length: 8 }, (_, i) => ({ x: i, z: i }));
  debug.update({ dog: ctrl }, { dog: brain }, 'other');
  assert.equal(previousOnDispose, first, 'atributo antigo ainda está anexado ao liberar GPU');
  const grown = path.geometry.getAttribute('position');
  assert.notEqual(grown, first);
  brain.path = [];
  debug.update({ dog: ctrl }, { dog: brain }, 'other');
  assert.equal(path.geometry.getAttribute('position'), grown);
  assert.equal(path.geometry.drawRange.count, 0);
  createResourceScope(debug.group).dispose();
});

// Montagem pequena com objetos Three reais. Não usa stubProps/Proxy como
// evidência de ownership; mantém apenas engine sem GPU e dogs do helper.
async function resourceGame() {
  const builds = [];
  let globalMesh;
  const h = await createHeadlessGame({ mode: 'title', query: 'debug', configure({ levels, dogs }) {
    globalMesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    dogs.radhija.object.add(globalMesh);
    for (const level of levels) {
      level.build = ({ root }) => {
        const item = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial({ map: new THREE.Texture() }));
        root.add(item);
        const built = { props: { item }, root, counts: [item.geometry, item.material, item.material.map].map(disposals) };
        builds.push(built);
        return built;
      };
      level.createPuzzle = ({ props, dogs, root }) => {
        const carry = createCarryItem({ obj: props.item, dogs, scene: root, name: 'ball' });
        return { stage: 'start', total: 0, carrier: null, reset: () => carry.returnHome(), attach: () => carry.attach('radhija') };
      };
    }
  } });
  assert.equal(h.game.state, 'title');
  return { h, builds, globalMesh };
}

test('recursos: troca real de fase devolve item carregado e libera cenário/debug sem tocar dogs', async () => {
  const { h, builds, globalMesh } = await resourceGame();
  const globalCounts = [globalMesh.geometry, globalMesh.material].map(disposals);
  const oldDebug = h.engine.scene.children.find((object) => object.name === 'debug-draw');
  const debugCount = disposals(oldDebug.children[0].material);
  h.game.puzzle.attach();
  assert.equal(builds[0].props.item.parent, h.dogs.radhija.mouthSocket);
  assert.equal(await h.game.loadLevel(1, { mode: 'title' }), true);
  assert.deepEqual(builds[0].counts.map((count) => count()), [1, 1, 1]);
  assert.deepEqual(globalCounts.map((count) => count()), [0, 0]);
  assert.equal(globalMesh.parent, h.dogs.radhija.object);
  assert.equal(h.dogs.radhija.mouthSocket.children.length, 0);
  assert.equal(debugCount(), 1);
  assert.equal(oldDebug.parent, null);
  assert.equal(h.engine.scene.children.filter((object) => object.name.startsWith('fase:')).length, 1);
  assert.equal(h.engine.scene.children.filter((object) => object.name === 'debug-draw').length, 1);
});

test('recursos: import falho preserva recursos e permite retornar à fase intacta', async () => {
  const { h, builds } = await resourceGame();
  const puzzle = h.game.puzzle;
  h.levels[1].load = () => Promise.reject(new Error('EST05_IMPORT'));
  assert.equal(await h.game.loadLevel(1), false);
  assert.deepEqual(builds[0].counts.map((count) => count()), [0, 0, 0]);
  assert.equal(h.game.puzzle, puzzle);
  h.game.cancelLoad();
  assert.equal(h.game.state, 'title');
});

test('recursos: erro antes do retorno de build libera árvore parcial e extras declarados', async () => {
  const { h, builds } = await resourceGame();
  let partialCounts;
  h.levels[1].build = ({ root }) => {
    const extra = ownResource(root, new THREE.Texture());
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial());
    root.add(mesh);
    partialCounts = [extra, mesh.geometry, mesh.material].map(disposals);
    throw new Error('EST05_BUILD');
  };
  assert.equal(await h.game.loadLevel(1), false);
  assert.equal(h.game.state, 'load-error');
  assert.deepEqual(partialCounts.map((count) => count()), [1, 1, 1]);
  assert.deepEqual(builds[0].counts.map((count) => count()), [1, 1, 1]);
  assert.equal(h.game.built, null);
  assert.equal(h.game.puzzle, null);
  assert.equal(h.game.debug.world, null);
  assert.equal(h.game.debug.nav, null);
  assert.equal(h.game.debug.scent, null);
  assert.equal(h.engine.scene.children.some((object) => object.name.startsWith('fase:') || object.name === 'debug-draw'), false);
});

test('recursos: reset falho ainda recolhe item da boca e encerra a fase uma única vez', async () => {
  const { h, builds } = await resourceGame();
  h.game.puzzle.attach();
  let resets = 0;
  h.game.puzzle.reset = () => { resets++; throw new Error('EST05_RESET'); };
  assert.equal(await h.game.loadLevel(1), false);
  assert.equal(resets, 1);
  assert.deepEqual(builds[0].counts.map((count) => count()), [1, 1, 1]);
  assert.equal(h.dogs.radhija.mouthSocket.children.length, 0);
  assert.equal(h.game.built, null);
  assert.equal(h.game.puzzle, null);
});
