// Câmera em 3ª pessoa do Modo História (decisão do usuário em 2026-11-01): atrás da cachorrinha ativa, girando livre
// em volta dela (analógico direito; arrastar com o mouse ou com o dedo na parte livre da tela; rodinha e pinça
// aproximam), desviando das paredes (o braço da câmera encurta antes de entrar numa parede) e voltando devagar
// para trás da dog quando ela anda. Dentro de um cômodo, ela chega mais perto, fica mais baixa e não passa do teto.
// Em lugar apertado (retorno do usuário em 2026-11-09: "a câmera fica sendo empurrada para uma visão de cima"), o
// braço curto NÃO vira vista de cima: a câmera sobe só até passar da cabeça da dog e olha para a frente, por cima do
// ombro dela. Só paredes encurtam o braço; móveis, árvores e o carro ficam por conta do recorte que deixa ver as dogs.
// Mesma API do cameraRig das fases (src/game/cameraRig.js): update, basis (a entrada é relativa à câmera), focusShot
// (os planos das cenas, com alvo e origem lidos por referência), snapFollow, setMode, onSwitch, setZone, setZoom.
// As fases e o mapa das fases continuam com a câmera de cima; esta só entra com layout.CAMERA.rig === 'third'.
// Configuração em layout.CAMERA.third: { distance, pitch, minPitch, maxPitch, fov, pivotY, lookY, heading, occluders,
// indoor: { distance, pitch }, ceilings: [{ minX, maxX, minZ, maxZ, y }] }.
import * as THREE from 'three';
import { readGamepad } from '../../game/input.js';

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

/** Colisores que encurtam o braço da câmera (só o que é parede: muros, casa, prédios e portas): pelo começo do id. */
const DEFAULT_OCCLUDERS = ['muro', 'casa', 'quarto', 'cozinha', 'quintal', 'torre', 'guarita', 'deposito', 'porta', 'portaozinho'];
const sstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * @param {THREE.PerspectiveCamera} camera
 * @param {import('../../types').LevelLayout} layout
 * @param {{ element?: HTMLElement | null }} [opts]
 */
export function createThirdPersonRig(camera, layout, { element = null } = {}) {
  const cfg = {
    distance: 2.8, pitch: 0.3, minPitch: 0.04, maxPitch: 0.95, fov: 56, pivotY: 0.5, lookY: 0.44, heading: Math.PI,
    occluders: DEFAULT_OCCLUDERS, ceilings: [], probe: 0.16, minDist: 0.2,
    // dentro de um cômodo (embaixo de um teto): mais perto e mais baixa
    indoor: { distance: 2.1, pitch: 0.22 },
    // braço curto (parede atrás da dog): de closeFrom m para baixo a câmera vai virando "por cima do ombro": sobe até
    // closeLift m (passa da cabeça dela) e olha closeAhead m à frente, closeLook m mais alto
    closeFrom: 1.6, closeTo: 0.45, closeLift: 0.42, closeAhead: 1.9, closeLook: 0.26,
    far: 72, // a 3ª pessoa olha o horizonte: além da névoa nada se desenha
  };
  const title = { center: { x: 0, z: 0 }, radius: 5, angle: 0.4, height: 2.4, look: { x: 0, y: 0.6, z: 0 } };
  const celebrate = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  /** @type {import('../../types').CollisionWorld | null} */
  let world = null;

  function configure(L) {
    const C = L.CAMERA || {};
    Object.assign(cfg, C.third || {});
    if (C.title) Object.assign(title, C.title);
    if (C.celebrate) { celebrate.pos.fromArray(C.celebrate.pos); celebrate.look.fromArray(C.celebrate.look); }
  }
  configure(layout);
  const farBefore = camera.far;
  camera.far = cfg.far;
  camera.updateProjectionMatrix();

  // ---------------------------------------------------------------- estado
  let heading = cfg.heading; // para onde a câmera olha, no plano (0 = +z)
  let pitch = cfg.pitch;
  let zoom = 1;
  let zoomTarget = 1;
  let dist = cfg.distance; // o braço de agora (encurta nas paredes)
  let inK = 0; // 0 ao ar livre … 1 embaixo de um teto (entra e sai suave)
  const pivot = new THREE.Vector3();
  const pivotTarget = new THREE.Vector3();
  let switchT = 0;
  let sinceInput = 99;
  let sinceStick = 99; // desde o último giro pelo analógico direito (o clique dele logo depois não vale como botão)
  // a câmera gira sozinha para trás da dog (andando e no fim das cenas). As partidas automáticas do E2E desligam: as
  // teclas delas contam com um rumo fixo.
  let autoRecenter = true;
  let lastUpdate = -1;
  let mode = 'title';
  let trans = null;
  let shot = null;
  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let fov = cfg.fov;
  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const shotPos = new THREE.Vector3();
  const shotLook = new THREE.Vector3();

  // ---------------------------------------------------------------- entrada própria (girar e aproximar)
  const drag = { yaw: 0, pitch: 0, zoom: 0 };
  const pointers = new Map();
  let pinch0 = 0;
  const onDown = (e) => {
    if (e.button > 0 && e.pointerType === 'mouse') return;
    // o arraste segue com o canvas mesmo passando por cima do HUD (e o soltar chega aqui, onde quer que seja)
    try { element.setPointerCapture?.(e.pointerId); } catch { /* sem captura: o soltar fora ainda é conferido no mover */ }
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' });
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch0 = Math.hypot(a.x - b.x, a.y - b.y);
    }
  };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    // mouse sem o botão apertado: o soltar se perdeu (fora da janela); passar o mouse por cima não gira a câmera
    if (!p.touch && !(e.buttons & 1)) { onUp(e); return; }
    if (pointers.size === 2) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinch0 > 0) drag.zoom += (pinch0 - d) / 240;
      pinch0 = d;
      return;
    }
    const k = p.touch ? 0.0075 : 0.0055;
    drag.yaw -= (e.clientX - p.x) * k;
    drag.pitch += (e.clientY - p.y) * k;
    p.x = e.clientX;
    p.y = e.clientY;
  };
  const onUp = (e) => { pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; };
  const onWheel = (e) => { drag.zoom += Math.sign(e.deltaY) * 0.12; };
  if (element?.addEventListener) {
    element.addEventListener('pointerdown', onDown);
    element.addEventListener('pointermove', onMove);
    element.addEventListener('pointerup', onUp);
    element.addEventListener('pointercancel', onUp);
    element.addEventListener('lostpointercapture', onUp);
    element.addEventListener('wheel', onWheel, { passive: true });
  }

  // ---------------------------------------------------------------- colisão do braço e teto
  const occludes = (id) => !!id && cfg.occluders.some((p) => id.startsWith(p));
  /** Até onde o braço vai sem entrar num colisor alto (no plano), a partir do pivô, na direção (dx, dz). */
  function boomReach(px, pz, dx, dz, want) {
    if (!world) return want;
    const step = 0.08;
    let free = want;
    for (let s = 0.12; s <= want + 1e-6; s += step) {
      const x = px + dx * s, z = pz + dz * s;
      const hit = world.contacts(x, z, cfg.probe, 'large').some((c) => occludes(c.id));
      // rente à parede, do lado da dog (nunca do outro lado dela, mesmo com a dog encostada)
      if (hit) { free = Math.max(cfg.minDist, s - 0.12); break; }
    }
    return free;
  }
  const ceilingAt = (x, z) => {
    for (const c of cfg.ceilings) if (x >= c.minX && x <= c.maxX && z >= c.minZ && z <= c.maxZ) return c.y;
    return Infinity;
  };
  /** A inclinação de agora: a que a jogadora escolheu, um pouco mais baixa dentro de um cômodo. */
  const pitchNow = () => clamp(pitch - (cfg.pitch - cfg.indoor.pitch) * inK, cfg.minPitch, cfg.maxPitch);

  // ---------------------------------------------------------------- poses
  function followPose(outPos, outLook) {
    const fx = Math.sin(heading), fz = Math.cos(heading);
    const p = pitchNow();
    const cp = Math.cos(p), sp = Math.sin(p);
    // braço curto: por cima do ombro, olhando para a frente (nunca de cima para baixo)
    const near = sstep(cfg.closeFrom, cfg.closeTo, dist);
    const baseY = pivot.y - cfg.pivotY;
    outLook.set(pivot.x + fx * cfg.closeAhead * near, baseY + cfg.lookY + cfg.closeLook * near, pivot.z + fz * cfg.closeAhead * near);
    outPos.set(pivot.x - fx * cp * dist, pivot.y + sp * dist + cfg.closeLift * near, pivot.z - fz * cp * dist);
    // dentro de um cômodo: sempre abaixo do teto
    const ceil = Math.min(ceilingAt(pivot.x, pivot.z), ceilingAt(outPos.x, outPos.z));
    if (pivot.y < ceil - 0.25 && outPos.y > ceil - 0.2) outPos.y = ceil - 0.2;
    let f = cfg.fov;
    if (shot) {
      const s = shot;
      let w;
      if (s.t < s.inT) w = smoother(s.t / s.inT);
      else if (s.t < s.inT + s.hold) w = 1;
      else w = 1 - smoother((s.t - s.inT - s.hold) / s.outT);
      const point = s.target || s.point;
      shotLook.set(point.x, point.y, point.z);
      if (s.from) shotPos.set(s.from.x, s.from.y, s.from.z);
      else shotPos.set(point.x - fx * cp * cfg.distance * s.scale, point.y + sp * cfg.distance * s.scale, point.z - fz * cp * cfg.distance * s.scale);
      if (s.t < s.inT) { outPos.copy(s.fromPos); outLook.copy(s.fromLook); }
      outPos.lerp(shotPos, w);
      outLook.lerp(shotLook, w);
      f = cfg.fov + (38 - cfg.fov) * w; // os planos das cenas foram compostos com a lente das fases
    }
    return f;
  }
  function titlePose(t, outPos, outLook) {
    const a = (title.angle ?? 0.4) + 0.24 * Math.sin(t * 0.11);
    const R = (title.radius ?? 5) + 0.4 * Math.sin(t * 0.07 + 1);
    outPos.set(title.center.x + Math.sin(a) * R, (title.height ?? 2.4) + 0.2 * Math.sin(t * 0.09), title.center.z + Math.cos(a) * R);
    outLook.set(title.look.x, title.look.y, title.look.z);
    return 40;
  }

  function apply() {
    camera.position.copy(pos);
    camera.lookAt(look);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  // ---------------------------------------------------------------- quadro
  function update(dt, ctx = {}) {
    const now = ctx.t ?? 0;
    // entrada (só no seguimento, sem plano de cena; depois de uma pausa, o que chegou no meio não conta)
    const stale = lastUpdate < 0 || now - lastUpdate > 0.25;
    lastUpdate = now;
    let moved = false;
    if (mode === 'follow' && !shot && !stale) {
      let g = null;
      try { g = readGamepad(); } catch { g = null; }
      const sx = g?.connected ? g.stick2?.x ?? 0 : 0;
      const sy = g?.connected ? g.stick2?.y ?? 0 : 0;
      if (Math.hypot(sx, sy) > 0.15) sinceStick = 0;
      const dy = drag.yaw - sx * 2.4 * dt;
      const dp = drag.pitch - sy * 1.5 * dt;
      if (Math.abs(dy) > 1e-5 || Math.abs(dp) > 1e-5) { heading = wrap(heading + dy); pitch = clamp(pitch + dp, cfg.minPitch, cfg.maxPitch); moved = true; }
      if (drag.zoom) zoomTarget = clamp(zoomTarget + drag.zoom, 0.6, 1.6);
    }
    drag.yaw = drag.pitch = drag.zoom = 0;
    sinceInput = moved ? 0 : sinceInput + dt;
    sinceStick += dt;
    zoom += (zoomTarget - zoom) * ease(8, dt);

    if (ctx.target) {
      const tv = ctx.target;
      pivotTarget.set(tv.x, (tv.y ?? 0) + cfg.pivotY, tv.z);
      switchT = Math.max(0, switchT - dt);
      const k = ease(switchT > 0 ? 4 : 14, dt);
      pivot.x += (pivotTarget.x - pivot.x) * k;
      pivot.z += (pivotTarget.z - pivot.z) * k;
      pivot.y += (pivotTarget.y - pivot.y) * ease(6, dt);
      // volta devagar para trás da dog quando ela anda (sem girar quando ela vem na direção da câmera)
      const speed = Math.hypot(tv.vx || 0, tv.vz || 0);
      if (autoRecenter && mode === 'follow' && !shot && speed > 0.4 && sinceInput > 1.1) {
        const want = Math.atan2(tv.vx, tv.vz);
        const diff = wrap(want - heading);
        if (Math.abs(diff) < 2.3) heading = wrap(heading + diff * ease(0.9 * Math.min(1, speed / 2), dt));
      }
    }
    // embaixo de um teto, a câmera chega mais perto e fica mais baixa (entra e sai em ~0,5 s)
    const roof = ceilingAt(pivot.x, pivot.z);
    inK += ((Number.isFinite(roof) && pivot.y < roof - 0.25 ? 1 : 0) - inK) * ease(4, dt);
    // o braço: até onde dá sem entrar numa parede (encolhe na hora, estica devagar)
    const want = (cfg.distance + (cfg.indoor.distance - cfg.distance) * inK) * zoom;
    const pn = pitchNow();
    const reach = boomReach(pivot.x, pivot.z, -Math.sin(heading), -Math.cos(heading), want * Math.cos(pn)) / Math.max(0.2, Math.cos(pn));
    dist = reach < dist ? reach : dist + (Math.min(reach, want) - dist) * ease(2.6, dt);

    if (shot) {
      shot.t += dt;
      if (shot.t > shot.inT + shot.hold + shot.outT) shot = null;
    }
    let f;
    if (mode === 'title') f = titlePose(now, tmpPos, tmpLook);
    else if (mode === 'celebrate' || mode === 'victory') { tmpPos.copy(celebrate.pos); tmpLook.copy(celebrate.look); f = 36; }
    else f = followPose(tmpPos, tmpLook);
    if (trans) {
      trans.t += dt;
      const k = smoother(trans.t / trans.dur);
      pos.lerpVectors(trans.fromPos, tmpPos, k);
      look.lerpVectors(trans.fromLook, tmpLook, k);
      fov = trans.fromFov + (f - trans.fromFov) * k;
      if (trans.t >= trans.dur) trans = null;
    } else {
      pos.copy(tmpPos);
      look.copy(tmpLook);
      fov = f;
    }
    apply();
  }

  function setMode(m, { instant = false, dur = 1.2 } = {}) {
    if (m === mode && !instant) return;
    // do título para o jogo, sem travelling: a área é grande e fechada, e ele atravessaria paredes até chegar à dog
    if (m === 'follow' && mode === 'title') instant = true;
    mode = m;
    if (instant) { trans = null; return; }
    trans = { fromPos: pos.clone(), fromLook: look.clone(), fromFov: fov, t: 0, dur };
  }
  /**
   * Põe o seguimento no alvo (reinício, troca de etapa, fim de cena). yaw (opcional): atrás de quem olha para lá. Saindo
   * de um plano de cena, a volta para trás da dog é suave (0,6 s), não um corte.
   */
  function snapFollow(x, z, yaw = null) {
    const fromShot = !!shot;
    pivot.set(x, pivot.y || cfg.pivotY, z);
    pivotTarget.copy(pivot);
    if (autoRecenter && Number.isFinite(yaw)) heading = wrap(yaw);
    dist = Math.min(dist, cfg.distance * zoom);
    shot = null;
    mode = 'follow';
    trans = fromShot ? { fromPos: pos.clone(), fromLook: look.clone(), fromFov: fov, t: 0, dur: 0.6 } : null;
    if (!fromShot) {
      fov = followPose(pos, look);
      apply();
    }
  }
  function focusShot(x, z, { hold = 1.2, inT = 0.55, outT = 0.7, scale = 0.8, y = cfg.lookY + 0.1, target = null, from = null } = {}) {
    shot = { point: new THREE.Vector3(x, y, z), target, from, t: 0, inT, hold, outT, scale, fromPos: pos.clone(), fromLook: look.clone() };
  }

  fov = titlePose(0, pos, look);
  apply();

  return {
    kind: 'third',
    update, setMode, snapFollow, focusShot, configure,
    onSwitch() { switchT = 0.9; },
    setZone() {},
    /** Gira para trás de quem olha para `yaw` (o fim das cenas: atrás da dog ativa). */
    behind(yaw) { if (autoRecenter && Number.isFinite(yaw)) heading = wrap(yaw); },
    /** O analógico direito girou a câmera agorinha? (o clique dele, nesse meio-tempo, não conta como botão) */
    stickBusy() { return sinceStick < 0.45; },
    /** O mundo de colisão da área (o braço desvia das paredes). */
    setWorld(w) { world = w || null; },
    limits: { minX: -Infinity, maxX: Infinity, minZ: -Infinity, maxZ: Infinity },
    setZoom(k) { zoomTarget = clamp(k, 0.6, 1.6); },
    get zoom() { return zoom; },
    get mode() { return mode; },
    get shotActive() { return !!shot; },
    get position() { return pos; },
    get lookTarget() { return look; },
    get heading() { return heading; },
    set heading(v) { heading = wrap(v); },
    get pitch() { return pitch; },
    get distance() { return dist; },
    get autoRecenter() { return autoRecenter; },
    set autoRecenter(on) { autoRecenter = !!on; },
    /** Base da entrada relativa à câmera: para a frente é para onde ela olha (gira junto com a câmera). */
    basis() {
      const fx = Math.sin(heading), fz = Math.cos(heading);
      return { fx, fz, rx: -fz, rz: fx };
    },
    /** Entrada sintética (testes): gira e aproxima como um arraste. */
    nudge({ yaw = 0, pitch: p = 0, zoom: z = 0 } = {}) { drag.yaw += yaw; drag.pitch += p; drag.zoom += z; },
    dispose() {
      camera.far = farBefore;
      camera.updateProjectionMatrix();
      if (!element?.removeEventListener) return;
      element.removeEventListener('pointerdown', onDown);
      element.removeEventListener('pointermove', onMove);
      element.removeEventListener('pointerup', onUp);
      element.removeEventListener('pointercancel', onUp);
      element.removeEventListener('lostpointercapture', onUp);
      element.removeEventListener('wheel', onWheel);
    },
  };
}
