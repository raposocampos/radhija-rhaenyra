// Apenas ferramenta de revisão; não é uma entrada do build publicado.
import * as THREE from 'three';
import { createPigeon } from '../../src/world/pigeon.js';
import { createPigeon as before } from '../../src/world/.pigeon-baseline.js';

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
renderer.setPixelRatio(1);
renderer.setSize(640, 300);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.12;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const stats = [];
window.reviewPigeons = async (states = false) => {
  document.querySelector('main').replaceChildren();
  const views = states ? [
    { name: 'Cochilando', eye: [0.6, 0.36, 0.65], asleep: true },
    { name: 'Espiando após latido', eye: [0.6, 0.36, 0.65], asleep: true, peek: true },
    { name: 'Voo · batida A', eye: [0.55, 0.4, 0.65], flying: true, flightTime: 1.1 },
    { name: 'Voo · batida B', eye: [0.55, 0.4, 0.65], flying: true, flightTime: 1.2 },
  ] : [
    { name: 'Três quartos', eye: [0.6, 0.36, 0.65] },
    { name: 'Perfil', eye: [1, 0.23, 0] },
    { name: 'Frente', eye: [0, 0.25, 1] },
    { name: 'Câmera alta · leitura no jogo', eye: [0.5, 1, -0.5] },
  ];
  for (const view of views) for (const [label, factory] of [['Antes', before], ['Depois', createPigeon]]) {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#eee9e1');
    scene.add(new THREE.HemisphereLight('#bcd4f2', '#9a7a4a', 1.05));
    const sun = new THREE.DirectionalLight('#ffc58a', 3.2);
    sun.position.set(-0.62, 0.8, 0.6);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    Object.assign(sun.shadow.camera, { left: -0.5, right: 0.5, top: 0.5, bottom: -0.5, near: 0.1, far: 3 });
    sun.shadow.normalBias = 0.002;
    scene.add(sun);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshStandardMaterial({ color: '#eee9e1', roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.002;
    floor.receiveShadow = true;
    scene.add(floor);
    const pigeon = factory({ seed: 3, tint: '#9198a8' });
    pigeon.setPose({ asleep: !!view.asleep, flying: !!view.flying, y: view.flying ? 0.065 : 0 });
    if (view.flying) for (let i = 1; i <= Math.round(view.flightTime * 60); i++) pigeon.update(1 / 60, i / 60);
    else for (let i = 1; i <= 120; i++) pigeon.update(1 / 60, i / 60);
    if (view.peek) {
      pigeon.peek();
      for (let i = 1; i <= 30; i++) pigeon.update(1 / 60, 2 + i / 60);
    }
    scene.add(pigeon.object);
    const camera = new THREE.OrthographicCamera(-0.45, 0.45, 0.211, -0.211, 0.01, 10);
    camera.position.fromArray(view.eye);
    camera.lookAt(0, 0.13, -0.025);
    renderer.render(scene, camera);
    const canvas = document.createElement('canvas');
    canvas.width = 640; canvas.height = 300;
    canvas.getContext('2d').drawImage(renderer.domElement, 0, 0);
    const figure = document.createElement('figure');
    const caption = document.createElement('figcaption');
    caption.textContent = `${label} · ${view.name}`;
    figure.append(caption, canvas);
    document.querySelector('main').append(figure);
    let meshes = 0, triangles = 0;
    pigeon.object.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    stats.push({ label, view: view.name, meshes, triangles, render: { ...renderer.info.render } });
    const geometries = new Set(), materials = new Set();
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) materials.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    materials.forEach((m) => m.dispose());
    sun.shadow.dispose();
  }
  return stats;
};
