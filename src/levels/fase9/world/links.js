// FASE 9 · Ligações visíveis entre o que a Rhaenyra aciona e o que muda: um cabo (ou conduíte, ou haste) preso na
// parede ou no chão, com um pulso de luz que corre de uma ponta à outra quando o mecanismo dispara e depois fica
// aceso de leve (ligado). Usado no freio da escadinha (alavanca → trava da roda), no disjuntor (→ luzes e tomada do
// ventilador) e no botão do registro (→ grade do duto).
//   makeLink(points, { radius, color, glow, clips }) → { object, pulse(), setOn(on), update(dt) }
import * as THREE from 'three';
import { stdMat } from '../../../world/util.js';

const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));

/**
 * Cabo por uma polilinha (cantos arredondados de leve). `glow` é a cor do pulso e do "ligado".
 * @param {THREE.Vector3[]} points
 * @param {{ radius?: number, color?: string, glow?: string, clips?: number, clipColor?: string, metal?: boolean }} [opts]
 */
export function makeLink(points, { radius = 0.012, color = '#3a2a22', glow = '#ffd36a', clips = 0, clipColor = '#c99a45', metal = false } = {}) {
  const grp = new THREE.Group();
  grp.name = 'ligacao';
  /** @type {THREE.CurvePath<THREE.Vector3>} */
  const path = new THREE.CurvePath();
  for (let i = 0; i < points.length - 1; i++) path.add(new THREE.LineCurve3(points[i], points[i + 1]));
  const len = path.getLength();
  const segs = Math.max(8, Math.round(len * 24));
  const mat = new THREE.MeshStandardMaterial({ color, roughness: metal ? 0.35 : 0.7, metalness: metal ? 0.7 : 0, emissive: glow, emissiveIntensity: 0 });
  const tube = new THREE.Mesh(new THREE.TubeGeometry(path, segs, radius, 8, false), mat);
  tube.castShadow = false;
  tube.receiveShadow = true;
  grp.add(tube);
  // presilhas a cada trecho (ficam por cima do cabo)
  if (clips) {
    const clipGeo = new THREE.CylinderGeometry(radius * 1.9, radius * 1.9, radius * 2.6, 10);
    const clipMat = stdMat(clipColor, { roughness: 0.35, metalness: 0.6 });
    for (let k = 1; k <= clips; k++) {
      const u = k / (clips + 1);
      const c = new THREE.Mesh(clipGeo, clipMat);
      c.position.copy(path.getPointAt(u));
      c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), path.getTangentAt(u));
      grp.add(c);
    }
  }
  // o pulso: uma bolinha brilhante (sem luz de verdade) com um rastro curto
  const beadMat = new THREE.MeshBasicMaterial({ color: glow, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });
  const beads = [0, 1, 2].map((i) => {
    const b = new THREE.Mesh(new THREE.SphereGeometry(radius * (2.6 - i * 0.6), 10, 8), beadMat.clone());
    b.visible = false;
    grp.add(b);
    return b;
  });
  const S = { t: -1, on: false, lit: 0 };
  const speed = Math.max(1.6, len / 0.9); // atravessa em no máximo ~0,9 s
  return {
    object: grp,
    length: len,
    /** Dispara o pulso (da primeira para a última ponta). */
    pulse() { S.t = 0; },
    setOn(on) { S.on = !!on; },
    /** O pulso já chegou na outra ponta? (para o efeito do outro lado começar junto) */
    get arrived() { return S.t < 0 || S.t * speed >= len; },
    update(dt) {
      S.lit = ease(S.lit, S.on ? 1 : 0, dt, 3);
      let flash = 0;
      if (S.t >= 0) {
        S.t += dt;
        const d = S.t * speed;
        beads.forEach((b, i) => {
          const u = (d - i * 0.07) / len;
          b.visible = u > 0 && u < 1;
          if (!b.visible) return;
          b.position.copy(path.getPointAt(u));
          b.material.opacity = (1 - i * 0.3) * (u < 0.9 ? 1 : (1 - u) * 10);
        });
        if (d > len + 0.25) { S.t = -1; for (const b of beads) b.visible = false; }
        flash = Math.max(0, 1 - Math.abs(d / len - 1) * 1.5);
      }
      mat.emissiveIntensity = 0.12 * S.lit + 0.5 * flash;
    },
  };
}
