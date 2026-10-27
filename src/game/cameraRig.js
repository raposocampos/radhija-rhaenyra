// Câmera: seguimento elevado em diagonal com amortecimento crítico, antecipação do movimento,
// limites do cenário, planos de foco curtos, plano cinematográfico da tela inicial e plano da comemoração.
// Toda troca de modo é uma transição suave (smootherstep) da pose atual para a pose viva do novo modo.
import * as THREE from 'three';

const smoother = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * x * (x * (x * 6 - 15) + 10));

/** SmoothDamp (amortecimento crítico) por eixo para Vector3. */
function damp3(cur, target, vel, smoothTime, dt) {
  const omega = 2 / Math.max(1e-4, smoothTime);
  const x = omega * dt;
  const e = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  for (const a of ['x', 'y', 'z']) {
    const change = cur[a] - target[a];
    const temp = (vel[a] + omega * change) * dt;
    vel[a] = (vel[a] - omega * temp) * e;
    cur[a] = target[a] + (change + temp) * e;
  }
}

/**
 * @param {import('three').PerspectiveCamera} camera
 * @param {import('../types').LevelLayout} layout
 */
export function createCameraRig(camera, layout) {
  // Tudo o que depende da fase vem de layout.CAMERA (ver configure). Valores padrão = fase 1.
  const offset = new THREE.Vector3();
  // aproximar/afastar no seguimento (o mapa das fases: rodinha e pinça); 1 = a distância da fase
  let zoom = 1;
  let zoomTarget = 1;
  let baseFov = 38;
  let lookHeight = 0.3;
  // Limites do ponto de foco (evita mostrar o vazio além do cenário).
  const limits = { minX: -3.3, maxX: 4.3, minZ: -3.75, maxZ: 2.3 };
  const titleCfg = { cx: -2.5, cz: -3.4, R: 5.6, Ramp: 0.45, a0: 0.5, aAmp: 0.24, h: 2.0, hAmp: 0.22, look: new THREE.Vector3(-2.85, 0.85, -3.55), lookSway: 0.3, fov: 36 };
  const celebrate = { pos: new THREE.Vector3(), look: new THREE.Vector3() };
  /** @type {NonNullable<import('../types').CameraConfig['zones']>} */
  let zones = [];
  const zoneOff = new Set(); // ids de zonas desligadas pela fase (cam.setZone)
  const zoneBias = new THREE.Vector3(); // deslocamento atual (x, y = altura extra do olhar, z), amortecido
  const zoneAt = (p) => zones.find((q) => !(q.id && zoneOff.has(q.id)) && p.x >= q.minX && p.x <= q.maxX && p.z >= q.minZ && p.z <= q.maxZ);
  const victoryOffset = { pos: new THREE.Vector3(1.1, 0.25, 0.7), look: new THREE.Vector3(1.22, 0.14, 0) };

  /** Reconfigura a câmera para o layout de uma fase (chamado a cada carregamento de fase). */
  /** @param {import('../types').LevelLayout} L */
  function configure(L) {
    const C = L.CAMERA;
    offset.set(...C.offset);
    baseFov = C.fov ?? 38;
    lookHeight = C.lookHeight ?? 0.3;
    if (C.limits) Object.assign(limits, C.limits);
    zones = C.zones || [];
    zoneOff.clear();
    zoom = zoomTarget = 1;
    zoneBias.set(0, 0, 0);
    if (C.title) {
      const T = C.title;
      Object.assign(titleCfg, {
        cx: T.center.x, cz: T.center.z, R: T.radius ?? 5.6, Ramp: T.radiusAmp ?? 0.45,
        a0: T.angle ?? 0.5, aAmp: T.angleAmp ?? 0.24, h: T.height ?? 2.0, hAmp: T.heightAmp ?? 0.22,
        lookSway: T.lookSway ?? 0.3, fov: T.fov ?? 36,
      });
      titleCfg.look.set(T.look.x, T.look.y, T.look.z);
    }
    celebrate.pos.set(...C.celebrate.pos);
    celebrate.look.set(...C.celebrate.look);
    if (C.victoryOffset) {
      victoryOffset.pos.set(...C.victoryOffset.pos);
      victoryOffset.look.set(...C.victoryOffset.look);
    }
  }
  configure(layout);

  const pos = new THREE.Vector3();
  const look = new THREE.Vector3();
  let fov = baseFov;

  // Seguimento
  const focus = new THREE.Vector3();
  const focusVel = new THREE.Vector3();
  const focusTarget = new THREE.Vector3();
  const lead = new THREE.Vector3();
  let switchT = 0; // após trocar de dog, seguimento mais macio

  // Plano de foco curto
  let shot = null; // { point: Vector3, target?, from?, t, inT, hold, outT, scale }

  // Transição entre modos
  let mode = 'title';
  let trans = null; // { fromPos, fromLook, fromFov, t, dur }

  const tmpPos = new THREE.Vector3();
  const tmpLook = new THREE.Vector3();
  const shotPos = new THREE.Vector3();
  const shotLook = new THREE.Vector3();

  function clampFocus(v) {
    v.x = Math.min(limits.maxX, Math.max(limits.minX, v.x));
    v.z = Math.min(limits.maxZ, Math.max(limits.minZ, v.z));
    return v;
  }

  function titlePose(t, outPos, outLook) {
    // Plano lento: leve arco + respiração de altura sobre o ponto de interesse da fase.
    const T = titleCfg;
    const a = T.a0 + T.aAmp * Math.sin(t * 0.11);
    const R = T.R + T.Ramp * Math.sin(t * 0.07 + 1.0);
    outPos.set(T.cx + Math.sin(a) * R, T.h + T.hAmp * Math.sin(t * 0.09), T.cz + Math.cos(a) * R);
    outLook.set(T.look.x + T.lookSway * Math.sin(t * 0.05), T.look.y, T.look.z);
    return T.fov;
  }

  function followPose(outPos, outLook) {
    outLook.set(focus.x, lookHeight, focus.z);
    outPos.copy(outLook).addScaledVector(offset, zoom);
    outPos.y = offset.y * zoom; // altura absoluta (chão plano)
    outLook.y = lookHeight;
    // zona: a câmera fica no mesmo lugar e o olhar sobe/avança (dx, dz deslocam os dois)
    outPos.x += zoneBias.x;
    outPos.z += zoneBias.z;
    outLook.x += zoneBias.x;
    outLook.z += zoneBias.z;
    outLook.y += zoneBias.y;
    let f = baseFov;
    if (shot) {
      const s = shot;
      let w;
      if (s.t < s.inT) w = smoother(s.t / s.inT);
      else if (s.t < s.inT + s.hold) w = 1;
      else w = 1 - smoother((s.t - s.inT - s.hold) / s.outT);
      const point = s.target || s.point;
      shotLook.set(point.x, point.y, point.z);
      if (s.from) shotPos.set(s.from.x, s.from.y, s.from.z);
      else shotPos.copy(offset).multiplyScalar(s.scale).add(shotLook);
      // Entrar de onde a câmera está, inclusive ao substituir outro plano.
      if (s.t < s.inT) { outPos.copy(s.fromPos); outLook.copy(s.fromLook); }
      outPos.lerp(shotPos, w);
      outLook.lerp(shotLook, w);
      f = baseFov - 2 * w;
    }
    return f;
  }

  function setMode(m, { instant = false, dur = 1.2 } = {}) {
    if (m === mode && !instant) return;
    mode = m;
    if (instant) {
      trans = null;
      return;
    }
    trans = { fromPos: pos.clone(), fromLook: look.clone(), fromFov: fov, t: 0, dur };
  }

  /** Posiciona o seguimento instantaneamente no alvo (reinício). */
  function snapFollow(x, z) {
    focus.set(x, 0, z);
    clampFocus(focus);
    const zn = zoneAt(focus);
    zoneBias.set(zn?.dx ?? 0, zn?.lookY ?? 0, zn?.dz ?? 0);
    focusVel.set(0, 0, 0);
    lead.set(0, 0, 0);
    shot = null;
    mode = 'follow';
    trans = null;
    fov = followPose(pos, look);
    apply();
  }

  /** `from` (opcional): de onde a câmera olha (sem ele, do lado de sempre, a `scale` do afastamento normal). */
  function focusShot(x, z, { hold = 1.2, inT = 0.55, outT = 0.7, scale = 0.8,
    y = lookHeight + 0.1, target = null, from = null } = {}) {
    shot = { point: new THREE.Vector3(x, y, z), target, from, t: 0, inT, hold, outT, scale,
      fromPos: pos.clone(), fromLook: look.clone() };
  }

  /** Liga ou desliga uma zona do layout pelo id (a fase decide quando ela faz sentido); a volta é suave. */
  function setZone(id, on) {
    if (on) zoneOff.delete(id);
    else zoneOff.add(id);
  }

  function onSwitch() {
    switchT = 1.1;
  }

  function apply() {
    camera.position.copy(pos);
    camera.lookAt(look);
    if (Math.abs(camera.fov - fov) > 1e-3) {
      camera.fov = fov;
      camera.updateProjectionMatrix();
    }
  }

  /**
   * ctx: { t, target: {x,z,vx,vz} } (alvo = dog ativa)
   */
  function update(dt, ctx) {
    zoom += (zoomTarget - zoom) * (1 - Math.exp(-dt * 8));
    // Seguimento sempre atualizado (para que as transições terminem numa pose viva).
    if (ctx.target) {
      const tv = ctx.target;
      const lx = Math.max(-0.75, Math.min(0.75, tv.vx * 0.32));
      const lz = Math.max(-0.75, Math.min(0.75, tv.vz * 0.32));
      const k = 1 - Math.exp(-dt * 2.5);
      lead.x += (lx - lead.x) * k;
      lead.z += (lz - lead.z) * k;
      focusTarget.set(tv.x + lead.x, 0, tv.z + lead.z);
      clampFocus(focusTarget);
      switchT = Math.max(0, switchT - dt);
      const st = 0.24 + 0.4 * Math.min(1, switchT / 0.8);
      damp3(focus, focusTarget, focusVel, st, dt);
      if (zones.length) {
        const zn = zoneAt(focus);
        const kz = 1 - Math.exp(-dt * 2.2);
        zoneBias.x += ((zn?.dx ?? 0) - zoneBias.x) * kz;
        zoneBias.y += ((zn?.lookY ?? 0) - zoneBias.y) * kz;
        zoneBias.z += ((zn?.dz ?? 0) - zoneBias.z) * kz;
      }
    }
    if (shot) {
      shot.t += dt;
      if (shot.t > shot.inT + shot.hold + shot.outT) shot = null;
    }

    let f;
    if (mode === 'title') f = titlePose(ctx.t, tmpPos, tmpLook);
    else if (mode === 'celebrate') {
      tmpPos.copy(celebrate.pos);
      tmpLook.copy(celebrate.look);
      f = 33;
    } else if (mode === 'victory') {
      // Dogs no terço esquerdo: o painel de vitória (centralizado) não as cobre.
      const drift = Math.sin(ctx.t * 0.25) * 0.08;
      tmpPos.copy(celebrate.pos).add(victoryOffset.pos);
      tmpPos.x += drift;
      tmpLook.copy(celebrate.look).add(victoryOffset.look);
      f = 34;
    } else f = followPose(tmpPos, tmpLook);

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

  // Pose inicial
  fov = titlePose(0, pos, look);
  apply();

  return {
    update, setMode, snapFollow, focusShot, onSwitch, setZone, limits, configure,
    /** Aproximar (< 1) ou afastar (> 1) no seguimento, suave. */
    setZoom(k) { zoomTarget = Math.max(0.45, Math.min(2.2, k)); },
    get zoom() { return zoom; },
    get mode() { return mode; },
    get shotActive() { return !!shot; },
    get position() { return pos; },
    get lookTarget() { return look; },
    /** Base de entrada relativa à câmera (fixa no seguimento: não muda durante os planos). */
    basis() {
      const fx = -offset.x;
      const fz = -offset.z;
      const L = Math.hypot(fx, fz);
      return { fx: fx / L, fz: fz / L, rx: -fz / L, rz: fx / L };
    },
  };
}
