// Kit de peças reutilizáveis para puzzles de fase (dicas, prompts, colecionáveis, item carregado,
// entrega no objetivo). Cada fase compõe o seu puzzle com isso + as mecânicas de src/game/mechanics/.
// Ver docs/ARQUITETURA.md §4.5 (interface de puzzle).

/** Distância até um ponto medida pelo centro OU pela cabeça da dog (o que estiver mais perto). */
export function reach(c, x, z) {
  const hl = (c.cfg.visual?.length || 0.6) * 0.42;
  const hx = c.x + Math.sin(c.yaw) * hl;
  const hz = c.z + Math.cos(c.yaw) * hl;
  return Math.min(Math.hypot(c.x - x, c.z - z), Math.hypot(hx - x, hz - z));
}

/**
 * Dicas (hint) e prompts (interact:prompt) sem repetição excessiva.
 * texts: { hint: { chave: 'texto' }, prompt: { chave: 'texto' } }
 */
export function createHints(emit, texts) {
  const S = { time: 0, next: new Map(), prev: new Set(), now: new Set(), prompt: undefined, promptKind: null };
  return {
    S,
    /** Começo de quadro (chame no início do update do puzzle). */
    frame(dt) {
      S.time += dt;
      S.prev = S.now;
      S.now = new Set();
    },
    /** Dica na borda de subida da condição (enquanto a condição dura, não repete), com cooldown. */
    cond(key, duration = 3.6, cooldown = 9) {
      S.now.add(key);
      if (S.prev.has(key)) return;
      if ((S.next.get(key) || 0) > S.time) return;
      S.next.set(key, S.time + cooldown);
      emit('hint', { text: texts.hint[key] ?? key, duration });
    },
    /** Dica imediata (ex.: ao apertar E), com cooldown curto. */
    now(key, duration = 3.6, cooldown = 2.5) {
      if ((S.next.get(key) || 0) > S.time) return;
      S.next.set(key, S.time + cooldown);
      emit('hint', { text: texts.hint[key] ?? key, duration });
    },
    setPrompt(kind, key = 'E') {
      const text = kind ? texts.prompt[kind] ?? kind : null;
      if (text === S.prompt) return;
      S.prompt = text;
      S.promptKind = kind;
      emit('interact:prompt', text ? { text, key } : { text: null });
    },
    get promptKind() { return S.promptKind; },
    reset() {
      S.next = new Map();
      S.prev = new Set();
      S.now = new Set();
      S.prompt = undefined;
      S.promptKind = null;
    },
  };
}

/** Colecionáveis: coleta automática pela dog ativa ao encostar. */
export function createCollectibles({ list, props, emit, pickupR = 0.42 }) {
  const got = new Set();
  return {
    update(active) {
      list.forEach((col, i) => {
        if (got.has(col.id)) return;
        // na altura certa: um ossinho lá em cima (col.y) só para quem está lá; quem está lá em cima não pega os do chão
        if (Math.abs((active.y || 0) - (col.y ?? 0)) > 0.6) return;
        if (Math.hypot(active.x - col.x, active.z - col.z) < pickupR) {
          got.add(col.id);
          const item = props?.collectibles?.find?.((p) => p.id === col.id) || props?.collectibles?.[i];
          item?.collect?.();
          emit('collectible:pickup', { id: col.id, x: col.x, z: col.z, count: got.size, total: list.length });
        }
      });
    },
    reset() {
      got.clear();
      props?.collectibles?.forEach?.((c) => c.reset?.());
    },
    get count() { return got.size; },
    get total() { return list.length; },
  };
}

/**
 * Item carregado na boca (cenoura, bolinha, pantufa…).
 * obj: Object3D do item (eixo longo em X local, centrado). carrier: 'any' | 'large' | 'small'.
 */
export function createCarryItem({ obj, dogs, scene, carrier = 'any', name = 'item' }) {
  const home = { parent: obj?.parent || scene, pos: obj ? obj.position.clone() : null, quat: obj ? obj.quaternion.clone() : null };
  let holder = null;
  const canCarry = (c) => carrier === 'any' || c.size === carrier;
  return {
    name,
    canCarry,
    get holder() { return holder; },
    attach(dogName) {
      holder = dogName;
      // pose da boca para o tipo do item (cenoura/bolinha/pantufa/patinho/ursinho/frisbee/meia/óculos/livro/chapéu/laço/vela/corda), se o modelo suportar
      if (['carrot', 'ball', 'slipper', 'duck', 'bear', 'frisbee', 'sock', 'glasses', 'book', 'hat', 'ribbon', 'candle', 'rope'].includes(name)) dogs[dogName]?.setCarryPose?.(name);
      if (!obj) return;
      const dog = dogs[dogName];
      (dog.mouthSocket || dog.object).add(obj);
      obj.position.set(0, 0, 0);
      obj.rotation.set(0, 0, 0);
    },
    /** Devolve à posição original (reset). */
    returnHome() {
      if (holder) dogs[holder]?.setCarryPose?.(null);
      holder = null;
      if (!obj) return;
      (home.parent || scene).add(obj);
      obj.position.copy(home.pos);
      obj.quaternion.copy(home.quat);
    },
    /** Larga no chão em (x, z) (ex.: empurrada pela gansa, se a fase quiser). */
    drop(x, z, y = 0.06) {
      if (holder) dogs[holder]?.setCarryPose?.(null);
      holder = null;
      if (!obj) return;
      (home.parent || scene).add(obj);
      obj.position.set(x, y, z);
      obj.rotation.set(0, Math.random() * Math.PI, 0);
    },
  };
}

/** A dog que carrega o item chegou ao objetivo? (a líder dentro da zona também vale, com folga) */
export function deliveredAt(goal, carrierCtrl, active) {
  if (!carrierCtrl) return false;
  const d = Math.hypot(carrierCtrl.x - goal.x, carrierCtrl.z - goal.z);
  const leaderIn = Math.hypot(active.x - goal.x, active.z - goal.z) < goal.r;
  return d < goal.r || (carrierCtrl !== active && leaderIn && d < goal.r + 0.8);
}
