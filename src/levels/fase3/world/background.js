// FASE 3 · Fundo noturno: prédios do condomínio com janelas acesas, silhuetas de árvores e a lua
// decorativa (disco com crateras + halo) no céu estrelado, visível no plano da tela inicial.
import * as THREE from 'three';
import { makeBuilding, makeTree } from '../../../world/background.js';
import { canvasTexture, radialTexture, rng } from '../../../world/util.js';

function moonTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    const grd = g.createRadialGradient(w * 0.45, h * 0.42, 10, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#fffaf0'); grd.addColorStop(0.8, '#e9ecf4'); grd.addColorStop(1, '#cdd3e2');
    g.fillStyle = grd; g.beginPath(); g.arc(w / 2, h / 2, w / 2 - 2, 0, Math.PI * 2); g.fill();
    const r = rng(3);
    for (let i = 0; i < 18; i++) {
      const x = w * (0.2 + r() * 0.6), y = h * (0.2 + r() * 0.6), rr = 6 + r() * 22;
      g.fillStyle = `rgba(150,160,185,${0.12 + r() * 0.2})`;
      g.beginPath(); g.arc(x, y, rr, 0, Math.PI * 2); g.fill();
    }
  }, { repeat: false });
}

export function buildBackground(layout) {
  const group = new THREE.Group();
  group.name = 'fundo-noite';
  const bdefs = [
    { x: -21, z: -7, w: 11, h: 14, d: 10, floors: 5, seed: 41, color: '#cfc2b0', ry: Math.PI / 2 - 0.1 },
    { x: -14, z: -19, w: 12, h: 18, d: 9, floors: 6, seed: 42, color: '#d8cab5', ry: 0.15 },
    { x: 10, z: -21, w: 14, h: 17, d: 9, floors: 6, seed: 43, color: '#d2c4b0', ry: -0.1 },
    { x: 20, z: -2, w: 10, h: 12, d: 12, floors: 4, seed: 44, color: '#dccfbd', ry: -Math.PI / 2 + 0.12 },
    { x: -20, z: 9, w: 9, h: 11, d: 9, floors: 4, seed: 45, color: '#cdbfa9', ry: Math.PI / 2 + 0.25 },
  ];
  for (const b of bdefs) {
    const m = makeBuilding(b);
    m.position.set(b.x, 0, b.z);
    m.rotation.y = b.ry;
    m.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false; o.receiveShadow = false;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const mm of mats) if (mm.emissiveMap) mm.emissiveIntensity = 1.8;
    });
    group.add(m);
  }
  const tdefs = [
    { x: -9.6, z: -1.0, height: 6.5, crown: 2.0, seed: 5 },
    { x: -10.5, z: 4.5, height: 6.0, crown: 1.9, seed: 3 },
    { x: -8.6, z: -6.8, height: 7.0, crown: 2.2, seed: 7 },
    { x: -12.5, z: -11.5, height: 7.5, crown: 2.4, seed: 9 },
    { x: 10.0, z: -5.0, height: 6.5, crown: 2.0, seed: 11 },
    { x: 10.6, z: 1.5, height: 5.5, crown: 1.8, seed: 13 },
    { x: 9.6, z: 6.5, height: 5.0, crown: 1.7, seed: 15 },
  ];
  for (const t of tdefs) {
    const tr = makeTree(t);
    tr.position.set(t.x, 0, t.z);
    tr.traverse((o) => { if (o.isMesh) { o.castShadow = false; } });
    group.add(tr);
  }
  // lua decorativa (no plano da tela inicial, acima das árvores a oeste)
  const moon = new THREE.Group();
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshBasicMaterial({ map: moonTexture(), color: new THREE.Color(2.2, 2.2, 2.3), fog: false, transparent: true }));
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#9fb4ff', transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
  glow.scale.set(7, 7, 1);
  moon.add(glow, disc);
  moon.position.set(-60, 26, -58);
  moon.lookAt(0, 0, 0);
  moon.scale.setScalar(2.6);
  moon.renderOrder = -5;
  group.add(moon);
  return { group, moon };
}
