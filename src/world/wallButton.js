// Botão ou alavanca no alto da parede, com as patinhas pintadas que mostram onde a Rhaenyra pega impulso
// (mecânica em src/game/mechanics/wallButton.js; pose em src/dogs/dogAnimation.js). Tudo procedural.
// Referencial local: a parede é o plano z = 0 (frente para +Z), origem no chão embaixo do botão, y para cima.
// Posicione o grupo no pé da parede (spot.x, 0, spot.z) com rotation.y = atan2(nx, nz) (wallButtonYaw).
//   kind 'button': placa esmaltada, botão de cogumelo com patinha, anel de dez luzes (o tempo que falta).
//   kind 'lever': placa com trilho, alavanca de bolinha que desce quando liga e uma lâmpada.
// Devolve um WallButtonProp: setPress(t), setOn(on), setTimer(k | null), update(dt, t).
// `top` é a altura do que a pata toca (o meio do botão; a bolinha da alavanca levantada). Saliência e patinhas
// seguem WALL_BUTTON_SHAPE (a mecânica passa as mesmas medidas para a pose da Rhaenyra).
import * as THREE from 'three';
import { rbox, canvasTexture, stdMat, brassMat } from './util.js';
import { WALL_BUTTON_SHAPE } from '../game/mechanics/wallButton.js';

const TAU = Math.PI * 2;
const LEDS = 10;
const LEVER_LEN = 0.1; // eixo → centro da bolinha
const MARKS_BASE = 0.22; // a pintura das patinhas começa a esta altura
const ARM_UP = 0.35; // levantada: quase em pé, um pouco para fora
const ARM_DOWN = Math.PI - 0.35; // puxada: para baixo

/** rotation.y que leva o +Z local para a normal da parede (nx, nz). */
export const wallButtonYaw = (nx, nz) => Math.atan2(nx, nz);

/** Uma patinha (almofada + quatro dedos) no contexto 2D, centrada em (x, y), apontando para cima. */
function pawPrint(g, x, y, size, tilt = 0) {
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  const s = size;
  g.beginPath();
  // almofada: "coração" arredondado
  g.moveTo(0, -0.05 * s);
  g.bezierCurveTo(0.34 * s, -0.12 * s, 0.44 * s, 0.3 * s, 0.2 * s, 0.38 * s);
  g.bezierCurveTo(0.1 * s, 0.42 * s, 0.04 * s, 0.33 * s, 0, 0.33 * s);
  g.bezierCurveTo(-0.04 * s, 0.33 * s, -0.1 * s, 0.42 * s, -0.2 * s, 0.38 * s);
  g.bezierCurveTo(-0.44 * s, 0.3 * s, -0.34 * s, -0.12 * s, 0, -0.05 * s);
  g.fill();
  for (const [dx, dy, r] of [[-0.36, -0.2, 0.12], [-0.13, -0.38, 0.13], [0.13, -0.38, 0.13], [0.36, -0.2, 0.12]]) {
    g.beginPath();
    g.ellipse(dx * s, dy * s, r * s * 0.86, r * s, dx * 0.5, 0, TAU);
    g.fill();
  }
  g.restore();
}

/**
 * As patinhas pintadas na parede (a textura começa a MARKS_BASE m do chão e tem height × width m): duas traseiras
 * onde ela pega impulso (a 0,36 m do chão), as duas dianteiras dos lados da placa (side m do meio, 5 cm abaixo do
 * topo da textura) e setinhas subindo até a placa (arrowTop m acima da base). Tinta branca com falhas de pincel
 * seco (o material tinge).
 */
function pawMarksTexture(height, width, side, arrowTop) {
  const W = 160;
  const H = Math.round((W * height) / width);
  return canvasTexture(W, H, (g) => {
    g.clearRect(0, 0, W, H);
    const px = W / width; // pixels por metro
    const xOf = (m) => W / 2 + m * px; // +X da parede = direita da textura (= esquerda de quem olha para ela de costas)
    const yOf = (m) => H - m * px; // altura acima da base → linha
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const pawS = 0.075 * px;
    const hind = 0.36 - MARKS_BASE;
    pawPrint(g, xOf(-0.055), yOf(hind + 0.01), pawS, -0.12);
    pawPrint(g, xOf(0.055), yOf(hind - 0.01), pawS, 0.12);
    pawPrint(g, xOf(-side), yOf(height - 0.05), pawS * 0.92, -0.22);
    pawPrint(g, xOf(side), yOf(height - 0.06), pawS * 0.92, 0.22);
    // setinhas para cima, das traseiras até a placa
    g.strokeStyle = 'rgba(255,255,255,0.8)';
    g.lineWidth = Math.max(2, 0.012 * px);
    g.lineCap = 'round';
    g.lineJoin = 'round';
    const y0 = yOf(hind + 0.07);
    const y1 = yOf(arrowTop);
    const n = Math.max(1, Math.floor((y0 - y1) / (0.085 * px)));
    for (let i = 0; i < n; i++) {
      const y = y0 - ((i + 0.5) * (y0 - y1)) / n;
      const w = 0.03 * px;
      g.beginPath();
      g.moveTo(W / 2 - w, y + w * 0.7);
      g.lineTo(W / 2, y);
      g.lineTo(W / 2 + w, y + w * 0.7);
      g.stroke();
    }
    // falhas da tinta (pincel seco)
    g.globalCompositeOperation = 'destination-out';
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 320; i++) {
      g.fillStyle = `rgba(0,0,0,${0.15 + rnd() * 0.35})`;
      g.fillRect(rnd() * W, rnd() * H, 1 + rnd() * 3, 1 + rnd() * 2);
    }
    g.globalCompositeOperation = 'source-over';
  }, { repeat: false });
}

/** Patinha clarinha para o topo do botão (decalque). */
function capPawTexture() {
  return canvasTexture(64, 64, (g) => {
    g.clearRect(0, 0, 64, 64);
    g.fillStyle = 'rgba(255,248,236,0.96)';
    pawPrint(g, 32, 36, 34);
  }, { repeat: false });
}

/**
 * @param {{ kind?: 'button' | 'lever', top?: number, color?: string, plate?: string, trim?: string,
 *   marks?: boolean, markColor?: string, markOpacity?: number, name?: string }} [opts]
 * @returns {import('../types').WallButtonProp}
 */
export function buildWallButton({
  kind = 'button', top = 1.2, color = '#e8554a', plate = '#f4ecdc', trim = '#3f6f78',
  marks = true, markColor = '#ffffff', markOpacity = 0.8, name = 'botao-parede',
} = {}) {
  const object = new THREE.Group();
  object.name = name;
  const shape = WALL_BUTTON_SHAPE[kind];

  // ---- placa (esmalte creme com borda colorida e quatro parafusos); a da alavanca desce para caber o curso
  const plateW = 0.25;
  const plateH = kind === 'lever' ? 0.3 : 0.25;
  const plateY = kind === 'lever' ? top - 0.085 : top;
  const border = new THREE.Mesh(rbox(plateW + 0.024, plateH + 0.024, 0.012, 0.02), stdMat(trim, { roughness: 0.5 }));
  border.position.set(0, plateY, 0.009); // de 3 mm a 15 mm da parede
  const face = new THREE.Mesh(rbox(plateW, plateH, 0.02, 0.018), stdMat(plate, { roughness: 0.42 }));
  face.position.set(0, plateY, 0.016); // frente em 26 mm
  object.add(border, face);
  const FRONT = 0.026;
  const screwGeo = new THREE.SphereGeometry(0.008, 10, 6, 0, TAU, 0, Math.PI / 2).rotateX(Math.PI / 2);
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    const sc = new THREE.Mesh(screwGeo, brassMat());
    sc.position.set(sx * (plateW / 2 - 0.022), plateY + sy * (plateH / 2 - 0.022), FRONT - 0.002);
    object.add(sc);
  }

  // ---- luzes (anel do botão ou lâmpada da alavanca): dois materiais por instância, trocados por luz
  const ledOff = new THREE.MeshStandardMaterial({ color: '#8c8a7e', roughness: 0.3, emissive: '#000000' });
  const ledOn = new THREE.MeshStandardMaterial({ color: '#d9ff9a', roughness: 0.25, emissive: '#9be05a', emissiveIntensity: 1.6 });
  const ledWarn = new THREE.MeshStandardMaterial({ color: '#ffd38a', roughness: 0.25, emissive: '#ff9a3c', emissiveIntensity: 1.6 });
  const leds = [];

  // ---- botão ou alavanca
  /** @type {THREE.MeshStandardMaterial} */
  const capMat = new THREE.MeshStandardMaterial({ color, roughness: 0.32, metalness: 0, emissive: color, emissiveIntensity: 0 });
  let cap = null;
  let arm = null;
  if (kind === 'button') {
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.011, 10, 32), stdMat('#e9e4da', { roughness: 0.25, metalness: 0.5 }));
    bezel.position.set(0, top, FRONT + 0.004);
    const housing = new THREE.Mesh(new THREE.CylinderGeometry(0.056, 0.06, 0.02, 28).rotateX(Math.PI / 2), stdMat('#2f3a3c', { roughness: 0.6 }));
    housing.position.set(0, top, FRONT + 0.004); // começa dentro da placa
    object.add(housing, bezel);
    // cogumelo: perfil girado (eixo do torno → +Z), topo quase reto para a patinha
    const prof = [[0, 0.027], [0.03, 0.026], [0.042, 0.022], [0.0485, 0.014], [0.05, 0.004], [0.05, 0]].map(([r, h]) => new THREE.Vector2(r, h));
    const capGeo = new THREE.LatheGeometry(prof.reverse(), 28).rotateX(Math.PI / 2);
    cap = new THREE.Group();
    cap.position.set(0, top, FRONT + 0.008);
    const capMesh = new THREE.Mesh(capGeo, capMat);
    capMesh.castShadow = true;
    const pawDecal = new THREE.Mesh(
      new THREE.CircleGeometry(0.026, 20),
      new THREE.MeshStandardMaterial({ map: capPawTexture(), transparent: true, depthWrite: false, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }),
    );
    pawDecal.position.z = 0.0285;
    cap.add(capMesh, pawDecal);
    object.add(cap);
    const ledGeo = new THREE.SphereGeometry(0.0085, 10, 6);
    for (let i = 0; i < LEDS; i++) {
      const a = Math.PI / 2 - (i / LEDS) * TAU; // começa no alto, sentido horário
      const led = new THREE.Mesh(ledGeo, ledOff);
      led.position.set(Math.cos(a) * 0.092, top + Math.sin(a) * 0.092, FRONT + 0.001);
      object.add(led);
      leds.push(led);
    }
  } else {
    // eixo abaixo do topo: levantada (ARM_UP), a bolinha fica em (0, top, shape.out); puxada, desce pelo trilho
    const hubY = top - LEVER_LEN * Math.cos(ARM_UP);
    const hubZ = shape.out - LEVER_LEN * Math.sin(ARM_UP);
    const slot = new THREE.Mesh(rbox(0.034, 0.2, 0.008, 0.004), stdMat('#2f3a3c', { roughness: 0.7 }));
    slot.position.set(0, hubY, FRONT);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.05, 18).rotateZ(Math.PI / 2), stdMat('#c9c4bb', { roughness: 0.3, metalness: 0.6 }));
    hub.position.set(0, hubY, hubZ);
    arm = new THREE.Group();
    arm.position.copy(hub.position);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.009, LEVER_LEN, 10), stdMat('#c9c4bb', { roughness: 0.3, metalness: 0.6 }));
    rod.position.y = LEVER_LEN / 2;
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.026, 18, 12), capMat);
    knob.position.y = LEVER_LEN;
    knob.name = `${name}:bolinha`;
    rod.castShadow = knob.castShadow = true;
    arm.add(rod, knob);
    object.add(slot, hub, arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 14, 8), ledOff);
    lamp.position.set(0.08, top + 0.03, FRONT + 0.003);
    object.add(lamp);
    leds.push(lamp);
  }
  object.traverse((o) => {
    if (/** @type {THREE.Mesh} */ (o).isMesh && o !== cap) o.receiveShadow = true;
  });

  // ---- patinhas na parede: traseiras embaixo, dianteiras dos lados da placa (top − shape.paws, ±shape.side)
  if (marks) {
    const h = Math.max(0.5, top - shape.paws + 0.05 - MARKS_BASE);
    const w = 2 * (shape.side + 0.055);
    const arrowTop = plateY - plateH / 2 - 0.035 - MARKS_BASE;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({
        map: pawMarksTexture(h, w, shape.side, arrowTop), color: markColor, transparent: true, opacity: markOpacity, depthWrite: false, roughness: 0.92,
        polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
      }),
    );
    decal.name = `${name}:patinhas`;
    decal.position.set(0, MARKS_BASE + h / 2, 0.003);
    object.add(decal);
  }

  // ---- estado animado
  const S = { press: 0, on: false, timer: /** @type {number | null} */ (null), arm: 0, armTarget: 0, glow: 0, t: 0 };

  function paintLeds() {
    if (kind === 'lever') {
      leds[0].material = S.on ? ledOn : ledOff;
      return;
    }
    let lit = 0;
    if (S.timer != null) lit = Math.ceil(S.timer * LEDS - 1e-6);
    else if (S.on) lit = LEDS;
    const warn = S.timer != null && S.timer < 0.3;
    const blinkOff = warn && Math.sin(S.t * 18) < 0;
    leds.forEach((led, i) => { led.material = i < lit && !blinkOff ? (warn ? ledWarn : ledOn) : ledOff; });
  }

  function apply() {
    if (cap) cap.position.z = FRONT + 0.008 - 0.013 * S.press;
    if (arm) arm.rotation.x = S.arm;
    // brilho: ligado aceso; desligado, um pulso fraquinho a cada ~2,4 s chama a atenção
    capMat.emissiveIntensity = S.on ? 0.55 : S.glow;
    paintLeds();
  }

  S.arm = S.armTarget = ARM_UP;
  apply();

  return {
    object,
    setPress(t) {
      S.press = THREE.MathUtils.clamp(t || 0, 0, 1);
      if (kind === 'lever' && S.press > 0) S.arm = Math.max(S.arm, ARM_UP + (ARM_DOWN - ARM_UP) * 0.35 * S.press);
      apply();
    },
    setOn(on) {
      S.on = !!on;
      S.armTarget = S.on ? ARM_DOWN : ARM_UP;
      apply();
    },
    setTimer(k) {
      S.timer = k == null ? null : THREE.MathUtils.clamp(k, 0, 1);
      apply();
    },
    update(dt, t) {
      S.t = t;
      const pulse = Math.max(0, Math.sin(t * TAU / 2.4)) ** 6;
      S.glow = 0.04 + 0.16 * pulse;
      if (arm) S.arm += (S.armTarget - S.arm) * (1 - Math.exp(-dt * 10));
      apply();
    },
  };
}
