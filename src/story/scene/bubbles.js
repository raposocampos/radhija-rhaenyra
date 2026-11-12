// AS BOLHAS DE SABÃO do Modo História: umas poucas que passam flutuando perto da Rhaenyra, e ela corre atrás e tenta
// abocanhar uma (src/story/scene/lesada.js). Cada bolha é uma esfera com a película furta-cor (rosa, ciano e amarelo
// pintados por vértice, transparente), que deriva com o vento, sobe e desce de leve e treme; estoura (cresce num
// instante e some) quando a Rhaenyra abocanha, quando encosta em alguma coisa ou quando a vida dela acaba.
// Barato: uma geometria e um material para todas (criados na carga) e um punhado de malhas que se reaproveitam; nada
// alocado por quadro.
//
// createBubbles({ root, blocked }) → { spawn(p, v, r), update(dt), popNear(p, r) → posição | null, nearest(p) → bolha,
//   live, reset(), dispose() }
import * as THREE from 'three';

/** Quantas bolhas no máximo ao mesmo tempo. */
export const BUBBLES_MAX = 5;

/** A película: furta-cor, mais clara em cima (o reflexo do céu), por vértice. */
function filmGeometry() {
  const g = new THREE.SphereGeometry(1, 16, 12);
  g.deleteAttribute('uv');
  const P = g.attributes.position, col = new Float32Array(P.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < P.count; i++) {
    const x = P.getX(i), y = P.getY(i), z = P.getZ(i);
    const hue = (0.55 + 0.35 * y + 0.18 * Math.sin(3 * x + 2 * z)) % 1;
    c.setHSL((hue + 1) % 1, 0.75, 0.72 + 0.2 * Math.max(0, y));
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3));
  g.name = 'bolha';
  return g;
}

/**
 * @param {{ root: THREE.Object3D, blocked?: ((x: number, y: number, z: number) => boolean) | null }} o
 *   blocked: o ponto encosta em algum colisor (a bolha estoura).
 */
export function createBubbles({ root, blocked = null }) {
  const geometry = filmGeometry();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: 0.38, roughness: 0.06, metalness: 0.1, depthWrite: false });
  material.name = 'bolha';
  const group = new THREE.Group();
  group.name = 'historia:bolhas';
  root.add(group);
  const list = Array.from({ length: BUBBLES_MAX }, (_, i) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `bolha-${i + 1}`;
    mesh.visible = false;
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    group.add(mesh);
    return { mesh, on: false, pos: mesh.position, vx: 0, vy: 0, vz: 0, r: 0.04, life: 0, t: 0, pop: -1, ph: i * 1.7 };
  });
  /** Estoura: cresce num instante e some (pop: s desde o estouro). */
  const burst = (b) => { if (b.on && b.pop < 0) b.pop = 0; };

  return {
    group, material,
    /**
     * Uma bolha nova em p, derivando a (vx, vz) m/s, de raio r (m). → a bolha, ou null (todas no ar).
     * @param {{ x: number, y: number, z: number }} p @param {{ x: number, z: number }} v
     */
    spawn(p, v, r = 0.045, life = 6) {
      const b = list.find((x) => !x.on);
      if (!b) return null;
      b.on = true;
      b.pos.set(p.x, p.y, p.z);
      b.vx = v.x; b.vz = v.z; b.vy = 0;
      b.r = r;
      b.life = life;
      b.t = 0;
      b.pop = -1;
      b.mesh.scale.setScalar(r);
      b.mesh.visible = true;
      return b;
    },
    update(dt) {
      for (const b of list) {
        if (!b.on) continue;
        b.t += dt;
        if (b.pop >= 0) {
          // estourando: cresce e some em 0,12 s
          b.pop += dt;
          b.mesh.scale.setScalar(b.r * (1 + 3 * b.pop / 0.12));
          if (b.pop >= 0.12) { b.on = false; b.mesh.visible = false; }
          continue;
        }
        // deriva com o vento, sobe e desce devagar e balança de lado; treme (a película mole)
        b.vy += (Math.sin(b.t * 1.3 + b.ph) * 0.06 - b.vy) * Math.min(1, dt * 2);
        const sway = Math.sin(b.t * 2.1 + b.ph) * 0.08;
        const nx = b.pos.x + (b.vx + sway * b.vz) * dt, nz = b.pos.z + (b.vz - sway * b.vx) * dt;
        const ny = Math.max(0.12, b.pos.y + b.vy * dt);
        b.pos.set(nx, ny, nz);
        const w = 1 + 0.06 * Math.sin(b.t * 9 + b.ph);
        b.mesh.scale.set(b.r * w, b.r / w, b.r * w);
        if (b.t >= b.life || blocked?.(nx, ny, nz)) burst(b);
      }
    },
    /** Estoura a bolha mais perto de p, até r m. → onde ela estava, ou null. */
    popNear(p, r) {
      let best = null, bd = r;
      for (const b of list) {
        if (!b.on || b.pop >= 0) continue;
        const d = Math.hypot(b.pos.x - p.x, b.pos.y - p.y, b.pos.z - p.z);
        if (d < bd) { bd = d; best = b; }
      }
      if (!best) return null;
      burst(best);
      return { x: best.pos.x, y: best.pos.y, z: best.pos.z };
    },
    /** A bolha inteira mais perto de p (no chão), ou null. */
    nearest(p) {
      let best = null, bd = Infinity;
      for (const b of list) {
        if (!b.on || b.pop >= 0) continue;
        const d = Math.hypot(b.pos.x - p.x, b.pos.z - p.z);
        if (d < bd) { bd = d; best = b; }
      }
      return best;
    },
    /** Quantas estão no ar (sem contar as estourando). */
    get live() { let n = 0; for (const b of list) if (b.on && b.pop < 0) n++; return n; },
    list,
    reset() { for (const b of list) { b.on = false; b.mesh.visible = false; b.pop = -1; } },
    dispose() {
      group.removeFromParent();
      geometry.dispose();
      material.dispose();
    },
  };
}
