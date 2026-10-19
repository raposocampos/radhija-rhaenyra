// Dublês explícitos da fronteira cenário/puzzle. Não desenham, mas cada fase
// só oferece os props e métodos declarados em seu contrato de produção.
import * as THREE from 'three';

/**
 * A guarda não fabrica propriedades. Até uma chamada opcional com nome errado
 * deve reprovar o teste, em vez de virar um no-op silencioso.
 * @template {object} T
 * @param {string} path
 * @param {T} value
 * @param {string[]} [absent]
 * @returns {T & { calls: unknown[][] }}
 */
function checked(path, value, absent = []) {
  /** @type {unknown[][]} */
  const calls = [];
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
    if (typeof descriptor.value !== 'function') continue;
    const method = descriptor.value;
    Object.defineProperty(value, name, {
      ...descriptor,
      value(...args) { calls.push([name, ...args]); return method.apply(this, args); },
    });
  }
  const target = Object.assign(value, { calls });
  return new Proxy(target, {
    get(t, key, receiver) {
      if (Reflect.has(t, key)) return Reflect.get(t, key, receiver);
      // Inspeção de objetos e resolução de promises não são operações de props.
      if (typeof key === 'symbol' || key === 'then' || absent.includes(key)) return undefined;
      throw new Error(`Prop não declarado: ${path}.${key}`);
    },
  });
}

/** @param {THREE.Group} root @param {string} name */
function object(root, name) {
  const obj = new THREE.Group();
  obj.name = `prop:${name}`;
  root.add(obj);
  return obj;
}

/** @param {THREE.Group} root @param {string} name */
function highlight(root, name) {
  return checked(name, { object: object(root, name), setHighlight(on) {} });
}

/** @param {THREE.Group} root @param {string} name @param {{ x: number, z: number }} pos */
function item(root, name, pos) {
  const obj = object(root, name);
  obj.position.set(pos.x, 0, pos.z);
  return checked(name, { object: obj, home: obj.position.clone(), setHighlight(on) {} });
}

/** @param {THREE.Group} root @param {string} name */
function gate(root, name) {
  const obj = object(root, name);
  return checked(name, { object: obj, setOpen(t) { obj.rotation.y = t; } });
}

/** @param {THREE.Group} root @param {string} name */
function press(root, name) {
  return checked(name, { object: object(root, name), setPress(t) {} });
}

/** @param {THREE.Group} root @param {string} name */
function fan(root, name) {
  const obj = object(root, name);
  return checked(name, { object: obj, setPos(x, z) { obj.position.set(x, 0, z); }, setAligned(on) {} });
}

/** @param {THREE.Group} root @param {string} name */
function pigeon(root, name) {
  return {
    object: object(root, name),
    /** @param {import('../../src/types').PigeonPose} pose */
    setPose(pose) {},
  };
}

/** @template {import('../../src/types').LevelProps} P @param {string} id @param {P} props */
function level(id, props) {
  return checked(id, props, ['collectibles', 'update', 'reset', 'fireflies']);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase1Props(root, layout) {
  /** @satisfies {import('../../src/types').Fase1Props} */
  const props = {
    gate: gate(root, 'fase1.gate'),
    rope: checked('fase1.rope', { object: object(root, 'rope'), setTug(t) {} }),
    cart: checked('fase1.cart', { object: object(root, 'cart'), setX(x) {} }),
    carrot: item(root, 'carrot', layout.CARROT),
    door: highlight(root, 'fase1.door'),
    collectibles: [],
  };
  return level('fase1', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase2Props(root, layout) {
  const ball = item(root, 'ball', layout.BALL);
  /** @satisfies {import('../../src/types').Fase2Props} */
  const props = {
    gate: gate(root, 'fase2.gate'),
    plank: press(root, 'fase2.plank'),
    wedge: checked('fase2.wedge', { object: object(root, 'wedge'), setState(t) {}, bump() {} }),
    sprinkler: checked('fase2.sprinkler', { object: object(root, 'sprinkler'), setAngle(a) {}, setOn(k) {} }),
    valve: checked('fase2.valve', { object: object(root, 'valve'), setTurn(t) {} }),
    crate: checked('fase2.crate', { object: object(root, 'crate'), setPos(x, z) {}, setSink(t) {} }),
    ball,
    item: ball,
    bed: highlight(root, 'fase2.bed'),
    collectibles: [],
  };
  return level('fase2', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase3Props(root, layout) {
  const slipper = item(root, 'slipper', layout.SLIPPER);
  /** @satisfies {import('../../src/types').Fase3Props} */
  const props = {
    gate: gate(root, 'fase3.gate'),
    plateH: press(root, 'fase3.plateH'),
    plateL: press(root, 'fase3.plateL'),
    lanternH: checked('fase3.lanternH', { object: object(root, 'lanternH'), setOn(k) {} }),
    lanternL: checked('fase3.lanternL', { object: object(root, 'lanternL'), setOn(k) {} }),
    slipper,
    item: slipper,
    door: highlight(root, 'fase3.door'),
    collectibles: [],
  };
  return level('fase3', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase4Props(root, layout) {
  const plateObject = object(root, 'plate');
  plateObject.position.y = layout.PERCH_B.y + 0.12;
  /** @satisfies {import('../../src/types').Fase4Props} */
  const props = {
    fan: fan(root, 'fase4.fan'),
    gate: gate(root, 'fase4.gate'),
    plate: checked('fase4.plate', {
      object: plateObject,
      get surfaceY() { return plateObject.position.y + 0.0125; },
      setPress(t) { plateObject.position.y = layout.PERCH_B.y + 0.12 - 0.065 * t; },
    }),
    pigeon: checked('fase4.pigeon', pigeon(root, 'pigeon')),
    napPigeon: checked('fase4.napPigeon', { ...pigeon(root, 'napPigeon'), peek() {} }),
    duck: item(root, 'duck', layout.DUCK),
    basin: checked('fase4.basin', { object: object(root, 'basin'), setRipple(k) {} }),
    goal: highlight(root, 'fase4.goal'),
    collectibles: [],
    reset() { props.gate.setOpen(0); props.plate.setPress(0); props.fan.setAligned(false); },
  };
  return level('fase4', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase5Props(root, layout) {
  const bear = item(root, 'bear', layout.BEAR);
  /** @satisfies {import('../../src/types').Fase5Props} */
  const props = {
    petGate: gate(root, 'fase5.petGate'),
    latch: checked('fase5.latch', { object: object(root, 'latch'), setTurn(k) {} }),
    pillowBox: checked('fase5.pillowBox', { object: object(root, 'pillowBox'), setPos(x, z) {}, setCollapse(k) {} }),
    bear: checked('fase5.bear', { object: bear.object, home: bear.home, setHighlight(on) {}, setCarried(on) {} }),
    bed: highlight(root, 'fase5.bed'),
    collectibles: [],
  };
  return level('fase5', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase6Props(root, layout) {
  const ball = item(root, 'ball', layout.BALL);
  ball.home.y = layout.BALL.y;
  ball.object.position.copy(ball.home);
  const moon = item(root, 'moon', layout.MOON);
  moon.home.y = layout.MOON.y;
  moon.object.position.copy(moon.home);
  const trainObject = object(root, 'train');
  const junctionObject = object(root, 'junction');
  const noseObject = object(trainObject, 'nose');
  const goalObject = object(root, 'goal');
  const sockets = { planet: object(goalObject, 'socket-planet'), moon: object(goalObject, 'socket-moon') };
  /** @type {import('../../src/types').Fase6Props} */
  const props = {
    pedal: press(root, 'fase6.pedal'),
    junction: checked('fase6.junction', {
      object: junctionObject,
      /** @param {import('../../src/types').Fase6Route} route */
      setRoute(route) { junctionObject.rotation.y = route === 'delivery' ? Math.PI / 2 : -Math.PI / 2; },
    }),
    train: checked('fase6.train', {
      object: trainObject,
      /** @param {import('../../src/types').Fase6TrainPose} pose */
      setPose(pose) { trainObject.position.set(pose.x, 0, pose.z); trainObject.rotation.y = pose.yaw; },
    }),
    nose: checked('fase6.nose', {
      object: noseObject,
      setSneeze(t) { noseObject.scale.set(1 + t * 0.3, 1 + t * 0.15, 1 - t * 0.55); },
    }),
    ball,
    moon,
    barrier: checked('fase6.barrier', { object: object(root, 'barrier'), setOpen(k) {} }),
    barrierPlate: press(root, 'fase6.barrierPlate'),
    hopper: checked('fase6.hopper', { object: object(root, 'hopper'), setOpen(k) {} }),
    goal: checked('fase6.goal', {
      object: goalObject,
      setHighlight(on) {},
      /** @param {import('../../src/types').Fase6Cargo} cargo */
      socket(cargo) { return sockets[cargo]; },
      launch() {},
    }),
    collectibles: [],
    reset() {
      props.pedal.setPress(0);
      props.barrierPlate.setPress(0);
      props.junction.setRoute('loop');
      props.train.setPose(layout.TRAIN.start);
      props.nose.setSneeze(0);
      props.barrier.setOpen(0);
      props.hopper.setOpen(0);
      for (const it of [ball, moon]) {
        it.object.position.copy(it.home);
        it.object.rotation.set(0, 0, 0);
        it.setHighlight(false);
      }
      props.goal.setHighlight(false);
    },
  };
  props.reset();
  return level('fase6', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase7Props(root, layout) {
  const ball = item(root, 'ball', layout.BALL);
  const frisbee = item(root, 'frisbee', layout.FRISBEE);
  frisbee.home.y = layout.FRISBEE.y;
  frisbee.object.position.copy(frisbee.home);
  const goalObject = object(root, 'goal');
  const spots = { ball: object(goalObject, 'spot-ball'), frisbee: object(goalObject, 'spot-frisbee') };
  /** @type {import('../../src/types').Fase7Props} */
  const props = {
    gate: gate(root, 'fase7.gate'),
    latch: checked('fase7.latch', { object: object(root, 'latch'), setTurn(k) {} }),
    ball,
    frisbee,
    goal: checked('fase7.goal', {
      object: goalObject,
      setHighlight(on) {},
      /** @param {import('../../src/types').Fase7Thing} thing */
      spot(thing) { return spots[thing]; },
    }),
    collectibles: [],
    reset() {
      props.gate.setOpen(0);
      props.latch.setTurn(0);
      for (const it of [ball, frisbee]) {
        it.object.position.copy(it.home);
        it.object.rotation.set(0, 0, 0);
        it.setHighlight(false);
      }
      props.goal.setHighlight(false);
    },
  };
  props.reset();
  return level('fase7', props);
}

/** Fase 8: meia no varal, mantinha (guarda o lugar pedido), cesto, máquina, botões e caminha.
 * @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase8Props(root, layout) {
  const rackObj = object(root, 'rack');
  const sockAnchor = object(rackObj, 'rack:meia');
  const sock = item(sockAnchor, 'sock', { x: 0, z: 0 });
  const bedObject = object(root, 'bed');
  const spots = { sock: object(bedObject, 'spot-sock'), blanket: object(bedObject, 'spot-blanket') };
  const basketObj = object(root, 'basket');
  const anchor = object(basketObj, 'basket:anchor');
  /** @satisfies {import('../../src/types').Fase8Props} */
  const props = {
    sock,
    rack: checked('fase8.rack', { object: rackObj, sockAnchor, lower: 0, setLower(t) { this.lower = t; } }),
    washer: checked('fase8.washer', { object: object(root, 'washer'), spin: 0, setSpin(k) { this.spin = k; } }),
    blanket: checked('fase8.blanket', {
      object: object(root, 'blanket'), where: 'machine', wobbleK: 0,
      /** @param {import('../../src/types').Fase8BlanketPlace} where */
      place(where, animate = false) { this.where = where; },
      wobble(k) { this.wobbleK = k; },
    }),
    basket: checked('fase8.basket', {
      object: basketObj, anchor,
      setPos(x, z) { basketObj.position.set(x, 0, z); },
      setHighlight(on) {},
    }),
    spinButton: wallButton(root, 'fase8.spinButton'),
    rackButton: wallButton(root, 'fase8.rackButton'),
    bed: checked('fase8.bed', {
      object: bedObject,
      setHighlight(on) {},
      /** @param {import('../../src/types').Fase8Thing} thing */
      spot(thing) { return spots[thing]; },
    }),
    collectibles: [],
    reset() {
      sockAnchor.add(sock.object);
      sock.object.position.copy(sock.home);
      props.blanket.place('machine');
      props.basket.setPos(layout.BASKET.start.x, layout.BASKET.start.z);
      props.rack.setLower(0);
      props.washer.setSpin(0);
    },
  };
  props.reset();
  return level('fase8', props);
}

/** Fase 9: óculos e livro (com a queda e o deitar), escada, globo, ventilador, porta, gato, duto, alavancas e mesinha.
 * @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase9Props(root, layout) {
  const glasses = item(root, 'glasses', { x: layout.GLASSES.x, z: layout.GLASSES.z });
  const book = item(root, 'book', { x: layout.CAT.top.x, z: layout.CAT.top.z });
  const tableObj = object(root, 'table');
  const spots = { glasses: object(tableObj, 'spot-glasses'), book: object(tableObj, 'spot-book') };
  const crate = (name) => checked(`fase9.${name}`, { object: object(root, name), setPos(x, z) { this.object.position.set(x, 0, z); } });
  /** @satisfies {import('../../src/types').Fase9Props} */
  const props = {
    glasses,
    book: Object.assign(book, {
      fall: /** @type {number | null} */ (null), lying: true,
      setFall(k) { this.fall = k; },
      setLying(on) { this.lying = on; },
    }),
    ladder: checked('fase9.ladder', { object: object(root, 'ladder'), setPos(x, z) { this.object.position.set(x, 0, z); }, setHighlight(on) {} }),
    globe: crate('globe'),
    fan: checked('fase9.fan', {
      object: object(root, 'fan'), aligned: false, power: false, running: false,
      setPos(x, z) { this.object.position.set(x, 0, z); }, setAligned(on) { this.aligned = on; },
      setPower(on) { this.power = on; }, setRunning(on) { this.running = on; },
    }),
    planter: checked('fase9.planter', { object: object(root, 'planter'), setPos(x, z) { this.object.position.set(x, 0, z); }, setHighlight(on) {} }),
    plate: checked('fase9.plate', { object: object(root, 'plate'), press: 0, setPress(t) { this.press = t; } }),
    power: checked('fase9.power', { on: false, setOn(on) { this.on = on; } }),
    ladderBrake: checked('fase9.ladderBrake', { released: false, setReleased(on) { this.released = on; } }),
    flap: checked('fase9.flap', { swing: 0, setSwing(v) { this.swing = v; } }),
    door: gate(root, 'fase9.door'),
    cat: checked('fase9.cat', { object: object(root, 'cat'), pose: null, setPose(p) { this.pose = { ...p }; } }),
    duct: checked('fase9.duct', { object: object(root, 'duct'), damper: false, puffs: [], outs: 0, setDamper(on) { this.damper = on; }, setPuffs(list) { this.puffs = list; }, outletPuff() { this.outs++; } }),
    brakeLever: wallButton(root, 'fase9.brakeLever'),
    breaker: wallButton(root, 'fase9.breaker'),
    doorHandle: wallButton(root, 'fase9.doorHandle'),
    doorHandleIn: wallButton(root, 'fase9.doorHandleIn'),
    table: checked('fase9.table', {
      object: tableObj,
      setHighlight(on) {},
      /** @param {import('../../src/types').Fase9Thing} thing */
      spot(thing) { return spots[thing]; },
    }),
    collectibles: [],
    reset() {
      root.add(glasses.object);
      glasses.object.position.copy(glasses.home);
      root.add(book.object);
      book.object.position.copy(book.home);
      props.book.setFall(null);
      props.door.setOpen(0);
    },
  };
  props.reset();
  return level('fase9', props);
}

/** Fase 10: os três enfeites, o bolo (andares e queda), piscininha, barquinho, caixote, ventilador, energia, portão e
 * cordinha, pombo, cano, balde e corda, placa e porta do galpão, disjuntor e torneira.
 * @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubFase10Props(root, layout) {
  const hat = item(root, 'hat', { x: layout.BOAT.start.x, z: layout.BOAT.start.z });
  const ribbon = item(root, 'ribbon', { x: layout.RIBBON.x, z: layout.RIBBON.z });
  const candle = item(root, 'candle', { x: layout.CANDLE.x, z: layout.CANDLE.z });
  const handle = object(root, 'rope-handle');
  handle.position.set(layout.ROPE.rest.x, 0, layout.ROPE.rest.z);
  const cakeObj = object(root, 'cake');
  const tierSpots = [0, 1, 2].map((i) => object(cakeObj, `tier-${i}`));
  const things = { hat, ribbon, candle };
  /** @satisfies {import('../../src/types').Fase10Props} */
  const props = {
    hat: Object.assign(hat, { onBoat: true, setOnBoat(on) { this.onBoat = on; } }),
    ribbon,
    candle,
    cake: checked('fase10.cake', {
      object: cakeObj, placed: /** @type {string[]} */ ([]), lit: false, rejected: 0,
      setHighlight(on) {},
      /** @param {import('../../src/types').Fase10Thing} thing @param {number} tier */
      place(thing, tier) { tierSpots[tier].add(things[thing].object); this.placed.push(thing); },
      /** @param {import('../../src/types').Fase10Thing} thing */
      reject(thing, tier, k, x, z) { if (k === 0) this.rejected++; root.add(things[thing].object); things[thing].object.position.set(x, 0, z); },
      light() { this.lit = true; },
    }),
    pool: checked('fase10.pool', { level: 0, y: 0, flowing: false, blocked: false, setLevel(k, y) { this.level = k; this.y = y; }, setFlow(on, blocked) { this.flowing = on; this.blocked = blocked; } }),
    boat: checked('fase10.boat', { object: object(root, 'boat'), setPos(x, z, y, drifting) { this.object.position.set(x, y, z); } }),
    crate: checked('fase10.crate', { object: object(root, 'crate'), setPos(x, z) { this.object.position.set(x, 0, z); }, setHighlight(on) {} }),
    fan: checked('fase10.fan', { object: object(root, 'fan'), power: false, setPower(on) { this.power = on; } }),
    power: checked('fase10.power', { on: false, stage: /** @type {'off' | 'house' | 'painting' | 'porch' | 'on'} */ ('off'), setOn(on) { this.on = on; this.stage = on ? 'on' : 'off'; } }),
    gate: gate(root, 'fase10.gate'),
    cord: checked('fase10.cord', { tug: 0, setTug(k) { this.tug = k; } }),
    pigeon: checked('fase10.pigeon', { object: object(root, 'pigeon'), pose: null, pecks: 0, setPose(p) { this.pose = { ...p }; }, peck() { this.pecks++; } }),
    tube: checked('fase10.tube', { object: object(root, 'tube'), puffs: [], outs: 0, setPuffs(list) { this.puffs = list; }, outletPuff() { this.outs++; } }),
    bucket: checked('fase10.bucket', { object: object(root, 'bucket'), y: 0, setY(y) { this.y = y; } }),
    rope: checked('fase10.rope', { handle, pulled: 0, setPull(pulled, holder) { this.pulled = pulled; } }),
    plate: press(root, 'fase10.plate'),
    shedDoor: gate(root, 'fase10.shedDoor'),
    breaker: wallButton(root, 'fase10.breaker'),
    tap: wallButton(root, 'fase10.tap'),
    collectibles: [],
    reset() {
      for (const it of [hat, ribbon, candle]) { root.add(it.object); it.object.position.copy(it.home); }
      props.hat.setOnBoat(true);
      props.cake.placed.length = 0;
      props.cake.lit = false;
      props.gate.setOpen(0);
      props.shedDoor.setOpen(0);
      props.bucket.setY(0);
      props.pigeon.object.visible = true;
    },
  };
  props.reset();
  return level('fase10', props);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubPlaceholderProps(root, layout) {
  const obj = object(root, 'item');
  const pos = layout.BALL || layout.SLIPPER;
  if (pos) obj.position.set(pos.x, 0.07, pos.z);
  /** @satisfies {import('../../src/types').PlaceholderProps} */
  const props = { item: checked('placeholder.item', { object: obj, setHighlight(on) {} }), collectibles: [], reset() {} };
  // O cenário provisório não oferece ball, plate ou gate: o puzzle usa seus
  // fallbacks. A guarda permite a ausência declarada, mas não cria tais props.
  return checked('placeholder', props, ['ball', 'plate', 'gate', 'update', 'fireflies']);
}

/** @param {THREE.Group} root @param {string} name */
function wallButton(root, name) {
  return checked(name, { object: object(root, name), setPress(t) {}, setOn(on) {}, setTimer(k) {}, update(dt, t) {} });
}

/** Arena do Pulo: o cenário provisório (item, sem ball/plate/gate) e a parede de treino do impulso.
 * @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubPuloProps(root, layout) {
  const obj = object(root, 'item');
  obj.position.set(layout.BALL.x, 0.07, layout.BALL.z);
  /** @satisfies {import('../../src/types').PuloProps} */
  const props = {
    item: checked('pulo.item', { object: obj, setHighlight(on) {} }),
    wallButton: wallButton(root, 'pulo.wallButton'),
    wallLever: wallButton(root, 'pulo.wallLever'),
    hatch: gate(root, 'pulo.hatch'),
    lights: checked('pulo.lights', { object: object(root, 'lights'), setOn(on) {} }),
    collectibles: [],
    reset() {},
  };
  return checked('pulo', props, ['ball', 'plate', 'gate', 'update', 'fireflies']);
}

/** @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubBafoProps(root, layout) {
  /** @satisfies {import('../../src/types').BafoProps} */
  const props = {
    fan: fan(root, 'bafo.fan'),
    gate: gate(root, 'bafo.gate'),
    plate: press(root, 'bafo.plate'),
    pigeon: checked('bafo.pigeon', pigeon(root, 'pigeon')),
    carrot: item(root, 'carrot', layout.CARROT),
    collectibles: [],
  };
  return level('bafo', props);
}

/** @param {string} id @param {THREE.Group} root @param {import('../../src/types').LevelLayout} layout */
export function stubProps(id, root, layout) {
  switch (id) {
    case 'fase1': return stubFase1Props(root, layout);
    case 'fase2': return stubFase2Props(root, layout);
    case 'fase3': return stubFase3Props(root, layout);
    case 'fase4': return stubFase4Props(root, layout);
    case 'fase5': return stubFase5Props(root, layout);
    case 'fase6': return stubFase6Props(root, layout);
    case 'fase7': return stubFase7Props(root, layout);
    case 'fase8': return stubFase8Props(root, layout);
    case 'fase9': return stubFase9Props(root, layout);
    case 'fase10': return stubFase10Props(root, layout);
    case 'modelo': return stubPlaceholderProps(root, layout);
    case 'pulo': return stubPuloProps(root, layout);
    case 'bafo': return stubBafoProps(root, layout);
    default: throw new Error(`Fase sem fábrica explícita de props: ${id}`);
  }
}
