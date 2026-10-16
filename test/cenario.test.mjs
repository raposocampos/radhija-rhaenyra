// Cenário sem z-fighting: em TODAS as fases (registradas e de desenvolvimento), nenhuma face de uma peça
// pode ficar no mesmo plano de outra peça e se sobrepor a ela. Quando isso acontece a placa de vídeo
// alterna entre as duas conforme a câmera anda: listras ou uma "sombra" tremendo na superfície (foi o
// caso da terra das floreiras da fase 4, no mesmo plano da tampa da caixa de alvenaria).
// O cenário é montado DE VERDADE no Node (test/helpers/worldBuild.mjs) e varrido por
// test/helpers/coplanar.mjs. Para corrigir um achado: afaste uma das faces 2–4 mm (ou faça uma peça
// terminar dentro da outra); o relatório diz as duas peças, o plano e onde fica.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { findCoplanarOverlaps } from './helpers/coplanar.mjs';

/** A área que a câmera do jogo mostra: os limites da fase com folga, do chão até acima das paredes. */
function playRegion(layout) {
  const B = layout.WORLD.bounds;
  return { minX: B.minX - 1, maxX: B.maxX + 1, minZ: B.minZ - 1, maxZ: B.maxZ + 1, minY: -0.02, maxY: 3.2 };
}

test('detector de z-fighting: acha a terra no plano da tampa da caixa e aceita 3 mm de folga', () => {
  const make = (soilTop) => {
    const root = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.5, 1.3), new THREE.MeshStandardMaterial({ color: '#d98f6a' }));
    box.position.y = 0.25; // topo em 0,5 m
    const soil = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.02, 1.2), new THREE.MeshStandardMaterial({ color: '#5b3e2b' }));
    soil.position.y = soilTop - 0.01;
    root.add(box, soil);
    return root;
  };
  const bug = findCoplanarOverlaps(make(0.5));
  assert.equal(bug.length, 1, 'terra no mesmo plano da tampa: um achado');
  assert.equal(bug[0].axis, 'y');
  assert.ok(Math.abs(bug[0].coord - 0.5) < 1e-3 && bug[0].area > 0.5, JSON.stringify(bug[0]));
  assert.deepEqual(findCoplanarOverlaps(make(0.503)), [], '3 mm acima: sem achado');
  // decalques feitos para ficar por cima (polygonOffset / transparente sem depthWrite) não contam
  const root = make(0.5);
  root.children[1].material.polygonOffset = true;
  assert.deepEqual(findCoplanarOverlaps(root), []);
});

for (const def of [...LEVELS, ...DEV_LEVELS]) {
  test(`${def.id}: cenário sem faces coplanares sobrepostas (z-fighting)`, async () => {
    const { root } = await buildLevelWorld(def);
    let meshes = 0;
    root.traverse((o) => { if (/** @type {any} */ (o).isMesh) meshes++; });
    assert.ok(meshes > 5, `o cenário foi montado (${meshes} malhas)`);
    const found = findCoplanarOverlaps(root, { region: playRegion(def.layout) });
    const report = found.map((f) => `\n  • ${f.a}\n    × ${f.b}\n    plano ${f.axis}${f.facing} = ${f.coord} m, ${(f.area * 1e4).toFixed(1)} cm², em ${JSON.stringify(f.at)}`).join('');
    assert.equal(found.length, 0, `faces no mesmo plano se sobrepondo (z-fighting):${report}`);
  });
}
