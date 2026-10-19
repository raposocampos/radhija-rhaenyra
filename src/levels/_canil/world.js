// CANIL DAS DOGS — CENÁRIO: um estúdio claro (piso de madeira, paredes ao norte e nos lados), os quatro tapetes da
// vitrine com as plaquinhas ("Radhija · atual", "Radhija · nova"…) e a vitrine (display.js).
import * as THREE from 'three';
import { createDisplay } from './display.js';

/** Plaquinha com o nome, sempre de frente para a câmera. */
function label(text, accent) {
  const c = document.createElement('canvas');
  c.width = 768;
  c.height = 128;
  const g = c.getContext('2d');
  g.font = 'bold 52px Nunito, system-ui, sans-serif';
  // a placa se ajusta ao texto (centralizada no canvas)
  const tw = Math.min(600, g.measureText(text).width || 420);
  const w = tw + 140;
  const x0 = (768 - w) / 2;
  g.fillStyle = 'rgba(255, 246, 230, 0.92)';
  g.beginPath();
  g.roundRect?.(x0, 14, w, 100, 46);
  g.fill();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(x0 + 58, 64, 20, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = '#4A3426';
  g.textBaseline = 'middle';
  g.fillText(text, x0 + 96, 66);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthWrite: false, transparent: true }));
  sprite.scale.set(1.08, 0.18, 1);
  return sprite;
}

/** Piso de tábuas claras (textura em canvas). */
function floorTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 512;
  const g = c.getContext('2d');
  for (let i = 0; i < 8; i++) {
    const l = 74 + ((i * 37) % 9) - 4;
    g.fillStyle = `hsl(32, 34%, ${l}%)`;
    g.fillRect(0, i * 64, 512, 64);
    g.fillStyle = 'rgba(90, 60, 30, 0.18)';
    g.fillRect(0, i * 64, 512, 2);
    g.fillRect(((i * 173) % 400) + 40, i * 64, 2, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

/**
 * @param {import('../../types').LevelBuildArgs} args
 * @returns {import('../../types').LevelBuild<import('./display.js').CanilProps>}
 */
export function buildCanilWorld({ root, layout }) {
  const B = layout.WORLD.bounds;
  const { SHOWCASE, ROOM } = layout;
  const W = B.maxX - B.minX, D = B.maxZ - B.minZ;

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(W + 6, D + 6).rotateX(-Math.PI / 2),
    new THREE.MeshStandardMaterial({ map: floorTexture(), roughness: 0.82 }),
  );
  floor.position.set((B.minX + B.maxX) / 2, 0, (B.minZ + B.maxZ) / 2);
  floor.receiveShadow = true;
  floor.name = 'piso';
  root.add(floor);

  // paredes: norte (alta) e laterais (um pouco mais baixas, para as quinas não ficarem no mesmo plano)
  const wallMat = new THREE.MeshStandardMaterial({ color: '#f1e6d6', roughness: 0.95 });
  const trimMat = new THREE.MeshStandardMaterial({ color: '#c99a6e', roughness: 0.8 });
  const north = new THREE.Mesh(new THREE.BoxGeometry(W + 0.4, ROOM.wallH + 0.04, ROOM.wall), wallMat);
  north.position.set((B.minX + B.maxX) / 2, ROOM.wallH / 2 - 0.02, B.minZ - ROOM.wall / 2);
  north.name = 'parede-norte';
  // as laterais entram 8 cm na parede do fundo (nenhuma face encostada no mesmo plano) e param antes da câmera
  const z0 = B.minZ - 0.08, z1 = B.maxZ - 0.6;
  for (const side of [-1, 1]) {
    const wall = new THREE.Mesh(new THREE.BoxGeometry(ROOM.wall, ROOM.sideH + 0.05, z1 - z0), wallMat);
    wall.position.set(side > 0 ? B.maxX + ROOM.wall / 2 : B.minX - ROOM.wall / 2, ROOM.sideH / 2 - 0.025, (z0 + z1) / 2);
    wall.name = side > 0 ? 'parede-leste' : 'parede-oeste';
    wall.receiveShadow = true;
    root.add(wall);
  }
  north.receiveShadow = true;
  root.add(north);
  // rodapé na parede do fundo
  // rodapé: começa dentro da parede e do piso (sem faces no mesmo plano)
  const trim = new THREE.Mesh(new THREE.BoxGeometry(W - 0.1, 0.1, 0.03), trimMat);
  trim.position.set((B.minX + B.maxX) / 2, 0.04, B.minZ + 0.012);
  trim.name = 'rodape';
  root.add(trim);

  // tapetes redondos (decalques no piso) e plaquinhas
  const rugColors = { v1: '#eadcc6', v2: '#cfe5d3' };
  const accents = { v1: '#C2601F', v2: '#5D8350' };
  for (const s of SHOWCASE.spots) {
    const rug = new THREE.Mesh(
      new THREE.CircleGeometry(SHOWCASE.r, 40).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color: rugColors[s.model], roughness: 1, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
    );
    rug.position.set(s.x, 0.002, SHOWCASE.z);
    rug.receiveShadow = true;
    rug.name = `tapete:${s.kind}:${s.model}`;
    root.add(rug);
    const name = s.kind === 'radhija' ? 'Radhija' : 'Rhaenyra';
    const tag = label(`${name} · ${s.model === 'v2' ? 'nova' : 'atual'}`, accents[s.model]);
    tag.position.set(s.x, s.kind === 'radhija' ? 0.7 : 0.8, SHOWCASE.z);
    tag.name = `plaquinha:${s.kind}:${s.model}`;
    root.add(tag);
  }

  const display = createDisplay({ root, z: SHOWCASE.z, spots: SHOWCASE.spots });
  return {
    props: {
      display,
      collectibles: [],
      reset() { display.reset(); },
    },
    seeThrough: [],
    env: { floor, north },
    update(dt) { display.update(dt); },
  };
}
