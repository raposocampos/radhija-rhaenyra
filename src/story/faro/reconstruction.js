// Reconstrução (sistema novo do Modo História, docs/HISTORIA.md): num ponto marcado, o pulso do Faro mostra silhuetas
// translúcidas repetindo o que aconteceu ali, com uma animação gravada (chaves de tempo, posição, rumo e pose).
// As silhuetas usam um material só (branco-azulado, mistura aditiva, sem luz nem neblina): leem bem no perfil mínima.
// API: createReconstruction({ root, actors, dur }) → { play(), stop(), update(dt), active, done, t, group, dispose() }.
// Cada ator: { id, object (Object3D), keys: [{ t, x, y, z, yaw?, ...pose }], pose?(object, key, dt) } — o pose recebe a
// chave interpolada (bater asas, pegar a boia), como o setPose dos pombos.
import * as THREE from 'three';

/** O material das silhuetas (compartilhado por todas as reconstruções da área). */
export function ghostMaterial(color = '#CFE6FF', opacity = 0.5) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false,
  });
}

/** Troca todos os materiais de um objeto pelo das silhuetas (guarda os originais para dispose). */
export function ghostify(object, material) {
  object.traverse((o) => {
    if (o.isMesh || o.isSprite) {
      o.material = material;
      o.castShadow = false;
      o.receiveShadow = false;
      o.renderOrder = 906;
    }
  });
  return object;
}

const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return a + d * k;
}
/** Chave interpolada no tempo t (posição suave com smoothstep entre as chaves; números e booleanos da pose). */
export function sampleKeys(keys, t) {
  if (!keys.length) return null;
  if (t <= keys[0].t) return { ...keys[0] };
  for (let i = 0; i + 1 < keys.length; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const u = (t - a.t) / Math.max(1e-6, b.t - a.t);
      const k = u * u * (3 - 2 * u);
      const out = { ...a, t };
      for (const key of Object.keys(b)) {
        if (key === 't') continue;
        if (key === 'yaw') out.yaw = lerpAngle(a.yaw ?? 0, b.yaw ?? 0, k);
        else if (typeof a[key] === 'number' && typeof b[key] === 'number') out[key] = lerp(a[key], b[key], key === 'x' || key === 'y' || key === 'z' ? k : u);
        else out[key] = u < 0.5 ? a[key] : b[key];
      }
      return out;
    }
  }
  return { ...keys[keys.length - 1] };
}

/**
 * @param {{ root: THREE.Object3D, actors: { id: string, object: THREE.Object3D, keys: { t: number, [k: string]: any }[], pose?: (o: THREE.Object3D, key: any, dt: number) => void }[],
 *   dur?: number, fadeIn?: number, fadeOut?: number, material?: THREE.Material }} opts
 */
export function createReconstruction({ root, actors, dur = null, fadeIn = 0.35, fadeOut = 0.6, material = null }) {
  const group = new THREE.Group();
  group.name = 'reconstrucao';
  group.visible = false;
  root.add(group);
  const mat = material || ghostMaterial();
  const baseOpacity = /** @type {any} */ (mat).opacity ?? 0.5;
  for (const a of actors) group.add(a.object);
  const total = dur ?? Math.max(...actors.map((a) => a.keys[a.keys.length - 1]?.t ?? 0));
  const S = { t: -1, done: false, plays: 0 };

  function place(t, dt) {
    for (const a of actors) {
      const k = sampleKeys(a.keys, t);
      if (!k) continue;
      a.object.position.set(k.x, k.y, k.z);
      if (k.yaw !== undefined) a.object.rotation.y = k.yaw;
      a.object.visible = k.hidden !== true;
      a.pose?.(a.object, k, dt);
    }
  }

  return {
    play() {
      S.t = 0;
      S.done = false;
      S.plays++;
      group.visible = true;
      place(0, 0);
    },
    stop() {
      S.t = -1;
      group.visible = false;
    },
    update(dt) {
      if (S.t < 0) return;
      S.t += dt;
      const t = S.t;
      if (t >= total + fadeOut) {
        S.t = -1;
        S.done = true;
        group.visible = false;
        /** @type {any} */ (mat).opacity = baseOpacity;
        return;
      }
      const k = t < fadeIn ? t / fadeIn : t > total ? 1 - (t - total) / fadeOut : 1;
      /** @type {any} */ (mat).opacity = baseOpacity * (0.6 + 0.4 * k) * k;
      place(Math.min(t, total), dt);
    },
    get active() { return S.t >= 0; },
    get done() { return S.done; },
    get plays() { return S.plays; },
    get t() { return S.t; },
    get duration() { return total; },
    group,
    material: mat,
    // o grupo fica na árvore da área: o escopo de recursos (src/core/resources.js) libera os atores depois deste dispose
    dispose() {
      if (!material) mat.dispose();
    },
  };
}
