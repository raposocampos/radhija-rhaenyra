// FASE 4 · Terraço: piso de lajotas com rejunte, deck de madeira das espreguiçadeiras, muretas com
// pingadeira, a fileira de floreiras (com o vão do pombo), a casa da escada com porta, capacho, escadinha e
// a caixa d'água no telhado, e a cidade em volta (prédios vizinhos abaixo e acima do terraço, na névoa).
import * as THREE from 'three';
import {
  rng, rbox, canvasTexture, plasterMat, stdMat, woodMat, mergeGeometries, contactShadow, shadowAll, mat, vnoise2,
} from '../../../world/util.js';
import { makeBuilding } from '../../../world/background.js';
import { plantMat, lavender, geranium, boxwood, smallFlowers } from '../../../world/plants.js';

const PARAPET_H = 1.1;

// ------------------------------------------------------------------ texturas
/** Lajotas de cerâmica 40 cm (8 × 8 numa repetição de 3,2 m) com rejunte; cor e bump. */
function tileTextures() {
  const N = 8, px = 64, S = N * px;
  const r = rng(41);
  const shades = [];
  for (let i = 0; i < N * N; i++) shades.push(r());
  const color = canvasTexture(S, S, (g) => {
    g.fillStyle = '#b8a28c';
    g.fillRect(0, 0, S, S);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const k = shades[j * N + i];
      const base = [196 + k * 22, 132 + k * 18, 98 + k * 14];
      g.fillStyle = `rgb(${base[0] | 0},${base[1] | 0},${base[2] | 0})`;
      g.fillRect(i * px + 2, j * px + 2, px - 4, px - 4);
      // manchinhas e desgaste de sol
      for (let s = 0; s < 22; s++) {
        const x = i * px + 3 + r() * (px - 6), y = j * px + 3 + r() * (px - 6);
        g.fillStyle = r() < 0.5 ? `rgba(255,236,210,${0.05 + r() * 0.08})` : `rgba(110,60,40,${0.04 + r() * 0.07})`;
        g.beginPath(); g.arc(x, y, 1 + r() * 3.5, 0, Math.PI * 2); g.fill();
      }
      // brilho na borda superior (lajota levemente abaulada)
      g.fillStyle = 'rgba(255,245,230,0.12)';
      g.fillRect(i * px + 3, j * px + 3, px - 6, 3);
    }
    // rejunte com sujeirinha
    g.strokeStyle = 'rgba(120,100,84,0.55)';
    g.lineWidth = 1;
    for (let i = 0; i <= N; i++) {
      g.beginPath(); g.moveTo(i * px, 0); g.lineTo(i * px, S); g.stroke();
      g.beginPath(); g.moveTo(0, i * px); g.lineTo(S, i * px); g.stroke();
    }
  });
  const bump = canvasTexture(S, S, (g) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, S, S);
    g.fillStyle = '#5a5a5a';
    for (let i = 0; i <= N; i++) { g.fillRect(i * px - 2, 0, 4, S); g.fillRect(0, i * px - 2, S, 4); }
  }, { srgb: false });
  return { color, bump };
}

/** Manchas grandes (umidade/sol) para multiplicar sobre o piso: textura única cobrindo o terraço. */
function grimeTexture() {
  return canvasTexture(512, 320, (g, w, h) => {
    const img = g.createImageData(w, h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const n = vnoise2(x * 0.018, y * 0.018) * 0.6 + vnoise2(x * 0.06 + 9, y * 0.06) * 0.4;
      // mais escuro perto das muretas (bordas)
      const ex = Math.min(x, w - x) / w, ey = Math.min(y, h - y) / h;
      const edge = Math.max(0, 1 - Math.min(ex, ey) * 9);
      const v = 255 - n * 30 - edge * 40;
      const i = (y * w + x) * 4;
      img.data[i] = v; img.data[i + 1] = v * 0.98; img.data[i + 2] = v * 0.95; img.data[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
  }, { repeat: false });
}

/** Fibra de coco do capacho com uma patinha. */
function doormatTexture() {
  return canvasTexture(256, 160, (g, w, h) => {
    const r = rng(8);
    g.fillStyle = '#9c6b3c';
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = r() < 0.5 ? 'rgba(70,40,18,0.25)' : 'rgba(210,160,100,0.25)';
      g.fillRect(r() * w, r() * h, 1, 2 + r() * 3);
    }
    g.fillStyle = '#5a3418';
    g.strokeStyle = '#5a3418';
    g.lineWidth = 7;
    g.strokeRect(10, 10, w - 20, h - 20);
    // patinha
    const cx = w / 2, cy = h / 2 + 10;
    g.beginPath(); g.ellipse(cx, cy, 30, 24, 0, 0, Math.PI * 2); g.fill();
    for (const [dx, dy] of [[-34, -30], [-12, -46], [12, -46], [34, -30]]) { g.beginPath(); g.ellipse(cx + dx, cy + dy, 11, 14, 0, 0, Math.PI * 2); g.fill(); }
  }, { repeat: false });
}

// ------------------------------------------------------------------ piso
function buildFloor(layout) {
  const grp = new THREE.Group();
  grp.name = 'piso';
  const tex = tileTextures();
  const W = 15.2, D = 10.4;
  tex.color.repeat.set(W / 3.2, D / 3.2);
  tex.bump.repeat.copy(tex.color.repeat);
  const floorMat = new THREE.MeshStandardMaterial({ map: tex.color, bumpMap: tex.bump, bumpScale: 1.4, roughness: 0.86 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D).rotateX(-Math.PI / 2), floorMat);
  floor.receiveShadow = true;
  grp.add(floor);
  // manchas largas por cima (multiplica)
  const B = layout.WORLD.bounds;
  const grime = new THREE.Mesh(
    new THREE.PlaneGeometry(B.maxX - B.minX, B.maxZ - B.minZ).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ map: grimeTexture(), transparent: true, blending: THREE.MultiplyBlending, premultipliedAlpha: true, depthWrite: false, fog: false }),
  );
  grime.position.set((B.minX + B.maxX) / 2, 0.002, (B.minZ + B.maxZ) / 2);
  grime.renderOrder = 1;
  grp.add(grime);

  // deck de madeira das espreguiçadeiras (zona A, sudoeste)
  const deck = new THREE.Group();
  const dk = { x0: -6.39, x1: -3.2, z0: 1.55, z1: 3.79 };
  const boardMat = woodMat('#a77b52', { key: 'f4-deck', rough: 0.82 });
  const n = Math.round((dk.z1 - dk.z0) / 0.15);
  const r = rng(5);
  const boards = [];
  for (let i = 0; i < n; i++) {
    const z = dk.z0 + (i + 0.5) * ((dk.z1 - dk.z0) / n);
    const b = rbox(dk.x1 - dk.x0, 0.03, (dk.z1 - dk.z0) / n - 0.012, 0.006, 1);
    b.translate((dk.x0 + dk.x1) / 2 + (r() - 0.5) * 0.02, 0.015, z);
    boards.push(b);
  }
  const deckMesh = new THREE.Mesh(mergeGeometries(boards), boardMat);
  deckMesh.receiveShadow = true;
  deck.add(deckMesh);
  grp.add(deck);

  // laje do corredor (cimento queimado)
  const C = layout.CORRIDOR;
  const slab = new THREE.Mesh(rbox(C.x1 - C.x0 + 0.1, 0.02, C.half * 2 + 0.36, 0.008, 1), stdMat('#9a958d', { roughness: 0.9 }));
  slab.position.set((C.x0 + C.x1) / 2, 0.01, C.z - 0.15);
  slab.receiveShadow = true;
  grp.add(slab);

  // ralos
  const drainMat = stdMat('#6f6a64', { roughness: 0.5, metalness: 0.4 });
  for (const [x, z] of [[-0.9, -2.4], [4.4, 3.1], [-5.9, -0.6]]) {
    const d = new THREE.Mesh(rbox(0.22, 0.01, 0.22, 0.004, 1), drainMat);
    d.position.set(x, 0.005, z);
    grp.add(d);
    for (let k = -2; k <= 2; k++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.012, 0.012), stdMat('#2c2a27'));
      s.position.set(x, 0.008, z + k * 0.035);
      grp.add(s);
    }
  }
  return grp;
}

// ------------------------------------------------------------------ muretas
function buildParapets() {
  const grp = new THREE.Group();
  grp.name = 'muretas';
  const wall = plasterMat('#efe1c9');
  const cap = stdMat('#d6cab8', { roughness: 0.88 });
  const add = (x, z, w, d, h) => {
    const m = new THREE.Mesh(rbox(w, h, d, 0.02), wall);
    m.position.set(x, h / 2, z);
    const c = new THREE.Mesh(rbox(w + 0.08, 0.06, d + 0.1, 0.015), cap);
    c.position.set(x, h + 0.03, z);
    grp.add(m, c);
    return m;
  };
  add(0, -4.32, 13.4, 0.24, PARAPET_H); // norte
  add(-6.52, -0.2, 0.24, 8.0, PARAPET_H); // oeste
  add(6.52, -0.2, 0.24, 8.0, PARAPET_H); // leste
  add(0, 3.94, 13.4, 0.24, 0.42); // sul (baixa: a câmera fica deste lado)
  // rodapé escuro (respingos de chuva)
  const sk = stdMat('#c9b9a2', { roughness: 0.95 });
  for (const [x, z, w, d] of [[0, -4.195, 13.0, 0.02], [-6.395, -0.2, 0.02, 7.9], [6.395, -0.2, 0.02, 7.9]]) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.1, d), sk);
    m.position.set(x, 0.05, z);
    grp.add(m);
  }
  shadowAll(grp);
  return grp;
}

// ------------------------------------------------------------------ floreiras
function buildPlanters(layout) {
  const grp = new THREE.Group();
  grp.name = 'floreiras';
  const P = layout.PLANTERS, G = layout.PASS;
  const boxMat = plasterMat('#d98f6a');
  const capMat = stdMat('#e9dccb', { roughness: 0.85 });
  const soilMat = stdMat('#5b3e2b', { roughness: 1 });
  const runs = [[-4.2 + 0.02, G.z0], [G.z1, 3.8 - 0.02]];
  const plants = { lav: [], ger: [], box: [], fl: [] };
  const r = rng(23);
  for (const [z0, z1] of runs) {
    const len = z1 - z0;
    const nBoxes = Math.max(1, Math.round(len / 1.35));
    for (let i = 0; i < nBoxes; i++) {
      const a = z0 + (i * len) / nBoxes, b = z0 + ((i + 1) * len) / nBoxes;
      // a caixa de alvenaria para 4 cm abaixo da borda: a terra fica por cima dela (sem faces no mesmo
      // plano, que davam z-fighting: listras "tremendo" na terra) e o aro cobre a junta
      const bodyH = P.height - 0.04;
      const m = new THREE.Mesh(rbox(P.half * 2, bodyH, b - a - 0.03, 0.035), boxMat);
      m.position.set(P.x, bodyH / 2, (a + b) / 2);
      // aro de cima (a terra aparece no meio)
      const L = b - a + 0.01, W = P.half * 2 + 0.05, t = 0.06;
      for (const sx of [-1, 1]) {
        const c = new THREE.Mesh(rbox(t, 0.09, L, 0.015), capMat);
        c.position.set(P.x + sx * (W / 2 - t / 2), P.height - 0.015, (a + b) / 2);
        grp.add(c);
      }
      for (const sz of [-1, 1]) {
        const c = new THREE.Mesh(rbox(W - 2 * t + 0.01, 0.09, t, 0.015), capMat);
        c.position.set(P.x, P.height - 0.015, (a + b) / 2 + sz * (L / 2 - t / 2));
        grp.add(c);
      }
      const soilTop = bodyH + 0.005;
      const s = new THREE.Mesh(new THREE.BoxGeometry(W - 2 * t + 0.008, 0.02, L - 2 * t + 0.008), soilMat);
      s.position.set(P.x, soilTop - 0.01, (a + b) / 2);
      grp.add(m, s);
      // plantas ao longo da caixa
      for (let z = a + 0.12; z < b - 0.08; z += 0.13 + r() * 0.06) {
        for (const side of [-1, 1]) {
          if (r() < 0.25) continue;
          const k = r();
          const x = P.x + side * (0.06 + r() * 0.06);
          const zz = z + (r() - 0.5) * 0.06;
          const y = soilTop - 0.012; // a base da planta afunda na terra (longe do topo da caixa e da terra)
          if (k < 0.4) plants.lav.push([x, y, zz, r()]);
          else if (k < 0.66) plants.ger.push([x, y, zz, r()]);
          else if (k < 0.74) plants.box.push([x, y, zz, r()]);
          else plants.fl.push([x, y, zz, r()]);
        }
      }
    }
  }
  const place = (list, make) => list.map(([x, y, z, s], i) => make(i, s).translate(x, y, z));
  const geos = [
    ...place(plants.lav, (i) => lavender({ stems: 16, height: 0.3, spread: 0.08, seed: 100 + i })),
    ...place(plants.ger, (i, s) => geranium({ radius: 0.09, height: 0.12, seed: 200 + i, flower: s < 0.5 ? '#f0525a' : '#f58ab0', clusters: 3 })),
    ...place(plants.box, (i) => boxwood(0.075, 300 + i).translate(0, 0.05, 0)),
    ...place(plants.fl, (i, s) => smallFlowers({ count: 14, radius: 0.08, height: 0.09, seed: 400 + i, color: s < 0.5 ? '#fff6ee' : '#ffd84a' })),
  ];
  const plantMesh = new THREE.Mesh(mergeGeometries(geos.map((g) => (g.index ? g.toNonIndexed() : g))), plantMat());
  plantMesh.castShadow = true;
  plantMesh.receiveShadow = true;
  grp.add(plantMesh);
  shadowAll(grp);
  return grp;
}

// ------------------------------------------------------------------ casa da escada + caixa d'água
function buildStairHouse(layout) {
  const grp = new THREE.Group();
  grp.name = 'casa-da-escada';
  const H = layout.STAIR_HOUSE;
  const w = H.x1 - H.x0, d = H.z1 - H.z0, cx = (H.x0 + H.x1) / 2, cz = (H.z0 + H.z1) / 2;
  const wallMat = plasterMat('#ead2a8');
  const body = new THREE.Mesh(rbox(w, H.height, d, 0.03), wallMat);
  body.position.set(cx, H.height / 2, cz);
  const roof = new THREE.Mesh(rbox(w + 0.16, 0.12, d + 0.16, 0.02), stdMat('#d8ccba', { roughness: 0.9 }));
  roof.position.set(cx, H.height + 0.06, cz);
  // faixa e rodapé
  const band = new THREE.Mesh(rbox(w + 0.02, 0.08, d + 0.02, 0.01), stdMat('#c9a77a', { roughness: 0.9 }));
  band.position.set(cx, H.height - 0.18, cz);
  grp.add(body, roof, band);

  // porta de metal verde-água com visor e maçaneta
  const D = H.door;
  const frame = new THREE.Mesh(rbox(D.width + 0.14, D.height + 0.08, 0.06, 0.012), stdMat('#f3eee4', { roughness: 0.6 }));
  frame.position.set(D.x, (D.height + 0.08) / 2, H.z1 + 0.02);
  const doorMat = stdMat('#3f8088', { roughness: 0.45, metalness: 0.35 });
  const door = new THREE.Mesh(rbox(D.width, D.height, 0.05, 0.01), doorMat);
  door.position.set(D.x, D.height / 2 + 0.02, H.z1 + 0.04);
  const panel = new THREE.Mesh(rbox(D.width - 0.2, 0.7, 0.01, 0.006), stdMat('#356f77', { roughness: 0.5, metalness: 0.35 }));
  panel.position.set(D.x, 0.55, H.z1 + 0.07);
  const visor = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.28), new THREE.MeshStandardMaterial({ color: '#b7d3df', roughness: 0.08, metalness: 0.2, emissive: '#2a3a44', emissiveIntensity: 0.4 }));
  visor.position.set(D.x, 1.55, H.z1 + 0.072);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), stdMat('#d8c38a', { metalness: 0.9, roughness: 0.3 }));
  knob.position.set(D.x + D.width / 2 - 0.12, 1.0, H.z1 + 0.1);
  const step = new THREE.Mesh(rbox(D.width + 0.3, 0.06, 0.3, 0.015), stdMat('#cdbfa9', { roughness: 0.9 }));
  step.position.set(D.x, 0.03, H.z1 + 0.15);
  grp.add(frame, door, panel, visor, knob, step);
  // arandela (apagada de dia) e plaquinha
  const lamp = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 0.16, 14), new THREE.MeshStandardMaterial({ color: '#fff6e4', roughness: 0.3, emissive: '#ffe3a8', emissiveIntensity: 0.15 }));
  lamp.position.set(D.x, D.height + 0.3, H.z1 + 0.1);
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.14), new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 84, (g, cw, ch) => {
      g.fillStyle = '#2f5b62'; g.fillRect(0, 0, cw, ch);
      g.fillStyle = '#f7f1e3'; g.font = '700 46px Fredoka, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('ESCADA', cw / 2, ch / 2 + 2);
    }, { repeat: false }), roughness: 0.6,
  }));
  sign.position.set(D.x + D.width / 2 + 0.38, 1.6, H.z1 + 0.012);
  grp.add(lamp, sign);

  // escadinha de marinheiro na face leste
  const ladderMat = stdMat('#7c8389', { metalness: 0.6, roughness: 0.4 });
  for (const dz of [-0.2, 0.2]) {
    const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, H.height + 0.5, 8), ladderMat);
    rail.position.set(H.x1 + 0.1, (H.height + 0.5) / 2, cz + dz);
    grp.add(rail);
  }
  for (let y = 0.3; y < H.height + 0.4; y += 0.28) {
    const rung = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.4, 6).rotateX(Math.PI / 2), ladderMat);
    rung.position.set(H.x1 + 0.1, y, cz);
    grp.add(rung);
  }

  // caixa d'água azul em cima (o pombo da passagem pousa na borda)
  const T = layout.NAP_PIGEON.flyTo;
  const tankMat = new THREE.MeshPhysicalMaterial({ color: '#3d7fc6', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const tankH = T.y - H.height - 0.12 - 0.06;
  const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.58, 0.5, tankH, 32, 1), tankMat);
  tank.position.set(T.x, H.height + 0.12 + tankH / 2, T.z);
  const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.06, 32), tankMat);
  lid.position.set(T.x, H.height + 0.12 + tankH + 0.03, T.z);
  const lidTop = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.25, 0.08, 20), tankMat);
  lidTop.position.set(T.x, H.height + 0.12 + tankH + 0.1, T.z);
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.555 - i * 0.02, 0.012, 6, 40).rotateX(Math.PI / 2), tankMat);
    ring.position.set(T.x, H.height + 0.32 + i * (tankH * 0.3), T.z);
    grp.add(ring);
  }
  const base = new THREE.Mesh(rbox(1.3, 0.12, 1.1, 0.02), stdMat('#bdb3a4'));
  base.position.set(T.x, H.height + 0.12 + 0.0, T.z);
  // cano descendo pela fachada
  const pipeMat = stdMat('#e9e4da', { roughness: 0.5 });
  const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, H.height + 0.4, 10), pipeMat);
  pipe.position.set(H.x0 + 0.35, (H.height + 0.4) / 2, H.z1 + 0.05);
  grp.add(tank, lid, lidTop, base, pipe);
  shadowAll(grp);

  // capacho (a "casa" desta fase) — brilha quando o patinho está a caminho
  const G = layout.GOAL;
  const matTex = doormatTexture();
  const matMat = new THREE.MeshStandardMaterial({ map: matTex, roughness: 1, emissive: '#ffb347', emissiveIntensity: 0 });
  const doormat = new THREE.Mesh(rbox(0.95, 0.025, 0.6, 0.01, 1), matMat);
  doormat.position.set(G.x, 0.0125, G.z + 0.05);
  doormat.receiveShadow = true;
  grp.add(doormat);
  const goalSh = contactShadow(0.5, 0.33, 0.18);
  goalSh.position.set(G.x, 0.004, G.z + 0.05);
  grp.add(goalSh);
  return { group: grp, doormat, doormatMat: matMat };
}

// ------------------------------------------------------------------ cidade em volta
function buildCity() {
  const grp = new THREE.Group();
  grp.name = 'cidade';
  const r = rng(77);
  const colors = ['#efe1c9', '#e7d2b8', '#dcd6cc', '#f0e6da', '#d9c3a4', '#c9d3d6', '#e9c9b5'];
  /** [x, z, w, d, alturaAcimaDoTerraço, andares totais, rotY] */
  const spots = [
    [-11, -14, 7, 6, 4.5, 14, 0], [-3, -17, 6, 6, 9, 16, 0], [4.5, -13, 7, 6, -1.5, 10, 0], [12, -16, 6, 6, 6, 14, 0],
    [-18, -8, 6, 7, 1.5, 12, Math.PI / 2], [17.5, -7, 6, 7, 3, 12, -Math.PI / 2], [-17, 3, 6, 6, -2.5, 9, Math.PI / 2],
    [17, 4, 6, 6, -0.5, 10, -Math.PI / 2], [-6.5, -28, 9, 6, 16, 22, 0], [9, -30, 8, 6, 12, 20, 0], [24, -22, 7, 6, 8, 16, -0.4],
    [-25, -20, 7, 6, 10, 18, 0.4],
  ];
  const facadeFix = (b) => b.traverse((o) => {
    const m = /** @type {any} */ (o).material;
    if (!m) return;
    for (const mm of Array.isArray(m) ? m : [m]) if (mm.emissiveMap) mm.emissiveIntensity = 0.12; // de dia: janelas quase não brilham
  });
  spots.forEach(([x, z, w, d, top, floors, rot], i) => {
    const h = floors * 3.0;
    const b = makeBuilding({ w, h, d, floors, seed: 300 + i, color: colors[i % colors.length], balconies: i % 3 !== 1 });
    facadeFix(b);
    b.position.set(x, top - h, z);
    b.rotation.y = rot;
    grp.add(b);
    // telhado: caixa d'água ou antena
    if (r() < 0.7) {
      const tank = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.55, 0.9, 16), stdMat(r() < 0.5 ? '#3d7fc6' : '#bfb8ae'));
      tank.position.set(x + (r() - 0.5) * w * 0.5, top + 0.75, z + (r() - 0.5) * d * 0.4);
      grp.add(tank);
    }
    if (r() < 0.5) {
      const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.2, 6), stdMat('#5b5752', { metalness: 0.5 }));
      mast.position.set(x + (r() - 0.5) * w * 0.6, top + 1.4, z + (r() - 0.5) * d * 0.5);
      grp.add(mast);
    }
  });
  // copas de árvores da rua lá embaixo (só aparecem nos vãos entre os prédios)
  const treeMat = mat('f4-street-trees', () => new THREE.MeshStandardMaterial({ color: '#5f8a43', roughness: 0.95 }));
  for (let i = 0; i < 14; i++) {
    const t = new THREE.Mesh(new THREE.IcosahedronGeometry(1.4 + r() * 0.8, 1), treeMat);
    const a = (i / 14) * Math.PI * 2;
    t.position.set(Math.cos(a) * (12 + r() * 4), -6 - r() * 3, Math.sin(a) * (10 + r() * 3) - 4);
    grp.add(t);
  }
  return grp;
}

export function buildTerrace(layout) {
  const floor = buildFloor(layout);
  const parapets = buildParapets();
  const planters = buildPlanters(layout);
  const house = buildStairHouse(layout);
  const city = buildCity();
  const group = new THREE.Group();
  group.name = 'terraco';
  group.add(floor, parapets, planters, house.group, city);
  return { group, house, planters, parapets };
}
