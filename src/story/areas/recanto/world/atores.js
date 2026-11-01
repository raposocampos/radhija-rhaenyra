// RECANTO DAS PATINHAS — os atores das cenas e o que se mexe sem ser cenário:
//  - o Esquadrão Migalha (createPigeon de src/world/pigeon.js com acessórios): o CAPITÃO (quepe azul com a pala e o
//    cachecol vermelho; mede a cenoura com a asa e bate continência), o FARELO (gordinho) e o SONECA (cochila em
//    qualquer lugar). Cada um: { object, setPose, salute(k), measure(k), update(dt, t) }.
//  - a CENOURA DE BORRACHA nova (a das fases é de pelúcia): laranja brilhante, com gomos e as folhas de borracha;
//    squeeze(k) amassa no "fiu".
//  - as MÃOS E PÉS humanos (kit de cenas): o braço da tutora e o porteiro, escondidos até as cenas.
//  - as SILHUETAS da Reconstrução da piscina: um pombo e a boia de patinho murcha, com o material translúcido.
//  - a GAROA da abertura: riscos de chuva numa malha só (instâncias), em volta da casa.
//  - as MEIAS PERDIDAS (o colecionável do capítulo): { id, object, collect(), reset() }.
import * as THREE from 'three';
import { createPigeon } from '../../../../world/pigeon.js';
import { createSock } from '../../../../world/toys.js';
import { createTutoraArm, createPorteiro } from '../../../scene/humans.js';
import { ghostMaterial, ghostify } from '../../../faro/reconstruction.js';

const std = (color, roughness = 0.6, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness, ...extra });

/** O quepe do Capitão (copa azul, pala preta, emblema dourado) e o cachecol vermelho. */
function captainGear(pigeon) {
  const head = pigeon.object.getObjectByName('cabeca');
  const neck = pigeon.object.getObjectByName('pescoco');
  const navy = std('#33456b', 0.55);
  const cap = new THREE.Group();
  cap.name = 'quepe';
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.027, 0.022, 14), navy);
  crown.position.y = 0.011;
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.034, 0.03, 0.008, 14), navy);
  top.position.y = 0.024;
  const visor = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.004, 14, 1, false, -Math.PI / 2, Math.PI), std('#1f2430', 0.4));
  visor.position.set(0, 0.002, 0.012);
  const badge = new THREE.Mesh(new THREE.SphereGeometry(0.006, 8, 6), std('#e8b93a', 0.3, { metalness: 0.6 }));
  badge.position.set(0, 0.016, 0.028);
  cap.add(crown, top, visor, badge);
  cap.position.set(0, 0.032, 0.0);
  cap.rotation.x = -0.18;
  (head || pigeon.object).add(cap);
  const scarf = new THREE.Group();
  scarf.name = 'cachecol';
  const red = std('#d23c3c', 0.8);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.03, 0.011, 8, 18), red);
  ring.rotation.x = Math.PI / 2;
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.008), red);
  tail.position.set(0.018, -0.025, 0.024);
  tail.rotation.z = 0.35;
  scarf.add(ring, tail);
  scarf.position.set(0, 0.012, 0.0);
  (neck || pigeon.object).add(scarf);
  for (const m of [crown, top, visor, badge, ring, tail]) m.castShadow = true;
}

/** Um pombo do esquadrão: o pombo do jogo, com a asa direita que a cena levanta (continência e medida). */
function squadPigeon({ id, seed, scale, tint = null, gear = null }) {
  const p = createPigeon({ seed, scale, ...(tint ? { tint } : {}) });
  p.object.name = `pombo:${id}`;
  if (gear) gear(p);
  const wingR = p.object.getObjectByName('asa-direita');
  const S = { salute: 0, measure: 0, hidden: false };
  return {
    id,
    object: p.object,
    setPose: (q) => p.setPose(q),
    peek: () => p.peek(),
    peck: () => p.peck(),
    /** 0..1: a asa direita sobe até a cabeça (continência). */
    salute(k) { S.salute = k; },
    /** 0..1: a asa direita se estica para a frente (medindo a cenoura). */
    measure(k) { S.measure = k; },
    setVisible(on) { p.object.visible = on; },
    update(dt, t) {
      p.update(dt, t);
      if (wingR && (S.salute > 0 || S.measure > 0)) {
        const s = S.salute, m = S.measure;
        wingR.rotation.z = wingR.rotation.z * (1 - Math.max(s, m)) + (1.55 * s + 1.05 * m);
        wingR.rotation.y = wingR.rotation.y * (1 - Math.max(s, m)) + (-0.95 * s - 0.25 * m);
        wingR.rotation.x = 0.35 * s - 0.55 * m;
      }
    },
  };
}

/** A cenoura de borracha (≈ 0,27 m), ponta para +Z, folhas para −Z; a origem no meio do corpo. */
function rubberCarrot() {
  const g = new THREE.Group();
  g.name = 'cenoura-de-borracha';
  const prof = [];
  const N = 14, len = 0.24;
  for (let i = 0; i <= N; i++) {
    const u = i / N;
    const r = 0.04 * Math.pow(Math.sin(Math.min(1, u * 1.15) * Math.PI * 0.5), 0.6) * (1 - u * 0.82) + (u > 0.97 ? 0 : 0.003);
    prof.push(new THREE.Vector2(Math.max(0.0005, r), u * len));
  }
  const bodyGeo = new THREE.LatheGeometry(prof, 22);
  bodyGeo.rotateX(Math.PI / 2);
  bodyGeo.translate(0, 0, -len * 0.42);
  // os gomos da borracha (anéis mais escuros) por cor de vértice
  const pos = bodyGeo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const a = new THREE.Color('#f07a1a'), b = new THREE.Color('#d8620c');
  for (let i = 0; i < pos.count; i++) {
    const z = pos.getZ(i);
    const c = Math.sin((z + 0.2) * 95) > 0.82 ? b : a;
    colors.set([c.r, c.g, c.b], i * 3);
  }
  bodyGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const rubber = new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.32, clearcoat: 0.55, clearcoatRoughness: 0.3 });
  const body = new THREE.Mesh(bodyGeo, rubber);
  body.castShadow = true;
  g.add(body);
  const leafMat = new THREE.MeshPhysicalMaterial({ color: '#4fa444', roughness: 0.4, clearcoat: 0.4 });
  for (let i = 0; i < 3; i++) {
    const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.09, 6), leafMat);
    leaf.position.set(Math.sin(i * 2.1) * 0.012, Math.cos(i * 2.1) * 0.012, -len * 0.42 - 0.04);
    leaf.rotation.set(-Math.PI / 2 + Math.cos(i * 2.1) * 0.45, 0, Math.sin(i * 2.1) * 0.45);
    leaf.castShadow = true;
    g.add(leaf);
  }
  // o furinho do apito
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.006, 10), std('#3a1a06', 0.5));
  hole.position.set(0, 0.041, -0.06);
  hole.rotation.x = -Math.PI / 2;
  g.add(hole);
  g.userData.carryKind = 'carrot';
  return {
    object: g,
    /** 0..1: amassada no "fiu". */
    squeeze(k) { body.scale.set(1 + 0.12 * k, 1 - 0.22 * k, 1); },
    setVisible(on) { g.visible = on; },
  };
}

/** A boia de patinho murcha (para a silhueta da Reconstrução): um anel amassado com a cabeça de patinho caída. */
function limpDuckFloat(material) {
  const g = new THREE.Group();
  g.name = 'boia-de-patinho';
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.05, 8, 20), material);
  ring.rotation.x = Math.PI / 2;
  ring.scale.set(1, 1, 0.45);
  ring.position.y = 0.025;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), material);
  head.position.set(0.17, 0.05, 0);
  head.scale.set(1, 0.7, 1);
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.06, 8), material);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(0.24, 0.045, 0);
  g.add(ring, head, beak);
  return g;
}

/**
 * @param {THREE.Group} root
 * @param {import('../../../../types').LevelLayout} L
 */
export function buildAtores(root, L) {
  const group = new THREE.Group();
  group.name = 'recanto:atores';
  root.add(group);

  // ---------------------------------------------------------------- o Esquadrão Migalha
  const squad = {
    cap: squadPigeon({ id: 'capitao', seed: 7, scale: 1.2, gear: captainGear }),
    far: squadPigeon({ id: 'farelo', seed: 3, scale: 1.32 }),
    son: squadPigeon({ id: 'soneca', seed: 11, scale: 1.12 }),
  };
  // o Farelo é gordinho: o tronco mais largo
  squad.far.object.getObjectByName('tronco')?.scale.set(1.18, 1.08, 1.06);
  for (const p of Object.values(squad)) {
    group.add(p.object);
    p.setPose({ x: 0, y: -50, z: 0, flying: false });
    p.object.visible = false;
  }

  // ---------------------------------------------------------------- a cenoura de borracha
  const carrot = rubberCarrot();
  group.add(carrot.object);
  carrot.object.visible = false;

  // ---------------------------------------------------------------- mãos e pés humanos (só nas cenas)
  const tutora = createTutoraArm();
  const porteiro = createPorteiro();
  tutora.object.visible = false;
  porteiro.object.visible = false;
  group.add(tutora.object, porteiro.object);

  // ---------------------------------------------------------------- as silhuetas da Reconstrução da piscina
  const gMat = ghostMaterial('#cfe6ff', 0.5);
  const ghostPigeon = createPigeon({ seed: 21, scale: 1.25 });
  ghostify(ghostPigeon.object, gMat);
  ghostPigeon.object.name = 'silhueta:pombo';
  const ghostFloat = ghostify(limpDuckFloat(gMat), gMat);
  ghostFloat.name = 'silhueta:boia';
  const ghosts = { pigeon: ghostPigeon, float: ghostFloat, material: gMat };

  // ---------------------------------------------------------------- a garoa (só na abertura)
  const RAIN_N = 260;
  const rainBox = { x0: L.HOUSE.x0 - 1, x1: L.HOUSE.x1 + 2, z0: L.HOUSE.z0 - 4.5, z1: L.HOUSE.z0 + 1.2, y1: 5.5 };
  const streak = new THREE.PlaneGeometry(0.012, 0.32);
  const rainMat = new THREE.MeshBasicMaterial({ color: '#b8cfee', transparent: true, opacity: 0, depthWrite: false, fog: false, side: THREE.DoubleSide });
  const rain = new THREE.InstancedMesh(streak, rainMat, RAIN_N);
  rain.name = 'recanto:garoa';
  rain.frustumCulled = false;
  rain.visible = false;
  const drops = [];
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, 0.12));
  const v = new THREE.Vector3(), one = new THREE.Vector3(1, 1, 1);
  let seed = 5;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
  for (let i = 0; i < RAIN_N; i++) {
    drops.push({ x: rainBox.x0 + rnd() * (rainBox.x1 - rainBox.x0), y: rnd() * rainBox.y1, z: rainBox.z0 + rnd() * (rainBox.z1 - rainBox.z0), s: 3.2 + rnd() * 1.4 });
    m4.compose(v.set(drops[i].x, drops[i].y, drops[i].z), q, one);
    rain.setMatrixAt(i, m4);
  }
  group.add(rain);
  const R = { k: 0 };
  const rainApi = {
    object: rain,
    /** 0..1: o quanto chove (opacidade); 0 esconde. */
    setOn(k) {
      R.k = k;
      rain.visible = k > 0.001;
      rainMat.opacity = 0.42 * k;
    },
    update(dt) {
      if (!rain.visible) return;
      for (let i = 0; i < RAIN_N; i++) {
        const d = drops[i];
        d.y -= d.s * dt;
        d.x -= 0.35 * dt;
        if (d.y < 0) { d.y += rainBox.y1; d.x = rainBox.x0 + rnd() * (rainBox.x1 - rainBox.x0); }
        m4.compose(v.set(d.x, d.y, d.z), q, one);
        rain.setMatrixAt(i, m4);
      }
      rain.instanceMatrix.needsUpdate = true;
    },
  };

  // ---------------------------------------------------------------- as meias perdidas
  const socks = L.SOCKS.map((s, i) => {
    const sock = createSock(0.24);
    sock.name = `meia-${s.id}`;
    const holder = new THREE.Group();
    holder.add(sock);
    group.add(holder);
    const st = { got: false, anim: -1, phase: i * 1.7 };
    const home = new THREE.Vector3(s.x, s.y + 0.16, s.z);
    const reset = () => {
      st.got = false; st.anim = -1;
      holder.visible = true;
      holder.position.copy(home);
      holder.scale.setScalar(1);
      holder.rotation.set(0, i * 1.3, s.id === 'antena' ? 0 : 0.5);
    };
    reset();
    return {
      id: s.id,
      object: holder,
      collect() { if (!st.got) { st.got = true; st.anim = 0; } },
      reset,
      get collected() { return st.got; },
      _update(dt, t) {
        if (st.anim >= 0) {
          st.anim += dt;
          const k = Math.min(1, st.anim / 0.5);
          holder.position.y = home.y + k * 0.35;
          holder.scale.setScalar(Math.max(0.001, 1 - k));
          holder.rotation.y += dt * 10;
          if (k >= 1) { holder.visible = false; st.anim = -1; }
          return;
        }
        if (st.got) return;
        // a da antena balança no vento; as outras respiram devagar
        if (s.id === 'antena') holder.rotation.z = Math.sin(t * 2.1 + st.phase) * 0.22;
        else holder.position.y = home.y + Math.sin(t * 1.6 + st.phase) * 0.012;
      },
    };
  });

  return {
    props: {
      squad, carrot, rain: rainApi, socks,
      humans: { tutora, porteiro },
      ghosts,
    },
    seeThrough: [],
    signs: [],
    update(dt, t) {
      for (const p of Object.values(squad)) if (p.object.visible) p.update(dt, t);
      rainApi.update(dt);
      for (const s of socks) s._update(dt, t);
    },
    reset() {
      for (const p of Object.values(squad)) { p.object.visible = false; p.salute(0); p.measure(0); }
      carrot.object.visible = false;
      carrot.squeeze(0);
      tutora.object.visible = false;
      porteiro.object.visible = false;
      rainApi.setOn(0);
      for (const s of socks) s.reset();
    },
    // as mãos e a botina liberam o que é delas; o resto fica na árvore para o escopo de recursos da área liberar
    dispose() {
      tutora.dispose();
      porteiro.dispose();
    },
  };
}
