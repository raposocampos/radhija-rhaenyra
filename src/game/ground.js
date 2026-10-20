// Chão das dogs em cima de coisas baixas de pisar (placas de pressão, pedais, botões do chão): retorno do usuário,
// "é como se só existisse a colisão do chão" (a pata entrava no estrado do botão). O cenário marca o desenho dessas
// coisas com `userData.walkable = true` (conta até GROUND_MAX) ou com o alto máximo que conta, em metros (o encosto
// alto da caminha da fase 2); heightAt(x, z) é o alto do que está embaixo do ponto (0 = o chão), medido
// por um raio para baixo no desenho de agora (a placa que afunda ao ser pisada já vem afundada). Só as malhas contam
// (o brilho de destaque em sprite, sem câmera no raio, quebraria o raycast do three.js). Bordas altas e fofas (a das
// caminhas) levam também `userData.rim`: andando para elas a dog dá um pulinho por cima (rimAlong, game.js), em vez
// de passar a pata por cima da borda (retorno do usuário: as dogs atravessavam as caminhas).
import * as THREE from 'three';
import { shown, meshesOf } from './pushRest.js';

/** Mais alto que isto não é "coisa baixa de pisar" (a dog não sobe): o raio ignora. */
export const GROUND_MAX = 0.3;

/**
 * O alto do chão para o corpo de uma dog em (x, z), olhando para `yaw`: a média do que está embaixo das patas da frente
 * e das de trás (o tronco apoia nas duas pontas). Passando por cima de uma borda (a da caminha), o corpo sobe o quanto
 * as patas sobem, não até o alto da borda que passa embaixo da barriga; numa placa, sobe aos poucos, uma ponta de cada
 * vez. @param {{ heightAt(x: number, z: number): number }} ground @param {{ front: number, back: number }} body
 */
export function bodyGround(ground, x, z, yaw, body) {
  const sx = Math.sin(yaw), sz = Math.cos(yaw);
  const f = body.front * 0.8, b = body.back * 0.8;
  return (ground.heightAt(x + sx * f, z + sz * f) + ground.heightAt(x - sx * b, z - sz * b)) / 2;
}

/**
 * Pulinho por cima da borda de uma caminha: andando para ela (entrando ou saindo), a dog pula em vez de passar a pata
 * por cima. time: duração (s); look: quanto à frente das patas da frente a borda já conta (m, mais um tanto com a
 * velocidade); min: velocidade mínima (m/s).
 */
export const HOP = { time: 0.34, look: 0.06, min: 0.25 };

/**
 * O pulinho que a dog `c` dá agora por cima de uma borda à frente (ground.rimAlong), ou null. `gy`: o chão do corpo
 * agora; `goal`: aonde ela vai (a comemoração), se ele fica antes da borda ela não pula (senão, chegando perto da borda
 * por dentro, saía da caminha). O pulinho leva as patas de trás para além da borda; `g0`/`g1`: o chão do corpo de onde
 * sai e de onde pousa (no ar, o corpo vai de um ao outro, sem subir na borda).
 * @param {ReturnType<typeof createGround> | null} ground
 * @param {{ x: number, z: number, yaw: number, v: number, cfg: { body?: { front: number, back: number } } }} c
 * @param {number} gy @param {{ x: number, z: number } | null} [goal]
 */
export function planRimHop(ground, c, gy, goal = null) {
  const b = c.cfg.body;
  if (!ground?.rims || !b || !(c.v >= HOP.min)) return null;
  const dx = Math.sin(c.yaw), dz = Math.cos(c.yaw);
  const f = b.front * 0.8;
  const rim = ground.rimAlong(c.x, c.z, dx, dz, f, f + HOP.look + c.v * 0.06);
  if (!rim) return null;
  if (goal && (goal.x - c.x) * dx + (goal.z - c.z) * dz < rim.start + 0.05) return null;
  const dist = rim.end + b.back * 0.8 + 0.1;
  const g1 = bodyGround(ground, c.x + dx * dist, c.z + dz * dist, c.yaw, b);
  return {
    dx, dz, time: HOP.time, speed: Math.min(3.4, Math.max(1.2, dist / HOP.time)),
    height: Math.max(0.08, rim.top + 0.05 - (gy + g1) / 2), g0: gy, g1,
  };
}

/** Os desenhos marcados para pisar dentro de `root`. @param {THREE.Object3D | null} root */
export function walkablesOf(root) {
  /** @type {THREE.Object3D[]} */
  const out = [];
  root?.traverse((o) => {
    if (o.userData?.walkable) out.push(o);
  });
  return out;
}

/** @param {THREE.Object3D[]} objects */
export function createGround(objects) {
  const ray = new THREE.Raycaster();
  const from = new THREE.Vector3();
  const down = new THREE.Vector3(0, -1, 0);
  const box = new THREE.Box3();
  const sphere = new THREE.Sphere();
  /** @type {Map<THREE.Object3D, number>} até que altura cada malha conta como chão */
  const maxOf = new Map();
  /** @type {Set<THREE.Object3D>} malhas de borda (`userData.rim`, a da caminha): a dog pula por cima (rimAlong) */
  const rims = new Set();
  // cada desenho com o círculo (no chão) que o contém e as malhas dele: os longe nem entram no raio
  const items = objects.map((obj) => {
    obj.updateMatrixWorld(true);
    box.setFromObject(obj);
    box.getBoundingSphere(sphere);
    const meshes = meshesOf(obj);
    const w = obj.userData.walkable;
    const rim = !!obj.userData.rim;
    for (const m of meshes) {
      maxOf.set(m, Math.max(maxOf.get(m) ?? 0, typeof w === 'number' ? w : GROUND_MAX));
      if (rim) rims.add(m);
    }
    return { meshes, rim, x: sphere.center.x, z: sphere.center.z, r: sphere.radius };
  });
  const rimItems = items.filter((it) => it.rim);
  const TOP = Math.max(GROUND_MAX, ...maxOf.values());
  /** @type {THREE.Object3D[]} */
  const near = [];
  const top = { h: 0, rim: false };
  /** O que dá para pisar embaixo de (x, z): o alto (0 = o chão) e se é uma borda. */
  function topAt(x, z) {
    top.h = 0;
    top.rim = false;
    near.length = 0;
    for (const it of items) if (Math.hypot(x - it.x, z - it.z) < it.r + 0.02) near.push(...it.meshes);
    if (!near.length) return top;
    from.set(x, TOP + 0.5, z);
    ray.set(from, down);
    ray.far = TOP + 0.6;
    for (const h of ray.intersectObjects(near, false)) {
      if (h.point.y > top.h && h.point.y <= (maxOf.get(h.object) ?? GROUND_MAX) && shown(h.object)) {
        top.h = h.point.y;
        top.rim = rims.has(h.object);
      }
    }
    return top;
  }
  return {
    /** Alto (m) do que dá para pisar embaixo de (x, z); 0 no chão. */
    heightAt(x, z) {
      return topAt(x, z).h;
    },
    /**
     * Andando de (x, z) na direção unitária (dx, dz): a primeira borda que começa entre d0 e d1 m à frente → onde ela
     * começa e acaba (m; o fim é procurado até dMax) e o alto dela; null se nenhuma (longe de todas, sem raio).
     * @returns {{ start: number, end: number, top: number } | null}
     */
    rimAlong(x, z, dx, dz, d0, d1, dMax = d1 + 1.2) {
      if (!rimItems.length) return null;
      const mx = x + (dx * (d0 + d1)) / 2, mz = z + (dz * (d0 + d1)) / 2;
      if (!rimItems.some((it) => Math.hypot(mx - it.x, mz - it.z) < it.r + (d1 - d0) / 2 + 0.02)) return null;
      const step = 0.03;
      let start = -1, high = 0;
      for (let d = d0; d <= dMax + 1e-6; d += step) {
        const t = topAt(x + dx * d, z + dz * d);
        if (t.rim) {
          if (start < 0) start = d;
          if (t.h > high) high = t.h;
        } else if (start >= 0) return { start, end: d, top: high };
        else if (d > d1) return null;
      }
      return start >= 0 ? { start, end: dMax, top: high } : null;
    },
    /** Quantos desenhos dá para pisar (testes). */
    get count() { return items.length; },
    /** Quantas bordas (caminhas) há para pular. */
    get rims() { return rimItems.length; },
  };
}
