// Luz de cinema do quarto (as cenas da abertura e da janela; pedido do usuário em 2026-11-10: "enquadramento, luz,
// gráficos… nível AAA"). Tudo falso e barato, sem luz de verdade nem pós-processamento novo (luz custa caro no celular
// e mudaria os programas da GPU):
//  - o feixe que entra pelo basculante (volumes de luz aditivos, com o degradê ao longo do comprimento): azul-lua de
//    noite, dourado de manhã;
//  - a mancha da janela no chão (os quatro vidros projetados, com a sombra dos caixilhos);
//  - a poeirinha brilhando no feixe (pontos, só de manhã) e o brilho quente do abajur da cômoda (só de noite);
//  - o clarão do relâmpago (o feixe e a mancha estouram por um instante).
// API: buildCinemaLight(root, L) → { object, setNight(k), setMorning(k), flash(k), update(dt, t), reset() }.
// Os materiais nascem na carga (o preparo do motor compila tudo escondido): nada compila no meio do jogo.
import * as THREE from 'three';

/** Degradê para o feixe: forte na janela, sumindo ao longo; macio nas bordas. */
function beamTexture() {
  const W = 64, H = 128;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const along = y / (H - 1); // 0 na janela, 1 no fim
    const fall = Math.pow(1 - along, 1.6) * (0.35 + 0.65 * Math.min(1, along * 6));
    for (let x = 0; x < W; x++) {
      const u = x / (W - 1);
      const edge = Math.sin(Math.PI * u) ** 1.3;
      // listras sutis, como poeira no ar
      const streak = 0.85 + 0.15 * Math.sin(u * 37 + along * 5) * Math.sin(u * 11.3);
      const v = Math.max(0, Math.min(1, fall * edge * streak));
      const i = (y * W + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * v);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** A mancha da janela no chão: 2 × 2 vidros com o caixilho escuro e a borda macia. */
function patchTexture() {
  const S = 128;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const img = g.createImageData(S, S);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const u = x / (S - 1), v = y / (S - 1);
      const soft = Math.min(1, Math.min(u, 1 - u, v, 1 - v) * 9);
      const bar = Math.abs(u - 0.5) < 0.025 || Math.abs(v - 0.5) < 0.03 ? 0.2 : 1;
      const val = soft * bar * (0.75 + 0.25 * (1 - v));
      const i = (y * S + x) * 4;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = Math.round(255 * val);
      img.data[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
/** Brilho redondo (abajur). */
function glowTexture() {
  const S = 64;
  const c = typeof document !== 'undefined' ? document.createElement('canvas') : null;
  if (!c) return null;
  c.width = S; c.height = S;
  const g = c.getContext('2d');
  if (!g) return null;
  const grad = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, S, S);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const additive = (map, color) => new THREE.MeshBasicMaterial({
  map, color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false, side: THREE.DoubleSide,
});

/**
 * @param {THREE.Object3D} root @param {any} L o layout da área
 */
export function buildCinemaLight(root, L) {
  const W = L.WINDOW;
  const group = new THREE.Group();
  group.name = 'recanto:luz-de-cinema';
  root.add(group);
  const cx = (W.x0 + W.x1) / 2;
  const ww = W.x1 - W.x0, wh = W.top - W.sill;
  // o feixe desce da janela (parede norte do quarto) para dentro do quarto, para o sul e um pouco para o leste
  const drop = new THREE.Vector3(0.35, -1.0, 1.45).normalize();
  const len = (W.sill + wh * 0.5) / -drop.y * 1.05;

  const beamMap = beamTexture();
  const beamMat = additive(beamMap, new THREE.Color('#ffd9a0'));
  // três lâminas cruzadas formam o volume do feixe (de qualquer ângulo, ele tem corpo)
  const beam = new THREE.Group();
  beam.name = 'luz:feixe';
  for (const [rx, sx] of [[0, 1], [Math.PI / 2, 0.55], [Math.PI / 4, 0.8]]) {
    const geo = new THREE.PlaneGeometry(ww * sx, len, 1, 1);
    geo.translate(0, -len / 2, 0); // o alto da lâmina na janela
    const m = new THREE.Mesh(geo, beamMat);
    m.rotation.y = rx;
    m.renderOrder = 905;
    m.frustumCulled = false;
    beam.add(m);
  }
  // orienta o eixo −Y local na direção do feixe, com o topo no meio da janela, um pouco para dentro
  beam.position.set(cx, W.sill + wh * 0.55, W.z + 0.12);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), drop);
  group.add(beam);

  // a mancha no chão, onde o feixe bate
  const hit = beam.position.clone().addScaledVector(drop, len * 0.96);
  const patchMat = additive(patchTexture(), new THREE.Color('#ffcf8a'));
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(ww * 1.25, wh * 1.5), patchMat);
  patch.name = 'luz:mancha-da-janela';
  patch.rotation.x = -Math.PI / 2;
  patch.rotation.z = -0.24;
  patch.position.set(hit.x, (L.HOUSE.floorY ?? 0.04) + 0.012, hit.z - 0.15);
  patch.renderOrder = 904;
  group.add(patch);

  // a poeirinha no feixe (de manhã)
  const N = 90;
  const dustPos = new Float32Array(N * 3);
  const dustSeed = new Float32Array(N);
  for (let i = 0; i < N; i++) dustSeed[i] = Math.random();
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dustMat = new THREE.PointsMaterial({
    color: '#fff1cf', size: 0.018, sizeAttenuation: true, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
  });
  const dust = new THREE.Points(dustGeo, dustMat);
  dust.name = 'luz:poeira';
  dust.frustumCulled = false;
  dust.renderOrder = 906;
  group.add(dust);

  // o abajur da cômoda (de noite): um brilho quente
  const glowMat = new THREE.SpriteMaterial({ map: glowTexture(), color: '#ffb35c', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, toneMapped: false });
  const lamp = new THREE.Sprite(glowMat);
  lamp.name = 'luz:abajur';
  const D = L.DRESSER;
  lamp.position.set(D.x + D.hx * 0.6, D.h + 0.38, D.z - 0.02);
  lamp.scale.setScalar(0.9);
  lamp.renderOrder = 906;
  group.add(lamp);

  const S = { night: 0, morning: 0, flash: 0 };
  const NIGHT_C = new THREE.Color('#7f9cff'), DAY_C = new THREE.Color('#ffd49a'), WHITE = new THREE.Color('#e8f0ff');
  const tmp = new THREE.Color();
  function apply() {
    const k = Math.max(S.night * 0.55, S.morning);
    tmp.copy(NIGHT_C).lerp(DAY_C, S.morning / Math.max(1e-4, S.night + S.morning)).lerp(WHITE, S.flash);
    beamMat.color.copy(tmp);
    patchMat.color.copy(tmp);
    beamMat.opacity = Math.min(1, 0.32 * k + 0.9 * S.flash);
    patchMat.opacity = Math.min(1, 0.55 * k + 0.9 * S.flash);
    dustMat.opacity = 0.75 * S.morning;
    glowMat.opacity = 0.85 * S.night;
    group.visible = k > 0.001 || S.flash > 0.001 || S.night > 0.001;
  }
  apply();

  return {
    object: group,
    /** A luz da lua pelo basculante e o abajur aceso (0..1). */
    setNight(k) { S.night = Math.max(0, Math.min(1, k)); apply(); },
    /** O sol da manhã pelo basculante, com a poeira (0..1). */
    setMorning(k) { S.morning = Math.max(0, Math.min(1, k)); apply(); },
    /** O clarão do relâmpago (0..1, a cena manda e deixa cair). */
    flash(k) { S.flash = Math.max(0, Math.min(1, k)); apply(); },
    update(dt, t) {
      if (!group.visible || S.morning <= 0.001) return;
      // a poeira sobe e desce devagar dentro do feixe
      for (let i = 0; i < N; i++) {
        const s = dustSeed[i];
        const a = (s * 7.3 + t * 0.03 * (0.5 + s)) % 1;
        const p = beam.position.clone().addScaledVector(drop, len * (0.08 + 0.85 * a));
        dustPos[i * 3] = p.x + Math.sin(t * 0.4 + s * 40) * ww * 0.35;
        dustPos[i * 3 + 1] = p.y + Math.sin(t * 0.7 + s * 17) * 0.06;
        dustPos[i * 3 + 2] = p.z + Math.cos(t * 0.5 + s * 23) * 0.18;
      }
      dustGeo.attributes.position.needsUpdate = true;
      void dt;
    },
    reset() { S.night = 0; S.morning = 0; S.flash = 0; apply(); },
  };
}
