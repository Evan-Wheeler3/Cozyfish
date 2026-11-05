// Gatherables (sticks, stones, fiber, berries, mushrooms, worm mounds,
// crates) and decorative ground cover (grass, flowers, reeds, lily pads).
import * as THREE from 'three';
import { N, CENTER, SPAWN, CAMP, HOUSE, MARKET, WATER_Y, POND_MAX_H } from './config.js';
import { mulberry32, hash2 } from './noise.js';
import { MAT } from './mesher.js';
import { K } from './terrain.js';
import * as M from './models.js';

const LABEL = {
  stick: 'Pick up Stick', stone: 'Pick up Stone', fiber: 'Gather Fiber', bush: 'Pick Berries',
  mushroom: 'Pick Mushroom', mound: 'Dig for Worms (hold)', crate: 'Open Crate',
};

export class Props {
  constructor(game) {
    this.g = game;
    this.items = [];
    this.decor = [];
    this.anims = [];
    this.place();
  }

  free(x, z) {
    const t = this.g.terrain;
    x = Math.floor(x); z = Math.floor(z);
    if (x < 2 || z < 2 || x >= N - 2 || z >= N - 2) return false;
    if (t.isPond(x, z)) return false;
    const h = t.H(x, z);
    if (t.hasSolid(x, h, z)) return false;
    if (x >= HOUSE.x - 1 && x <= HOUSE.x + 9 && z >= HOUSE.z - 1 && z <= HOUSE.z + 7) return false;
    if (x >= MARKET.x - 1 && x <= MARKET.x + 5 && z >= MARKET.z - 1 && z <= MARKET.z + 3) return false;
    if (this.taken.has(x + z * N)) return false;
    return true;
  }

  add(type, x, z, extra = {}) {
    const t = this.g.terrain;
    const fx = Math.floor(x), fz = Math.floor(z);
    this.taken.add(fx + fz * N);
    const it = { id: type + this.items.length, type, x: fx + 0.5, z: fz + 0.5, y: t.H(fx, fz), active: true, yaw: hash2(fx, fz, 9) * Math.PI * 2, ...extra };
    this.items.push(it);
    return it;
  }

  scatter(rnd, type, count, test, tries = 4000) {
    let n = 0;
    for (let i = 0; i < tries && n < count; i++) {
      const x = 3 + rnd() * (N - 6), z = 3 + rnd() * (N - 6);
      if (!this.free(x, z) || !test(Math.floor(x), Math.floor(z))) continue;
      this.add(type, x, z); n++;
    }
  }

  near(rnd, type, count, cx, cz, r0, r1, test = () => true) {
    let n = 0;
    for (let i = 0; i < 400 && n < count; i++) {
      const a = rnd() * Math.PI * 2, r = r0 + rnd() * (r1 - r0);
      const x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
      if (!this.free(x, z) || !test(Math.floor(x), Math.floor(z))) continue;
      this.add(type, x, z); n++;
    }
  }

  place() {
    const t = this.g.terrain, rnd = mulberry32(777);
    this.taken = new Set();
    const F = (x, z) => t.forest[z * N + x];
    const kind = (x, z) => t.kindAt(x, z);
    const nearTree = (x, z) => this.g.forest.near(x, z, 3).length > 0;

    // a gentle start near spawn
    this.near(rnd, 'stick', 5, SPAWN.x, SPAWN.z - 2, 3, 10);
    this.near(rnd, 'stone', 3, SPAWN.x - 3, SPAWN.z - 6, 2, 8);
    this.near(rnd, 'fiber', 3, SPAWN.x - 6, SPAWN.z - 6, 2, 8, (x, z) => kind(x, z) !== K.PATH);
    this.near(rnd, 'mound', 2, SPAWN.x + 2, SPAWN.z - 7, 3, 8, (x, z) => kind(x, z) === K.GRASS);

    this.scatter(rnd, 'stick', 55, (x, z) => F(x, z) > 0.15 || nearTree(x, z));
    this.scatter(rnd, 'stone', 22, (x, z) => kind(x, z) === K.SAND);
    this.scatter(rnd, 'stone', 18, (x, z) => F(x, z) > 0.3);
    this.scatter(rnd, 'fiber', 34, (x, z) => (kind(x, z) === K.GRASS || kind(x, z) === K.SAND) && F(x, z) < 0.4);
    this.scatter(rnd, 'bush', 24, (x, z) => F(x, z) > 0.05 && F(x, z) < 0.7);
    this.scatter(rnd, 'mushroom', 28, (x, z) => F(x, z) > 0.45 && nearTree(x, z));
    this.scatter(rnd, 'mound', 14, (x, z) => kind(x, z) === K.GRASS && F(x, z) < 0.5);

    // crates: one at the abandoned campsite holds string
    this.add('crate', CAMP.x + 2, CAMP.z - 2, { cid: 'camp', loot: { string: 2, worm: 3, coins: 6 } });
    const crateLoot = [
      { nails: 10, coins: 12 }, { string: 1, lure: 2 }, { rope: 1, coins: 20 },
      { worm: 4, string: 1, coins: 8 }, { nails: 6, lure: 3 }, { coins: 35, rope: 1 },
    ];
    let c = 0;
    for (let i = 0; i < 3000 && c < crateLoot.length; i++) {
      const x = 8 + rnd() * (N - 16), z = 8 + rnd() * (N - 16);
      const fx = Math.floor(x), fz = Math.floor(z);
      if (!this.free(x, z) || F(fx, fz) < 0.7) continue;
      if (Math.hypot(x - CENTER, z - CENTER) > 66) continue;
      if (this.items.some(it => it.type === 'crate' && Math.hypot(it.x - x, it.z - z) < 25)) continue;
      this.add('crate', x, z, { cid: 'c' + c, loot: crateLoot[c] }); c++;
    }

    // static boulders (solid)
    this.boulders = [];
    for (let i = 0, n = 0; i < 2000 && n < 16; i++) {
      const x = 4 + rnd() * (N - 8), z = 4 + rnd() * (N - 8);
      const fx = Math.floor(x), fz = Math.floor(z);
      if (!this.free(x, z) || kind(fx, fz) === K.PATH) continue;
      const shoreSide = kind(fx, fz) === K.SAND;
      if (!shoreSide && F(fx, fz) < 0.3) continue;
      if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 8 || Math.hypot(x - CAMP.x, z - CAMP.z) < 8) continue;
      this.boulders.push({ x: fx, z: fz, y: t.H(fx, fz), seed: 100 + n });
      t.addSolid(fx, t.H(fx, fz), fz);
      this.taken.add(fx + fz * N);
      n++;
    }
  }

  build(pal) {
    const g = this.g, season = pal.key;
    // gatherable meshes
    for (const it of this.items) {
      if (it.mesh) { g.scene.remove(it.mesh); it.mesh = null; }
      let geo, mesh;
      switch (it.type) {
        case 'stick': geo = M.stickGeo(); break;
        case 'stone': geo = M.stoneGeo(); break;
        case 'fiber': geo = M.fiberGeo(pal.snow || season === 'fall'); break;
        case 'bush': geo = M.bushGeo(season); break;
        case 'mushroom': geo = M.mushroomGeo(); break;
        case 'mound': geo = M.moundGeo(pal.snow); break;
        case 'crate': {
          const cg = M.crateGeo();
          mesh = new THREE.Group();
          const body = new THREE.Mesh(cg.body, MAT.vox), lid = new THREE.Group();
          const lidMesh = new THREE.Mesh(cg.lid, MAT.vox);
          lid.position.set(0, 0.48, -0.3);   // hinge along the back edge
          lidMesh.position.set(0, 0, 0.6);
          lid.add(lidMesh);
          body.castShadow = true; lidMesh.castShadow = true;
          mesh.add(body, lid);
          mesh.userData.lid = lid;
          if (g.state.cratesOpened.includes(it.cid)) { it.active = false; lid.rotation.x = -1.9; }
        } break;
      }
      if (!mesh) mesh = new THREE.Mesh(geo, MAT.vox);
      if (it.type === 'bush') {
        const b = new THREE.Mesh(M.berriesGeo(), MAT.vox);
        mesh.add(b); mesh.userData.berries = b;
      }
      mesh.position.set(it.x, it.y, it.z);
      mesh.rotation.y = it.type === 'crate' ? Math.round(it.yaw / (Math.PI / 2)) * Math.PI / 2 : it.yaw;
      mesh.castShadow = it.type === 'bush' || it.type === 'crate';
      mesh.receiveShadow = true;
      it.mesh = mesh;
      g.scene.add(mesh);
      this.refresh(it);
    }

    // decor
    for (const d of this.decor) { g.scene.remove(d); d.dispose && d.dispose(); }
    this.decor = [];
    const t = g.terrain, rnd = mulberry32(99);
    const mat4 = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3(), UP = new THREE.Vector3(0, 1, 0);
    const inst = (geo, list, scaleR = [0.8, 1.3], mat = MAT.plant) => {
      if (!list.length) return;
      const im = new THREE.InstancedMesh(geo, mat, list.length);
      list.forEach(([x, y, z], i) => {
        q.setFromAxisAngle(UP, rnd() * Math.PI * 2);
        const sc = scaleR[0] + rnd() * (scaleR[1] - scaleR[0]);
        mat4.compose(p.set(x, y, z), q, s.set(sc, sc, sc));
        im.setMatrixAt(i, mat4);
      });
      im.receiveShadow = true;
      g.scene.add(im); this.decor.push(im);
    };
    const tufts = [[], [], []], flowers = pal.flowers.map(() => []), reeds = [], lilies = [], lilyF = [];
    const tuftN = pal.snow ? 500 : 3600;
    for (let i = 0; i < tuftN * 3; i++) {
      if (tufts[0].length + tufts[1].length + tufts[2].length >= tuftN) break;
      const x = 2 + rnd() * (N - 4), z = 2 + rnd() * (N - 4);
      const fx = Math.floor(x), fz = Math.floor(z), k = t.kindAt(fx, fz);
      if (k === K.BED || k === K.PATH || t.hasSolid(fx, t.H(fx, fz), fz)) continue;
      if (k === K.SAND && rnd() > 0.2) continue;
      tufts[i % 3].push([x, t.H(fx, fz), z]);
    }
    const tuftHex = pal.grassTuft;
    inst(M.grassTuftGeo(tuftHex, 5, 1), tufts[0]);
    inst(M.grassTuftGeo(tuftHex, 7, 2), tufts[1]);
    inst(M.grassTuftGeo(pal.snow ? 0xa8946a : pal.grassDark, 4, 3), tufts[2]);
    if (flowers.length) {
      for (let i = 0; i < 4000; i++) {
        const x = 2 + rnd() * (N - 4), z = 2 + rnd() * (N - 4);
        const fx = Math.floor(x), fz = Math.floor(z);
        if (t.kindAt(fx, fz) !== K.GRASS || t.forest[fz * N + fx] > 0.6) continue;
        const ci = Math.floor(hash2(fx >> 2, fz >> 2, 4) * flowers.length);
        if (flowers[ci].length < 90) flowers[ci].push([x, t.H(fx, fz), z]);
      }
      pal.flowers.forEach((hex, i) => inst(M.flowerGeo(hex, i + 1), flowers[i], [0.9, 1.2]));
    }
    for (const [x, z] of t.pondCells) {
      const h = t.H(x, z);
      const shoreNear = !t.isPond(x + 1, z) || !t.isPond(x - 1, z) || !t.isPond(x, z + 1) || !t.isPond(x, z - 1);
      const r = hash2(x, z, 13);
      if (shoreNear && h === POND_MAX_H && r > 0.55) reeds.push([x + 0.5, h, z + 0.5]);
      else if (!pal.frozen && h <= POND_MAX_H - 1 && h >= POND_MAX_H - 3 && r > 0.93) (r > 0.985 ? lilyF : lilies).push([x + 0.5, WATER_Y + 0.02, z + 0.5]);
    }
    inst(M.reedGeo(pal.snow || pal.key === 'fall'), reeds, [0.8, 1.2]);
    inst(M.lilyGeo(false), lilies, [0.9, 1.3], MAT.vox);
    inst(M.lilyGeo(pal.key !== 'fall'), lilyF, [1, 1.2], MAT.vox);
    // boulders
    for (const b of this.boulders) {
      const m = new THREE.Mesh(M.boulderGeo(b.seed % 5, pal.snow, pal.key === 'spring' || pal.key === 'summer'), MAT.vox);
      m.position.set(b.x + 0.5 - 0.6, b.y - 0.2, b.z + 0.5 - 0.6);
      m.rotation.y = (b.seed % 4) * Math.PI / 2;
      m.castShadow = m.receiveShadow = true;
      g.scene.add(m); this.decor.push(m);
    }
  }

  refresh(it) {
    const season = this.g.season;
    if (it.type === 'bush') {
      const has = it.active && season !== 'winter';
      it.mesh.userData.berries.visible = has;
      it.mesh.visible = true;
    } else if (it.type === 'mushroom') it.mesh.visible = it.active && season !== 'winter';
    else if (it.type === 'crate') it.mesh.visible = true;
    else it.mesh.visible = it.active;
  }

  available(it) {
    if (!it.active) return false;
    if ((it.type === 'bush' || it.type === 'mushroom') && this.g.season === 'winter') return false;
    return true;
  }

  label(it) { return LABEL[it.type]; }

  targets() { return this.items; }

  harvest(it) {
    if (!this.available(it)) return null;
    const rnd = Math.random;
    let loot;
    switch (it.type) {
      case 'stick': loot = { stick: 1 + (rnd() < 0.3 ? 1 : 0) }; break;
      case 'stone': loot = { stone: 1 + (rnd() < 0.3 ? 1 : 0) }; break;
      case 'fiber': loot = { fiber: 2 + (rnd() < 0.4 ? 1 : 0) }; break;
      case 'bush': loot = { berries: 2 + Math.floor(rnd() * 3) }; break;
      case 'mushroom': loot = { mushroom: 1 + (this.g.season === 'fall' && rnd() < 0.5 ? 1 : 0) }; break;
      case 'mound': loot = { worm: 2 + Math.floor(rnd() * 3) }; break;
      case 'crate': loot = it.loot; this.g.state.cratesOpened.push(it.cid); break;
    }
    it.active = false;
    if (it.type === 'crate') this.anims.push({ it, t: 0, kind: 'lid' });
    else if (it.type === 'bush') this.refresh(it);
    else this.anims.push({ it, t: 0, kind: 'pop' });
    return loot;
  }

  update(dt) {
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.kind === 'pop') {
        const k = a.t / 0.22;
        const sc = k < 0.4 ? 1 + k * 0.8 : Math.max(0, 1.32 * (1 - (k - 0.4) / 0.6));
        a.it.mesh.scale.setScalar(sc);
        if (k >= 1) { a.it.mesh.scale.setScalar(1); this.refresh(a.it); this.anims.splice(i, 1); }
      } else if (a.kind === 'lid') {
        const k = Math.min(1, a.t / 0.5);
        a.it.mesh.userData.lid.rotation.x = -1.9 * (1 - Math.pow(1 - k, 3)) - Math.sin(k * Math.PI) * 0.2;
        if (k >= 1) this.anims.splice(i, 1);
      }
    }
  }

  dailyReset() {
    for (const it of this.items) {
      if (it.type === 'crate') continue;
      const p = this.g.player.pos;
      if (!it.active && Math.hypot(p.x - it.x, p.z - it.z) > 4) { it.active = true; this.refresh(it); }
    }
  }
}
