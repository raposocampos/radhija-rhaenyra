// Rosto da dog (filhos do osso da cabeça): olhos com reflexo de luz, nariz de botão e boca com língua.
// A animação (dogAnimation.js) escala os olhos (piscar, susto), abre a boca (latido, carregar item) e
// estica a língua comprida do Lambe-Lambe.
import * as THREE from 'three';

/**
 * opts: { headBone, toHead(p) (ponto do design → espaço da cabeça), design, s (escala), P (parâmetros) }
 * → { eyes: Group[], lip: Mesh, tongue: Mesh, mouthW, lickTongue }
 */
export function createDogFace({ headBone, toHead, design, s, P }) {
  const eyeMat = new THREE.MeshPhysicalMaterial({ color: '#140b07', roughness: 0.1, clearcoat: 1, clearcoatRoughness: 0.03 });
  const catchMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const noseMat = new THREE.MeshPhysicalMaterial({ color: '#16100e', roughness: 0.32, clearcoat: 0.9, clearcoatRoughness: 0.18 });
  const lipMat = new THREE.MeshStandardMaterial({ color: '#2a1b17', roughness: 0.55 });
  const tongueMat = new THREE.MeshStandardMaterial({ color: '#d8707a', roughness: 0.45 });
  const eyeR = design.face.eyeR;
  const eyeGeo = new THREE.SphereGeometry(eyeR, 28, 18);
  const catchGeo = new THREE.CircleGeometry(eyeR * 0.3, 16);
  const catch2Geo = new THREE.CircleGeometry(eyeR * 0.13, 12);
  const eyes = [];
  for (const side of [1, -1]) {
    const e = design.face.eyeL;
    const grp = new THREE.Group();
    grp.position.copy(toHead([e[0] * side, e[1], e[2]]));
    // olhar levemente para fora
    grp.rotation.y = side * 0.32;
    const eye = new THREE.Mesh(eyeGeo, eyeMat);
    grp.add(eye);
    const dir = new THREE.Vector3(-0.28 * side, 0.42, 0.86).normalize(); // reflexo de luz (em cima, para dentro)
    const c1 = new THREE.Mesh(catchGeo, catchMat);
    c1.position.copy(dir).multiplyScalar(eyeR * 1.01);
    c1.lookAt(dir.clone().multiplyScalar(2));
    const dir2 = new THREE.Vector3(0.22 * side, -0.3, 0.93).normalize();
    const c2 = new THREE.Mesh(catch2Geo, catchMat);
    c2.position.copy(dir2).multiplyScalar(eyeR * 1.01);
    c2.lookAt(dir2.clone().multiplyScalar(2));
    grp.add(c1, c2);
    headBone.add(grp);
    eyes.push(grp);
  }
  // nariz de botão
  const noseGeo = new THREE.SphereGeometry(design.face.noseR, 28, 18);
  {
    const p = noseGeo.attributes.position;
    const r = design.face.noseR;
    for (let i = 0; i < p.count; i++) {
      let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
      x *= 1.28;
      y *= y > 0 ? 0.92 : 0.78;
      z *= 0.85;
      // narinas: leve afundamento
      for (const sx of [1, -1]) {
        const dx = x - sx * r * 0.5, dy = y + r * 0.12, dz = z - r * 0.8;
        const dd = (dx * dx + dy * dy * 1.5 + dz * dz) / (r * r * 0.09);
        const k = Math.exp(-dd) * r * 0.18;
        z -= k;
      }
      p.setXYZ(i, x, y, z);
    }
    noseGeo.computeVertexNormals();
  }
  const nose = new THREE.Mesh(noseGeo, noseMat);
  nose.position.copy(toHead(design.face.nose));
  nose.rotation.x = -0.15;
  headBone.add(nose);
  // boca: linha escura que abre no latido, com língua
  const mouth = new THREE.Group();
  mouth.position.copy(toHead(design.face.mouth));
  const lip = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), lipMat);
  const tongue = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), tongueMat);
  mouth.add(lip, tongue);
  headBone.add(mouth);
  const mouthW = 0.017 * s * P.hs;

  // Língua do Lambe-Lambe: sai da boca em dois gomos (base e ponta) que a animação estica e enrola para cima.
  // Os gomos são elipsoides que começam no pivô (z = 0) e vão até z = 1 antes da escala.
  const lickMat = new THREE.MeshPhysicalMaterial({ color: '#ef6f86', roughness: 0.3, clearcoat: 0.7, clearcoatRoughness: 0.2, emissive: '#5a1420', emissiveIntensity: 0.25 });
  const lobeGeo = new THREE.SphereGeometry(0.5, 18, 12).translate(0, 0, 0.5);
  {
    // sulco no meio e borda um pouco mais fina: lê como língua, não como bala
    const p = lobeGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      const groove = Math.exp(-(x * x) / 0.012) * 0.12 * (y > 0 ? 1 : 0);
      p.setY(i, y * (1 - 0.35 * Math.abs(x) / 0.5) - groove);
    }
    lobeGeo.computeVertexNormals();
  }
  const lickRoot = new THREE.Group();
  lickRoot.position.set(0, -0.004 * s, 0.002 * s);
  const lickBase = new THREE.Mesh(lobeGeo, lickMat);
  const lickTipPivot = new THREE.Group();
  const lickTip = new THREE.Mesh(lobeGeo, lickMat);
  lickTipPivot.add(lickTip);
  lickRoot.add(lickBase, lickTipPivot);
  lickRoot.visible = false;
  mouth.add(lickRoot);
  const lickTongue = { root: lickRoot, base: lickBase, tipPivot: lickTipPivot, tip: lickTip, width: 0.032 * s * P.hs, length: 0.11 * s * P.hs };

  return { eyes, lip, tongue, mouthW, lickTongue };
}
