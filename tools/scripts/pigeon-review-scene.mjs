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

const HEAD = [0, 0.24, 0.1];
const stats = [];
window.reviewPigeons = async (states = false) => {
  document.querySelector('main').replaceChildren();
  // zoom aproxima a câmera ortográfica; target é o ponto olhado (padrão: o corpo inteiro).
  const views = states ? [
    { name: 'Cochilando', eye: [0.6, 0.36, 0.65], asleep: true },
    { name: 'Espiando após latido (um olho)', eye: [0.6, 0.36, 0.65], asleep: true, peek: true },
    { name: 'Bicando e batendo as asas', eye: [0.75, 0.3, 0.45], asleep: true, peck: 0.24 },
    { name: 'Voo · batida A', eye: [0.55, 0.4, 0.65], flying: true, flightTime: 1.1 },
    { name: 'Voo · batida B', eye: [0.55, 0.4, 0.65], flying: true, flightTime: 1.2 },
    { name: 'Pousando (frenagem)', eye: [0.75, 0.3, 0.5], flying: true, flightTime: 1.0, landing: 0.95 },
  ] : [
    { name: 'Três quartos', eye: [0.6, 0.36, 0.65] },
    { name: 'Perfil', eye: [1, 0.23, 0] },
    { name: 'Frente', eye: [0, 0.25, 1] },
    { name: 'Câmera alta · leitura no jogo', eye: [0.5, 1, -0.5] },
    { name: 'Cabeça de perto · olho, bico e carúncula', eye: [0.75, 0.3, 0.55], zoom: 3, target: HEAD },
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
    if (view.landing) {
      pigeon.setPose({ flightProgress: view.landing });
      for (let i = 1; i <= 9; i++) pigeon.update(1 / 60, view.flightTime + i / 60);
    }
    if (view.peek) {
      pigeon.peek();
      for (let i = 1; i <= 30; i++) pigeon.update(1 / 60, 2 + i / 60);
    }
    // O modelo anterior não tem bicada: fica parado, para comparar a pose de repouso.
    if (view.peck) {
      pigeon.peck?.();
      for (let i = 1; i <= Math.round(view.peck * 60); i++) pigeon.update(1 / 60, 2 + i / 60);
    }
    scene.add(pigeon.object);
    const zoom = view.zoom ?? 1, target = view.target ?? [0, 0.13, -0.025];
    const camera = new THREE.OrthographicCamera(-0.45 / zoom, 0.45 / zoom, 0.211 / zoom, -0.211 / zoom, 0.01, 10);
    camera.position.fromArray(view.eye).add(new THREE.Vector3().fromArray(target)).sub(new THREE.Vector3(0, 0.13, -0.025));
    camera.lookAt(target[0], target[1], target[2]);
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
    const materials = new Set();
    pigeon.object.traverse((o) => {
      if (!o.isMesh) return;
      meshes++;
      materials.add(o.material);
      triangles += (o.geometry.index?.count ?? o.geometry.attributes.position.count) / 3;
    });
    stats.push({ label, view: view.name, meshes, materials: materials.size, triangles, render: { ...renderer.info.render } });
    const geometries = new Set(), all = new Set();
    scene.traverse((o) => {
      if (o.geometry) geometries.add(o.geometry);
      if (o.material) all.add(o.material);
    });
    geometries.forEach((g) => g.dispose());
    all.forEach((m) => m.dispose());
    sun.shadow.dispose();
  }
  return stats;
};
