// A nuvem de cheiro do Faro (pedido do usuário em 2026-11-09: "uma nuvenzinha de cheiro até o objetivo, ou até o
// mistério"; mais bonita em 2026-11-11). Enquanto o Faro está aceso, um rastro de nuvenzinhas sai do focinho de quem
// fareja e anda pelo caminho até a próxima pista (`lead`), na cor do cheiro, com uma onda de brilho correndo para o
// lado de lá: é só ir atrás. Cada nuvenzinha tem gomos (três bolinhas encavaladas), um brilho por dentro puxado para
// cima, gira devagar e deriva com o vento; as da ponta (perto da pista) são maiores e mais fortes, e um tufo gira em
// volta da pista quando ela está no trecho desenhado. O rastro passa por onde o cheiro passaria (por baixo de porta
// fechada, pela portinha de gato): quando a porta está trancada, ele mostra para onde é, e abrir é com as duas.
//  - O caminho vem do grafo de navegação da área (NAV_NODES/NAV_EDGES), sem olhar o que está fechado; o começo dele
//    acompanha quem fareja a cada quadro (o resto é refeito a cada 0,3 s).
//  - O desenho é uma malha só (instâncias de um quadrado virado para a câmera, sem textura e sem pós-processamento):
//    vale também no perfil mínimo.
// API: createScentCloud({ root, layout, world }) → { setLead(lead | null), update(dt, time, k, from), path(from, to),
//   info(), dispose() }.
import * as THREE from 'three';

const MAX = 96; // nuvenzinhas no máximo
const STEP = 0.36; // m entre uma e outra
const START = 0.35; // m: a primeira nuvenzinha um pouco à frente do focinho
const REACH = 16; // m de rastro à frente de quem fareja (o resto aparece andando)
const HEIGHT = 0.3; // m acima do chão
const FLOW = 0.55; // m/s: as nuvenzinhas andam do focinho para a pista
const END_PUFFS = 5; // o tufo em volta da pista
const ORDER = 906; // depois do véu do Faro

// O tamanho e a rotação (em volta do eixo da tela) vêm da matriz da instância: cada nuvenzinha gira devagar e o
// ângulo também muda um pouco o tamanho dos gomos.
const VS = /* glsl */ `
varying vec2 vUv;
varying vec2 vScr;
varying vec3 vCol;
varying float vSeed;
void main() {
  vUv = uv;
  vCol = vec3(1.0);
  #ifdef USE_INSTANCING_COLOR
    vCol = instanceColor;
  #endif
  vec4 c = vec4(0.0, 0.0, 0.0, 1.0);
  float s = 1.0;
  float ang = 0.0;
  #ifdef USE_INSTANCING
    c = instanceMatrix * c;
    s = length(instanceMatrix[0].xyz);
    ang = atan(instanceMatrix[0].y, instanceMatrix[0].x);
  #endif
  vSeed = ang;
  float cs = cos(ang);
  float sn = sin(ang);
  vec2 q = vec2(cs * position.x - sn * position.y, sn * position.x + cs * position.y);
  vScr = q * 2.0;
  vec4 mv = modelViewMatrix * c;
  mv.xy += q * s;
  gl_Position = projectionMatrix * mv;
}`;
// A cor da instância leva o tom do cheiro e, no tamanho dela, o quanto a nuvenzinha aparece (a onda, o começo e o fim
// do rastro). Gomos com miolo claro (a luz vem de cima, na tela) e a beirada um tico mais escura (volume): lê bem no
// piso claro e no gramado (mistura normal, não aditiva).
const FS = /* glsl */ `
uniform float uK;
varying vec2 vUv;
varying vec2 vScr;
varying vec3 vCol;
varying float vSeed;
void main() {
  vec2 p = (vUv - 0.5) * 2.0;
  float m = max(vCol.r, max(vCol.g, vCol.b));
  vec3 hue = m > 1e-4 ? vCol / m : vec3(1.0);
  float h = fract(sin(vSeed * 12.9898) * 43758.5453);
  float d = min(
    min(length(p - vec2(0.3, 0.02)) / (0.58 + 0.08 * h), length(p - vec2(-0.16, 0.27)) / (0.54 - 0.06 * h)),
    min(length(p - vec2(-0.14, -0.26)) / (0.5 + 0.06 * h), length(p) / 0.66)
  );
  float a = smoothstep(1.0, 0.55, d);
  float core = smoothstep(0.8, 0.0, length(vScr - vec2(-0.08, 0.2)));
  float rim = smoothstep(0.5, 1.0, d) * a;
  vec3 col = mix(hue, vec3(1.0), 0.58 * core) * (1.0 - 0.2 * rim);
  gl_FragColor = vec4(col, a * min(1.0, m) * 0.88 * uK);
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

/** 0 → 1 suave entre a e b. */
function smooth(a, b, x) {
  const t = b > a ? Math.min(1, Math.max(0, (x - a) / (b - a))) : x >= b ? 1 : 0;
  return t * t * (3 - 2 * t);
}
/** Um número de 0 a 1 que é sempre o mesmo para a mesma nuvenzinha. */
function hash(n) {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../types').LevelLayout, world?: import('../../types').CollisionWorld | null }} opts
 */
export function createScentCloud({ root, layout, world = null }) {
  const geo = new THREE.PlaneGeometry(1, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VS, fragmentShader: FS, uniforms: { uK: { value: 0 } },
    transparent: true, depthWrite: false, fog: false, toneMapped: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, MAX);
  mesh.name = 'faro:nuvem-de-cheiro';
  mesh.frustumCulled = false;
  mesh.renderOrder = ORDER;
  mesh.count = 0;
  mesh.visible = false;
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(MAX * 3).fill(1), 3);
  mesh.instanceColor.setUsage(THREE.DynamicDrawUsage);
  root.add(mesh);

  /** @type {{ x: number, z: number, y?: number, color?: string } | null} */
  let lead = null;
  /** @type {{ x: number, z: number, d: number }[]} o caminho de agora até a pista, com a distância desde quem fareja */
  let route = [];
  let total = 0; // m de caminho até a pista (inteiro, não só o trecho desenhado)
  let refreshT = 0;
  const color = new THREE.Color('#FF8A2A');
  const tmpC = new THREE.Color();
  const m4 = new THREE.Matrix4();
  const v = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const sc = new THREE.Vector3();
  const AXIS = new THREE.Vector3(0, 0, 1);
  const P = { x: 0, z: 0 };

  function rebuild(from) {
    route = [];
    total = 0;
    if (!lead) return;
    const r = scentRoute(layout, world, from, lead);
    let acc = 0;
    for (let i = 0; i < r.length; i++) {
      if (i) acc += Math.hypot(r[i].x - r[i - 1].x, r[i].z - r[i - 1].z);
      route.push({ x: r[i].x, z: r[i].z, d: acc });
    }
    total = acc;
  }
  /** O começo do caminho acompanha quem fareja a cada quadro (sem esperar o próximo refazer). */
  function follow(from) {
    if (route.length < 2) return;
    route[0].x = from.x;
    route[0].z = from.z;
    let acc = 0;
    for (let i = 1; i < route.length; i++) {
      acc += Math.hypot(route[i].x - route[i - 1].x, route[i].z - route[i - 1].z);
      route[i].d = acc;
    }
    total = acc;
  }
  /** O ponto a `d` m de quem fareja, pelo caminho. */
  function sample(d) {
    let i = 1;
    while (i < route.length - 1 && route[i].d < d) i++;
    const a = route[i - 1], b = route[i];
    const seg = b.d - a.d;
    const u = seg > 1e-6 ? Math.min(1, Math.max(0, (d - a.d) / seg)) : 0;
    P.x = a.x + (b.x - a.x) * u;
    P.z = a.z + (b.z - a.z) * u;
    return P;
  }

  /**
   * @param {number} dt @param {number} time @param {number} k 0..1: o quanto o Faro está aceso
   * @param {{ x: number, z: number } | null} from quem fareja (o rastro sai dela e acompanha quando ela anda)
   */
  function update(dt, time, k, from) {
    if (!(k > 0) || !lead || !from || !Number.isFinite(from.x) || !Number.isFinite(from.z)) {
      if (mesh.visible) { mesh.visible = false; mesh.count = 0; route = []; total = 0; }
      refreshT = 0;
      return;
    }
    time = Number.isFinite(time) ? time : 0;
    refreshT -= Number.isFinite(dt) ? dt : 0;
    if (refreshT <= 0 || route.length < 2) {
      refreshT = 0.3;
      rebuild(from);
    } else follow(from);
    if (route.length < 2) {
      mesh.visible = false;
      mesh.count = 0;
      return;
    }
    color.set(lead.color || '#FF8A2A');
    mat.uniforms.uK.value = Math.min(1, k);
    const leadY = lead.y ?? 0;
    const drawn = Math.min(total, REACH);
    const ends = total <= REACH + 0.01; // a pista está no trecho desenhado
    // o vento: uma deriva lenta que muda de lado devagar
    const wx = 0.1 * Math.sin(time * 0.27) + 0.04 * Math.sin(time * 0.71 + 1.3);
    const wz = 0.07 * Math.cos(time * 0.21) + 0.03 * Math.sin(time * 0.53);
    // as nuvenzinhas andam: a de número i está a START + (i + f) * STEP m (f corre de 0 a 1 e recomeça); `id` não muda
    // enquanto ela anda (o tamanho, o giro e o balanço são dela)
    const base = (time * FLOW) / STEP;
    const K = Math.floor(base);
    const f = base - K;
    let n = 0;
    for (let i = 0; n < MAX - END_PUFFS; i++) {
      const d = START + (i + f) * STEP;
      if (d > drawn) break;
      const id = i - K;
      const h1 = hash(id);
      const h2 = hash(id + 57.3);
      const p = sample(d);
      // a onda de brilho corre de quem fareja para a pista
      const wave = 0.5 + 0.5 * Math.sin(time * 3.4 - d * 1.9);
      const bob = Math.sin(time * 1.3 + id * 1.7) * 0.05;
      const drift = Math.min(1, (d - START) / 1.5);
      const side = Math.sin(id * 2.4 + time * 0.8) * 0.08;
      // entra macio no focinho; some no fim do trecho desenhado quando o caminho continua além dele; chega na pista
      const head = Math.min(1, (d - START) / (STEP * 1.5));
      const tail = ends ? Math.min(1, (total - d) / 0.5) : Math.min(1, (REACH - d) / 2.5);
      const tip = ends ? smooth(Math.max(0, total - 3), total, d) : 0; // as da ponta: maiores e mais fortes
      const size = (0.38 + 0.18 * h1) * (0.85 + 0.35 * wave) * (0.7 + 0.3 * head) * (1 + 0.45 * tip);
      const y = leadY * (total > 0 ? Math.min(1, d / total) : 0) + HEIGHT + bob + 0.04 * tip;
      const ang = h2 * 6.283 + time * (0.15 + 0.25 * h1) * (h2 > 0.5 ? 1 : -1);
      q.setFromAxisAngle(AXIS, ang);
      m4.compose(v.set(p.x + side + wx * drift, y, p.z + Math.cos(id * 1.9) * 0.09 + wz * drift), q, sc.setScalar(size));
      mesh.setMatrixAt(n, m4);
      mesh.setColorAt(n, tmpC.copy(color).multiplyScalar(Math.max(0, (0.55 + 0.45 * wave) * head * tail * (1 + 0.35 * tip))));
      n++;
    }
    // o tufo na pista: gira devagar em volta dela, pulsando com a onda
    if (ends && n > 0) {
      const at = route[route.length - 1];
      const pulse = 0.5 + 0.5 * Math.sin(time * 3.4 - total * 1.9);
      for (let j = 0; j < END_PUFFS; j++) {
        const a = time * 0.9 + (j * Math.PI * 2) / END_PUFFS;
        const r = 0.28 + 0.06 * Math.sin(time * 1.7 + j);
        const size = 0.42 * (0.9 + 0.2 * Math.sin(time * 2 + j * 1.3));
        q.setFromAxisAngle(AXIS, j * 1.37 + time * 0.3);
        m4.compose(v.set(at.x + Math.cos(a) * r + wx * 0.5, leadY + HEIGHT * 0.85 + 0.08 * Math.sin(time * 1.3 + j * 1.1), at.z + Math.sin(a) * r + wz * 0.5), q, sc.setScalar(size));
        mesh.setMatrixAt(n, m4);
        mesh.setColorAt(n, tmpC.copy(color).multiplyScalar(0.8 + 0.4 * pulse));
        n++;
      }
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
