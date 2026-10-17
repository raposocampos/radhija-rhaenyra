import * as THREE from 'three';
import { createPigeon } from '../../src/world/pigeon.js';
import { createPigeon as before } from '../../src/world/.pigeon-motion-baseline.js';

// Sequência determinística para vídeo/filmstrip no runner, sem depender do FPS do SwiftShader.
window.startPigeonMotionReview = () => {
  document.querySelector('h1').textContent = 'Decolagem · voo · pouso';
  document.querySelector('header p').textContent = 'Animação anterior à esquerda · nova à direita';
  const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(1280, 600); renderer.setPixelRatio(1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.setScissorTest(true);
  document.querySelector('main').style.display = 'block';
  document.querySelector('main').replaceChildren(renderer.domElement);
  const models = [before, createPigeon].map((factory) => {
    const scene = new THREE.Scene(); scene.background = new THREE.Color('#eee9e1');
    scene.add(new THREE.HemisphereLight('#bcd4f2', '#9a7a4a', 1.6));
    const sun = new THREE.DirectionalLight('#ffc58a', 3.2); sun.position.set(-0.62, 0.8, 0.6); scene.add(sun);
    const p = factory({ seed: 3, tint: '#9198a8' }); scene.add(p.object);
    const camera = new THREE.OrthographicCamera(-0.42, 0.42, 0.394, -0.394, 0.01, 10);
    camera.position.set(0.6, 0.48, 0.85); camera.lookAt(0, 0.26, 0);
    return { scene, p, camera };
  });
  window.pigeonMotionFrame = (frame) => {
    const t = frame / 30, k = THREE.MathUtils.clamp((t - 0.6) / 1.8, 0, 1);
    const flying = t >= 0.6 && t < 2.4;
    for (const [i, { scene, p, camera }] of models.entries()) {
      p.setPose({ flying, flightProgress: k, y: Math.sin(k * Math.PI) * 0.18, yaw: 0 });
      // Duas atualizações por quadro: simulação de 60 Hz, vídeo de 30 fps.
      p.update(1 / 60, t); p.update(1 / 60, t + 1 / 60);
      renderer.setViewport(i * 640, 0, 640, 600); renderer.setScissor(i * 640, 0, 640, 600);
      renderer.render(scene, camera);
    }
  };
};
