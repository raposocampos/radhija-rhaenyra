// O narrador das cenas em HQ (pedido do usuário em 2026-11-10: diálogo "estilo mangá ou Scott Pilgrim, como se
// estivéssemos lendo uma HQ dentro do jogo"). Acrescenta ao diretor (src/story/scene/director.js) o que as cenas usam
// para falar e para montar a página; o desenho é da camada de HQ (src/story/ui/comic.js) e das legendas do jogo
// (src/story/ui/storyHud.js). Só eventos: nada aqui mexe no estado da missão.
//  - say(quem, texto, { mood, dur, mode }) → balão com texto (cena) ou legenda curta (jogo); a boca de quem fala mexe
//    enquanto o texto digita (o `talk` do ator na trava do diretor). O ponto do balão acompanha a cabeça a cada quadro.
//  - comic(on), panel(layout, slot, …), onomato(texto, …), caption(texto, sub, …), fx(tipo, …): a página de HQ.
// Eventos: story:say, story:sayMove, story:sayClear, story:comic, story:panel, story:onomato, story:caption, story:fx.

import { typeDuration } from '../ui/subtitles.js';

/** Os nomes de quem fala (o que aparece na etiqueta e nas legendas). */
export const SPEAKERS = {
  radhija: 'Radhija', rhaenyra: 'Rhaenyra', capitao: 'Capitão Migalha', farelo: 'Farelo', soneca: 'Soneca', porteiro: 'Seu Porteiro',
};
/** Letras por segundo da "máquina de escrever" dos balões (igual à da camada de HQ). */
export const TYPE_RATE = 45;
/** Quanto tempo uma fala fica na tela: o tempo de ler, com piso e teto. */
export const sayDuration = (text) => Math.min(5.5, Math.max(1.6, 0.9 + String(text).length / 15));

/**
 * @param {{ dir: any, emit: (name: string, payload?: object) => void,
 *   anchorOf?: (who: string) => ({ x: number, y: number, z: number } | null) }} opts
 *   anchorOf: onde fica a cabeça de quem não é dog (pombos, porteiro); as dogs vêm do diretor.
 *   cam: a câmera da história (para a lente dos planos).
 */
export function createStoryteller({ dir, emit, anchorOf = () => null, cam = () => null }) {
  let nextId = 1;
  /** As falas na tela: { id, who, t, typeT, dur } (quem fala, há quanto tempo, quanto leva digitando, quanto dura). */
  let lines = [];
  let comicOn = false;

  const DOGS = ['radhija', 'rhaenyra'];
  function anchor(who) {
    if (!who) return null;
    if (DOGS.includes(who)) return dir.head(who, 0.12);
    return anchorOf(who);
  }

  return {
    /**
     * Uma fala. mode 'cena' (balão de HQ) dentro das cenas; 'jogo' (legenda curta) fora delas.
     * @param {string | null} who @param {string} text
     * @param {{ mood?: 'normal' | 'grito' | 'sussurro' | 'sono' | 'pensa', dur?: number, mode?: 'cena' | 'jogo' }} [o]
     */
    say(who, text, { mood = 'normal', dur = null, mode = null } = {}) {
      const id = nextId++;
      const d = dur ?? sayDuration(text);
      const m = mode ?? (comicOn ? 'cena' : 'jogo');
      const a = anchor(who);
      // a nova fala de quem já está falando substitui a dele
      lines = lines.filter((l) => l.who !== who || !who);
      // a boca mexe enquanto o texto digita, com as pausas da pontuação (o mesmo tempo da voz: src/story/ui/subtitles.js)
      lines.push({ id, who, t: 0, typeT: typeDuration(String(text)), dur: d, mood });
      emit('story:say', { id, who, name: who ? SPEAKERS[who] ?? who : '', text, dur: d, mode: m, mood, ...(a ? { anchor: { x: a.x, y: a.y, z: a.z } } : {}) });
      return id;
    },
    /** Some com as falas (fim de cena, pular). */
    clearSay() {
      lines = [];
      for (const n of DOGS) if (dir.held(n)) dir.actor(n).talk = 0;
      emit('story:sayClear', {});
    },
    /** A lente dos planos (graus de campo de visão; 38 é a padrão). Vale até a cena acabar. */
    lens(fov = 38) { cam()?.setShotFov?.(fov); },
    /** Liga/desliga a página de HQ. */
    comic(on, style = 'cor') {
      comicOn = !!on;
      emit('story:comic', { on: comicOn, style });
    },
    get comicOn() { return comicOn; },
    /**
     * Um quadro novo da página: o anterior congela. layout: 'full' | '2h' | '2v' | '3a' | '3b' | '4'.
     * @param {string} layout @param {number} slot @param {{ tilt?: number, enter?: 'slide' | 'pop' | 'wipe' | 'zoom' }} [o]
     */
    panel(layout, slot, { tilt = 0, enter = 'slide' } = {}) {
      emit('story:panel', { layout, slot, tilt, enter });
    },
    /** Onomatopeia grande (FLAP FLAP, SNIF, CRASH!), presa a um ponto do mundo ou da tela. */
    onomato(text, { at = null, sx = null, sy = null, size = 1, color = '#ffd23f', rot = -8, style = 'pop' } = {}) {
      emit('story:onomato', { text, ...(at ? { anchor: at } : {}), ...(sx !== null ? { sx, sy } : {}), size, color, rot, style });
    },
    /** Caixa de apresentação/narração estilo Scott Pilgrim. */
    caption(text, { sub = '', pos = 'tl', dur = 2.6, at = null } = {}) {
      emit('story:caption', { text, sub, pos, dur, ...(at ? { anchor: at } : {}) });
    },
    /** Efeito de mangá por cima do quadro ao vivo. */
    fx(kind, { at = null, dur = 0.8 } = {}) {
      emit('story:fx', { kind, dur, ...(at ? { anchor: at } : {}) });
    },
    /** A cada quadro: o ponto dos balões acompanha quem fala, e a boca mexe enquanto o texto digita. */
    update(dt) {
      if (!lines.length) return;
      const talking = { radhija: 0, rhaenyra: 0 };
      lines = lines.filter((l) => {
        l.t += dt;
        if (l.t >= l.dur) return false;
        const a = anchor(l.who);
        if (a) emit('story:sayMove', { id: l.id, x: a.x, y: a.y, z: a.z });
        if (l.who in talking && l.t < l.typeT + 0.15) talking[l.who] = l.mood === 'sussurro' || l.mood === 'sono' ? 0.45 : l.mood === 'grito' ? 1 : 0.8;
        return true;
      });
      for (const n of DOGS) if (dir.held(n)) dir.actor(n).talk = talking[n];
    },
    /** A fala mais nova de alguém ainda na tela? (testes) */
    speaking: (who) => lines.some((l) => l.who === who),
    get lines() { return lines.map((l) => ({ id: l.id, who: l.who })); },
    reset() { lines = []; comicOn = false; cam()?.setShotFov?.(38); },
  };
}
