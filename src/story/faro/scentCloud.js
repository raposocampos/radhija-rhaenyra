// A nuvem de cheiro do Faro (pedido do usuário em 2026-11-09: "uma nuvenzinha de cheiro até o objetivo, ou até o
// mistério"). Enquanto o pulso do Faro está aceso, um rastro de nuvenzinhas sai do focinho de quem fareja e segue o
// caminho até a próxima pista (`lead`), na cor do cheiro, com uma onda de brilho correndo para o lado de lá: é só ir
// atrás. O rastro passa por onde o cheiro passaria (por baixo de porta fechada, pela portinha de gato): quando a porta
// está trancada, ele mostra para onde é, e abrir é com as duas.
//  - O caminho vem do grafo de navegação da área (NAV_NODES/NAV_EDGES), sem olhar o que está fechado.
//  - O desenho é uma malha só (instâncias de um quadrado virado para a câmera, mistura aditiva, sem textura e sem
//    pós-processamento): vale também no perfil mínimo.
// API: createScentCloud({ root, layout, world }) → { setLead(lead | null), update(dt, time, k, from), path(from, to),
//   info(), dispose() }.
import * as THREE from 'three';

const MAX = 96; // nuvenzinhas no máximo
const STEP = 0.36; // m entre uma e outra
const REACH = 16; // m de rastro à frente de quem fareja (o resto aparece andando)
const HEIGHT = 0.3; // m acima do chão
const ORDER = 906; // depois do véu do Faro

const VS = /* glsl */ `
varying vec2 vUv;
varying vec3 vCol;
void main() {
  vUv = uv;
  vCol = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #endif
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  float s = 1.0;
  #ifdef USE_INSTANCING
    c = instanceMatrix * c;
    s = length(instanceMatrix[0].xyz);
  #endif
  vec4 mv = modelViewMatrix * c;
  mv.xy += position.xy * s;
  gl_Position = projectionMatrix * mv;
}`;
const FS = /* glsl */ `
uniform float uK;
varying vec2 vUv;
varying vec3 vCol;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  float a = smoothstep(1.0, 0.0, d);
  gl_FragColor = vec4(vCol * (a * a * uK), 1.0);
  #include <colorspace_fragment>
}`;

/**
 * O caminho pelo grafo, sem restrições (o cheiro passa por baixo da porta): de `from` até `to`.
 * @returns {{ x: number, z: number }[]} pontos do caminho, começando em `from` e acabando em `to`
 */
export function scentRoute(layout, world, from, to) {
  const N = layout.NAV_NODES || {};
  const ids = Object.keys(N);
  if (!ids.length) return [{ x: from.x, z: from.z }, { x: to.x, z: to.z }];
  const clear = (a, b) => !world?.segmentClear || world.segmentClear(a.x, a.z, b.x, b.z, 0.08, 'small');
  if (Math.hypot(to.x - from.x, to.z - from.z) < 0.5 || clear(from, to)) return [{ x: from.x, z: from.z }, { x: to.x, z: to.z }];
  const adj = new Map(ids.map((id) => [id, []]));
  for (const [a, b] of layout.NAV_EDGES || []) {
    if (!N[a] || !N[b]) continue;
    const w = Math.hypot(N[a].x - N[b].x, N[a].z - N[b].z);
    adj.get(a).push([b, w]);
    adj.get(b).push([a, w]);
  }
  /** Os nós de onde `p` tem caminho livre, com o custo de chegar; sem nenhum, os dois mais perto (com um castigo). */
  const anchors = (p) => {
    const seen = ids.map((id) => ({ id, d: Math.hypot(N[id].x - p.x, N[id].z - p.z) })).sort((a, b) => a.d - b.d);
    const free = seen.filter((s) => s.d < 14 && clear(p, N[s.id])).slice(0, 5);
    return free.length ? free : seen.slice(0, 2).map((s) => ({ id: s.id, d: s.d + 4 }));
  };
  const dist = new Map();
  const prev = new Map();
  const open = [];
  for (const s of anchors(from)) { dist.set(s.id, s.d); open.push(s.id); }
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist.get(open[i]) < dist.get(open[bi])) bi = i;
    const id = open.splice(bi, 1)[0];
    for (const [nb, w] of adj.get(id)) {
      const nd = dist.get(id) + w;
      if (nd < (dist.get(nb) ?? Infinity)) {
        dist.set(nb, nd);
        prev.set(nb, id);
        if (!open.includes(nb)) open.push(nb);
      }
    }
  }
  let best = null;
  let bestD = Infinity;
  for (const g of anchors(to)) {
    const d = (dist.get(g.id) ?? Infinity) + g.d;
    if (d < bestD) { bestD = d; best = g.id; }
  }
  const chain = [];
  for (let id = best; id; id = prev.get(id)) chain.unshift({ x: N[id].x, z: N[id].z });
  // sem voltinha no começo e no fim: pula os nós que já dá para ir direto
  while (chain.length > 1 && clear(from, chain[1])) chain.shift();
  while (chain.length > 1 && clear(chain[chain.length - 2], to)) chain.pop();
  return [{ x: from.x, z: from.z }, ...chain, { x: to.x, z: to.z }];
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../types').LevelLayout, world?: import('../../types').CollisionWorld | null }} opts
 */
export function createScentCloud({ root, layout, world = null }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms: { uK: { value: 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'faro:nuvem-de-cheiro';
  mesh.frustumCulled = false;
  mesh.renderOrder = ORDER;
  mesh.count = 0;
  mesh.visible = false;
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
  root.add(mesh);

  /** @type {{ x: number, z: number, y?: number, color?: string } | null} */
  let lead = null;
  /** Os pontos do rastro de agora (um a cada STEP m), com a distância desde o começo. */
  let pts = [];
  let total = 0; // m de caminho até a pista (inteiro, não só o trecho desenhado)
  let refreshT = 0;
  const color = new THREE.Color('#FF8A2A');
  const tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();

  function rebuild(from) {
    pts = [];
    total = 0;
    if (!lead) return;
    const route = scentRoute(layout, world, from, lead);
    let acc = 0;
    let next = 0.35; // a primeira nuvenzinha um pouco à frente do focinho
    for (let i = 0; i + 1 < route.length; i++) {
      const a = route[i], b = route[i + 1];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      while (next <= acc + len && pts.length < MAX && next <= REACH) {
        const u = len > 1e-6 ? (next - acc) / len : 0;
        pts.push({ x: a.x + (b.x - a.x) * u, z: a.z + (b.z - a.z) * u, d: next });
        next += STEP;
      }
      acc += len;
    }
    total = acc;
  }

  /**
   * @param {number} dt @param {number} time @param {number} k 0..1: o quanto o Faro está aceso
   * @param {{ x: number, z: number } | null} from quem fareja (o rastro sai dela e acompanha quando ela anda)
   */
  function update(dt, time, k, from) {
    if (!(k > 0) || !lead || !from) {
      if (mesh.visible) { mesh.visible = false; mesh.count = 0; pts = []; }
      refreshT = 0;
      return;
    }
    refreshT -= dt;
    if (refreshT <= 0) {
      refreshT = 0.3;
      rebuild(from);
    }
    color.set(lead.color || '#FF8A2A');
    mat.uniforms.uK.value = k;
    const n = pts.length;
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      // a onda de brilho corre de quem fareja para a pista; as nuvenzinhas sobem e descem devagar, fora de compasso
      const wave = 0.5 + 0.5 * Math.sin(time * 3.4 - p.d * 1.9);
      const bob = Math.sin(time * 1.3 + i * 1.7) * 0.05;
      const side = Math.sin(i * 2.4) * 0.09;
      const size = (0.34 + 0.16 * ((i * 37) % 7) / 6) * (0.85 + 0.35 * wave);
      // some no fim do trecho desenhado quando o caminho continua além dele
      const tail = total > REACH + 0.5 ? Math.min(1, (REACH - p.d) / 2.5) : 1;
      const head = Math.min(1, p.d / 0.6);
      m4.compose(v.set(p.x + side, (lead.y ?? 0) * (total > 0 ? Math.min(1, p.d / total) : 0) + HEIGHT + bob, p.z + Math.cos(i * 1.9) * 0.09), q, sc.setScalar(size));
      mesh.setMatrixAt(i, m4);
      mesh.setColorAt(i, tmpC.copy(color).multiplyScalar((0.45 + 0.55 * wave) * tail * head));
    }
    mesh.count = n;
    mesh.visible = n > 0;
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }

  return {
    /** A próxima pista: para onde o rastro vai e a cor do cheiro (null apaga). */
    setLead(l) {
      const same = !!l && !!lead && l.x === lead.x && l.z === lead.z && l.color === lead.color;
      lead = l ? { ...l } : null;
      if (!same) refreshT = 0;
    },
    get lead() { return lead; },
    update,
    /** O caminho do cheiro entre dois pontos (para os testes e para o HUD). */
    path: (from, to) => scentRoute(layout, world, from, to),
    info() { return { on: mesh.visible, puffs: mesh.count, lead: lead ? { x: +lead.x.toFixed(2), z: +lead.z.toFixed(2), color: lead.color ?? null } : null, total: +total.toFixed(2) }; },
    mesh,
    dispose() {
      mesh.removeFromParent();
      geo.dispose();
      mat.dispose();
      mesh.dispose?.();
    },
  };
}
