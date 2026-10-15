// SDF + Surface Nets — gera malhas orgânicas (união suave de primitivas) no carregamento.
// Tudo em JS puro, sem dependências além de números. Usado por dogModel.js.

// ---------------------------------------------------------------------------
// Ruído (value noise 3D com hash inteiro) e fBm
// ---------------------------------------------------------------------------
function hash3(ix, iy, iz, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(iz, 1440662683) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h & 0xffff) / 65535;
}

// tabela periódica 32³ de valores aleatórios (muito mais barata que o hash por amostra)
const NT = 32, NM = NT - 1;
const NTAB = new Float32Array(NT * NT * NT * 4);
for (let sd = 0; sd < 4; sd++) {
  for (let i = 0; i < NT * NT * NT; i++) NTAB[sd * NT * NT * NT + i] = hash3(i & NM, (i >> 5) & NM, i >> 10, sd * 31 + 7);
}
export function vnoise(x, y, z, seed = 0) {
  const fxf = Math.floor(x), fyf = Math.floor(y), fzf = Math.floor(z);
  const fx = x - fxf, fy = y - fyf, fz = z - fzf;
  const ix = fxf & NM, iy = fyf & NM, iz = fzf & NM;
  const jx = (ix + 1) & NM, jy = (iy + 1) & NM, jz = (iz + 1) & NM;
  const base = (seed & 3) * 32768;
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy), uz = fz * fz * (3 - 2 * fz);
  const y0 = iy << 5, y1 = jy << 5, z0 = (iz << 10) + base, z1 = (jz << 10) + base;
  const a = NTAB[ix + y0 + z0], b = NTAB[jx + y0 + z0];
  const c = NTAB[ix + y1 + z0], d = NTAB[jx + y1 + z0];
  const e = NTAB[ix + y0 + z1], f = NTAB[jx + y0 + z1];
  const g = NTAB[ix + y1 + z1], h = NTAB[jx + y1 + z1];
  const x1 = a + (b - a) * ux, x2 = c + (d - c) * ux, x3 = e + (f - e) * ux, x4 = g + (h - g) * ux;
  const q1 = x1 + (x2 - x1) * uy, q2 = x3 + (x4 - x3) * uy;
  return q1 + (q2 - q1) * uz;
}

// fBm em [-1, 1] aprox.
export function fbm(x, y, z, octaves = 3, seed = 0) {
  let sum = 0, amp = 0.5, norm = 0;
  for (let o = 0; o < octaves; o++) {
    sum += (vnoise(x + o * 5.3, y, z, seed + o) * 2 - 1) * amp;
    norm += amp;
    x *= 2.03; y *= 2.03; z *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
}

// ---------------------------------------------------------------------------
// Primitivas
// ---------------------------------------------------------------------------
// smooth-min polinomial (Inigo Quilez)
export function smin(a, b, k) {
  if (k <= 0) return Math.min(a, b);
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}
export function smax(a, b, k) {
  return -smin(-a, -b, k);
}

// Tipos: 0 esfera {c,r}, 1 elipsoide {c, r:[rx,ry,rz], m?(3x3 inversa)}, 2 cone arredondado {a,b,ra,rb,sx?}
// As primitivas são achatadas num Float64Array (formato fixo → código monomórfico e rápido).
const STRIDE = 25;
function packPrims(prims) {
  const buf = new Float64Array(prims.length * STRIDE);
  prims.forEach((p, i) => {
    const o = i * STRIDE;
    buf[o] = p.t;
    if (p.t === 0) {
      buf[o + 1] = p.c[0]; buf[o + 2] = p.c[1]; buf[o + 3] = p.c[2]; buf[o + 4] = p.r;
    } else if (p.t === 1) {
      buf[o + 1] = p.c[0]; buf[o + 2] = p.c[1]; buf[o + 3] = p.c[2];
      buf[o + 5] = p.r[0]; buf[o + 6] = p.r[1]; buf[o + 7] = p.r[2];
      if (p.m) { buf[o + 8] = 1; for (let k = 0; k < 9; k++) buf[o + 9 + k] = p.m[k]; }
    } else {
      buf[o + 1] = p.a[0]; buf[o + 2] = p.a[1]; buf[o + 3] = p.a[2];
      const bx = p.b[0] - p.a[0], by = p.b[1] - p.a[1], bz = p.b[2] - p.a[2];
      buf[o + 18] = bx; buf[o + 19] = by; buf[o + 20] = bz;
      buf[o + 21] = p.ra; buf[o + 22] = p.rb; buf[o + 23] = p.sx || 1;
      buf[o + 24] = bx * bx + by * by + bz * bz;
    }
  });
  return buf;
}

function primDistF(B, o, x, y, z) {
  const t = B[o];
  if (t === 0) {
    const dx = x - B[o + 1], dy = y - B[o + 2], dz = z - B[o + 3];
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - B[o + 4];
  }
  if (t === 1) {
    let dx = x - B[o + 1], dy = y - B[o + 2], dz = z - B[o + 3];
    if (B[o + 8] === 1) {
      const tx = B[o + 9] * dx + B[o + 10] * dy + B[o + 11] * dz;
      const ty = B[o + 12] * dx + B[o + 13] * dy + B[o + 14] * dz;
      const tz = B[o + 15] * dx + B[o + 16] * dy + B[o + 17] * dz;
      dx = tx; dy = ty; dz = tz;
    }
    const rx = B[o + 5], ry = B[o + 6], rz = B[o + 7];
    const k0x = dx / rx, k0y = dy / ry, k0z = dz / rz;
    const k1x = k0x / rx, k1y = k0y / ry, k1z = k0z / rz;
    const k0 = Math.sqrt(k0x * k0x + k0y * k0y + k0z * k0z);
    const k1 = Math.sqrt(k1x * k1x + k1y * k1y + k1z * k1z);
    if (k1 < 1e-9) return -Math.min(rx, ry, rz);
    return (k0 * (k0 - 1)) / k1;
  }
  const sx = B[o + 23];
  const px = (x - B[o + 1]) * sx, py = y - B[o + 2], pz = z - B[o + 3];
  const bx = B[o + 18], by = B[o + 19], bz = B[o + 20];
  let h = (px * bx + py * by + pz * bz) / B[o + 24];
  h = h < 0 ? 0 : h > 1 ? 1 : h;
  const qx = px - bx * h, qy = py - by * h, qz = pz - bz * h;
  return (Math.sqrt(qx * qx + qy * qy + qz * qz) - (B[o + 21] + (B[o + 22] - B[o + 21]) * h)) / sx;
}

// Distância a uma primitiva em formato de objeto (uso fora do laço quente)
export function primDist(p, x, y, z) {
  if (!p._packed) p._packed = packPrims([p]);
  return primDistF(p._packed, 0, x, y, z);
}

// Compila uma descrição em grupos para uma função sdf(x,y,z).
// groups: [{ prims:[...], k, join, disp?: {amp, freq:[fx,fy,fz], oct, seed, band}, sub?: [{c,r,k}] }]
export function compileSDF(groups) {
  const G = groups.length;
  const all = groups.flatMap((g) => g.prims);
  const B = packPrims(all);
  const gStart = new Int32Array(G), gEnd = new Int32Array(G);
  const gK = new Float64Array(G), gJoin = new Float64Array(G);
  const gBS = new Float64Array(G * 4);
  const gDisp = new Float64Array(G * 7); // amp, fx, fy, fz, oct, seed, band (amp 0 = sem)
  const gSub = new Float64Array(G * 10); // até 2 esferas subtraídas: cx,cy,cz,r,k
  const gNSub = new Int32Array(G);
  let off = 0;
  groups.forEach((g, gi) => {
    gStart[gi] = off; off += g.prims.length; gEnd[gi] = off;
    gK[gi] = g.k || 0; gJoin[gi] = g.join || 0;
    const b = groupsBounds([{ prims: g.prims }], 0);
    const c = [0, 1, 2].map((i) => (b.min[i] + b.max[i]) / 2);
    const r = Math.hypot(b.max[0] - c[0], b.max[1] - c[1], b.max[2] - c[2]);
    gBS.set([c[0], c[1], c[2], r + (g.disp ? g.disp.amp : 0)], gi * 4);
    if (g.disp) gDisp.set([g.disp.amp, g.disp.freq[0], g.disp.freq[1], g.disp.freq[2], g.disp.oct, g.disp.seed, g.disp.band], gi * 7);
    if (g.sub) {
      gNSub[gi] = Math.min(2, g.sub.length);
      g.sub.slice(0, 2).forEach((sb, k) => gSub.set([sb.c[0], sb.c[1], sb.c[2], sb.r, sb.k], gi * 10 + k * 5));
    }
  });
  function sdf(x, y, z) {
    let res = 1e9;
    for (let gi = 0; gi < G; gi++) {
      if (gi > 0) {
        const o = gi * 4;
        const dx = x - gBS[o], dy = y - gBS[o + 1], dz = z - gBS[o + 2];
        const lb = Math.sqrt(dx * dx + dy * dy + dz * dz) - gBS[o + 3];
        if (lb > res + gJoin[gi]) continue;
      }
      const k = gK[gi];
      let d = 1e9;
      for (let i = gStart[gi]; i < gEnd[gi]; i++) d = smin(d, primDistF(B, i * STRIDE, x, y, z), k);
      const od = gi * 7;
      if (gDisp[od] > 0 && d < gDisp[od + 6]) {
        d -= gDisp[od] * fbm(x * gDisp[od + 1], y * gDisp[od + 2], z * gDisp[od + 3], gDisp[od + 4], gDisp[od + 5]);
      }
      for (let si = 0; si < gNSub[gi]; si++) {
        const os = gi * 10 + si * 5;
        const dx = x - gSub[os], dy = y - gSub[os + 1], dz = z - gSub[os + 2];
        d = smax(d, -(Math.sqrt(dx * dx + dy * dy + dz * dz) - gSub[os + 3]), gSub[os + 4]);
      }
      res = gi === 0 ? d : smin(res, d, gJoin[gi]);
    }
    return res;
  }
  // distâncias brutas a cada primitiva (para pesos de skin/cor)
  sdf.primCount = all.length;
  sdf.primDistances = (x, y, z, out) => {
    for (let i = 0; i < all.length; i++) out[i] = primDistF(B, i * STRIDE, x, y, z);
    return out;
  };
  return sdf;
}

// Caixa envolvente das primitivas dos grupos
export function groupsBounds(groups, margin) {
  const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9];
  const ext = (c, r) => {
    for (let i = 0; i < 3; i++) {
      mn[i] = Math.min(mn[i], c[i] - r);
      mx[i] = Math.max(mx[i], c[i] + r);
    }
  };
  for (const g of groups) {
    for (const p of g.prims) {
      if (p.t === 0) ext(p.c, p.r);
      else if (p.t === 1) ext(p.c, Math.max(...p.r));
      else {
        const sx = p.sx ? 1 / p.sx : 1;
        ext(p.a, p.ra * sx);
        ext(p.b, p.rb * sx);
      }
    }
  }
  for (let i = 0; i < 3; i++) { mn[i] -= margin; mx[i] += margin; }
  return { min: mn, max: mx };
}

// ---------------------------------------------------------------------------
// Surface Nets com pulo de blocos distantes + projeção na superfície + suavização
// ---------------------------------------------------------------------------
export function surfaceNets(sdf, bounds, cell, { smoothIters = 2, project = 2 } = {}) {
  const ox = bounds.min[0], oy = bounds.min[1], oz = bounds.min[2];
  const nx = Math.ceil((bounds.max[0] - ox) / cell) + 1;
  const ny = Math.ceil((bounds.max[1] - oy) / cell) + 1;
  const nz = Math.ceil((bounds.max[2] - oz) / cell) + 1;
  const sxy = nx * ny;
  const vals = new Float32Array(nx * ny * nz);
  const B = 4;
  const half = B * cell * 0.8660254 + cell;
  for (let bz = 0; bz < nz; bz += B) {
    for (let by = 0; by < ny; by += B) {
      for (let bx = 0; bx < nx; bx += B) {
        const ex = Math.min(bx + B, nx - 1), ey = Math.min(by + B, ny - 1), ez = Math.min(bz + B, nz - 1);
        const cx = ox + ((bx + ex) / 2) * cell, cy = oy + ((by + ey) / 2) * cell, cz = oz + ((bz + ez) / 2) * cell;
        const dc = sdf(cx, cy, cz);
        const far = Math.abs(dc) > half * 1.25;
        for (let k = bz; k <= ez; k++) {
          for (let j = by; j <= ey; j++) {
            let idx = k * sxy + j * nx + bx;
            for (let i = bx; i <= ex; i++, idx++) {
              vals[idx] = far ? dc : sdf(ox + i * cell, oy + j * cell, oz + k * cell);
            }
          }
        }
      }
    }
  }

  // vértices por célula
  const cx1 = nx - 1, cy1 = ny - 1, cz1 = nz - 1;
  const cellIdx = new Int32Array(cx1 * cy1 * cz1).fill(-1);
  const pos = [];
  const corner = new Float32Array(8);
  const EDGES = [
    [0, 1], [2, 3], [4, 5], [6, 7], // x
    [0, 2], [1, 3], [4, 6], [5, 7], // y
    [0, 4], [1, 5], [2, 6], [3, 7], // z
  ];
  const COFF = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  for (let k = 0; k < cz1; k++) {
    for (let j = 0; j < cy1; j++) {
      for (let i = 0; i < cx1; i++) {
        let mask = 0;
        for (let c = 0; c < 8; c++) {
          const o = COFF[c];
          const v = vals[(k + o[2]) * sxy + (j + o[1]) * nx + (i + o[0])];
          corner[c] = v;
          if (v < 0) mask |= 1 << c;
        }
        if (mask === 0 || mask === 255) continue;
        let ax = 0, ay = 0, az = 0, n = 0;
        for (const [e0, e1] of EDGES) {
          const v0 = corner[e0], v1 = corner[e1];
          if (v0 < 0 === v1 < 0) continue;
          const t = v0 / (v0 - v1);
          const o0 = COFF[e0], o1 = COFF[e1];
          ax += o0[0] + (o1[0] - o0[0]) * t;
          ay += o0[1] + (o1[1] - o0[1]) * t;
          az += o0[2] + (o1[2] - o0[2]) * t;
          n++;
        }
        cellIdx[k * cx1 * cy1 + j * cx1 + i] = pos.length / 3;
        pos.push(ox + (i + ax / n) * cell, oy + (j + ay / n) * cell, oz + (k + az / n) * cell);
      }
    }
  }

  const ci = (i, j, k) => cellIdx[k * cx1 * cy1 + j * cx1 + i];
  const idx = [];
  const quad = (a, b, c, d, flip) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (flip) { const t = b; b = d; d = t; }
    // diagonal mais curta
    const d1 = dist2(pos, a, c), d2 = dist2(pos, b, d);
    if (d1 <= d2) idx.push(a, b, c, a, c, d);
    else idx.push(a, b, d, b, c, d);
  };
  for (let k = 0; k < nz; k++) {
    for (let j = 0; j < ny; j++) {
      for (let i = 0; i < nx; i++) {
        const v0 = vals[k * sxy + j * nx + i];
        const in0 = v0 < 0;
        // aresta em x
        if (i < nx - 1 && j > 0 && k > 0 && j < ny - 1 && k < nz - 1) {
          const v1 = vals[k * sxy + j * nx + i + 1];
          if (in0 !== v1 < 0) quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), !in0);
        }
        if (j < ny - 1 && i > 0 && k > 0 && i < nx - 1 && k < nz - 1) {
          const v1 = vals[k * sxy + (j + 1) * nx + i];
          if (in0 !== v1 < 0) quad(ci(i - 1, j, k - 1), ci(i - 1, j, k), ci(i, j, k), ci(i, j, k - 1), !in0);
        }
        if (k < nz - 1 && i > 0 && j > 0 && i < nx - 1 && j < ny - 1) {
          const v1 = vals[(k + 1) * sxy + j * nx + i];
          if (in0 !== v1 < 0) quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), !in0);
        }
      }
    }
  }

  const P = new Float32Array(pos);
  const I = new Uint32Array(idx);
  const nv = P.length / 3;

  // vizinhança para suavização laplaciana
  if (smoothIters > 0) {
    const nbStart = new Int32Array(nv + 1);
    const cnt = new Int32Array(nv);
    for (let t = 0; t < I.length; t += 3) {
      cnt[I[t]] += 2; cnt[I[t + 1]] += 2; cnt[I[t + 2]] += 2;
    }
    for (let v = 0; v < nv; v++) nbStart[v + 1] = nbStart[v] + cnt[v];
    const nb = new Int32Array(nbStart[nv]);
    const fill = new Int32Array(nv);
    for (let t = 0; t < I.length; t += 3) {
      const a = I[t], b = I[t + 1], c = I[t + 2];
      nb[nbStart[a] + fill[a]++] = b; nb[nbStart[a] + fill[a]++] = c;
      nb[nbStart[b] + fill[b]++] = a; nb[nbStart[b] + fill[b]++] = c;
      nb[nbStart[c] + fill[c]++] = a; nb[nbStart[c] + fill[c]++] = b;
    }
    const tmp = new Float32Array(P.length);
    for (let it = 0; it < smoothIters; it++) {
      for (let v = 0; v < nv; v++) {
        let sx = 0, sy = 0, sz = 0;
        const s = nbStart[v], e = nbStart[v + 1];
        for (let q = s; q < e; q++) {
          const u = nb[q] * 3;
          sx += P[u]; sy += P[u + 1]; sz += P[u + 2];
        }
        const n = e - s || 1;
        const l = 0.5;
        tmp[v * 3] = P[v * 3] + (sx / n - P[v * 3]) * l;
        tmp[v * 3 + 1] = P[v * 3 + 1] + (sy / n - P[v * 3 + 1]) * l;
        tmp[v * 3 + 2] = P[v * 3 + 2] + (sz / n - P[v * 3 + 2]) * l;
      }
      P.set(tmp);
    }
  }

  // projeção na superfície (Newton) + normais pelo gradiente do SDF (diferenças à frente)
  const N = new Float32Array(P.length);
  const h = cell * 0.3;
  for (let v = 0; v < nv; v++) {
    let x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
    let gx = 0, gy = 0, gz = 1;
    for (let it = 0; it <= project; it++) {
      const d = sdf(x, y, z);
      gx = sdf(x + h, y, z) - d;
      gy = sdf(x, y + h, z) - d;
      gz = sdf(x, y, z + h) - d;
      const gl = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1;
      gx /= gl; gy /= gl; gz /= gl;
      if (it === project) break;
      const step = Math.max(-cell, Math.min(cell, d));
      x -= gx * step; y -= gy * step; z -= gz * step;
    }
    P[v * 3] = x; P[v * 3 + 1] = y; P[v * 3 + 2] = z;
    N[v * 3] = gx; N[v * 3 + 1] = gy; N[v * 3 + 2] = gz;
  }
  return { positions: P, normals: N, indices: I };
}

function dist2(pos, a, b) {
  const dx = pos[a * 3] - pos[b * 3], dy = pos[a * 3 + 1] - pos[b * 3 + 1], dz = pos[a * 3 + 2] - pos[b * 3 + 2];
  return dx * dx + dy * dy + dz * dz;
}
