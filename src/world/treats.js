// Ossinhos dourados (petiscos escondidos) de todas as fases: visual e animação de coleta num módulo só;
// cada fase só ajusta brilho e material. buildTreats(root, COLLECTIBLES, opts) → { list: CollectibleProp[], update(dt, t) }.
import * as THREE from 'three';
import { rng, canvasTexture, radialTexture, contactShadow } from './util.js';
import { boneGeometry } from './toys.js';

/** Estrelinha de brilho (sprite aditivo). */
export function starTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.2, 'rgba(255,240,200,0.7)'); grd.addColorStop(1, 'rgba(255,220,150,0)');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(255,250,235,0.95)';
    g.beginPath(); g.moveTo(32, 2); g.lineTo(35, 29); g.lineTo(62, 32); g.lineTo(35, 35); g.lineTo(32, 62); g.lineTo(29, 35); g.lineTo(2, 32); g.lineTo(29, 29); g.closePath(); g.fill();
  }, { srgb: false, repeat: false });
}

/**
 * @param {THREE.Object3D} root
 * @param {import('../types').Collectible[]} list
 * @param {{ glow?: number, glowPulse?: [number, number], shine?: [number, number], roughness?: number, metalness?: number,
 *   y?: number, starTex?: THREE.Texture }} [opts] glow: brilho próprio (0 = nenhum); glowPulse: [base, amplitude] da
 *   pulsação do brilho parado; shine: [base, lampejo] do emissivo do osso; y: altura do chão.
 */
export function buildTreats(root, list, {
  glow = 0.22, glowPulse = [glow * 0.8, glow * 0.35], shine = [0.15, 0.5], roughness = 0.5, metalness = 0.2, y = 0,
  starTex = starTexture(),
} = {}) {
  const geo = boneGeometry();
  const baseMat = new THREE.MeshStandardMaterial({ color: '#dba04f', roughness, metalness, emissive: '#ffb347', emissiveIntensity: 0 });
  const base = y;
  const items = list.map((c, i) => {
    // cada ossinho pode ficar numa altura própria (c.y: em cima de um deque, de uma prateleira…)
    const y = base + (c.y ?? 0);
    const y0 = y + 0.021;
    const grp = new THREE.Group();
    grp.name = `osso-${c.id}`;
    const r = rng(i + 3);
    const mat = baseMat.clone();
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    grp.add(mesh);
    const baseRot = r() * Math.PI;
    root.add(grp);
    const sh = contactShadow(0.11, 0.06, 0.45, y + 0.006);
    sh.position.x = c.x;
    sh.position.z = c.z;
    sh.rotation.y = baseRot;
    root.add(sh);
    const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, color: '#fff1c2', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    star.scale.setScalar(0.12);
    root.add(star);
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: radialTexture(), color: '#ffc46a', transparent: true, opacity: glow, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(0.32);
    halo.visible = glow > 0;
    root.add(halo);
    const st = { anim: -1, collected: false, phase: r() * 10 };
    return {
      id: c.id,
      object: grp,
      collect() { if (st.collected) return; st.collected = true; st.anim = 0; },
      reset() {
        st.collected = false;
        st.anim = -1;
        grp.visible = true;
        sh.visible = true;
        halo.visible = glow > 0;
        grp.position.set(c.x, y0, c.z);
        grp.rotation.set(0, baseRot, 0.06);
        grp.scale.setScalar(1);
        sh.material.opacity = 0.45;
        halo.position.set(c.x, y + 0.05, c.z);
        halo.material.opacity = glow;
        star.material.opacity = 0;
      },
      /** @param {number} dt @param {number} t */
      _update(dt, t) {
        if (st.anim >= 0) {
          st.anim += dt;
          const k = Math.min(1, st.anim / 0.55);
          grp.position.y = y0 + Math.sin(k * Math.PI) * 0.28;
          grp.rotation.y = baseRot + k * Math.PI * 3;
          const s = k < 0.35 ? 1 + k * 0.6 : Math.max(0, 1.21 * (1 - (k - 0.35) / 0.65));
          grp.scale.setScalar(s);
          sh.material.opacity = 0.45 * (1 - k);
          halo.material.opacity = glow * (1 - k);
          star.material.opacity = Math.sin(k * Math.PI) * 0.9;
          star.position.set(grp.position.x, grp.position.y + 0.05, grp.position.z);
          if (k >= 1) { grp.visible = false; sh.visible = false; halo.visible = false; st.anim = -1; star.material.opacity = 0; }
          return;
        }
        if (st.collected) return;
        const cyc = ((t + st.phase) % 4.2) / 4.2;
        const f = cyc < 0.12 ? Math.sin((cyc / 0.12) * Math.PI) : 0;
        star.material.opacity = f * 0.85;
        star.material.rotation = t * 0.8;
        star.scale.setScalar(0.07 + f * 0.07);
        star.position.set(c.x + 0.03, y + 0.07, c.z);
        mat.emissiveIntensity = shine[0] + f * shine[1];
        if (glow > 0) halo.material.opacity = glowPulse[0] + glowPulse[1] * Math.sin(t * 2 + st.phase);
        grp.position.y = y0 + Math.max(0, Math.sin(t * 2 + st.phase)) * 0.004;
      },
    };
  });
  for (const o of items) o.reset();
  return {
    list: items.map(({ id, object, collect, reset }) => ({ id, object, collect, reset })),
    /** @param {number} dt @param {number} t */
    update(dt, t) { for (const o of items) o._update(dt, t); },
  };
}
