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
    case 'modelo':
    case 'pulo': return stubPlaceholderProps(root, layout);
    case 'bafo': return stubBafoProps(root, layout);
    default: throw new Error(`Fase sem fábrica explícita de props: ${id}`);
  }
}
