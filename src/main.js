// Ponto de entrada — integração entre os módulos.
// Visão geral: docs/ARQUITETURA.md. As fases moram em src/levels/.
import * as THREE from 'three';
import { events } from './core/events.js';
import { createEngine } from './core/engine.js';
import { createFrameCap, furShellsFor } from './core/quality.js';
import { createSettings } from './core/settings.js';
import { createDog } from './dogs/dog.js';
import { createGame, HUB } from './game/game.js';
import { createAudio } from './fx/audio.js';
import { createParticles } from './fx/particles.js';
import { createFeedback } from './fx/feedback.js';
import { createUI } from './ui/ui.js';
import { createInstallHint } from './ui/installHint.js';
import { updateSeeThrough } from './world/seeThrough.js';
import { LEVELS as ALL_LEVELS, publishedLevelIndex } from './levels/index.js';
import MAPA from './levels/mapa/index.js';

const params = new URLSearchParams(location.search);

// Garante que a tela de carregamento seja pintada antes da montagem procedural (que bloqueia ~2–4 s).
const nextPaint = () => new Promise((res) => requestAnimationFrame(() => setTimeout(res, 0)));
// Marcos do boot (rr:boot:*, e rr:level:* no loadLevel): aparecem no painel de desempenho do navegador e o E2E mede
// cada etapa por eles (tools/scripts/lib/hang-probe.mjs); num travamento, o último marco diz onde parou.
const mark = (name) => globalThis.performance?.mark?.(`rr:boot:${name}`);

async function boot() {
  mark('start');
  await nextPaint();

  // ?level=2 (posição, 1-based) ou ?level=fase6 (id) abrem uma fase publicada. Outro id é de uma fase de
  // desenvolvimento (ex.: ?level=pulo), carregada só sob demanda no fim da lista; protótipos de fases novas
  // entram juntos e em ordem (devCatalog em levels/dev.js).
  const levelParam = params.get('level') || '';
  const published = publishedLevelIndex(ALL_LEVELS, levelParam);
  const dev = published === null
    ? (await import('./levels/dev.js')).devCatalog(ALL_LEVELS, levelParam)
    : null;
  const LEVELS = dev ? dev.levels : ALL_LEVELS;

  const engine = createEngine(document.getElementById('app'), { params });
  mark('engine');
  // as duas dogs com o modelo novo (src/dogs/v2/), o padrão desde a etapa 5; ?dogs=atual volta ao modelo anterior
  // (para comparar ou reverter); ?dogs=novo, dos links antigos, continua dando o novo. No celular e no tablet, o pelo
  // do novo tem menos cascas (furShellsFor; o PC fica com as de sempre)
  let makeDog = createDog;
  if (params.get('dogs') !== 'atual') {
    const { createDogV2 } = await import('./dogs/v2/dog.js');
    const shells = furShellsFor(engine.quality.device);
    makeDog = (kind) => createDogV2(kind, { shells });
  }
  const dogs = {
    radhija: makeDog('radhija'),
    rhaenyra: makeDog('rhaenyra'),
  };
  mark('dogs');
  engine.scene.add(dogs.radhija.object, dogs.rhaenyra.object);

  // o mapa das fases (Pandorópolis): Jogar → Fases, a pausa e a vitória levam a ele
  const game = createGame({ engine, dogs, levels: LEVELS, params, hub: MAPA });
  const audio = createAudio();
  const particles = createParticles(engine);
  // opções salvas (modo sem dicas): a UI esconde objetivo e dicas, o feedback esconde o marcador do objetivo
  const settings = createSettings();
  // props/layout da fase atual (mudam a cada fase): o feedback lê via getters.
  const feedback = createFeedback({
    engine, audio, particles, dogs, game, settings,
    get props() { return game.built?.props; },
    get layout() { return game.levelDef?.layout ?? LEVELS[0].layout; },
  });
  // no catálogo de desenvolvimento (prévias dos protótipos) o menu libera todas as fases para teste
  // input: controles de toque; quality: menu de qualidade gráfica e layout do celular (engine.quality.device)
  const ui = createUI({ audio, layout: LEVELS[0].layout, levels: LEVELS, params, unlockAll: !!dev, input: game.input, quality: engine.quality, settings, map: !dev });
  // o mapa lê o progresso salvo pela UI (e, no catálogo de desenvolvimento, libera todas as bandeirinhas)
  game.setProgressSource(() => ui.progress);
  game.setUnlockAll(!!dev);
  // trilha: o tema da tela inicial, o do mapa das fases e o de cada fase (src/fx/audio/themes.js). Na troca de fase,
  // o tema anterior segue tocando sob a cortina até a nova fase carregar.
  const musicFor = () => {
    if (game.state === 'title') return 'menu';
    if (game.state === 'load-error') return null;
    if (game.isHub) return 'mapa';
    return game.levelDef?.id ?? null;
  };
  const syncMusic = () => { if (game.state !== 'loading') audio.setMusic(musicFor()); };
  events.on('game:state', syncMusic);
  events.on('level:loaded', syncMusic);

  // iPhone no Safari: como jogar em tela cheia (pelo app da tela inicial); nada no PC nem no Android
  const installHint = createInstallHint({ root: /** @type {HTMLElement} */ (document.querySelector('#ui .rr')), device: engine.quality.device, audio });

  // Fase inicial (id desconhecido: a primeira); ?play pula a tela inicial; ?mapa abre direto no mapa das fases.
  const lv = dev ? dev.index : published ?? 0;
  mark('ui');
  if (params.has('mapa') && !dev) await game.loadLevel(HUB, { mode: 'play', initial: true });
  else await game.loadLevel(lv, { mode: params.has('play') ? 'play' : 'title', initial: true });
  syncMusic();

  // ?cam=x,y,z&look=x,y,z — câmera fixa (capturas de cenário). Aplicada depois do game.update.
  const camFix = params.get('cam')?.split(',').map(Number);
  const lookFix = (params.get('look') || '0,0,0').split(',').map(Number);

  const clock = new THREE.Clock();
  let elapsed = 0;
  // Celular/tablet: no máximo 60 quadros por segundo (telas de 90/120 Hz desenhariam o dobro e esquentariam o
  // aparelho). O quadro pulado não roda nada; o seguinte recebe o tempo inteiro em dt. No PC, todos os quadros.
  const capFrame = engine.quality.capFps ? createFrameCap() : null;

  function frame(now) {
    if (capFrame && !capFrame(now)) {
      requestAnimationFrame(frame);
      return;
    }
    const dt = Math.min(clock.getDelta(), 1 / 20);
    elapsed += dt;
    // Governador de FPS (só no modo automático do celular/tablet): mede os quadros da partida rodando.
    engine.quality.frame(performance.now(), game.state === 'playing' && !document.hidden);
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
    engine, dogs, game, audio, particles, feedback, ui, events, settings, levels: LEVELS, THREE, installHint,
    // capturas quadro a quadro (tools/scripts/capture-lambe.mjs): o mesmo "ver através" do quadro normal
    seeThrough: () => updateSeeThrough(dogs, game.activeDog || 'radhija'),
    get env() { return game.built?.env; },
    get props() { return game.built?.props; },
    get layout() { return game.levelDef?.layout; },
  };
  mark('ready');

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
