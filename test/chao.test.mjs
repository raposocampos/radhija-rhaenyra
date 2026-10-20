// Chão e apoio das patas (etapa 4, retorno do usuário na prévia do #48):
//   · empurrando de pé, as patas da frente apoiam no DESENHO do objeto (pushRest.js), não na caixa de colisão (no
//     carrinho da fase 1 a caixa passa 6 cm das pontas e a beirada fica abaixo da altura das patas: elas ficavam no ar);
//   · as coisas baixas de pisar (placas de pressão, pedais, botões do chão) viram chão (ground.js): a dog sobe nelas, e
//     no modelo novo cada pata pisa em cima (antes as patas entravam no estrado).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { installBrowserStubs } from './helpers/headless.mjs';
import { buildLevelWorld } from './helpers/worldBuild.mjs';
import { withSeed } from './helpers/seeded.mjs';
import { LEVELS } from '../src/levels/index.js';
import { DEV_LEVELS } from '../src/levels/dev.js';
import { pushRest } from '../src/game/pushRest.js';
import { createGround, walkablesOf } from '../src/game/ground.js';

installBrowserStubs();
const DT = 1 / 60;
const level = (id) => [...LEVELS, ...DEV_LEVELS].find((d) => d.id === id);

test('empurrando de pé: as patas apoiam no desenho de cada objeto de empurrar (cenário real de cada fase)', async () => {
  const L = (id) => level(id).layout;
  // [fase, prop, meia largura em x da caixa de colisão]
  const cases = [
    ['fase1', 'cart', L('fase1').CART.halfSize.x],
    ['fase2', 'crate', L('fase2').CRATE.half],
    ['fase4', 'fan', L('fase4').FAN.half],
    ['fase5', 'pillowBox', L('fase5').BOX_PILLOWS.half],
    ['fase8', 'basket', L('fase8').BASKET.half],
    ['fase9', 'ladder', L('fase9').LADDER.half],
    ['fase9', 'globe', L('fase9').GLOBE.half],
    ['fase9', 'fan', L('fase9').FAN.half],
    ['fase9', 'planter', L('fase9').PLANTER.half],
    ['fase10', 'crate', L('fase10').CRATE.half],
  ];
  const report = [];
  const bad = [];
  const worlds = new Map();
  try {
    for (const [id, key, hx] of cases) {
      if (!worlds.has(id)) worlds.set(id, await buildLevelWorld(level(id)));
      const fx = worlds.get(id);
      const obj = fx.built.props[key].object;
      fx.root.updateMatrixWorld(true);
      const c = obj.getWorldPosition(new THREE.Vector3());
      // a Rhaenyra (quem empurra) de frente para a face oeste, com o peito encostado na caixa de colisão
      const near = 0.245;
      const at = { x: c.x - hx - near, z: c.z, yaw: Math.PI / 2 };
      const r = pushRest(obj, at, { near, pref: 0.36 * 1.133, scale: 1.133 });
      const tag = `${id} ${key}`;
      if (!r) {
        bad.push(`${tag}: os raios não acharam o desenho`);
        continue;
      }
      const top = Number.isFinite(r.top) ? `${(r.top * 100).toFixed(1)} cm` : 'alta';
      report.push(`${tag}: face a ${((r.gap - near) * 100).toFixed(1)} cm da caixa, beirada ${top}, patas a ${(r.y * 100).toFixed(1)} cm`);
      // o desenho não passa da caixa (o peito entraria nele) nem fica longe demais dela (as patas não alcançam)
      if (r.gap < near - 0.02) bad.push(`${tag}: o desenho passa ${((near - r.gap) * 100).toFixed(1)} cm da caixa de colisão`);
      if (r.gap > near + 0.2) bad.push(`${tag}: o desenho fica ${((r.gap - near) * 100).toFixed(1)} cm atrás da caixa`);
      if (Number.isFinite(r.top) && r.y > r.top + 1e-6) bad.push(`${tag}: patas acima da beirada`);
    }
  } finally {
    for (const fx of worlds.values()) fx.dispose();
  }
  console.log(`[chão] patas no desenho\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('empurrando de pé: no carrinho da fase 1 as patas vão em cima da beirada (ela fica abaixo da altura das patas)', async () => {
  const def = level('fase1');
  const fx = await buildLevelWorld(def);
  try {
    const { CART } = def.layout;
    const obj = fx.built.props.cart.object;
    fx.root.updateMatrixWorld(true);
    const c = obj.getWorldPosition(new THREE.Vector3());
    const r = pushRest(obj, { x: c.x - CART.halfSize.x - 0.245, z: c.z, yaw: Math.PI / 2 }, { near: 0.245, pref: 0.408, scale: 1.133 });
    assert.ok(r, 'achou o carrinho');
    // a tábua da ponta fica uns 5 cm para dentro da caixa e acaba a ~37,5 cm do chão
    assert.ok(r.gap > 0.245 + 0.02 && r.gap < 0.245 + 0.09, `face da ponta a ${((r.gap - 0.245) * 100).toFixed(1)} cm da caixa`);
    assert.ok(Number.isFinite(r.top) && Math.abs(r.top - 0.375) < 0.02, `beirada a ${(r.top * 100).toFixed(1)} cm`);
    assert.ok(r.top < 0.408 + 0.034, 'mais baixa que as patas: elas vão em cima');
  } finally {
    fx.dispose();
  }
});

test('placas de pisar (cenário real): viram chão; longe delas, o chão de sempre', async () => {
  const cases = [['fase2', 'PLANK'], ['fase3', 'PLATE_H'], ['fase6', 'PEDAL'], ['fase6', 'BARRIER_PLATE'], ['fase9', 'DAMPER_PLATE'], ['porcos', 'BUTTON']];
  const report = [];
  const bad = [];
  const worlds = new Map();
  try {
    for (const [id, key] of cases) {
      const def = level(id);
      if (!worlds.has(id)) worlds.set(id, await buildLevelWorld(def));
      const fx = worlds.get(id);
      fx.root.updateMatrixWorld(true);
      const ground = createGround(walkablesOf(fx.root));
      const P = def.layout[key];
      const h = ground.heightAt(P.x, P.z);
      const far = ground.heightAt(P.x + 3, P.z + 3);
      report.push(`${id} ${key}: ${(h * 100).toFixed(1)} cm (${ground.count} coisa(s) de pisar na fase)`);
      if (!(h > 0.01 && h < 0.2)) bad.push(`${id} ${key}: alto ${(h * 100).toFixed(1)} cm`);
      if (far !== 0) bad.push(`${id} ${key}: 3 m dela o chão está a ${(far * 100).toFixed(1)} cm`);
    }
  } finally {
    for (const fx of worlds.values()) fx.dispose();
  }
  console.log(`[chão] placas\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});

test('modelo novo atravessando uma placa: cada pata pisa em cima dela, o corpo sobe e nada fica dentro dela', async () => {
  const { createDogV2 } = await import('../src/dogs/v2/dog.js');
  // placa de 9 cm (como o pedal da fase 6) a 1 m da dog, marcada para pisar
  const scene = new THREE.Group();
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.09, 0.8), new THREE.MeshBasicMaterial());
  plate.position.set(0, 0.045, 1.2);
  plate.userData.walkable = true;
  scene.add(plate);
  scene.updateMatrixWorld(true);
  const ground = createGround(walkablesOf(scene));
  const PAWS = ['FLp', 'FRp', 'HLp', 'HRp'];
  const report = [];
  const bad = [];
  for (const kind of ['radhija', 'rhaenyra']) {
    withSeed(55, () => {
      const d = createDogV2(kind);
      d.setGround(ground.heightAt);
      let y = 0, z = 0;
      const m = { inside: Infinity, insideAt: '', onTop: 0, lift: 0 };
      for (let f = 0; f < 150; f++) {
        // como no jogo: anda 0,9 m/s para a frente; o chão do objeto vem suavizado do chão embaixo do centro
        z += 0.9 * DT;
        y += (ground.heightAt(0, z) - y) * (1 - Math.exp(-14 * DT));
        d.object.position.set(0, y, z);
        d.update(DT, { speed: 0.9, action: 'none' });
        d.object.updateMatrixWorld(true);
        m.lift = Math.max(m.lift, y);
        d.locomotion.legs.forEach((L, i) => {
          const p = d.bones.find((b) => b.name === PAWS[i]).getWorldPosition(new THREE.Vector3());
          const g = ground.heightAt(p.x, p.z);
          // a articulação da pata apoiada fica acima do chão embaixo dela (a almofadinha, uns 2 cm abaixo dela)
          if (!L.swing && p.y - g < m.inside) { m.inside = p.y - g; m.insideAt = `${PAWS[i]} a ${(p.y * 100).toFixed(1)} cm, chão ${(g * 100).toFixed(1)} cm`; }
          if (!L.swing && g > 0.05) m.onTop++;
        });
      }
      report.push(`${kind}: corpo subiu até ${(m.lift * 100).toFixed(1)} cm; pata apoiada mais baixa em relação ao chão embaixo dela: ${(m.inside * 1000).toFixed(1)} mm (${m.insideAt}); quadros de pata apoiada em cima da placa: ${m.onTop}`);
      if (m.lift < 0.08) bad.push(`${kind}: o corpo não subiu na placa (${(m.lift * 100).toFixed(1)} cm)`);
      if (m.onTop < 40) bad.push(`${kind}: as patas não pisaram em cima da placa (${m.onTop} quadros)`);
      // a articulação da pata apoiada fica ~2 cm acima do chão embaixo dela: menos que 5 mm, a pata entrou
      if (m.inside < 0.005) bad.push(`${kind}: uma pata apoiada entrou na placa (${m.insideAt})`);
    });
  }
  console.log(`[chão] modelo novo na placa\n  ${report.join('\n  ')}`);
  assert.deepEqual(bad, []);
});
