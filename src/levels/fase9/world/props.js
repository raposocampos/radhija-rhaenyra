// FASE 9 · Props interativos: os óculos (na prateleira alta), o livro (no alto do armário, caindo, no chão, deitado
// na mesinha), o Bichano (com os "Zzz" enquanto dorme), as quatro alavancas da parede (freio da escadinha, disjuntor
// do jardim de inverno e a maçaneta da porta dos dois lados), os ossinhos e as luzes da casa (o fogo da lareira
// tremula; a lanterna acende com o disjuntor). A escadinha e a trava do freio, o globo, o ventilador, o vaso de
// rodinhas, o botão do registro, a porta, o duto, a portinha e a mesinha vêm prontos dos outros módulos do cenário.
import * as THREE from 'three';
import { createGlasses, createStorybook } from '../../../world/toys.js';
import { createCat } from '../../../world/cat.js';
import { buildTreats } from '../../../world/treats.js';
import { buildWallButton, wallButtonYaw } from '../../../world/wallButton.js';
import { canvasTexture } from '../../../world/util.js';

const ease = (cur, target, dt, rate) => cur + (target - cur) * (1 - Math.exp(-rate * dt));
const smooth = (k) => { const x = Math.min(1, Math.max(0, k)); return x * x * (3 - 2 * x); };

/** Materiais com emissivo de um objeto (para o brilho de destaque). */
function emissiveMats(obj) {
  const list = [];
  obj.traverse((/** @type {THREE.Mesh} */ o) => {
    if (!o.isMesh) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) if (m && 'emissive' in m && !m.transparent) list.push(m);
  });
  return list;
}

/**
 * @param {{ root: THREE.Object3D, layout: import('../../../types').LevelLayout, room: any, library: any, office: any,
 *   hall: any, conservatory: any }} args
 */
export function buildProps({ root, layout, room, library, office, hall, conservatory }) {
  const { GLASSES, WARDROBE, CAT, BOOK_FALL, BRAKE_LEVER, BREAKER, DOOR_HANDLE, DOOR_HANDLE_IN, COLLECTIBLES } = layout;

  // ---- óculos dobrados na prateleira alta
  const glassesObj = createGlasses();
  glassesObj.position.set(GLASSES.x, GLASSES.y + 0.008, GLASSES.z);
  root.add(glassesObj);
  const glassesHome = glassesObj.position.clone();
  const glassesMats = emissiveMats(glassesObj);

  // ---- livro: o grupo de fora é o que vai para a boca; o de dentro deita (chão, armário, mesinha) ou fica em pé (boca)
  const bookObj = new THREE.Group();
  bookObj.name = 'livro';
  bookObj.userData.carryKind = 'book';
  const bookInner = createStorybook();
  bookObj.add(bookInner);
  root.add(bookObj);
  const BW = 0.22; // altura do livro (de pé)
  const bookTop = new THREE.Vector3(CAT.top.x + 0.04, WARDROBE.h, CAT.top.z);
  const bookFloor = new THREE.Vector3(BOOK_FALL.x, 0, BOOK_FALL.z);
  const bookMats = emissiveMats(bookInner);
  /** Deitado (capa para cima) ou de pé (como na boca). */
  function setLying(on) {
    if (on) {
      bookInner.rotation.set(-Math.PI / 2, 0, 0);
      bookInner.position.set(0, 0.018, BW / 2);
    } else {
      bookInner.rotation.set(0, 0, 0);
      bookInner.position.set(0, 0, 0);
    }
  }
  const bookHomeFn = () => {
    root.add(bookObj);
    bookObj.position.copy(bookTop);
    bookObj.rotation.set(0, 0.35, 0);
    setLying(true);
  };
  bookHomeFn();
  const bookHome = bookObj.position.clone();

  // ---- o Bichano, dormindo em cima do livro
  const cat = createCat();
  root.add(cat.object);
  const catHome = () => cat.setPose({ x: CAT.top.x, y: CAT.top.y + 0.035, z: CAT.top.z, yaw: 0.4, mode: 'sleep', k: 1 });
  catHome();
  // "Zzz" subindo do gato enquanto ele dorme (para quem olha de longe saber que ele está lá em cima, dormindo)
  const zTex = zzzTexture();
  const zzz = [0, 1, 2].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: zTex, transparent: true, depthWrite: false, opacity: 0 }));
    sp.renderOrder = 25;
    root.add(sp);
    return { sp, ph: i / 3 };
  });

  // ---- alavancas no alto das paredes (patinhas pintadas)
  const place = (prop, cfg) => {
    prop.object.position.set(cfg.x, 0, cfg.z);
    prop.object.rotation.y = wallButtonYaw(cfg.nx, cfg.nz);
    root.add(prop.object);
    return prop;
  };
  const brakeLever = place(buildWallButton({ kind: 'lever', top: BRAKE_LEVER.top, color: '#e8554a', name: 'alavanca-freio' }), BRAKE_LEVER);
  const breaker = place(buildWallButton({ kind: 'lever', top: BREAKER.top, color: '#f2c14e', plate: '#d8dcd6', trim: '#2a2624', name: 'disjuntor' }), BREAKER);
  const doorHandle = place(buildWallButton({ kind: 'lever', top: DOOR_HANDLE.top, color: '#c99a45', trim: '#6b4630', name: 'macaneta' }), DOOR_HANDLE);
  const doorHandleIn = place(buildWallButton({ kind: 'lever', top: DOOR_HANDLE_IN.top, color: '#c99a45', trim: '#6b4630', name: 'macaneta-dentro' }), DOOR_HANDLE_IN);
  const levers = [brakeLever, breaker, doorHandle, doorHandleIn];
  const treats = buildTreats(root, COLLECTIBLES, { glow: 0.24 });

  // ---- luzes da casa (sem sombra): o fogo da lareira tremula
  const lights = [];
  const addLight = (pos, color, intensity, dist) => {
    const l = new THREE.PointLight(color, intensity, dist, 1.6);
    l.position.copy(pos);
    root.add(l);
    lights.push(l);
    return l;
  };
  const fireLight = addLight(library.firePos, '#ff9a4a', 2.2, 5.5);
  addLight(library.corner.lampPos, '#ffcf8a', 1.3, 4.2);
  addLight(office.deskLampPos, '#ffe0a8', 1.1, 4.0);
  addLight(hall.sconcePos, '#ffd08a', 0.9, 3.6);
  conservatory.setLanternLight(addLight(conservatory.lanternPos, '#ffd38a', 0.06, 4.2));

  const st = { glassesHl: false, glassesGlow: 0, bookHl: false, bookGlow: 0, fall: /** @type {number | null} */ (null) };
  /** @satisfies {import('../../../types').Fase9Props} */
  const props = {
    glasses: { object: glassesObj, home: glassesHome, setHighlight(on) { st.glassesHl = !!on; } },
    book: {
      object: bookObj,
      home: bookHome,
      setHighlight(on) { st.bookHl = !!on; },
      setLying,
      /** null = no alto do armário; 0..1 caindo do armário até o chão (arco com cambalhota); 1 = no chão. */
      setFall(k) {
        st.fall = k;
        if (k == null) { bookHomeFn(); return; }
        root.add(bookObj);
        setLying(true);
        const u = smooth(k);
        bookObj.position.set(
          bookTop.x + (bookFloor.x - bookTop.x) * u,
          bookTop.y * (1 - k * k) + Math.sin(Math.PI * k) * 0.12,
          bookTop.z + (bookFloor.z - bookTop.z) * u,
        );
        bookObj.rotation.set(Math.sin(Math.PI * k) * 0.9, 0.35 + k * 1.4, Math.sin(Math.PI * k) * 0.4);
        if (k >= 1) bookObj.rotation.set(0, 1.75, 0);
      },
    },
    ladder: { object: library.ladder.object, setPos: library.ladder.setPos, setHighlight: library.ladder.setHighlight },
    globe: { object: library.globe.object, setPos: library.globe.setPos },
    fan: {
      object: conservatory.fan.object, setPos: conservatory.fan.setPos, setAligned: conservatory.fan.setAligned,
      setPower: conservatory.fan.setPower, setRunning: conservatory.fan.setRunning,
    },
    planter: { object: conservatory.planter.object, setPos: conservatory.planter.setPos, setHighlight: conservatory.planter.setHighlight },
    plate: {
      object: conservatory.plate.group,
      setPress(t) { conservatory.plate.setPress(t); conservatory.plateLink.setOn(t > 0.5); },
    },
    power: { setOn: conservatory.power.setOn },
    ladderBrake: { setReleased: library.brake.setReleased },
    flap: { setSwing: room.setFlapSwing },
    door: office.door,
    cat: { object: cat.object, setPose: cat.setPose },
    duct: {
      object: room.duct.group,
      setDamper: room.duct.setDamper,
      setPuffs: room.duct.setPuffs,
      outletPuff: room.duct.outletPuff,
    },
    brakeLever, breaker, doorHandle, doorHandleIn,
    table: { object: library.corner.group, setHighlight: library.corner.setHighlight, spot: (thing) => library.corner.spots[thing] },
    collectibles: treats.list,
    fireflies: false,
    update(dt, t) {
      cat.update(dt, t);
      const asleep = cat.mode === 'sleep';
      for (const z of zzz) {
        const u = (t * 0.35 + z.ph) % 1;
        z.sp.position.set(CAT.top.x + 0.12 + u * 0.18 + Math.sin(u * 6 + z.ph * 9) * 0.03, CAT.top.y + 0.22 + u * 0.42, CAT.top.z + 0.12);
        z.sp.scale.setScalar(0.07 + u * 0.09);
        z.sp.material.opacity = asleep ? Math.sin(Math.PI * u) * 0.9 : 0;
        z.sp.visible = asleep;
      }
      for (const l of levers) l.update?.(dt, t);
      treats.update(dt, t);
      // o livro em pé na boca e deitado no resto (o carregador o tira do root)
      const inMouth = /mouthSocket/.test(bookObj.parent?.name || '');
      if (inMouth && bookInner.rotation.x !== 0) setLying(false);
      st.glassesGlow = ease(st.glassesGlow, st.glassesHl ? 1 : 0, dt, 5);
      for (const m of glassesMats) m.emissive?.setRGB(0.6 * st.glassesGlow, 0.45 * st.glassesGlow, 0.15 * st.glassesGlow).multiplyScalar(0.6 + 0.4 * Math.sin(t * 5));
      st.bookGlow = ease(st.bookGlow, st.bookHl ? 1 : 0, dt, 5);
      for (const m of bookMats) m.emissive?.setRGB(0.5 * st.bookGlow, 0.32 * st.bookGlow, 0.12 * st.bookGlow).multiplyScalar(0.6 + 0.4 * Math.sin(t * 5));
      fireLight.intensity = 2.0 + 0.35 * Math.sin(t * 11) * Math.sin(t * 6.3) + 0.15 * Math.sin(t * 23);
    },
    reset() {
      root.add(glassesObj);
      glassesObj.position.copy(glassesHome);
      glassesObj.rotation.set(0, 0, 0);
      bookHomeFn();
      catHome();
      office.door.setOpen(0);
      library.brake.setReleased(false);
      conservatory.power.setOn(false);
      conservatory.plateLink.setOn(false);
      for (const l of levers) { l.setOn(false); l.setPress(0); l.setTimer?.(null); }
      st.glassesHl = st.bookHl = false;
      st.fall = null;
      for (const c of treats.list) c.reset();
    },
  };
  props.reset();
  return { props, lights };
}

/** Um "Z" de desenho (contorno escuro, miolo claro) para o sono do Bichano. */
function zzzTexture() {
  return canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.font = 'bold 50px sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 7;
    g.strokeStyle = 'rgba(40,30,60,0.85)';
    g.strokeText('Z', w / 2, h / 2 + 2);
    g.fillStyle = '#f4f0ff';
    g.fillText('Z', w / 2, h / 2 + 2);
  }, { repeat: false });
}
