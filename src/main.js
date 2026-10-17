// Ponto de entrada — integração entre os módulos.
// Visão geral: docs/ARQUITETURA.md. As fases moram em src/levels/.
import * as THREE from 'three';
import { events } from './core/events.js';
import { createEngine } from './core/engine.js';
import { createDog } from './dogs/dog.js';
import { createGame } from './game/game.js';
import { createAudio } from './fx/audio.js';
import { createParticles } from './fx/particles.js';
import { createFeedback } from './fx/feedback.js';
import { createUI } from './ui/ui.js';
import { updateSeeThrough } from './world/seeThrough.js';
import { LEVELS as ALL_LEVELS } from './levels/index.js';

const params = new URLSearchParams(location.search);

// Garante que a tela de carregamento seja pintada antes da montagem procedural (que bloqueia ~2–4 s).
const nextPaint = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));

async function boot() {
  await nextPaint();

  // ?level=<id> de uma fase de desenvolvimento (ex.: ?level=pulo): carregada só sob demanda, no fim da lista.
  const levelParam = params.get('level') || '';
  const devLevel = levelParam && !/^\d+$/.test(levelParam)
    ? (await import('./levels/dev.js')).DEV_LEVELS.find((d) => d.id === levelParam)
    : null;
  const LEVELS = devLevel ? [...ALL_LEVELS, devLevel] : ALL_LEVELS;

  const engine = createEngine(document.getElementById('app'), { params });
  const dogs = {
    radhija: createDog('radhija'),
    rhaenyra: createDog('rhaenyra'),
  };
  engine.scene.add(dogs.radhija.object, dogs.rhaenyra.object);

  const game = createGame({ engine, dogs, levels: LEVELS, params });
  const audio = createAudio();
  const particles = createParticles(engine);
  // props/layout da fase atual (mudam a cada fase): o feedback lê via getters.
  const feedback = createFeedback({
    engine, audio, particles, dogs, game,
    get props() { return game.built?.props; },
    get layout() { return game.levelDef?.layout ?? LEVELS[0].layout; },
  });
  const ui = createUI({ audio, layout: LEVELS[0].layout, levels: LEVELS, params });

  // Fase inicial: ?level=2 (1-based) para testes; ?play pula a tela inicial.
  const lv = devLevel ? LEVELS.length - 1 : Math.max(1, Math.min(LEVELS.length, parseInt(params.get('level') || '1', 10) || 1)) - 1;
  await game.loadLevel(lv, { mode: params.has('play') ? 'play' : 'title', initial: true });

  // ?cam=x,y,z&look=x,y,z — câmera fixa (capturas de cenário). Aplicada depois do game.update.
  const camFix = params.get('cam')?.split(',').map(Number);
  const lookFix = (params.get('look') || '0,0,0').split(',').map(Number);

  const clock = new THREE.Clock();
  let elapsed = 0;

  function frame() {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    elapsed += dt;
    game.update(dt, elapsed);
    if (game.state === 'loading' || game.state === 'load-error') {
      // A UI segue acessível, mas nenhum efeito ou desenho usa uma fase parcial.
      ui.update(dt);
      requestAnimationFrame(frame);
      return;
    }
    if (camFix?.length === 3) {
      engine.camera.position.set(.../** @type {[number, number, number]} */ (camFix));
      engine.camera.lookAt(.../** @type {[number, number, number]} */ (lookFix));
    }
    updateSeeThrough(dogs, game.activeDog || 'radhija');
    feedback.update(dt, elapsed);
    particles.update(dt);
    ui.update(dt);
    engine.render(dt, elapsed);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  // Ganchos de teste/depuração (usados por tools/shot.mjs e pelo QA).
  window.__game = {
    engine, dogs, game, audio, particles, feedback, ui, events, levels: LEVELS, THREE,
    get env() { return game.built?.env; },
    get props() { return game.built?.props; },
    get layout() { return game.levelDef?.layout; },
  };

  // Some com a tela de carregamento depois do primeiro quadro.
  requestAnimationFrame(() => {
    const loading = document.getElementById('loading');
    if (!loading) return;
    loading.classList.add('is-done');
    setTimeout(() => loading.remove(), 700);
  });
}

boot().catch((err) => {
  console.error(err);
  const loading = document.getElementById('loading');
  if (!loading) return;
  // Também funciona se engine/UI/__game nem chegaram a ser criados.
  const box = loading.querySelector('.box');
  box.setAttribute('role', 'alert');
  box.lastElementChild.textContent = 'Não foi possível iniciar o jogo. Recarregue a página para tentar novamente.';
  const reload = document.createElement('button');
  reload.type = 'button';
  reload.className = 'rr-boot-reload';
  reload.textContent = 'Recarregar jogo';
  reload.addEventListener('click', () => location.reload());
  box.appendChild(reload);
  reload.focus();
});
