// Contato com o chão do modelo novo: as primitivas do desenho viram elipsoides presos aos ossos, e o ponto mais
// baixo do corpo sai das posições dos ossos neste quadro. O modelo novo usa isso para nunca passar do chão.
import * as THREE from 'three';

/**
 * Elipsoides de contato { i (osso), c (centro no osso), r [x, y, z], ax (eixos no corpo) | null } das primitivas
 * do desenho, sem as regiões de `skip` (ex.: 'tail', 'ear'). Cada um ganha a folga da união suave do grupo (até
 * k/4 além das formas, onde duas se juntam).
 * @param {any} design @param {Record<string, number>} index @param {THREE.Vector3[]} rest
 * @param {{ skip?: string[] }} [opts]
 */
export function groundContacts(design, index, rest, { skip = [] } = {}) {
  /** @type {{ i: number, c: THREE.Vector3, r: number[], ax: THREE.Vector3[] | null }[]} */
  const out = [];
  let pad = 0;
  const add = (bone, c, r, ax = null) => {
    const i = index[bone];
    if (i === undefined) return;
    const R = rest[i];
    out.push({ i, c: new THREE.Vector3(c[0] - R.x, c[1] - R.y, c[2] - R.z), r: r.map((v) => v + pad), ax: ax && ax.map((a) => new THREE.Vector3(a[0], a[1], a[2])) });
  };
  for (const g of [...design.bodyGroups, ...design.earGroups]) {
    pad = 0.25 * (g.k || 0);
    for (const p of g.prims) {
      if (skip.includes(p.reg)) continue;
      if (p.t === 0) add(p.bone, p.c, [p.r, p.r, p.r]);
      else if (p.t === 1) add(p.bone, p.c, p.r, p.m ? [p.m.slice(0, 3), p.m.slice(3, 6), p.m.slice(6, 9)] : null);
      else {
        // cone arredondado: as duas esferas das pontas (achatadas em x por sx)
        const k = 1 / (p.sx || 1);
        add(p.bone, p.a, [p.ra * k, p.ra, p.ra]);
        add(p.bone, p.b, [p.rb * k, p.rb, p.rb]);
      }
    }
  }
  return out;
}

const _c = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _a = new THREE.Vector3();

/**
 * Altura do ponto mais baixo (no referencial do objeto da dog) com os ossos em P/Q (referencial do corpo) e o corpo
 * (inner) em innerPos/innerQuat.
 * @param {ReturnType<typeof groundContacts>} contacts @param {THREE.Vector3[]} P @param {THREE.Quaternion[]} Q
 * @param {THREE.Vector3} innerPos @param {THREE.Quaternion} innerQuat
 */
export function lowestPoint(contacts, P, Q, innerPos, innerQuat) {
  let low = Infinity;
  lowestPoint.bone = -1;
  for (const k of contacts) {
    _c.copy(k.c).applyQuaternion(Q[k.i]).add(P[k.i]).applyQuaternion(innerQuat).add(innerPos);
    _q.multiplyQuaternions(innerQuat, Q[k.i]);
    // linha y da matriz de rotação: (R·v).y para os eixos do elipsoide
    const { x: qx, y: qy, z: qz, w: qw } = _q;
    const r0 = 2 * (qx * qy + qw * qz), r1 = 1 - 2 * (qx * qx + qz * qz), r2 = 2 * (qy * qz - qw * qx);
    let h2 = 0;
    for (let a = 0; a < 3; a++) {
      let wy;
      if (k.ax) {
        _a.copy(k.ax[a]);
        wy = r0 * _a.x + r1 * _a.y + r2 * _a.z;
      } else wy = a === 0 ? r0 : a === 1 ? r1 : r2;
      h2 += (k.r[a] * wy) ** 2;
    }
    const y = _c.y - Math.sqrt(h2);
    if (y < low) {
      low = y;
      lowestPoint.bone = k.i;
    }
  }
  return low;
}
/** Osso da forma mais baixa na última chamada (diagnóstico). */
lowestPoint.bone = -1;
