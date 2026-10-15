// Sandbox do Agente Polimento: ouvir cada som do jogo.
import { createAudio } from '../src/fx/audio.js';

const audio = createAudio();
const grid = document.getElementById('grid');
const opts = { speed: 2.2, count: 2, total: 3, name: 'radhija', strength: 0.9, locked: true };
let rollTimer = 0;
for (const n of audio.names) {
  const b = document.createElement('button');
  b.textContent = n;
  b.addEventListener('click', () => {
    audio.unlock();
    if (n === 'cartRoll' || n === 'crateDrag') {
      // simula 2 s de carrinho rolando / caixote arrastando
      clearInterval(rollTimer);
      const t0 = performance.now();
      rollTimer = setInterval(() => {
        if (performance.now() - t0 > 2000) return clearInterval(rollTimer);
        audio.play(n, { speed: n === 'cartRoll' ? 0.85 : 0.7 });
      }, 16);
    } else audio.play(n, opts);
  });
  grid.appendChild(b);
}
document.getElementById('vol').addEventListener('input', (e) => audio.setVolume(e.target.value / 100));
document.getElementById('muffle').addEventListener('change', (e) => audio.setMuffled(e.target.checked));
for (const k of ['day', 'dusk', 'night']) {
  const b = document.createElement('button');
  b.textContent = `ambiente: ${k}`;
  b.addEventListener('click', () => { audio.unlock(); audio.setAmbience(k); });
  grid.appendChild(b);
}
window.__audio = audio;
