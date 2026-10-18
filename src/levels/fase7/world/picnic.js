// FASE 7 · O piquenique (a entrega): toalha xadrez com dobrinhas, cesta de vime com tampas e alça, garrafa
// térmica, pratinho com sanduíches e laranja, guardanapo. Os dois objetos ficam nos lugares marcados
// (PICNIC_SPOTS); com algo a caminho, um halo dourado pulsa em volta da toalha.
import * as THREE from 'three';
import { canvasTexture, contactShadow, radialTexture, rng, vnoise2, stdMat, rbox } from '../../../world/util.js';

/** Xadrez vermelho e branco de toalha de piquenique (tecido com trama). */
function ginghamTexture() {
  return canvasTexture(256, 256, (g, w, h) => {
    g.fillStyle = '#fbf3ea';
    g.fillRect(0, 0, w, h);
    const n = 8, s = w / n;
    for (let i = 0; i < n; i++) {
      if (i % 2) continue;
      g.fillStyle = 'rgba(214,64,58,0.62)';
      g.fillRect(i * s, 0, s, h);
      g.fillRect(0, i * s, w, s);
    }
    // trama
    const r = rng(5);
    for (let k = 0; k < 2600; k++) {
      g.fillStyle = r() < 0.5 ? 'rgba(255,255,255,0.08)' : 'rgba(80,30,20,0.06)';
      g.fillRect(r() * w, r() * h, 2, 1);
    }
  });
}
/** Vime trançado. */
function wickerTexture() {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#8a5a2e';
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 8) {
      for (let x = 0; x < w; x += 16) {
        const off = (y / 8) % 2 ? 8 : 0;
        const grd = g.createLinearGradient(x + off, y, x + off, y + 8);
        grd.addColorStop(0, '#d9a564'); grd.addColorStop(0.5, '#c48a4a'); grd.addColorStop(1, '#8f5d2f');
        g.fillStyle = grd;
        g.fillRect(x + off + 1, y + 1, 14, 6);
      }
    }
  });
}

/** @param {THREE.Group} root @param {import('../../../types').LevelLayout} layout */
export function buildPicnic(root, layout) {
  const P = layout.PICNIC, BK = layout.BASKET, SP = layout.PICNIC_SPOTS;
  const group = new THREE.Group();
  group.name = 'piquenique';
  // toalha: plano subdividido com dobrinhas e cantos levantados
  const clothGeo = new THREE.PlaneGeometry(P.hx * 2, P.hz * 2, 40, 28).rotateX(-Math.PI / 2);
  const cp = clothGeo.attributes.position;
  for (let i = 0; i < cp.count; i++) {
    const x = cp.getX(i), z = cp.getZ(i);
    const fold = Math.abs(Math.sin((x / P.hx) * Math.PI * 1.0)) < 0.06 ? 0.004 : 0; // vinco da dobra
    const wr = (vnoise2(x * 3.5, z * 3.5) - 0.5) * 0.012;
    const edge = Math.max(0, Math.max(Math.abs(x) / P.hx, Math.abs(z) / P.hz) - 0.9) * 0.08;
    cp.setY(i, 0.008 + Math.max(0, wr) + fold + edge * (vnoise2(x * 2, z * 2 + 4) > 0.5 ? 1 : 0.2));
  }
  clothGeo.computeVertexNormals();
  const tex = ginghamTexture();
  tex.repeat.set(2.2, 1.6);
  const clothMat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.85, side: THREE.DoubleSide, emissive: '#ffd27a', emissiveIntensity: 0 });
  const cloth = new THREE.Mesh(clothGeo, clothMat);
  cloth.position.set(P.x, 0, P.z);
  cloth.rotation.y = P.yaw;
  cloth.receiveShadow = true;
  cloth.name = 'toalha';
  group.add(cloth);
  // cesta de vime com duas tampas e alça
  const basket = new THREE.Group();
  basket.position.set(BK.x, 0, BK.z);
  basket.rotation.y = 0.3;
  const wicker = new THREE.MeshStandardMaterial({ map: wickerTexture(), roughness: 0.9 });
  const body = new THREE.Mesh(rbox(0.36, 0.22, 0.26, 0.04), wicker);
  body.position.y = 0.11;
  for (const s of [-1, 1]) {
    const lid = new THREE.Mesh(rbox(0.17, 0.03, 0.27, 0.012), wicker);
    lid.position.set(s * 0.09, 0.232, 0);
    lid.rotation.z = s * 0.06;
    basket.add(lid);
  }
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.012, 8, 24, Math.PI), new THREE.MeshStandardMaterial({ color: '#a8743c', roughness: 0.8 }));
  handle.position.y = 0.24;
  handle.rotation.y = Math.PI / 2;
  const napkin = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.12, 4, 3), new THREE.MeshStandardMaterial({ color: '#f2c94c', side: THREE.DoubleSide, roughness: 0.8 }));
  napkin.position.set(0.05, 0.255, 0.11);
  napkin.rotation.set(-1.0, 0.2, 0.1);
  basket.add(body, handle, napkin);
  const bsh = contactShadow(0.28, 0.22, 0.45);
  bsh.position.y = 0.01;
  basket.add(bsh);
  group.add(basket);
  // garrafa térmica
  const thermos = new THREE.Group();
  thermos.position.set(P.x - 0.12, 0.01, P.z - 0.32);
  const tb = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.22, 16), new THREE.MeshPhysicalMaterial({ color: '#4fa3d9', roughness: 0.3, clearcoat: 0.8 }));
  tb.position.y = 0.11;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.047, 0.047, 0.05, 16), stdMat('#f2ede2', { roughness: 0.4 }));
  cap.position.y = 0.242;
  thermos.add(tb, cap);
  group.add(thermos);
  // pratinho com sanduíches e laranja
  const plate = new THREE.Group();
  plate.position.set(P.x + 0.32, 0.012, P.z - 0.18);
  const dish = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.1, 0.018, 24), stdMat('#ffffff', { roughness: 0.25 }));
  dish.position.y = 0.009;
  plate.add(dish);
  for (const [x, z, ry] of [[-0.04, 0.0, 0.3], [0.05, 0.03, -0.5]]) {
    const sw = new THREE.Group();
    const bread = stdMat('#e9c48a', { roughness: 0.85 });
    for (const y of [0.026, 0.05]) {
      const sl = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.012, 3), bread);
      sl.position.y = y;
      sw.add(sl);
    }
    const fill = new THREE.Mesh(new THREE.CylinderGeometry(0.053, 0.053, 0.014, 3), stdMat('#7fbf5a', { roughness: 0.7 }));
    fill.position.y = 0.0375; // o recheio entra um pouco nas duas fatias
    sw.add(fill);
    sw.position.set(x, 0, z);
    sw.rotation.y = ry;
    plate.add(sw);
  }
  const orange = new THREE.Mesh(new THREE.SphereGeometry(0.035, 14, 10), stdMat('#f39a3d', { roughness: 0.6 }));
  orange.position.set(0.0, 0.05, -0.07);
  plate.add(orange);
  group.add(plate);
  group.traverse((/** @type {THREE.Mesh} */ o) => { if (o.isMesh && !o.userData.noShadow && o !== cloth) { o.castShadow = true; o.receiveShadow = true; } });
  // lugares dos objetos: a bolinha perto da cesta, o frisbee deitado na toalha
  const spots = {
    ball: new THREE.Group(),
    frisbee: new THREE.Group(),
  };
  spots.ball.position.set(SP.ball.x, layout.BALL.r + 0.008, SP.ball.z);
  spots.frisbee.position.set(SP.frisbee.x, 0.012, SP.frisbee.z);
  spots.frisbee.rotation.y = 0.5;
  group.add(spots.ball, spots.frisbee);
  // halo dourado no chão em volta da toalha (destaque com algo a caminho)
  const halo = new THREE.Mesh(new THREE.PlaneGeometry(P.hx * 3.2, P.hz * 3.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({
    map: radialTexture(), color: '#ffd27a', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  }));
  halo.position.set(P.x, 0.004, P.z);
  halo.rotation.y = P.yaw;
  halo.userData.noShadow = true;
  group.add(halo);
  root.add(group);
  let hl = 0, hlT = 0;
  /** @type {import('../../../types').Fase7Props['goal']} */
  const goal = {
    object: group,
    setHighlight(on) { hlT = on ? 1 : 0; },
    spot: (thing) => spots[thing],
  };
  return {
    goal,
    update(dt, t) {
      hl += (hlT - hl) * Math.min(1, dt * 3);
      const pulse = hl * (0.65 + 0.35 * Math.sin(t * 2.6));
      halo.material.opacity = 0.55 * pulse;
      clothMat.emissiveIntensity = 0.12 * pulse;
    },
    reset() {
      hl = hlT = 0;
      halo.material.opacity = 0;
      clothMat.emissiveIntensity = 0;
    },
  };
}
