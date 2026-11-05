// Built things: Mabel's market stand, the dock, the old campsite, signs,
// placeable campfires, and the house that rises block by block.
import * as THREE from 'three';
import { MARKET, HOUSE, CAMP, WATER_Y } from './config.js';
import { VoxelModel, MAT, glowMat, lin } from './mesher.js';
import { hash3, mulberry32 } from './noise.js';
import * as M from './models.js';

const WOOD = 0x8a5e38, WOOD_D = 0x6a4428, WOOD_L = 0xb08050, PLANK = 0xa87a4a;

function easeOutBounce(t) {
  const n = 7.5625, d = 2.75;
  if (t < 1 / d) return n * t * t;
  if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
  if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
  return n * (t -= 2.625 / d) * t + 0.984375;
}

// ─── House voxels (0.5-unit voxels relative to plot origin) ──
// Footprint 9×7 cells = 18×14 small voxels. Door on west wall (cell x=0, z=3).
function houseStage(stage) {
  const v = [];
  const put = (x, y, z, c) => v.push([x, y, z, c]);
  const rnd = mulberry32(50 + stage);
  if (stage === 0) {
    for (let x = 0; x < 18; x++) for (let z = 0; z < 14; z++) for (let y = 0; y < 2; y++) {
      const edge = x === 0 || z === 0 || x === 17 || z === 13;
      const r = hash3(x >> 1, y, z >> 1, 3);
      put(x, y, z, y === 1 && !edge ? (r > 0.5 ? 0x9a948a : 0x8a857c) : (r > 0.6 ? 0x7d7870 : 0x6c6862));
    }
    // front step
    put(-1, 0, 6, 0x8a857c); put(-1, 0, 7, 0x8a857c); put(-2, 0, 6, 0x7d7870); put(-2, 0, 7, 0x7d7870);
  } else if (stage === 1) {
    for (let x = 0; x < 18; x++) for (let z = 0; z < 14; z++) {
      const cx = x >> 1, cz = z >> 1;
      if (!(cx === 0 || cx === 8 || cz === 0 || cz === 6)) continue;
      for (let y = 2; y < 8; y++) {
        const cy = (y - 2) >> 1; // 0..2 → world cells 10..12
        if (cx === 0 && cz === 3 && cy < 2) continue; // doorway
        const corner = (cx === 0 || cx === 8) && (cz === 0 || cz === 6);
        const window = cy === 1 && ((cz === 0 || cz === 6) && (cx === 2 || cx === 6) || (cx === 8 && (cz === 2 || cz === 4)));
        let c;
        if (window) {
          const inner = (cz === 0 || cz === 6) ? (x % 2 === 0 ? 0 : 1) : (z % 2 === 0 ? 0 : 1);
          c = 0x9fcfe0; // glass
          if ((cz === 0 && z === 0) || (cz === 6 && z === 13) || (cx === 8 && x === 17)) c = 0xb7dbe8;
          if (inner < 0) c = WOOD_D;
        } else if (corner) c = 0xc8a06a;
        else c = y % 2 === 0 ? 0x7a5232 : 0x8d6240;
        put(x, y, z, c);
      }
    }
    // door frame lintel already continuous (cy=2). Window sills:
    for (const [x, z] of [[4, -1], [5, -1], [12, -1], [13, -1], [4, 14], [5, 14], [12, 14], [13, 14]]) put(x, 3, z, WOOD_D);
  } else if (stage === 2) {
    for (let zi = -2; zi <= 15; zi++) {
      const d = Math.abs(zi - 6.5);
      const ry = 8 + Math.floor(8.5 - d);
      for (let x = -2; x <= 19; x++) {
        const row = Math.floor(8.5 - d);
        put(x, ry, zi, (row % 2 === 0) ? 0x8a3a2a : 0xa24c32);
        if (x === -2 || x === 19) put(x, ry - 1, zi, 0x6a2a1e); // eaves trim
      }
      // gable ends (inside the wall line)
      if (zi >= 0 && zi <= 13) for (let y = 8; y < ry; y++) { put(0, y, zi, WOOD_L); put(1, y, zi, PLANK); put(16, y, zi, PLANK); put(17, y, zi, WOOD_L); }
    }
    // ridge cap
    for (let x = -2; x <= 19; x++) { put(x, 17, 6, 0x6a2a1e); put(x, 17, 7, 0x6a2a1e); }
    // stone chimney through the east gable
    for (let y = 8; y <= 20; y++) for (let x = 16; x <= 17; x++) for (let z = 6; z <= 7; z++) put(x + 1, y, z, hash3(x, y, z) > 0.5 ? 0x8a857c : 0x77736c);
    // round gable window
    put(0, 10, 6, 0xf2c46a); put(0, 10, 7, 0xf2c46a); put(0, 11, 6, 0xf2c46a); put(0, 11, 7, 0xf2c46a);
  } else if (stage === 3) {
    // bed (NE corner): frame, blanket, pillow
    for (let x = 12; x <= 15; x++) for (let z = 2; z <= 4; z++) {
      put(x, 2, z, WOOD_D);
      put(x, 3, z, x === 15 ? 0xf4efe6 : (z === 3 ? 0xd8574a : 0xc8483c));
    }
    // fireplace on the east wall
    for (let y = 2; y <= 7; y++) for (let z = 5; z <= 8; z++) {
      if (y <= 3 && (z === 6 || z === 7)) continue; // firebox opening
      put(15, y, z, hash3(15, y, z) > 0.5 ? 0x8a857c : 0x77736c);
    }
    put(14, 5, 5, WOOD_D); put(14, 5, 6, WOOD_D); put(14, 5, 7, WOOD_D); put(14, 5, 8, WOOD_D); // mantel
    put(14, 6, 5, 0xe0c060); put(14, 6, 8, 0x5a9a44); // candle + plant
    // table & stools
    for (let x = 4; x <= 6; x++) for (let z = 9; z <= 11; z++) put(x, 3, z, PLANK);
    put(4, 2, 9, WOOD_D); put(6, 2, 11, WOOD_D); put(4, 2, 11, WOOD_D); put(6, 2, 9, WOOD_D);
    put(5, 4, 10, 0xd8d0c0); // a mug
    put(8, 2, 10, WOOD); put(2, 2, 10, WOOD);
    // shelves with jars and books
    for (let x = 4; x <= 9; x++) { put(x, 5, 1 + 1, WOOD_D); if (rnd() > 0.3) put(x, 6, 2, [0x3f86b8, 0xc84a3a, 0x6f9a4f, 0xe0b040][x % 4]); }
    // flower boxes under the windows outside
    for (const [x, z] of [[4, -1], [5, -1], [12, -1], [13, -1], [4, 14], [5, 14], [12, 14], [13, 14]]) put(x, 4, z, [0xe86b8a, 0xf2c23a, 0xffffff, 0xb79cff][(x + z) % 4]);
    // open door leaning against the wall
    for (let y = 2; y < 6; y++) { put(2, y, 4, 0x7a4a2a); put(2, y, 5, 0x6a4026); }
    put(2, 3, 5, 0xd8b04a);
    // welcome mat
    put(-1, 1, 6, 0xb84a3a); put(-1, 1, 7, 0xb84a3a);
  }
  return v;
}

export class Structures {
  constructor(game) {
    this.g = game;
    this.interactables = [];
    this.campfires = [];
    this.houseMeshes = [];
    this.anims = [];
  }

  build() {
    const g = this.g, t = g.terrain;
    // ── Market stand ──
    {
      const m = new VoxelModel();
      const awnRed = 0xc8423a, awnCream = 0xf2e6d0;
      m.box(0, 0, 0, 19, 3, 3, (x, y, z) => y === 3 ? WOOD_L : (z === 0 && x % 4 === 0 ? WOOD_D : WOOD));
      for (const [px, pz] of [[0, 0], [18, 0], [0, 10], [18, 10]]) m.box(px, 0, pz, px + 1, 11, pz + 1, WOOD_D);
      m.box(2, 0, 10, 17, 1, 11, WOOD); // back shelf
      m.box(3, 2, 10, 6, 3, 11, 0x6a8fa8); m.box(8, 2, 10, 11, 3, 11, 0xb0bcc4); m.box(13, 2, 10, 16, 3, 11, 0x8fa860);
      for (let x = -1; x <= 20; x++) for (let z = -2; z <= 12; z++) {
        const stripe = Math.floor((x + 1) / 3) % 2 === 0 ? awnRed : awnCream;
        const y = 12 + Math.floor((z + 2) / 5);
        m.set(x, y, z, stripe);
        if (z === -2 && (x % 3 !== 1)) m.set(x, y - 1, z, stripe); // scalloped edge
      }
      // sign board with a little fish
      m.box(6, 15, -3, 13, 18, -3, (x, y) => (y === 15 || y === 18 || x === 6 || x === 13) ? WOOD_D : 0xe8d4a8);
      m.box(8, 16, -4, 11, 17, -4, 0x3f86b8); m.set(12, 16, -4, 0x3f86b8); m.set(12, 17, -4, 0x3f86b8); m.set(9, 17, -4, 0x101010);
      // goods on the counter
      m.box(1, 4, 1, 3, 4, 2, 0x6a4428); m.set(1, 5, 1, 0x3a4fb8); m.set(2, 5, 2, 0xc8324a); m.set(3, 5, 1, 0x3a4fb8);
      m.box(15, 4, 1, 17, 4, 2, 0x6a4428); m.set(16, 5, 1, 0xc8322a); m.set(15, 5, 2, 0xf2ead8);
      const mesh = new THREE.Mesh(m.build(0.25, 0, 0, 0, 0.06, 5), MAT.vox);
      mesh.position.set(MARKET.x, 9, MARKET.z);
      mesh.castShadow = mesh.receiveShadow = true;
      g.scene.add(mesh);
      for (let x = 0; x < 5; x++) t.addSolid(MARKET.x + x, 9, MARKET.z);
      for (const [px, pz] of [[0, 0], [4, 0], [0, 2], [4, 2]]) for (let y = 9; y < 12; y++) t.addSolid(MARKET.x + px, y, MARKET.z + pz);
      for (let x = 1; x < 4; x++) t.addSolid(MARKET.x + x, 9, MARKET.z + 2);
      // lantern
      const lan = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.26, 0.2), glowMat(0xffb050, 4));
      lan.position.set(MARKET.x + 0.25, 11.35, MARKET.z - 0.25);
      g.scene.add(lan);
      this.marketLantern = lan;
      // Mabel
      const npc = M.npcModel();
      npc.position.set(MARKET.x + 2.5, 9, MARKET.z + 1.55);
      g.scene.add(npc);
      this.npc = npc;
      this.interactables.push({
        id: 'mabel', pos: new THREE.Vector3(MARKET.x + 2.5, 10.2, MARKET.z + 0.6), r: 1.4,
        label: () => "Talk to Mabel", action: () => g.ui.openShop(),
      });
    }

    // ── Dock ──
    {
      const d = t.dock, m = new VoxelModel();
      const len = (d.z1 - d.z0 + 1) * 4;
      for (let z = 0; z < len; z++) for (let x = 0; x < 8; x++) {
        if (z % 4 === 3 && x % 3 === 1) continue; // gaps between planks
        m.set(x, 0, z, (Math.floor(z / 4) % 2 ? 0xa8784a : 0x9a6c40));
      }
      for (let pz = 0; pz < len; pz += 8) for (const px of [0, 7]) {
        const bed = t.H(d.x0 + px / 4, d.z0 + pz / 4);
        const depth = Math.ceil((8.75 - bed) / 0.25);
        for (let y = -depth; y < 0; y++) m.set(px, y, pz, 0x5a3c24);
      }
      m.box(0, 1, 0, 0, 2, 0, 0x5a3c24); m.box(7, 1, 0, 7, 2, 0, 0x5a3c24);
      const mesh = new THREE.Mesh(m.build(0.25, 0, 0, 0, 0.06, 9), MAT.vox);
      mesh.position.set(d.x0, 8.75, d.z0);
      mesh.castShadow = mesh.receiveShadow = true;
      g.scene.add(mesh);
    }

    // ── Abandoned campsite ──
    {
      const cy = t.campY, m = new VoxelModel();
      // A-frame tent: 3 cells wide (x), 3 deep (z), opening toward +x
      for (let z = 0; z < 12; z++) for (let y = 0; y < 9; y++) {
        const half = Math.round((9 - y) * 0.68);
        for (const x of [6 - half, 5 + half]) if (x >= 0 && x < 12) m.set(x, y, z, z % 4 === 0 ? 0x7f7048 : 0x9a8a5a);
        if (z === 0) for (let x = 6 - half; x <= 5 + half; x++) m.set(x, y, z, 0x8a7a50);
      }
      m.box(5, 9, -1, 6, 9, 12, WOOD_D);
      const tent = new THREE.Mesh(m.build(0.25, 0, 0, 0, 0.08, 4), MAT.vox);
      tent.position.set(CAMP.x - 3, cy, CAMP.z - 1);
      tent.rotation.y = 0;
      tent.castShadow = tent.receiveShadow = true;
      g.scene.add(tent);
      for (let x = -3; x < 0; x++) for (let z = -1; z < 2; z++) { t.addSolid(CAMP.x + x, cy, CAMP.z + z); if (x === -2) t.addSolid(CAMP.x + x, cy + 1, CAMP.z + z); }
      // cold fire pit + log seat + clothesline with string
      const pit = new THREE.Mesh(M.campfireGeo(), MAT.vox);
      pit.position.set(CAMP.x + 1.4, cy, CAMP.z + 2.4);
      g.scene.add(pit);
      const seat = new THREE.Mesh(M.logGeo(), MAT.vox);
      seat.position.set(CAMP.x + 3.2, cy + 0.16, CAMP.z + 3.4); seat.rotation.y = 0.6; seat.castShadow = true;
      g.scene.add(seat);
      const line = new VoxelModel();
      line.box(0, 0, 0, 0, 12, 0, WOOD_D); line.box(24, 0, 0, 24, 12, 0, WOOD_D);
      for (let x = 1; x < 24; x++) line.set(x, 12 - Math.round(Math.sin(x / 24 * Math.PI) * 1.5), 0, 0xe8e0c8);
      line.box(7, 7, 0, 9, 10, 0, 0xc84a3a); line.box(14, 8, 0, 15, 10, 0, 0x3f86b8);
      const lm = new THREE.Mesh(line.build(0.125, 0, 0, 0, 0.05, 2), MAT.vox);
      lm.position.set(CAMP.x - 3.5, cy, CAMP.z - 3.2); lm.castShadow = true;
      g.scene.add(lm);
      this.interactables.push({
        id: 'tent', pos: new THREE.Vector3(CAMP.x - 1.2, cy + 0.8, CAMP.z + 0.5), r: 1.2,
        label: () => 'Rest in the tent', action: () => g.ui.openRest('tent'),
      });
    }

    // ── Signs ──
    const sign = (x, z, rotY, label, action, id) => {
      const s = new THREE.Mesh(M.signGeo(), MAT.vox);
      const y = t.surfaceY(x, z);
      s.position.set(x, y, z); s.rotation.y = rotY; s.castShadow = true;
      g.scene.add(s);
      this.interactables.push({ id, pos: new THREE.Vector3(x, y + 0.9, z), r: 0.8, label, action });
      return s;
    };
    this.houseSign = sign(HOUSE.x - 1.6, HOUSE.z + 1.5, -Math.PI / 2, () => g.state.house >= 4 ? 'Your cozy cabin' : `Build: ${['Foundation', 'Walls', 'Roof', 'Interior'][g.state.house]}`, () => g.ui.openBuild('house'), 'housesign');
    const d = t.dock;
    this.boatSign = sign(d.x0 - 0.8, d.z1 + 2.2, Math.PI, () => g.state.boat ? 'Boat dock' : 'Build a rowboat', () => g.ui.openBuild('boat'), 'boatsign');

    // house interactables (bed / fireplace appear at stage 4)
    this.interactables.push({
      id: 'bed', pos: new THREE.Vector3(HOUSE.x + 7, 10.5, HOUSE.z + 1.5), r: 1.0, when: () => g.state.house >= 4,
      label: () => 'Sleep in your bed', action: () => g.ui.openRest('bed'),
    });

  }

  // Rebuild saved progress (house stages, campfires) when a game starts.
  restore() {
    const g = this.g;
    for (let s = 0; s < g.state.house; s++) this.buildHouseStage(s, true);
    for (const c of g.state.campfires) this.addCampfire(new THREE.Vector3(c[0], c[1], c[2]), true);
  }

  // ── House building ──
  buildHouseStage(stage, instant = false) {
    const g = this.g, t = g.terrain;
    const vox = houseStage(stage);
    const geo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const mesh = new THREE.InstancedMesh(geo, MAT.inst, vox.length);
    mesh.castShadow = mesh.receiveShadow = true;
    const col = new THREE.Color();
    const data = vox.map(([x, y, z, c], i) => {
      const L = Array.isArray(c) ? c : lin(c);
      const j = 1 + (hash3(x, y, z, 31 + stage) - 0.5) * 0.12;
      col.setRGB(L[0] * j, L[1] * j, L[2] * j);
      mesh.setColorAt(i, col);
      return { x: HOUSE.x + (x + 0.5) * 0.5, y: HOUSE.y + (y + 0.5) * 0.5, z: HOUSE.z + (z + 0.5) * 0.5, delay: y * 0.09 + Math.random() * 0.5 };
    });
    const maxDelay = Math.max(...data.map(d => d.delay));
    const anim = { mesh, data, t: instant ? 1e9 : 0, dur: maxDelay + 0.7, lastThunk: 0 };
    // Bounds must come from where the blocks END UP: three.js computes an
    // instanced mesh's culling sphere once, and the drop animation starts
    // with every block parked far overhead (which hid the whole stage).
    this.setHouseMatrices({ ...anim, t: 1e9 });
    mesh.computeBoundingSphere();
    mesh.boundingSphere.radius += 6; // room for the drop-in animation
    this.setHouseMatrices(anim);
    g.scene.add(mesh);
    this.houseMeshes.push(mesh);
    if (!instant) this.anims.push(anim);
    // collision cells
    const cells = new Set();
    for (const [x, y, z] of vox) {
      const cx = HOUSE.x + Math.floor(x / 2), cy = HOUSE.y + Math.floor(y / 2), cz = HOUSE.z + Math.floor(z / 2);
      if (stage === 3) {
        // only bed + fireplace + table block movement
        if (!((x >= 12 && z >= 2 && z <= 4) || x === 15 || (x >= 4 && x <= 6 && z >= 9 && z <= 11))) continue;
        if (y > 3 && x !== 15) continue;
      }
      if (stage === 0 && (x < 0)) continue;
      cells.add(cx + ',' + cy + ',' + cz);
    }
    for (const k of cells) { const [x, y, z] = k.split(',').map(Number); t.addSolid(x, y, z); }
    if (stage === 3) this.addFireplace(instant);
  }

  setHouseMatrices(a) {
    const m = new THREE.Matrix4();
    a.data.forEach((d, i) => {
      const k = Math.min(1, Math.max(0, (a.t - d.delay) / 0.7));
      const yOff = k <= 0 ? 5 : (1 - easeOutBounce(k)) * 5;
      const s = k <= 0 ? 0 : 1;
      m.makeScale(s, s, s).setPosition(d.x, d.y + yOff, d.z);
      a.mesh.setMatrixAt(i, m);
    });
    a.mesh.instanceMatrix.needsUpdate = true;
  }

  addFireplace(instant) {
    const g = this.g;
    const pos = new THREE.Vector3(HOUSE.x + 7.35, HOUSE.y + 1.05, HOUSE.z + 3.5);
    const fire = this.makeFlames(pos, 0.7);
    this.fireplace = { pos, fire };
    g.lights.fireplace.position.copy(pos).add(new THREE.Vector3(-0.6, 0.5, 0));
    g.lights.fireplace.userData.base = 10;
  }

  makeFlames(pos, scale = 1) {
    const g = this.g, grp = new THREE.Group();
    const geo = M.flameGeo();
    const outer = new THREE.Mesh(geo, glowMat(0xff7a20, 3.2));
    const inner = new THREE.Mesh(geo, glowMat(0xffd060, 4));
    inner.scale.setScalar(0.6); inner.position.y = 0.02;
    grp.add(outer, inner);
    grp.position.copy(pos);
    grp.scale.setScalar(scale);
    g.scene.add(grp);
    grp.userData = { outer, inner, phase: Math.random() * 10 };
    return grp;
  }

  addCampfire(pos, restoring = false) {
    const g = this.g;
    if (this.campfires.length >= 2) {
      const old = this.campfires.shift();
      g.scene.remove(old.base, old.fire);
      this.interactables = this.interactables.filter(i => i !== old.inter);
      g.state.campfires.shift();
    }
    const base = new THREE.Mesh(M.campfireGeo(), MAT.vox);
    base.position.copy(pos); base.receiveShadow = true;
    g.scene.add(base);
    const fire = this.makeFlames(pos.clone().add(new THREE.Vector3(0.48, 0.12, 0.48)), 1);
    const cf = { pos: pos.clone().add(new THREE.Vector3(0.5, 0, 0.5)), base, fire };
    cf.inter = { id: 'campfire', pos: cf.pos.clone().setY(pos.y + 0.4), r: 0.9, label: () => 'Rest by the fire', action: () => g.ui.openRest('fire') };
    this.interactables.push(cf.inter);
    this.campfires.push(cf);
    if (!restoring) g.state.campfires.push([pos.x, pos.y, pos.z]);
    this.assignFireLights();
  }

  assignFireLights() {
    const L = [this.g.lights.camp1, this.g.lights.camp2];
    L.forEach((l, i) => {
      const cf = this.campfires[i];
      if (cf) { l.position.copy(cf.pos).setY(cf.pos.y + 0.9); l.userData.base = 9; } else l.userData.base = 0;
    });
  }

  nearFire(p, r = 5) {
    for (const cf of this.campfires) if (cf.pos.distanceTo(p) < r) return true;
    if (this.fireplace && this.fireplace.pos.distanceTo(p) < 6) return true;
    return false;
  }

  insideHouse(p) {
    return this.g.state.house >= 3 && p.x > HOUSE.x + 0.5 && p.x < HOUSE.x + 8.5 && p.z > HOUSE.z + 0.5 && p.z < HOUSE.z + 6.5 && p.y < HOUSE.y + 4;
  }

  update(dt, time) {
    const g = this.g;
    for (let i = this.anims.length - 1; i >= 0; i--) {
      const a = this.anims[i];
      a.t += dt;
      if (a.t - a.lastThunk > 0.16 && a.t < a.dur - 0.5) { a.lastThunk = a.t; g.audio.play('block'); }
      this.setHouseMatrices(a);
      if (a.t > a.dur) this.anims.splice(i, 1);
    }
    // flames flicker
    const flames = [...this.campfires.map(c => c.fire)];
    if (this.fireplace) flames.push(this.fireplace.fire);
    for (const f of flames) {
      const u = f.userData;
      u.phase += dt * 9;
      u.outer.scale.set(1 + Math.sin(u.phase) * 0.12, 1 + Math.sin(u.phase * 1.7) * 0.25, 1 + Math.cos(u.phase * 1.3) * 0.12);
      u.inner.scale.set(0.6 + Math.sin(u.phase * 2.1) * 0.08, 0.6 + Math.cos(u.phase * 1.4) * 0.15, 0.6);
      u.outer.rotation.y += dt * 0.8;
      if (Math.random() < dt * 6) g.fx.ember(f.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.3, 0.4, (Math.random() - 0.5) * 0.3)));
      if (Math.random() < dt * 3) g.fx.smoke(f.position.clone().add(new THREE.Vector3(0, 0.8, 0)));
    }
    // Mabel looks at the player and bobs gently
    if (this.npc) {
      const p = g.player.pos, n = this.npc;
      const yaw = Math.atan2(p.x - n.position.x, p.z - n.position.z);
      const dist = Math.hypot(p.x - n.position.x, p.z - n.position.z);
      let rel = yaw - Math.PI; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const target = dist < 12 ? Math.max(-1.4, Math.min(1.4, rel)) : 0;
      n.rotation.y += (Math.PI + target - n.rotation.y) * Math.min(1, dt * 3);
      n.position.y = 9 + Math.abs(Math.sin(time * 1.6)) * 0.02;
      n.userData.head.rotation.x = Math.sin(time * 0.7) * 0.05;
    }
  }
}
