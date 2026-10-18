// HUD durante a partida: chip da dog ativa, companheira (seguindo/esperando), objetivo, petiscos,
// prompt de interação ("E Pegar a cenoura") e dicas temporárias. No modo desafio (setNoHints) as dicas não
// aparecem; o objetivo some pelo CSS (.rr[data-hints="off"]) mas continua atualizado para voltar ao religar.
import { DOG_INFO, other, glyph, richText } from './markup.js';
import { dogIcon, followIcon, stayIcon } from './icons.js';

/** Reinicia uma animação CSS de classe (remove, força reflow, recoloca). */
export function retrigger(el, cls) {
  el.classList.remove(cls);
  void el.offsetWidth;
  el.classList.add(cls);
}

/**
 * opts: { $ (querySelector na raiz da UI), getTotal() (petiscos da fase atual) }
 */
export function createHud({ $, getTotal }) {
  const chip = $('.rr-chip');
  const chipAvatar = $('.rr-chip__avatar');
  const chipName = $('.rr-chip__dogname');
  const chipTrait = $('.rr-chip__trait');
  const comp = $('.rr-comp');
  const objective = $('.rr-objective');
  const objectiveText = $('.rr-objective__text');
  const treats = $('.rr-treats');
  const treatsCount = $('.rr-treats__count');
  const treatsTotal = $('.rr-treats__total');
  const prompt = $('.rr-prompt');
  const promptKey = $('.rr-prompt__key');
  const promptText = $('.rr-prompt__text');
  const hint = $('.rr-hint');
  const hintText = $('.rr-hint__text');

  let activeDog = null;
  const stay = { radhija: false, rhaenyra: false };
  let objText = '';
  let count = 0;
  let hintTimer = 0;
  let promptOn = false;
  let noHints = false;

  function setDog(name) {
    const info = DOG_INFO[name];
    if (!info || name === activeDog) return;
    const first = activeDog === null;
    activeDog = name;
    stay[name] = false; // quem vira ativa perde o "fica"
    chip.dataset.dog = name;
    chipAvatar.innerHTML = dogIcon(name);
    chipName.textContent = info.name;
    chipTrait.textContent = `· ${info.trait}`;
    if (!first) retrigger(chip, 'is-swap');
    renderComp(!first);
  }

  function renderComp(animate) {
    const name = other(activeDog || 'radhija');
    const st = !!stay[name];
    const changedDog = comp.dataset.dog !== name;
    const changedStay = comp.dataset.stay !== (st ? '1' : '0');
    comp.dataset.dog = name;
    comp.dataset.stay = st ? '1' : '0';
    if (changedDog) {
      $('.rr-comp__avatar').innerHTML = dogIcon(name);
      $('.rr-comp__name').textContent = DOG_INFO[name].name;
    }
    $('.rr-comp__ico').innerHTML = st ? stayIcon() : followIcon();
    $('.rr-comp__label').textContent = st ? 'esperando' : 'seguindo';
    comp.title = st ? 'Fica: ela espera aqui. Aperte de novo para chamar (Vem).' : 'Vem: ela segue você. Aperte para ela esperar (Fica).';
    if (animate && (changedDog || changedStay)) retrigger(comp, 'is-pop');
  }

  /** Fica/Vem da companheira (evento companion:stay). */
  function setStay(name, on) {
    if (!DOG_INFO[name]) return;
    stay[name] = !!on;
    renderComp(true);
  }

  function setObjective(text) {
    const t = text ? String(text) : '';
    if (t === objText) return;
    objText = t;
    if (!t) { objective.classList.add('is-empty'); return; }
    objectiveText.innerHTML = richText(t);
    objective.classList.remove('is-empty');
    retrigger(objective, 'is-new');
  }
  /** Esconde o objetivo sem animação (fase nova carregada). */
  function clearObjective() {
    objText = '';
    objective.classList.add('is-empty');
  }

  function setCount(n, total = getTotal()) {
    const prev = count;
    count = Math.max(0, n | 0);
    treatsCount.textContent = String(count);
    if (Number.isFinite(total)) treatsTotal.textContent = `/${total}`;
    treats.classList.toggle('is-full', total > 0 && count >= total);
    if (count > prev) retrigger(treats, 'is-pop');
  }
  function setTotalLabel(total) {
    treatsTotal.textContent = `/${total}`;
  }

  function setPrompt(p) {
    const text = p?.text;
    if (!text) {
      if (promptOn) prompt.classList.remove('is-on');
      promptOn = false;
      return;
    }
    promptKey.innerHTML = glyph(p.key ?? 'E');
    promptText.innerHTML = richText(text);
    if (!promptOn) prompt.classList.add('is-on');
    promptOn = true;
  }

  function showHint(text, duration) {
    clearTimeout(hintTimer);
    if (!text || noHints) { hideHint(); return; }
    hintText.innerHTML = richText(text);
    if (hint.classList.contains('is-on')) retrigger(hint, 'is-on');
    else hint.classList.add('is-on');
    const ms = Math.max(1.2, Number(duration) || 3.4) * 1000;
    hintTimer = setTimeout(hideHint, ms);
  }
  function hideHint() {
    clearTimeout(hintTimer);
    hint.classList.remove('is-on');
  }

  /** Modo desafio (opções): sem dicas em balão; uma dica na tela some na hora. */
  function setNoHints(on) {
    noHints = !!on;
    if (noHints) hideHint();
  }

  /** Começo de uma partida: zera petiscos, Fica/Vem, prompt e dica. */
  function reset() {
    count = 0;
    treatsCount.textContent = '0';
    treats.classList.remove('is-full');
    stay.radhija = stay.rhaenyra = false;
    renderComp();
    setPrompt(null);
    hideHint();
  }

  return {
    setDog, renderComp, setStay, setObjective, clearObjective, setCount, setTotalLabel, setPrompt, showHint, hideHint, setNoHints, reset,
    get activeDog() { return activeDog; },
    get count() { return count; },
  };
}
