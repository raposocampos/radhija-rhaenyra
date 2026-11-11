// O modo Faro (pedido do usuário em 2026-11-11: "crie tipo uma estamina para o Faro, dê a opção de ligar e desligar
// ao apertar"). Apertar o botão do Faro (V, L3 ou o do focinho no toque) LIGA a visão de cheiro: a nuvem até a próxima
// pista, as trilhas de cheiro com fiapos andando, as pistas acesas e o mundo frio e sem cor (faro.js). Apertar de novo
// DESLIGA. Enquanto ligado, as pistas ao alcance vão se revelando (uma procura a cada FARO_MODE.scanEvery s).
// O fôlego do focinho: gasta com o Faro ligado (8 s do cheio ao vazio) e recarrega desligado (5 s do vazio ao cheio,
// começando 0,8 s depois de desligar). Vazio: desliga sozinho, a dog funga cansada (som, bufo cinza saindo do focinho
// e o medidor piscando) e só religa com 25%. Uma cena (cinematic) também desliga.
// Um fôlego POR DOG: trocar de dog dá fôlego novo (com o Faro ligado, a outra continua farejando com o dela); a que
// descansa recarrega.
// Lógica pura (sem three.js): o desenho é do faro.js (hold, wave, scan, sniff, tired) e o HUD ouve story:faroState
// { on, stamina, who, locked, min, tired? } (src/story/ui/faroMeter.js), emitido a cada mudança e a cada ~0,1 s
// enquanto o fôlego muda.
// API: createFaroMode({ faro, cloud?, emit, onReveal?, onTired?, snout? }) → { toggle(c) → ligou?, off(reason?),
//   update(dt, { active, cinematic }) → k (0..1), canStart(name), on, k, who, stamina, info(), reset() }.

export const FARO_MODE = Object.freeze({
  /** fôlego gasto por segundo ligado (8 s do cheio ao vazio) */
  drain: 1 / 8,
  /** fôlego recuperado por segundo desligado (5 s do vazio ao cheio) */
  regen: 1 / 5,
  /** s depois de desligar até começar a recarregar */
  regenDelay: 0.8,
  /** depois de esvaziar, só religa com este fôlego */
  minOn: 0.25,
  /** s para a visão de cheiro acender e apagar */
  fadeIn: 0.35,
  fadeOut: 0.4,
  /** s entre os avisos story:faroState enquanto o fôlego muda */
  emitEvery: 0.1,
  /** s entre as procuras de pistas ao alcance */
  scanEvery: 0.25,
  /** s entre as fungadas (o som e os fiapinhos de ar entrando no focinho) */
  sniffEvery: 1.25,
  /** s em que um segundo aperto não conta (repique do botão) */
  bounce: 0.15,
  /** s do aviso de cansada */
  tiredT: 0.9,
});

const num = (v, d = 0) => (Number.isFinite(v) ? v : d);

/**
 * O focinho de quem fareja (com a cabeça baixa, farejando): a Rhaenyra é maior.
 * @param {{ x: number, z: number, y?: number, yaw?: number, size?: string }} c
 */
export function snoutOf(c) {
  const big = c.size === 'large';
  const f = big ? 0.38 : 0.31;
  const yaw = num(c.yaw);
  return { x: num(c.x) + Math.sin(yaw) * f, y: num(c.y) + (big ? 0.36 : 0.3), z: num(c.z) + Math.cos(yaw) * f };
}

/**
 * @param {{
 *   faro?: any, cloud?: any, emit?: (name: string, payload?: object) => void,
 *   onReveal?: ((ids: string[], info: { fresh: string[], who: string | null }) => void) | null,
 *   onTired?: ((who: string | null, why: string) => void) | null,
 *   snout?: (c: any) => { x: number, y: number, z: number },
 * }} [opts]
 * faro: o faro.js (hold, wave, scan, sniff, tired; o que faltar é ignorado). onReveal: as pistas ao alcance a cada
 * procura (ids: todas as de agora; fresh: as que ainda não tinham aparecido desde que ligou). onTired: a dog ficou sem
 * fôlego (why: 'vazio' quando esvaziou ligado, 'travado' quando tentou ligar abaixo dos 25%).
 */
export function createFaroMode({ faro = null, cloud = null, emit = () => {}, onReveal = null, onTired = null, snout = snoutOf } = {}) {
  const P = FARO_MODE;
  /** @type {Map<string, { s: number, lock: boolean, rest: number }>} o fôlego de cada dog (0..1), travada, s desligada */
  const dogs = new Map();
  const dog = (name) => {
    const key = name || 'radhija';
    let d = dogs.get(key);
    if (!d) { d = { s: 1, lock: false, rest: P.regenDelay }; dogs.set(key, d); }
    return d;
  };
  const S = {
    on: false, k: 0, who: /** @type {string | null} */ (null), active: /** @type {string | null} */ (null), cine: false,
    bounce: 0, emitT: 0, scanT: 0, sniffT: 0, tiredT: 0,
    /** @type {any} */ from: null, seen: new Set(), /** @type {any} */ last: null,
  };

  /** Onde a dog está e o focinho dela (para o faro.js). */
  function pose(c) {
    let n = null;
    try { n = snout(c); } catch (_) { n = null; }
    if (!n || !Number.isFinite(n.x) || !Number.isFinite(n.y) || !Number.isFinite(n.z)) n = snoutOf(c);
    return { x: num(c.x), z: num(c.z), y: num(c.y), yaw: num(c.yaw), nose: n, who: c.name ?? null };
  }

  /** A dog pode ligar o Faro agora (tem fôlego e não está travada depois de esvaziar)? */
  function canStart(name) {
    const d = dog(name);
    return d.s > 0.001 && !d.lock;
  }

  /** O aviso para o HUD: a cada mudança e a cada ~0,1 s enquanto o fôlego muda. */
  function state(force = false, extra = null) {
    const name = S.on ? S.who : (S.active || S.who || 'radhija');
    const d = dog(name);
    const st = { on: S.on, stamina: Math.round(d.s * 1000) / 1000, who: name, locked: d.lock, min: P.minOn };
    if (extra) Object.assign(st, extra);
    const l = S.last;
    const shape = !l || l.on !== st.on || l.who !== st.who || l.locked !== st.locked;
    const moved = !!l && l.stamina !== st.stamina && (S.emitT <= 0 || st.stamina <= 0 || st.stamina >= 1);
    if (!force && !extra && !shape && !moved) return;
    S.last = st;
    S.emitT = P.emitEvery;
    emit('story:faroState', st);
  }

  /** As pistas ao alcance de `p` (as de agora; onReveal recebe também as novas desde que ligou). */
  function scan(p) {
    if (!p || typeof faro?.scan !== 'function') return [];
    const ids = faro.scan(p) || [];
    if (!ids.length) return ids;
    const fresh = ids.filter((id) => !S.seen.has(id));
    for (const id of fresh) S.seen.add(id);
    onReveal?.(ids.slice(), { fresh, who: S.who });
    return ids;
  }

  /** A dog sem fôlego: bufo cinza no focinho, o som, e o medidor pisca (story:faroState com tired). */
  function tired(c, why) {
    S.tiredT = P.tiredT;
    const p = c ? pose(c) : S.from;
    faro?.tired?.(p);
    emit('story:sfx', { name: 'faro-cansado', x: p?.x ?? 0, z: p?.z ?? 0 });
    onTired?.(c?.name ?? S.who, why);
    state(true, { tired: true });
  }

  function start(c) {
    if (!c || S.cine || S.bounce > 0) return false;
    S.active = c.name ?? S.active;
    if (!canStart(c.name)) { tired(c, 'travado'); return false; }
    S.on = true;
    S.who = c.name ?? 'radhija';
    S.seen.clear();
    S.bounce = P.bounce;
    S.sniffT = 0.2; // a primeira fungada logo depois da onda
    S.scanT = P.scanEvery;
    const p = pose(c);
    S.from = p;
    faro?.wave?.(p);
    emit('story:sfx', { name: 'faro-liga', x: p.x, z: p.z });
    state(true);
    scan(p); // as pistas ao alcance aparecem na hora (como no pulso)
    return true;
  }

  /** Desliga (reason: 'botao', 'cena', 'troca', 'vazio', 'reset'). → desligou agora? */
  function off(reason = 'botao') {
    if (!S.on) return false;
    S.on = false;
    dog(S.who).rest = 0;
    S.bounce = P.bounce;
    if (reason === 'botao') {
      emit('story:sfx', { name: 'faro-desliga', x: S.from?.x ?? 0, z: S.from?.z ?? 0 });
    }
    state(true);
    return true;
  }

  return {
    /** O botão do Faro: liga (→ true) ou desliga (→ false). Sem fôlego, a dog funga cansada (→ false). */
    toggle(c) {
      if (S.on) {
        if (S.bounce <= 0) off('botao');
        return false;
      }
      return start(c);
    },
    off,
    /**
     * A cada quadro (ANTES do faro.update): o fôlego, a cena, a troca de dog, as fungadas e a procura de pistas.
     * @param {number} dt @param {{ active?: any, cinematic?: boolean }} [o] active: quem está com a jogadora
     * @returns {number} k (0..1): o quanto a visão de cheiro está acesa (também vai para faro.hold)
     */
    update(dt, { active = null, cinematic = false } = {}) {
      dt = Number.isFinite(dt) ? Math.min(Math.max(dt, 0), 0.25) : 0;
      S.cine = !!cinematic;
      S.bounce = Math.max(0, S.bounce - dt);
      S.tiredT = Math.max(0, S.tiredT - dt);
      S.emitT -= dt;
      const name = active?.name ?? null;
      const swapped = !!name && name !== S.active;
      if (name) { S.active = name; dog(name); }
      // uma cena (ou ninguém com a jogadora) desliga
      if (S.on && (S.cine || !active)) off('cena');
      // trocou de dog com o Faro ligado: a outra fareja com o fôlego dela (ou, sem fôlego, desliga)
      if (S.on && name && name !== S.who) {
        if (canStart(name)) {
          dog(S.who).rest = 0;
          S.who = name;
          S.seen.clear();
          S.scanT = 0;
          S.sniffT = 0.2;
          faro?.wave?.(pose(active)); // a onda sai dela também
        } else {
          off('troca');
          tired(active, 'travado');
        }
      }
      // o fôlego: quem fareja gasta; as outras descansam e recarregam
      for (const [n, d] of dogs) {
        if (S.on && n === S.who) {
          d.s = Math.max(0, d.s - P.drain * dt);
          d.rest = 0;
        } else {
          const before = d.rest;
          d.rest += dt;
          const t = Math.min(dt, Math.max(0, d.rest - Math.max(before, P.regenDelay)));
          if (t > 0 && d.s < 1) d.s = Math.min(1, d.s + P.regen * t);
          if (d.lock && d.s >= P.minOn) d.lock = false;
        }
      }
      if (S.on && dog(S.who).s <= 0) {
        dog(S.who).lock = true;
        off('vazio');
        tired(active, 'vazio');
      }
      // acende e apaga suave
      S.k = S.on ? Math.min(1, S.k + dt / P.fadeIn) : Math.max(0, S.k - dt / P.fadeOut);
      if (active && (S.on || S.k > 0)) S.from = pose(active);
      if (S.on && S.from) {
        S.sniffT -= dt;
        if (S.sniffT <= 0) {
          S.sniffT = P.sniffEvery;
          faro?.sniff?.();
          emit('story:sfx', { name: 'fungada', x: S.from.x, z: S.from.z, volume: 0.3 });
        }
        S.scanT -= dt;
        if (S.scanT <= 0) {
          S.scanT = P.scanEvery;
          scan(S.from);
        }
      }
      faro?.hold?.(S.k, S.k > 0 ? S.from : null);
      state(swapped);
      return S.k;
    },
    canStart,
    /** Liga sem passar pelo botão (o mesmo que toggle com o Faro desligado). */
    start,
    get on() { return S.on; },
    /** 0..1: o quanto a visão de cheiro está acesa (sobe em 0,35 s, apaga em 0,4 s). */
    get k() { return S.k; },
    /** Quem está farejando (ou farejou por último). */
    get who() { return S.who; },
    /** O fôlego (0..1) de quem fareja, ou da dog com a jogadora. */
    get stamina() { return dog(S.on ? S.who : (S.active || S.who)).s; },
    /** O fôlego de uma dog (0..1). */
    staminaOf: (name) => dog(name).s,
    info() {
      const stamina = {};
      const locked = [];
      for (const [n, d] of dogs) {
        stamina[n] = Math.round(d.s * 1000) / 1000;
        if (d.lock) locked.push(n);
      }
      return { on: S.on, k: Math.round(S.k * 1000) / 1000, who: S.who, active: S.active, stamina, locked, tired: S.tiredT > 0 };
    },
    /** Tudo apagado e o fôlego cheio (o reset da área). */
    reset() {
      S.on = false;
      S.k = 0;
      S.who = null;
      S.bounce = 0;
      S.tiredT = 0;
      S.from = null;
      S.seen.clear();
      dogs.clear();
      faro?.hold?.(0, null);
      cloud?.update?.(0, 0, 0, null);
      S.last = null;
      state(true);
    },
  };
}
