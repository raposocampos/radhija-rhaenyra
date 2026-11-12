// Estimativa rápida (só Node, sem navegador) dos triângulos da área do Modo História, por região e por balde do
// cenário, no mesmo critério do E2E de recursos (tools/scripts/measure-resources.mjs: a área inteira à vista, e o que
// faz sombra conta duas vezes). Uso: node tools/scripts/triangulos-historia.mjs. O teto do E2E é o da fase 10.
import * as THREE from 'three';
import { createStoryGame } from '../../test/helpers/historia.mjs';
const h = await createStoryGame({ query: 'stage=casa' });
h.run(0.2);
const L = h.layout;
const scene = h.engine.scene;
scene.updateMatrixWorld(true);
const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
const region = (c) => {
  if (c.x < L.LOT.x1 + 0.3 && c.z > L.LOT.z0 - 0.3) return c.x < L.HOUSE.x1 ? (c.z > 14.3 ? 'casa-ala-sul' : 'casa-norte') : 'quintal';
  if (c.z > L.WALL.maxZ + 0.2) return 'fora-sul';
  return 'resto';
};
const by = new Map(), byKey = new Map();
const v = new THREE.Vector3();
scene.traverse((o) => {
  if (!(o.isMesh || o.isInstancedMesh) || !o.visible) return;
  for (let p = o.parent; p; p = p.parent) if (!p.visible) return;
  const inst = o.isInstancedMesh ? o.count : 1;
  const t = tri(o.geometry) * inst * (o.castShadow ? 2 : 1);
  o.geometry.computeBoundingSphere();
  v.copy(o.geometry.boundingSphere.center).applyMatrix4(o.matrixWorld);
  const r = region(v);
  const slot = (o.name || '?').startsWith('mapa:') ? o.name.split(':')[1] : 'outros';
  const k = `${r} ${slot}`;
  by.set(k, (by.get(k) || 0) + t);
  by.set(r, (by.get(r) || 0) + t);
  if (r !== 'resto') { const n = `${r} ${o.name || o.parent?.name || '?'}`; byKey.set(n, (byKey.get(n) || 0) + t); }
});
console.log('TOTAL (com a sombra em dobro):', Math.round([...by.entries()].filter(([k]) => !k.includes(' ')).reduce((s, [, t]) => s + t, 0)));
for (const [k, t] of [...by.entries()].sort((a, b) => b[1] - a[1])) console.log(String(Math.round(t)).padStart(8), k);
console.log('--- maiores fora do resto');
for (const [k, t] of [...byKey.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(String(Math.round(t)).padStart(8), k);
process.exit(0);
