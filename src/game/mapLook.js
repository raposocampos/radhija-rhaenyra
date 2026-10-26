// Olhar o mapa das fases sem andar com as dogs: arrastar (o mouse, ou um dedo fora do joystick e dos botões), a
// rodinha e a pinça (aproximar e afastar) e o analógico direito do controle deslocam o ponto que a câmera olha. Quando
// a dog ativa volta a andar, o olhar volta para ela devagar. Só vale com `enabled` (o jogo liga no mapa, passeando).
// API: createMapLook({ element }) → { enabled, x, z, zoom, update(dt, { moving, stick, basis, distance, fov, pitch }), reset() }

const MAX_PAN = 45; // m do ponto da dog
const STICK_SPEED = 13; // m/s no analógico todo inclinado (na distância normal)

/**
 * @param {{ element?: HTMLElement | null }} opts element: a tela do jogo (o canvas)
 */
export function createMapLook({ element = null } = {}) {
  const S = { enabled: false, x: 0, z: 0, zoom: 1 };
  /** @type {Map<number, { x: number, y: number }>} */
  const pointers = new Map();
  let pinch = null; // { d0, zoom0 }
  // movimento pedido pelos eventos, aplicado no update (com a base da câmera de agora)
  const pend = { dx: 0, dy: 0 };

  const two = () => [...pointers.values()];
  function onDown(e) {
    if (!S.enabled || e.target !== element) return;
    // o mouse arrasta com qualquer botão; o toque, com o dedo que caiu na tela (fora do joystick e dos botões)
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 2) {
      const [a, b] = two();
      pinch = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, zoom0: S.zoom };
    }
    element.setPointerCapture?.(e.pointerId);
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p || !S.enabled) return;
    if (pointers.size >= 2 && pinch) {
      p.x = e.clientX;
      p.y = e.clientY;
      const [a, b] = two();
      const d = Math.hypot(a.x - b.x, a.y - b.y) || 1;
      S.zoom = clampZoom(pinch.zoom0 * (pinch.d0 / d));
      return;
    }
    pend.dx += e.clientX - p.x;
    pend.dy += e.clientY - p.y;
    p.x = e.clientX;
    p.y = e.clientY;
  }
  function onUp(e) {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
  }
  function onWheel(e) {
    if (!S.enabled) return;
    e.preventDefault();
    S.zoom = clampZoom(S.zoom * Math.exp(e.deltaY * 0.0012));
  }
  const clampZoom = (k) => Math.max(0.55, Math.min(1.9, k));
  if (element) {
    element.addEventListener('pointerdown', onDown);
    addEventListener('pointermove', onMove);
    addEventListener('pointerup', onUp);
    addEventListener('pointercancel', onUp);
    element.addEventListener('wheel', onWheel, { passive: false });
    element.addEventListener('contextmenu', (e) => { if (S.enabled) e.preventDefault(); });
  }

  return {
    get enabled() { return S.enabled; },
    set enabled(on) {
      S.enabled = !!on;
      if (!on) { pointers.clear(); pinch = null; pend.dx = pend.dy = 0; }
    },
    get x() { return S.x; },
    get z() { return S.z; },
    get zoom() { return S.zoom; },
    /** Olhou longe da dog (arrastou, analógico direito)? */
    get away() { return Math.hypot(S.x, S.z) > 0.6; },
    /**
     * A cada quadro (no mapa): aplica o arrasto e o analógico direito na base da câmera e, com a dog andando, volta
     * devagar. distance: da câmera ao ponto olhado (m); fov em graus; pitch: inclinação da câmera (rad);
     * viewH: altura da tela (px).
     * @param {number} dt
     * @param {{ moving?: boolean, stick?: { x: number, y: number, m: number }, basis: { fx: number, fz: number, rx: number, rz: number }, distance: number, fov: number, pitch: number, viewH: number }} ctx
     */
    update(dt, ctx) {
      if (!S.enabled) return;
      const B = ctx.basis;
      // metros por pixel no ponto olhado; na vertical, o chão inclinado estica (÷ sen da inclinação)
      const wpp = (2 * ctx.distance * Math.tan((ctx.fov * Math.PI) / 360)) / Math.max(1, ctx.viewH);
      const along = 1 / Math.max(0.3, Math.sin(ctx.pitch));
      if (pend.dx || pend.dy) {
        // o chão acompanha o dedo: arrastar para a direita leva a câmera para a esquerda
        S.x += -B.rx * pend.dx * wpp + B.fx * pend.dy * wpp * along;
        S.z += -B.rz * pend.dx * wpp + B.fz * pend.dy * wpp * along;
        pend.dx = pend.dy = 0;
      }
      const st = ctx.stick;
      if (st && st.m > 0) {
        const v = STICK_SPEED * S.zoom * dt;
        S.x += (B.rx * st.x + B.fx * st.y) * v;
        S.z += (B.rz * st.x + B.fz * st.y) * v;
      }
      if (ctx.moving && !pointers.size && !(st && st.m > 0)) {
        const k = Math.exp(-dt * 3.2);
        S.x *= k;
        S.z *= k;
      }
      const L = Math.hypot(S.x, S.z);
      if (L > MAX_PAN) { S.x *= MAX_PAN / L; S.z *= MAX_PAN / L; }
    },
    /** Volta a olhar para a dog, na distância normal (ao abrir o mapa e no atalho). */
    reset({ keepZoom = false } = {}) {
      S.x = S.z = 0;
      if (!keepZoom) S.zoom = 1;
      pend.dx = pend.dy = 0;
    },
  };
}
