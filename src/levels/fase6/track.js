// Expresso do Superbafo · trilho. A MESMA descrição (TRACK, em layout.js) move o trem (puzzle.js) e desenha
// os trilhos de madeira (world/railway.js): retas e arcos encadeados com tangente contínua, então locomotiva
// e vagão seguem as curvas sem quinas, e a volta fecha o circuito chegando à estação já alinhada.
// Só números, sem Three.js (os testes usam direto no Node).
//
//   const track = createTrack();                 // TRACK e TRAIN do layout
//   track.routes.loop.length                     // m (circuito fechado)
//   track.routes.delivery.at(s)                  // { x, z, dx, dz }: ponto e direção de avanço
//   track.consist('delivery', s)                 // { x, z, yaw, wagon: { x, z, yaw } } (anda de ré)
//   track.pieces                                 // trechos para desenhar, cada um uma vez
//   track.distanceTo(x, z)                       // distância ao eixo do trilho mais próximo
//
// Direção: a locomotiva olha para trás (yaw = direção de -avanço), com o vagão à frente no trilho. Ângulos
// de curva em graus, + = esquerda (anti-horário visto de cima, com o norte em -Z).
import { TRACK, TRAIN } from './layout.js';

/** Gira (x, z) por `a` radianos no sentido da curva à esquerda. @returns {[number, number]} */
function rot(x, z, a) {
  const c = Math.cos(a), s = Math.sin(a);
  return [x * c + z * s, -x * s + z * c];
}

/**
 * Encadeia os comandos a partir de `p` (que avança). Cada trecho guarda o início e a direção inicial.
 * @param {import('../../types').Fase6TrackCommand[]} cmds
 * @param {{ x: number, z: number, dx: number, dz: number }} p
 * @param {string} route
 */
function chain(cmds, p, route) {
  return cmds.map(([kind, a, b], i) => {
    const base = { id: `${route}-${i}`, route, x0: p.x, z0: p.z, dx0: p.dx, dz0: p.dz };
    if (kind === 'line') {
      p.x += p.dx * a;
      p.z += p.dz * a;
      return { ...base, kind: 'line', length: a, cx: 0, cz: 0, r: 0, turn: 0 };
    }
    const turn = (b * Math.PI) / 180;
    const sg = Math.sign(turn);
    // centro à esquerda (curva +) ou à direita (curva −) da direção atual
    const cx = p.x + sg * a * p.dz, cz = p.z - sg * a * p.dx;
    const [rx, rz] = rot(p.x - cx, p.z - cz, turn);
    p.x = cx + rx;
    p.z = cz + rz;
    [p.dx, p.dz] = rot(p.dx, p.dz, turn);
    return { ...base, kind: 'arc', length: a * Math.abs(turn), cx, cz, r: a, turn };
  });
}

/** Ponto e direção a `u` metros do início do trecho. */
function sample(seg, u, out) {
  if (seg.kind === 'line') {
    out.x = seg.x0 + seg.dx0 * u;
    out.z = seg.z0 + seg.dz0 * u;
    out.dx = seg.dx0;
    out.dz = seg.dz0;
    return out;
  }
  const phi = seg.turn * (u / seg.length);
  const [rx, rz] = rot(seg.x0 - seg.cx, seg.z0 - seg.cz, phi);
  const [dx, dz] = rot(seg.dx0, seg.dz0, phi);
  out.x = seg.cx + rx;
  out.z = seg.cz + rz;
  out.dx = dx;
  out.dz = dz;
  return out;
}

/** @param {string} name @param {any[]} segments @param {boolean} closed */
function makePath(name, segments, closed) {
  const offsets = [];
  let length = 0;
  for (const seg of segments) { offsets.push(length); length += seg.length; }
  const first = segments[0];
  const start = { x: first.x0, z: first.z0, dx: first.dx0, dz: first.dz0 };
  const end = sample(segments.at(-1), segments.at(-1).length, { x: 0, z: 0, dx: 0, dz: 0 });
  return {
    name, closed, length, segments, start, end,
    /** @param {number} s @param {{ x: number, z: number, dx: number, dz: number }} [out] */
    at(s, out = { x: 0, z: 0, dx: 0, dz: 0 }) {
      if (closed) s = ((s % length) + length) % length;
      else if (s <= 0 || s >= length) {
        // além das pontas: segue reto (o vagão para no trilho do para-choque, depois do fim da entrega)
        const p = s <= 0 ? start : end;
        const k = s <= 0 ? s : s - length;
        out.x = p.x + p.dx * k;
        out.z = p.z + p.dz * k;
        out.dx = p.dx;
        out.dz = p.dz;
        return out;
      }
      let i = segments.length - 1;
      while (i > 0 && offsets[i] > s) i--;
      return sample(segments[i], s - offsets[i], out);
    },
  };
}

/**
 * @param {import('../../types').Fase6TrackSpec} [spec]
 * @param {{ x: number, z: number }} [start] a estação (o trem sai para o norte)
 * @param {number} [cargoOffset] distância no trilho entre a locomotiva e o vagão
 */
export function createTrack(spec = TRACK, start = TRAIN.start, cargoOffset = TRAIN.cargoOffset) {
  const p = { x: start.x, z: start.z, dx: 0, dz: -1 };
  const stem = chain(spec.stem, p, 'stem');
  const junction = { x: p.x, z: p.z, dx: p.dx, dz: p.dz };
  const loopBranch = chain(spec.loop, { ...junction }, 'loop');
  const deliveryBranch = chain(spec.delivery, { ...junction }, 'delivery');
  const routes = {
    loop: makePath('loop', [...stem, ...loopBranch], true),
    delivery: makePath('delivery', [...stem, ...deliveryBranch], false),
  };
  const e = routes.delivery.end;
  const tail = chain([['line', spec.tail]], { ...e }, 'tail');
  // A entrega sai da agulha por cima da volta: 3 mm acima, as duas peças não ficam no mesmo plano.
  const pieces = [...stem, ...loopBranch, ...deliveryBranch, ...tail].map((seg) => ({
    ...seg, lift: seg.route === 'delivery' || seg.route === 'tail' ? 0.003 : 0,
  }));
  const tmp = { x: 0, z: 0, dx: 0, dz: 0 };
  return {
    spec, routes, pieces, junction, cargoOffset,
    /** Pose da composição a `s` metros do início da rota (locomotiva e vagão, cada um na tangente do trilho). */
    consist(/** @type {import('../../types').Fase6Route} */ route, /** @type {number} */ s) {
      const path = routes[route];
      const a = path.at(s, { x: 0, z: 0, dx: 0, dz: 0 });
      const b = path.at(s + cargoOffset, { x: 0, z: 0, dx: 0, dz: 0 });
      return {
        x: a.x, z: a.z, yaw: Math.atan2(-a.dx, -a.dz),
        wagon: { x: b.x, z: b.z, yaw: Math.atan2(-b.dx, -b.dz) },
      };
    },
    /** Distância (m) de (x, z) ao eixo do trilho mais próximo, amostrando cada peça a cada 2 cm. */
    distanceTo(/** @type {number} */ x, /** @type {number} */ z) {
      let best = Infinity;
      for (const seg of pieces) {
        const n = Math.max(1, Math.ceil(seg.length / 0.02));
        for (let i = 0; i <= n; i++) {
          sample(seg, (seg.length * i) / n, tmp);
          best = Math.min(best, Math.hypot(tmp.x - x, tmp.z - z));
        }
      }
      return best;
    },
    /** Ponto e direção de uma peça a `u` metros do início dela (para desenhar). */
    sample(/** @type {any} */ seg, /** @type {number} */ u, out = { x: 0, z: 0, dx: 0, dz: 0 }) { return sample(seg, u, out); },
  };
}
