// Detector de "z-fighting": faces de malhas DIFERENTES no mesmo plano (alinhado aos eixos, ±tol) que se
// sobrepõem. A placa de vídeo não sabe qual desenhar e alterna entre as duas conforme a câmera anda: no
// jogo aparece como listras ou uma "sombra" tremendo (foi o caso da terra das floreiras da fase 4).
// Funciona com a cena de verdade (Node com dublês de canvas, ou no navegador).
//
//   const achados = findCoplanarOverlaps(root, { region });   // [{ a, b, axis, facing, coord, area, at }]
//
// Fica de fora o que não briga na tela:
// - faces viradas para baixo (-Y) ou para o norte (-Z): a câmera do jogo fica sempre acima do chão e ao
//   sul, olhando para o norte (essas faces só existem encostadas em paredes e no chão);
// - pares com o mesmo material ou materiais iguais (mesma cor, textura e acabamento: a briga não aparece);
// - decalques feitos para ficar por cima: material transparente sem depthWrite, polygonOffset, sem depthTest;
// - malhas invisíveis, instanciadas, linhas, pontos e sprites.
import * as THREE from 'three';

const AXES = ['x', 'y', 'z'];

/** O objeto e todos os pais estão visíveis? */
function visibleChain(o) {
  for (let p = o; p; p = p.parent) if (p.visible === false) return false;
  return true;
}

/** O material desenha por cima de propósito (decalque) ou nem escreve profundidade? */
function isOverlayMaterial(m) {
  if (!m || m.visible === false) return true;
  if (m.polygonOffset) return true;
  if (m.depthTest === false || m.colorWrite === false) return true;
  if (m.transparent && m.depthWrite === false) return true;
  return false;
}

/** Nome legível para o relatório: caminho de nomes até a raiz, cor do material e caixa da malha no mundo. */
const _box = new THREE.Box3();
function label(mesh, mat) {
  const names = [];
  for (let p = mesh; p && names.length < 4; p = p.parent) if (p.name) names.push(p.name);
  const col = mat?.color ? ` #${mat.color.getHexString()}` : '';
  _box.setFromObject(mesh);
  const f = (v) => v.toArray().map((x) => +x.toFixed(3)).join(', ');
  return `${names.reverse().join('>') || 'malha'} ${mesh.geometry?.type || ''}${col} [centro ${f(_box.getCenter(new THREE.Vector3()))} · tamanho ${f(_box.getSize(new THREE.Vector3()))}]`;
}

/**
 * Faces alinhadas aos eixos de todas as malhas sob `root`, agrupadas por (eixo, sentido).
 * @param {THREE.Object3D} root
 */
function collectFaces(root, normalTol, region) {
  /** @type {Map<string, any[]>} */
  const lists = new Map();
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3();
  const ab = new THREE.Vector3(), ac = new THREE.Vector3(), n = new THREE.Vector3();
  root.updateMatrixWorld(true);
  root.traverse((/** @type {any} */ o) => {
    if (!o.isMesh || o.isInstancedMesh || !visibleChain(o)) return;
    const geo = o.geometry;
    const pos = geo?.attributes?.position;
    if (!pos) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    const index = geo.index;
    const triCount = (index ? index.count : pos.count) / 3;
    const groups = geo.groups?.length ? geo.groups : [{ start: 0, count: triCount * 3, materialIndex: 0 }];
    const m4 = o.matrixWorld;
    for (const g of groups) {
      const mat = mats[g.materialIndex ?? 0] ?? mats[0];
      if (isOverlayMaterial(mat)) continue;
      const doubleSided = mat.side === THREE.DoubleSide;
      const end = Math.min(g.start + g.count, triCount * 3);
      for (let i = g.start; i + 2 < end + 1 && i + 2 < triCount * 3; i += 3) {
        const ia = index ? index.getX(i) : i, ib = index ? index.getX(i + 1) : i + 1, ic = index ? index.getX(i + 2) : i + 2;
        a.fromBufferAttribute(pos, ia).applyMatrix4(m4);
        b.fromBufferAttribute(pos, ib).applyMatrix4(m4);
        c.fromBufferAttribute(pos, ic).applyMatrix4(m4);
        n.crossVectors(ab.subVectors(b, a), ac.subVectors(c, a));
        const len = n.length();
        if (len < 2e-6) continue; // triângulo degenerado
        n.divideScalar(len);
        const k = Math.abs(n.x) > normalTol ? 0 : Math.abs(n.y) > normalTol ? 1 : Math.abs(n.z) > normalTol ? 2 : -1;
        if (k < 0) continue;
        const ax = AXES[k];
        const sign = Math.sign(n[ax]) * (mat.side === THREE.BackSide ? -1 : 1);
        const [u, v] = AXES.filter((q) => q !== ax);
        if (region) {
          const cx = (a.x + b.x + c.x) / 3, cy = (a.y + b.y + c.y) / 3, cz = (a.z + b.z + c.z) / 3;
          if (cx < region.minX || cx > region.maxX || cz < region.minZ || cz > region.maxZ || cy < region.minY || cy > region.maxY) continue;
        }
        const face = {
          c: (a[ax] + b[ax] + c[ax]) / 3, mesh: o, mat,
          u0: Math.min(a[u], b[u], c[u]), u1: Math.max(a[u], b[u], c[u]),
          v0: Math.min(a[v], b[v], c[v]), v1: Math.max(a[v], b[v], c[v]),
        };
        for (const s of doubleSided ? [1, -1] : [sign]) {
          if (k !== 0 && s < 0) continue; // virada para baixo (-Y) ou para o norte (-Z): a câmera nunca vê
          const key = `${ax}${s > 0 ? '+' : '-'}`;
          if (!lists.has(key)) lists.set(key, []);
          lists.get(key).push(face);
        }
      }
    }
  });
  return lists;
}

/** Assinatura do material: dois materiais iguais em tudo que aparece na tela não brigam visivelmente. */
const _sig = new WeakMap();
function matSig(m) {
  if (!_sig.has(m)) {
    const c = (x) => (x && x.isColor ? x.getHexString() : '');
    _sig.set(m, [m.type, c(m.color), c(m.emissive), m.map?.uuid ?? '', m.roughness ?? '', m.metalness ?? '', m.opacity, m.vertexColors].join('|'));
  }
  return _sig.get(m);
}

const rectArea = (f, g) => Math.max(0, Math.min(f.u1, g.u1) - Math.max(f.u0, g.u0)) * Math.max(0, Math.min(f.v1, g.v1) - Math.max(f.v0, g.v0));

/**
 * @param {THREE.Object3D} root
 * @param {{ tol?: number, minArea?: number, normalTol?: number, region?: { minX: number, maxX: number, minY: number, maxY: number, minZ: number, maxZ: number } }} [opts]
 *   tol: distância máxima entre os planos (m); minArea: sobreposição mínima para contar (m²);
 *   region: só faces com o centro dentro desta caixa (a área de jogo; o fundo distante fica de fora).
 */
export function findCoplanarOverlaps(root, { tol = 0.0015, minArea = 4e-4, normalTol = 0.9995, region = null } = {}) {
  const lists = collectFaces(root, normalTol, region);
  const found = new Map();
  for (const [key, faces] of lists) {
    // baldes de largura tol no eixo do plano; cada balde é comparado com ele mesmo e com o vizinho
    /** @type {Map<number, any[]>} */
    const buckets = new Map();
    for (const f of faces) {
      const q = Math.floor(f.c / tol);
      if (!buckets.has(q)) buckets.set(q, []);
      buckets.get(q).push(f);
    }
    for (const [q, here] of buckets) {
      const near = here.concat(buckets.get(q + 1) || []);
      // por malha
      /** @type {Map<any, any[]>} */
      const byMesh = new Map();
      for (const f of near) {
        if (!byMesh.has(f.mesh)) byMesh.set(f.mesh, []);
        byMesh.get(f.mesh).push(f);
      }
      if (byMesh.size < 2) continue;
      const meshes = [...byMesh.keys()];
      const box = (fs) => fs.reduce((r, f) => ({ u0: Math.min(r.u0, f.u0), u1: Math.max(r.u1, f.u1), v0: Math.min(r.v0, f.v0), v1: Math.max(r.v1, f.v1) }), { u0: Infinity, u1: -Infinity, v0: Infinity, v1: -Infinity });
      const boxes = new Map(meshes.map((m) => [m, box(byMesh.get(m))]));
      for (let i = 0; i < meshes.length; i++) {
        for (let j = i + 1; j < meshes.length; j++) {
          const A = byMesh.get(meshes[i]), B = byMesh.get(meshes[j]);
          if (rectArea(boxes.get(meshes[i]), boxes.get(meshes[j])) <= 0) continue;
          // grade espacial nas faces do menor conjunto
          const [small, big] = A.length < B.length ? [A, B] : [B, A];
          const cell = 0.25;
          /** @type {Map<string, any[]>} */
          const grid = new Map();
          for (const f of small) {
            for (let gu = Math.floor(f.u0 / cell); gu <= Math.floor(f.u1 / cell); gu++) {
              for (let gv = Math.floor(f.v0 / cell); gv <= Math.floor(f.v1 / cell); gv++) {
                const gk = `${gu},${gv}`;
                if (!grid.has(gk)) grid.set(gk, []);
                grid.get(gk).push(f);
              }
            }
          }
          let area = 0;
          let at = null;
          let pair = null;
          for (const f of big) {
            const seen = new Set();
            for (let gu = Math.floor(f.u0 / cell); gu <= Math.floor(f.u1 / cell) && area < minArea; gu++) {
              for (let gv = Math.floor(f.v0 / cell); gv <= Math.floor(f.v1 / cell) && area < minArea; gv++) {
                for (const g of grid.get(`${gu},${gv}`) || []) {
                  if (seen.has(g) || g.mat === f.mat || matSig(g.mat) === matSig(f.mat) || Math.abs(g.c - f.c) > tol) continue;
                  seen.add(g);
                  const ov = rectArea(f, g);
                  if (ov > 0) {
                    area += ov;
                    at = { u: (Math.max(f.u0, g.u0) + Math.min(f.u1, g.u1)) / 2, v: (Math.max(f.v0, g.v0) + Math.min(f.v1, g.v1)) / 2 };
                    pair = [f, g];
                  }
                }
              }
            }
            if (area >= minArea) break;
          }
          if (area < minArea) continue;
          const [f, g] = pair;
          const ax = key[0];
          const [u, v] = AXES.filter((x) => x !== ax);
          const id = [label(f.mesh, f.mat), label(g.mesh, g.mat)].sort().join(' × ') + ` @${key}`;
          if (found.has(id)) continue;
          found.set(id, {
            a: label(f.mesh, f.mat), b: label(g.mesh, g.mat), axis: ax, facing: key[1], coord: +f.c.toFixed(4),
            area: +area.toFixed(5), at: { [ax]: +f.c.toFixed(3), [u]: +at.u.toFixed(2), [v]: +at.v.toFixed(2) },
          });
        }
      }
    }
  }
  return [...found.values()];
}
