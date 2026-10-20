// FASE 9 · O hall de entrada: banco com sapatos e galochas, porta-guarda-chuva com o guarda-chuva molhado pingando
// numa poça, cabideiro com casacos e chapéu, aparador com a tigela de chaves, o espelho e o porta-retratos, a
// passadeira listrada, a arandela acesa e a almofada do Bichano perto do arco.
import * as THREE from 'three';
import { rbox, canvasTexture, stdMat, woodMat, contactShadow, shadowAll } from '../../../world/util.js';

const TAU = Math.PI * 2;

export function buildHall({ root, layout }) {
  const { HALL_BENCH: HB, UMBRELLA_STAND: U, COAT_RACK: CR, CONSOLE: CO, CAT, WORLD, WALL_EH, WALL_HL } = layout;
  const B = WORLD.bounds;
  const grp = new THREE.Group();
  grp.name = 'hall';
  const wood = woodMat('#6b4630', { key: 'f9-hall-madeira', rough: 0.5 });
  const brass = stdMat('#c99a45', { roughness: 0.3, metalness: 0.8 });

  // banco com almofada e os sapatos embaixo
  const bench = new THREE.Group();
  bench.position.set(HB.x, 0, HB.z);
  const seat = new THREE.Mesh(rbox(HB.hx * 2, 0.05, HB.hz * 2, 0.012), wood);
  seat.position.y = HB.h - 0.025;
  const pad = new THREE.Mesh(rbox(HB.hx * 2 - 0.06, 0.05, HB.hz * 2 - 0.04, 0.02), new THREE.MeshStandardMaterial({ color: '#7a2a28', roughness: 0.9 }));
  pad.position.y = HB.h + 0.02;
  const shelf = new THREE.Mesh(rbox(HB.hx * 2 - 0.04, 0.025, HB.hz * 2 - 0.02, 0.008), wood);
  shelf.position.y = 0.12;
  bench.add(seat, pad, shelf);
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(rbox(0.04, HB.h - 0.05, HB.hz * 2, 0.01), wood);
    side.position.set(sx * (HB.hx - 0.02), (HB.h - 0.05) / 2, 0);
    bench.add(side);
  }
  const shoe = (x, color, z = 0) => {
    const s = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.13, 4, 10).rotateX(Math.PI / 2), stdMat(color, { roughness: 0.6 }));
    s.scale.set(1, 0.7, 1);
    s.position.set(x, 0.155, z);
    bench.add(s);
  };
  shoe(-0.32, '#3a2416'); shoe(-0.24, '#3a2416'); shoe(0.12, '#8a2a2a', 0.02); shoe(0.2, '#8a2a2a', 0.02);
  // galochas amarelas no chão, ao lado
  for (const dx of [0, 0.11]) {
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.26, 12), stdMat('#e8c040', { roughness: 0.35 }));
    boot.position.set(HB.hx + 0.12 + dx, 0.13, 0.04);
    const toe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.06, 4, 10).rotateX(Math.PI / 2), stdMat('#e8c040', { roughness: 0.35 }));
    toe.position.set(HB.hx + 0.12 + dx, 0.04, 0.09);
    bench.add(boot, toe);
  }
  grp.add(bench);

  // porta-guarda-chuva com o guarda-chuva molhado e a poça embaixo
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(U.r, U.r * 0.9, 0.5, 18, 1, true), stdMat('#2f4a3e', { roughness: 0.3, metalness: 0.2, side: THREE.DoubleSide }));
  stand.position.set(U.x, 0.25, U.z);
  const umb = new THREE.Group();
  umb.position.set(U.x, 0.1, U.z);
  umb.rotation.z = 0.15;
  const canopy = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.6, 8, 1, true), new THREE.MeshPhysicalMaterial({ color: '#2a5a8a', roughness: 0.2, clearcoat: 1, side: THREE.DoubleSide }));
  canopy.position.y = 0.42;
  canopy.rotation.x = Math.PI;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.01, 6, 12, Math.PI), stdMat('#5a3a24', { roughness: 0.5 }));
  handle.position.y = 0.8;
  umb.add(canopy, handle);
  grp.add(stand, umb);
  const puddle = new THREE.Mesh(new THREE.CircleGeometry(0.2, 24).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#5b7c8a', roughness: 0.05, transparent: true, opacity: 0.75 }));
  puddle.scale.set(1.3, 1, 0.8);
  puddle.position.set(U.x + 0.22, 0.007, U.z + 0.22);
  puddle.userData.noShadow = true;
  grp.add(puddle);
  // gotinha caindo do guarda-chuva (anima no update)
  const drop = new THREE.Mesh(new THREE.SphereGeometry(0.008, 8, 6), new THREE.MeshStandardMaterial({ color: '#cfe6f2', roughness: 0.05, transparent: true, opacity: 0.85 }));
  grp.add(drop);

  // cabideiro com casaco, cachecol e chapéu
  const rack = new THREE.Group();
  rack.position.set(CR.x, 0, CR.z);
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.75, 10), wood);
  pole.position.y = 0.875;
  rack.add(pole);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU;
    const leg = new THREE.Mesh(rbox(0.03, 0.03, 0.3, 0.008), wood);
    leg.position.set(Math.sin(a) * 0.12, 0.05, Math.cos(a) * 0.12);
    leg.rotation.set(0.35, a, 0);
    rack.add(leg);
    const hook = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.14, 6), brass);
    hook.position.set(Math.sin(a + 0.5) * 0.06, 1.68, Math.cos(a + 0.5) * 0.06);
    hook.rotation.set(Math.cos(a + 0.5) * 0.9, 0, -Math.sin(a + 0.5) * 0.9);
    rack.add(hook);
  }
  const coat = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, 0.9, 12, 1, true), new THREE.MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.95, side: THREE.DoubleSide }));
  coat.position.set(0.08, 1.22, 0.04);
  const scarf = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.025, 8, 16), stdMat('#9c2f2a', { roughness: 0.95 }));
  scarf.position.set(-0.06, 1.55, 0.02);
  scarf.rotation.x = 1.2;
  const hat = new THREE.Group();
  hat.position.set(0, 1.8, 0);
  hat.add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.012, 20), stdMat('#3a3028', { roughness: 0.8 })));
  const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.065, 0.08, 18), stdMat('#3a3028', { roughness: 0.8 }));
  crown.position.y = 0.045;
  hat.add(crown);
  rack.add(coat, scarf, hat);
  grp.add(rack);

  // aparador com a tigela de chaves, o porta-retratos e o espelho na parede (o aparador fica encostado no arco)
  const con = new THREE.Group();
  con.position.set(CO.x, 0, CO.z);
  const ctop = new THREE.Mesh(rbox(CO.hx * 2, 0.035, CO.hz * 2, 0.01), wood);
  ctop.position.y = CO.h;
  con.add(ctop);
  for (const sz of [-1, 1]) for (const sx of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, CO.h, 8), wood);
    leg.position.set(sx * (CO.hx - 0.03), CO.h / 2, sz * (CO.hz - 0.03));
    con.add(leg);
  }
  const bowl = new THREE.Mesh(new THREE.SphereGeometry(0.08, 16, 8, 0, TAU, Math.PI / 2, Math.PI / 2), stdMat('#d8cba8', { roughness: 0.4, side: THREE.DoubleSide }));
  bowl.position.set(0, CO.h + 0.08, -0.12);
  bowl.rotation.x = Math.PI;
  const keys = new THREE.Mesh(new THREE.TorusGeometry(0.02, 0.004, 6, 12), brass);
  keys.position.set(0.01, CO.h + 0.05, -0.12);
  keys.rotation.x = 1.2;
  con.add(bowl, keys);
  const photo = new THREE.Mesh(rbox(0.12, 0.15, 0.02, 0.006), brass);
  photo.position.set(0, CO.h + 0.09, 0.15);
  photo.rotation.set(0, -Math.PI / 2, -0.1);
  con.add(photo);
  grp.add(con);
  // espelho oval na parede do fundo, entre o cabideiro e a porta
  const mirror = new THREE.Group();
  mirror.position.set(-3.95, 1.55, B.minZ + 0.02);
  const mframe = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.025, 8, 32), woodMat('#c99a45', { key: 'f9-espelho', rough: 0.35 }));
  mframe.scale.set(0.8, 1.15, 1);
  const glass = new THREE.Mesh(new THREE.CircleGeometry(0.21, 32), new THREE.MeshStandardMaterial({ color: '#cfd8de', roughness: 0.04, metalness: 0.9 }));
  glass.scale.set(0.8, 1.15, 1);
  glass.position.z = -0.006;
  mirror.add(mframe, glass);
  grp.add(mirror);
  // arandela acesa ao lado da porta
  const sconce = new THREE.Group();
  sconce.position.set(-2.25, 1.75, B.minZ + 0.06);
  const sback = new THREE.Mesh(rbox(0.06, 0.12, 0.02, 0.006), brass);
  const sshade = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 0.12, 16, 1, true), new THREE.MeshStandardMaterial({ color: '#f1dcae', emissive: '#ffcf7a', emissiveIntensity: 0.6, roughness: 0.7, side: THREE.DoubleSide }));
  sshade.position.set(0, 0.06, 0.06);
  sconce.add(sback, sshade);
  grp.add(sconce);

  // passadeira listrada do hall (de leste a oeste, entre a porta do escritório e o arco)
  const runner = new THREE.Mesh(rbox(WALL_HL.x - WALL_EH.x - 0.4, 0.008, 0.7, 0.004), new THREE.MeshStandardMaterial({
    map: canvasTexture(256, 64, (g, w, h) => {
      g.fillStyle = '#2f4a3e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#d8cba8'; g.fillRect(0, 6, w, 4); g.fillRect(0, h - 10, w, 4);
      g.fillStyle = '#b06a4a';
      for (let x = 12; x < w; x += 24) { g.beginPath(); g.moveTo(x, h / 2 - 8); g.lineTo(x + 8, h / 2); g.lineTo(x, h / 2 + 8); g.lineTo(x - 8, h / 2); g.fill(); }
    }, { repeat: false }), roughness: 0.95,
  }));
  runner.position.set((WALL_EH.x + WALL_HL.x) / 2, 0.005, 0.35);
  runner.receiveShadow = true;
  grp.add(runner);

  // almofada do Bichano (redonda, xadrez), perto do arco
  const cushion = new THREE.Group();
  cushion.position.set(CAT.bed.x, 0, CAT.bed.z);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 10, 24).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#b06a4a', roughness: 0.95 }));
  ring.position.y = 0.06;
  const pillow = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.2, 0.05, 24), new THREE.MeshStandardMaterial({ map: canvasTexture(64, 64, (g, w, h) => {
    g.fillStyle = '#e8d9b8'; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(176,106,74,0.45)';
    for (let i = 0; i < w; i += 16) { g.fillRect(i, 0, 8, h); g.fillRect(0, i, w, 8); }
  }), roughness: 0.95 }));
  pillow.position.y = 0.03;
  cushion.add(ring, pillow);
  // baixinha (12 cm) e fofa: as dogs pisam nela como numa placa (game/ground.js), sem atravessar
  cushion.userData.walkable = true;
  grp.add(cushion);

  shadowAll(grp);
  puddle.castShadow = false;
  runner.castShadow = false;
  root.add(grp);
  for (const [x, z, r] of [[HB.x, HB.z, HB.hx], [CR.x, CR.z, 0.2], [CO.x, CO.z, 0.3], [CAT.bed.x, CAT.bed.z, 0.28]]) {
    const sh = contactShadow(r + 0.08, r * 0.6 + 0.06, 0.35);
    sh.position.set(x, 0.004, z);
    root.add(sh);
  }
  const dropFrom = new THREE.Vector3(U.x + 0.12, 0.18, U.z + 0.1);
  return {
    group: grp,
    sconcePos: new THREE.Vector3(-2.25, 1.75, B.minZ + 0.2),
    update(dt, t) {
      // uma gotinha a cada ~1,2 s, do guarda-chuva até a poça
      const u = (t % 1.2) / 0.35;
      drop.visible = u < 1;
      drop.position.set(dropFrom.x + 0.1 * Math.min(1, u), dropFrom.y * (1 - u * u), dropFrom.z + 0.12 * Math.min(1, u));
    },
  };
}
