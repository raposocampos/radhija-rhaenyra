// Caminhos no chão andados de verdade (a voltinha antes do cocô e os zoomies, extras.js; a volta até a poça e até o
// lugar novo depois do xixi, idle.js): trechos de curvatura suave, percorridos com uma velocidade que acelera e freia.
// Quem anda um caminho põe a dog em cada ponto e passa a velocidade e o giro de verdade para a animação (as patas
// acompanham o deslocamento).

const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/**
 * Caminho no chão a partir de (x, z) andando para yaw, em trechos { len, k0, k1 }: a curvatura (1/raio; + = vira
 * para a esquerda, com o yaw crescendo) vai de k0 a k1 ao longo do trecho. Pontos a cada ~2 cm, com o yaw contínuo.
 */
export function buildPath(x, z, yaw, segs) {
  const P = { x: [x], z: [z], yaw: [yaw], k: [segs[0]?.k0 ?? 0], s: [0], len: 0, i: 0 };
  for (const g of segs) {
    const n = Math.max(1, Math.ceil(g.len / 0.02));
    const ds = g.len / n;
    for (let j = 1; j <= n; j++) {
      const k = g.k0 + ((g.k1 - g.k0) * (j - 0.5)) / n;
      x += Math.sin(yaw + (k * ds) / 2) * ds;
      z += Math.cos(yaw + (k * ds) / 2) * ds;
      yaw += k * ds;
      P.len += ds;
      P.x.push(x);
      P.z.push(z);
      P.yaw.push(yaw);
      P.k.push(g.k0 + ((g.k1 - g.k0) * j) / n);
      P.s.push(P.len);
    }
  }
  return P;
}
/** Ponto do caminho na distância d (em out: x, z, yaw, k). O cursor só volta se d voltar. */
export function along(P, d, out) {
  const n = P.s.length - 1;
  if (d < P.s[P.i]) P.i = 0;
  while (P.i < n - 1 && P.s[P.i + 1] < d) P.i++;
  const i = P.i;
  const j = Math.min(n, i + 1);
  const u = Math.min(1, Math.max(0, (d - P.s[i]) / Math.max(1e-6, P.s[j] - P.s[i])));
  out.x = P.x[i] + (P.x[j] - P.x[i]) * u;
  out.z = P.z[i] + (P.z[j] - P.z[i]) * u;
  out.yaw = P.yaw[i] + (P.yaw[j] - P.yaw[i]) * u;
  out.k = P.k[i] + (P.k[j] - P.k[i]) * u;
  return out;
}
export const lastOf = (P) => ({ x: P.x[P.x.length - 1], z: P.z[P.z.length - 1], yaw: P.yaw[P.yaw.length - 1] });
/**
 * Velocidade suave para percorrer D m com pico vMax: acelera na fração `up` do tempo e freia na fração `down`.
 * → { T (s), at(τ, out) → out.d (m percorridos), out.v (m/s) }
 */
export function speedProfile(D, vMax, up, down) {
  const N = 160; // tabela fina: o passo da animação bate com o deslocamento de cada quadro
  const shape = (u) => smooth(u / up) * (1 - smooth((u - (1 - down)) / down));
  const F = [0];
  for (let i = 1; i <= N; i++) F.push(F[i - 1] + shape((i - 0.5) / N) / N);
  const mean = F[N];
  const T = D / (vMax * mean);
  return {
    T,
    at(tau, out) {
      const u = Math.min(1, Math.max(0, tau / T));
      const f = u * N;
      const i = Math.min(N - 1, Math.floor(f));
      out.d = (D * (F[i] + (F[i + 1] - F[i]) * (f - i))) / mean;
      out.v = vMax * shape(u);
      return out;
    },
  };
}
/** O caminho até o ponto i (inclusive), como um caminho novo. */
export function cutPath(P, i) {
  const j = Math.max(1, Math.min(P.s.length - 1, i)) + 1;
  return { x: P.x.slice(0, j), z: P.z.slice(0, j), yaw: P.yaw.slice(0, j), k: P.k.slice(0, j), s: P.s.slice(0, j), len: P.s[j - 1], i: 0 };
}
/**
 * Onde, andando o caminho, ela fica de frente para Q (o rumo cruza a direção de Q), depois de `from` m: o índice do
 * ponto, ou −1 (nunca fica).
 */
export function facingIndex(P, Q, from = 0) {
  let prev = NaN;
  for (let i = 0; i < P.s.length; i++) {
    if (P.s[i] < from) continue;
    const a = Math.atan2(Q.x - P.x[i], Q.z - P.z[i]) - P.yaw[i];
    const e = Math.atan2(Math.sin(a), Math.cos(a));
    // cruzou o zero (não o ±π, de costas para Q)
    if (Number.isFinite(prev) && Math.sign(e) !== Math.sign(prev) && Math.abs(e - prev) < Math.PI) return i;
    prev = e;
  }
  return -1;
}
/**
 * Os caminhos de Dubins "curva, reta, curva" (raio r, só para a frente) de (x0, z0) olhando para yaw0 até (x1, z1)
 * olhando para yaw1: os quatro tipos (esquerda/direita na saída e na chegada), cada um em trechos para buildPath.
 * Nada de girar parada: toda mudança de rumo é andando (no mínimo o raio r). → [{ segs, len }]
 */
export function dubinsPaths(x0, z0, yaw0, x1, z1, yaw1, r) {
  const TAU = Math.PI * 2;
  const mod = (a) => ((a % TAU) + TAU) % TAU;
  const out = [];
  for (const ds of [1, -1]) {
    for (const de of [1, -1]) {
      // centros das curvas: à esquerda (ds = +1) ou à direita do rumo (esquerda de quem olha para yaw: (cos, −sin))
      const csx = x0 + ds * r * Math.cos(yaw0), csz = z0 - ds * r * Math.sin(yaw0);
      const cex = x1 + de * r * Math.cos(yaw1), cez = z1 - de * r * Math.sin(yaw1);
      const vx = cex - csx, vz = cez - csz;
      const D = Math.hypot(vx, vz);
      const hV = Math.atan2(vx, vz);
      let h, S;
      if (ds === de) {
        h = hV;
        S = D;
      } else {
        if (D < 2 * r) continue;
        S = Math.sqrt(D * D - 4 * r * r);
        h = hV + Math.atan2(2 * ds * r, S);
      }
      const a1 = mod(ds * (h - yaw0));
      const a2 = mod(de * (yaw1 - h));
      const segs = [
        { len: r * a1, k0: ds / r, k1: ds / r },
        { len: S, k0: 0, k1: 0 },
        { len: r * a2, k0: de / r, k1: de / r },
      ].filter((g) => g.len > 1e-4);
      if (!segs.length) continue;
      out.push({ segs, len: r * a1 + S + r * a2 });
    }
  }
  return out;
}
