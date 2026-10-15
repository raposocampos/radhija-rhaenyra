// FASE 3 · Operação Pantufa — cenário noturno (dono: Agente Cenário F3).
// API: buildWorld({ engine, root, layout, params }) → { props, seeThrough: Object3D[], update(dt, t), dispose() }
// Tudo é criado dentro de `root`. Props: docs/CONTRATO.md §6 (fase 3).
// Luzes: lua (sombra, do preset) + PointLights quentes sem sombra: mesa, gramado sul, lanterna H,
// lanterna L, brilho da pantufa, janela do cantinho, lago (7) + 1 SpotLight saindo da porta de vidro.
import * as THREE from 'three';
import { SUN_DIR } from '../../../world/util.js';
import { pondField, buildPond, buildBridge } from './pond.js';
import { buildGround } from './ground.js';
import { buildHouse } from './house.js';
import { buildGarden } from './garden.js';
import { createProps } from './props.js';
import { buildStringLights, buildFireflies } from './lights.js';
import { buildBackground } from './background.js';

/**
 * @param {import('../../../types').LevelBuildArgs} args
 * @returns {import('../../../types').LevelBuild<import('../../../types').Fase3Props>}
 */
export function buildWorld({ engine, root, layout }) {
  const timings = {};
  const T = (name, fn) => { const t0 = performance.now(); const r = fn(); timings[name] = Math.round(performance.now() - t0); return r; };
  const field = pondField(layout);
  const ground = T('ground', () => buildGround(layout, field));
  const pond = T('pond', () => buildPond(layout, field));
  const bridge = T('bridge', () => buildBridge(layout, field));
  const house = T('house', () => buildHouse(layout));
  const garden = T('garden', () => buildGarden(layout));
  const strings = T('strings', () => buildStringLights(layout));
  const flies = buildFireflies(layout, field);
  const bg = T('background', () => buildBackground(layout));
  if (typeof window !== 'undefined') window.__f3Timings = timings;
  root.add(ground.group, pond.group, bridge.group, house.group, garden.group, strings.group, flies.points, bg.group);

  // ------------------------------------------------ luz âmbar saindo da porta de vidro
  const D = layout.GLASS_DOOR, Z = layout.WORLD.houseWallZ;
  const doorSpot = new THREE.SpotLight('#ffb367', 7.0, 8.5, 0.95, 0.75, 1.4);
  doorSpot.position.set(D.x, 2.3, Z - 0.9);
  doorSpot.target.position.set(D.x + 0.2, 0, Z + 2.6);
  doorSpot.castShadow = false;
  root.add(doorSpot, doorSpot.target);
  // janela do cantinho (luz quente sobre a pedra leve)
  const nookLight = new THREE.PointLight('#ffb36a', 1.3, 3.4, 1.5);
  nookLight.position.set(-3.0, 1.35, -4.35);
  root.add(nookLight);
  // lago: luz quente dos cordões sobre a água/ponte/ilha
  const pondLight = new THREE.PointLight('#ffbd78', 2.2, 7.5, 1.4);
  pondLight.position.set(2.4, 2.1, -0.2);
  root.add(pondLight);

  // ------------------------------------------------ luzinhas no corrimão da ponte
  const bridgeBulbs = [];
  {
    const n = 15;
    const geo = new THREE.SphereGeometry(0.014, 8, 6);
    const im = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: '#ffffff' }), n * bridge.railCurves.length);
    const m4 = new THREE.Matrix4(), c = new THREE.Color('#ffd590').multiplyScalar(4.5);
    let k = 0;
    for (const curve of bridge.railCurves) {
      for (let i = 0; i < n; i++) {
        const p = curve.getPointAt((i + 0.5) / n);
        m4.makeTranslation(p.x, p.y - 0.035 - 0.012 * Math.sin(i * 2.1), p.z + (p.z > -0.6 ? 0.02 : -0.02));
        im.setMatrixAt(k, m4);
        im.setColorAt(k, c);
        if (i === 3 || i === 11) bridgeBulbs.push(p.clone().add(new THREE.Vector3(0, -0.04, 0)));
        k++;
      }
    }
    im.frustumCulled = false;
    root.add(im);
  }

  // ------------------------------------------------ props interativos
  const P = createProps(layout, field, { house, doorSpot });
  root.add(P.root);

  // ------------------------------------------------ reflexos no lago (até 16 fontes)
  const waterU = pond.water.material.uniforms;
  waterU.uMoonDir.value.copy(SUN_DIR);
  const staticSources = [
    ...strings.waterSamples,
    ...bridgeBulbs.map((p) => ({ pos: p, col: new THREE.Color('#ffd590'), k: 0.45 })),
    { pos: pondLight.position.clone(), col: new THREE.Color('#ffbd78'), k: 0.25 },
  ];
  const sources = [...P.lightsForWater, ...staticSources].slice(0, waterU.uLights.value.length);
  const tableL = garden.lights.table;
  const size = new THREE.Vector2();

  return {
    props: P.props,
    seeThrough: [garden.hedgeAB, garden.nook, P.props.gate.object],
    env: { field, ground, pond, bridge, house, garden, strings, timings },
    update(dt, t) {
      P.props.update(dt, t);
      sources.forEach((s, i) => {
        waterU.uLights.value[i].set(s.pos.x, s.pos.y, s.pos.z, s.k);
        waterU.uLightCol.value[i].copy(s.col);
      });
      // lamparina da mesa: chama tremendo
      const fl = 0.9 + 0.07 * Math.sin(t * 11.3) + 0.05 * Math.sin(t * 27.1 + 1.3);
      tableL.light.intensity = tableL.base * fl;
      tableL.flame.scale.set(1, 2.1 * fl, 1);
      engine.renderer.getDrawingBufferSize(size);
      flies.material.uniforms.uScale.value = size.y * 0.5;
    },
    dispose() {
      // texturas/materiais exclusivos desta montagem (geometrias o núcleo já libera)
      ground.mapTex?.dispose();
      pond.water.material.dispose();
      for (const m of Object.values(house.interiorMats)) { m.map?.dispose(); m.dispose(); }
    },
  };
}
