// The deep woods: instanced voxel trees you can chop down.
import * as THREE from 'three';
import { N, CENTER, HOUSE, MARKET, CAMP, SPAWN } from './config.js';
import { mulberry32, hash3, valueNoise, clamp } from './noise.js';
import { VoxelModel, MAT, lin } from './mesher.js';
import { K } from './terrain.js';

const S = 0.5; // tree voxel size
// size = trunk height in blocks. low: canopy may reach down near eye level
// (one bushy variant per type); everything else keeps leaves above head height.
const VARIANTS = [
  { type: 'oak', size: 6, leaf: 0, seed: 11 },
  { type: 'oak', size: 7, leaf: 1, seed: 12 },
  { type: 'oak', size: 4, leaf: 2, seed: 13, low: true },
  { type: 'pine', size: 9, seed: 21 },
  { type: 'pine', size: 11, seed: 22 },
  { type: 'pine', size: 6, seed: 23, low: true },
  { type: 'birch', size: 7, seed: 31 },
  { type: 'birch', size: 8, seed: 32 },
];
const TREE_CHUNK = 40;
const LEAF_MIN = 6; // lowest leaf voxel (0.5 units) for tall trees → 3 blocks up
const LOGS = { oak: 4, pine: 5, birch: 4 };

function buildTree(v, pal) {
  const m = new VoxelModel();
  const rnd = mulberry32(v.seed * 7919);
  const th = v.size * 2;
  const bark = v.type === 'birch' ? 0xe9e4d8 : v.type === 'pine' ? 0x5b3f2b : 0x6e4b31;
  const barkDark = v.type === 'birch' ? 0x2e2a26 : 0x4a3220;
  for (let y = 0; y < th; y++) for (let sx = -1; sx <= 0; sx++) for (let sz = -1; sz <= 0; sz++) {
    const r = hash3(sx, y, sz, v.seed);
    m.set(sx, y, sz, v.type === 'birch' ? (r > 0.78 ? barkDark : bark) : (r > 0.7 ? barkDark : bark));
  }
  // roots
  const rootSpots = [[-2, -1], [1, 0], [0, -2], [-1, 1], [-2, 0], [1, -1], [-1, -2], [0, 1]];
  for (const [rx, rz] of rootSpots) if (rnd() > 0.5) { m.set(rx, 0, rz, bark); if (rnd() > 0.6) m.set(rx, 1, rz, bark); }

  const leafHex = v.type === 'pine' ? pal.leaves.pine : pal.leaves[v.type] == null ? null
    : v.type === 'oak' ? pal.leaves.oak[v.leaf] : pal.leaves.birch;
  const winterBare = leafHex == null;

  // branches (visible in winter, poke out otherwise)
  if (v.type !== 'pine') {
    const nb = winterBare ? 5 : 3;
    for (let b = 0; b < nb; b++) {
      const a = rnd() * Math.PI * 2, dx = Math.cos(a), dz = Math.sin(a);
      const y0 = Math.floor(th * (v.low ? 0.55 : 0.68) + rnd() * th * 0.3), len = 3 + Math.floor(rnd() * 3);
      for (let k = 1; k <= len; k++) {
        const x = Math.round(dx * k - 0.5), z = Math.round(dz * k - 0.5), y = y0 + Math.round(k * 0.7);
        m.set(x, y, z, bark);
        if (winterBare && k === len) m.set(x, y + 1, z, bark);
      }
    }
  }

  if (!winterBare) {
    const L = lin(leafHex);
    const blossom = pal.key === 'spring' && v.type === 'oak' && v.leaf === 2;
    const leafCol = (x, y, z, cy, ry) => {
      const r = hash3(x, y, z, v.seed + 5);
      let k = 0.82 + r * 0.3 + (y - cy) / ry * 0.12;
      if (blossom) {
        if (r > 0.82) return [1.0 * 0.95, 0.93, 0.95];
        if (r < 0.12) return lin(0x86c95c).map(c => c * k);
      }
      if (pal.key === 'fall' && v.type !== 'pine' && r > 0.9) return lin(0xc94a28).map(c => c * k);
      return [L[0] * k, L[1] * k, L[2] * k];
    };
    if (v.type === 'pine') {
      const maxR = 3.2 + v.size * 0.22, bottom = v.low ? 4 : Math.max(LEAF_MIN, Math.round(th * 0.42)), top = th + 4;
      for (let y = bottom; y <= top; y++) {
        const f = (y - bottom) / (top - bottom);
        let R = (1 - f) * maxR + 0.6;
        if ((y - bottom) % 3 === 0) R += 0.9;
        const Ri = Math.ceil(R);
        for (let x = -Ri - 1; x <= Ri; x++) for (let z = -Ri - 1; z <= Ri; z++) {
          const d = Math.hypot(x + 0.5, z + 0.5);
          if (d > R + (hash3(x, y, z, v.seed) - 0.5) * 0.8) continue;
          if (m.has(x, y, z)) continue;
          m.set(x, y, z, leafCol(x, y, z, top, top - bottom), 1);
        }
      }
      if (pal.snow) {
        for (const vx of [...m.values()]) {
          const [x, y, z] = vx;
          if (y >= bottom && !m.has(x, y + 1, z) && hash3(x, y, z, 3) > 0.15) m.set(x, y, z, [0.93, 0.96, 1.0], 1);
        }
      }
    } else {
      const cy = v.type === 'oak' ? th + 1 : th;
      const rx = v.type === 'oak' ? 4.4 + v.size * 0.3 : 3.4, ry = v.type === 'oak' ? 3.8 + (v.low ? 0 : 0.6) : 4.8;
      const R = Math.ceil(Math.max(rx, ry)) + 1;
      // two or three overlapping blobs for a natural silhouette
      const blobs = [[0, 0, 0, 1]];
      for (let b = 0; b < 2; b++) blobs.push([(rnd() - 0.5) * 4, (rnd() - 0.2) * 2, (rnd() - 0.5) * 4, 0.65 + rnd() * 0.2]);
      for (let y = cy - R; y <= cy + R; y++) for (let x = -R - 2; x <= R + 2; x++) for (let z = -R - 2; z <= R + 2; z++) {
        let inside = false;
        for (const [bx, by, bz, bs] of blobs) {
          const dx = (x + 0.5 - bx) / (rx * bs), dy = (y - cy - by) / (ry * bs), dz = (z + 0.5 - bz) / (rx * bs);
          if (dx * dx + dy * dy + dz * dz < 1 - (hash3(x, y, z, v.seed + 1) * 0.35)) { inside = true; break; }
        }
        if (!inside || m.has(x, y, z)) continue;
        if (!v.low && y < LEAF_MIN) continue;
        m.set(x, y, z, leafCol(x, y, z, cy, ry), 1);
      }
    }
  } else if (pal.snow) {
    for (const vx of [...m.values()]) {
      const [x, y, z] = vx;
      if (y > 2 && !m.has(x, y + 1, z) && hash3(x, y, z, 8) > 0.3) m.set(x, y + 1, z, [0.93, 0.96, 1.0]);
    }
  }
  return m.build(S, 0, 0, 0, 0.06, v.seed);
}

function buildStump() {
  const m = new VoxelModel();
  for (let y = 0; y < 2; y++) for (let sx = -1; sx <= 0; sx++) for (let sz = -1; sz <= 0; sz++) m.set(sx, y, sz, y === 1 ? 0xc89a62 : 0x6e4b31);
  m.set(-2, 0, -1, 0x6e4b31); m.set(1, 0, 0, 0x6e4b31);
  return m.build(S, 0, 0, 0, 0.1, 4);
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
const _q2 = new THREE.Quaternion(), _axis = new THREE.Vector3(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const UP = new THREE.Vector3(0, 1, 0);

export class Forest {
  constructor(game) {
    this.g = game;
    this.trees = [];
    this.falling = [];
    this.shaking = new Set();
    this.place();
  }

  blocked(x, z) {
    const t = this.g.terrain;
    if (t.isPond(x, z) || t.isPond(x + 1, z) || t.isPond(x, z + 1) || t.isPond(x - 1, z) || t.isPond(x, z - 1)) return true;
    const k = t.kindAt(x, z);
    if (k === K.PATH || k === K.SAND) return true;
    if (x >= HOUSE.x - 4 && x <= HOUSE.x + 12 && z >= HOUSE.z - 4 && z <= HOUSE.z + 10) return true;
    if (x >= MARKET.x - 4 && x <= MARKET.x + 8 && z >= MARKET.z - 4 && z <= MARKET.z + 6) return true;
    if (Math.hypot(x - SPAWN.x, z - SPAWN.z) < 6) return true;
    if (Math.hypot(x - CAMP.x, z - CAMP.z) < 8) return true;
    const d = t.dock;
    if (x >= d.x0 - 3 && x <= d.x1 + 3 && z >= d.z1 - 2 && z <= d.z1 + 6) return true;
    return false;
  }

  place() {
    const t = this.g.terrain, rnd = mulberry32(4242);
    const SP = 3.4;
    for (let gz = 2; gz < N - 2; gz += SP) for (let gx = 2; gx < N - 2; gx += SP) {
      const x = Math.floor(gx + rnd() * SP * 0.8), z = Math.floor(gz + rnd() * SP * 0.8);
      if (x < 1 || z < 1 || x >= N - 1 || z >= N - 1) continue;
      const f = t.forest[z * N + x];
      const p = f > 0 ? 0.1 + f * 0.62 : 0.03;
      if (rnd() > p) continue;
      if (this.blocked(x, z)) continue;
      const n = valueNoise(x * 0.05, z * 0.05, 41) + (rnd() - 0.5) * 0.35;
      const dc = Math.hypot(x - CENTER, z - CENTER);
      let type = n < 0.42 ? 'pine' : n < 0.72 ? 'oak' : 'birch';
      if (dc > 62 && rnd() < 0.6) type = 'pine';
      const wantLow = rnd() < 0.2;
      let opts = VARIANTS.map((v, i) => [v, i]).filter(([v]) => v.type === type && !!v.low === wantLow);
      if (!opts.length) opts = VARIANTS.map((v, i) => [v, i]).filter(([v]) => v.type === type);
      const [v, vi] = opts[Math.floor(rnd() * opts.length)];
      const y = t.H(x, z);
      const tree = { i: this.trees.length, vi, type, size: v.size, x, z, y, yaw: Math.floor(rnd() * 4) * Math.PI / 2, alive: true, hp: 0, regrowDay: 0, shake: 0 };
      this.trees.push(tree);
      for (let k = 0; k < v.size; k++) t.addSolid(x, y + k, z);
    }
    // index for quick spatial lookup
    this.grid = new Map();
    for (const tr of this.trees) {
      const key = (tr.x >> 3) + (tr.z >> 3) * 64;
      if (!this.grid.has(key)) this.grid.set(key, []);
      this.grid.get(key).push(tr);
    }
  }

  near(x, z, r) {
    const out = [];
    for (let gz = (z - r) >> 3; gz <= (z + r) >> 3; gz++) for (let gx = (x - r) >> 3; gx <= (x + r) >> 3; gx++) {
      const list = this.grid.get(gx + gz * 64);
      if (list) for (const tr of list) if (Math.abs(tr.x + 0.5 - x) < r && Math.abs(tr.z + 0.5 - z) < r) out.push(tr);
    }
    return out;
  }

  matrixFor(tr, shakeAngle = 0) {
    _p.set(tr.x + 0.5, tr.y, tr.z + 0.5);
    _q.setFromAxisAngle(UP, tr.yaw);
    if (shakeAngle) { _q2.setFromAxisAngle(_axis.set(Math.cos(tr.yaw), 0, Math.sin(tr.yaw)), shakeAngle); _q.premultiply(_q2); }
    return _m.compose(_p, _q, _s);
  }

  // Trees are split into spatial chunks per variant so the GPU only draws
  // (and shadows) the ones in view.
  build(pal) {
    this.geos = VARIANTS.map(v => buildTree(v, pal));
    if (!this.chunks) {
      const groups = new Map();
      for (const tr of this.trees) {
        const key = tr.vi + ':' + Math.floor(tr.x / TREE_CHUNK) + ':' + Math.floor(tr.z / TREE_CHUNK);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(tr);
      }
      this.chunks = [];
      for (const list of groups.values()) {
        const vi = list[0].vi;
        const mesh = new THREE.InstancedMesh(this.geos[vi], MAT.tree, list.length);
        mesh.castShadow = true; mesh.receiveShadow = true;
        list.forEach((tr, i) => { tr.mesh = mesh; tr.inst = i; });
        mesh.userData.vi = vi;
        this.g.scene.add(mesh);
        this.chunks.push(mesh);
      }
      this.stumps = new THREE.InstancedMesh(buildStump(), MAT.vox, this.trees.length);
      this.stumps.castShadow = true; this.stumps.receiveShadow = true;
      this.g.scene.add(this.stumps);
    } else {
      for (const m of this.chunks) m.geometry = this.geos[m.userData.vi];
      for (const g of this.oldGeos || []) g.dispose();
    }
    this.oldGeos = this.geos;
    for (const tr of this.trees) this.syncTree(tr);
    for (const m of this.chunks) { m.instanceMatrix.needsUpdate = true; m.computeBoundingSphere(); m.boundingSphere.radius += 6; }
    this.stumps.instanceMatrix.needsUpdate = true;
    this.stumps.computeBoundingSphere();
    // falling trees keep their old geometry reference; swap it
    for (const f of this.falling) f.mesh.geometry = this.geos[f.tree.vi];
  }

  hiddenMatrix(tr) { return _m.makeScale(0.0001, 0.0001, 0.0001).setPosition(tr.x + 0.5, tr.y, tr.z + 0.5); }

  syncTree(tr) {
    const mesh = tr.mesh;
    mesh.setMatrixAt(tr.inst, tr.alive ? this.matrixFor(tr) : this.hiddenMatrix(tr));
    this.stumps.setMatrixAt(tr.i, tr.alive ? this.hiddenMatrix(tr) : this.matrixFor(tr));
    mesh.instanceMatrix.needsUpdate = true;
    this.stumps.instanceMatrix.needsUpdate = true;
  }

  // Returns 'hit' or 'felled'
  hit(tr, from, power) {
    if (!tr.alive) return null;
    if (tr.hp <= 0) tr.hp = power;
    tr.hp -= 1;
    tr.shake = 0.35;
    this.shaking.add(tr);
    const g = this.g;
    const hp = new THREE.Vector3(tr.x + 0.5, Math.min(from.y, tr.y + 1.6), tr.z + 0.5);
    g.fx.burst(hp, [0xc89a62, 0x8a5a36, 0xe0c08a], 10, 3.5, 0.08);
    g.audio.play('chop');
    if (tr.hp <= 0) { this.fell(tr, from); return 'felled'; }
    return 'hit';
  }

  fell(tr, from) {
    const g = this.g;
    tr.alive = false; tr.hp = 0;
    tr.regrowDay = g.state.day + 3;
    for (let k = 0; k < tr.size; k++) g.terrain.removeSolid(tr.x, tr.y + k, tr.z);
    this.syncTree(tr);
    const pivot = new THREE.Group();
    pivot.position.set(tr.x + 0.5, tr.y + 0.5, tr.z + 0.5);
    const mesh = new THREE.Mesh(this.geos[tr.vi], MAT.tree);
    mesh.position.y = -0.5;
    mesh.rotation.y = tr.yaw;
    mesh.castShadow = true;
    pivot.add(mesh);
    g.scene.add(pivot);
    const dir = new THREE.Vector3(tr.x + 0.5 - from.x, 0, tr.z + 0.5 - from.z);
    if (dir.lengthSq() < 0.01) dir.set(1, 0, 0);
    dir.normalize();
    const axis = new THREE.Vector3().crossVectors(UP, dir).normalize();
    this.falling.push({ tree: tr, pivot, mesh, axis, dir, angle: 0, w: 0.25, bounces: 0, settle: 0 });
    g.audio.play('creak');
  }

  update(dt) {
    const g = this.g;
    for (const tr of this.shaking) {
      if (tr.shake <= 0) { this.shaking.delete(tr); continue; }
      {
        tr.shake = Math.max(0, tr.shake - dt);
        const a = Math.sin(tr.shake * 55) * 0.05 * (tr.shake / 0.35);
        tr.mesh.setMatrixAt(tr.inst, tr.alive ? this.matrixFor(tr, a) : this.hiddenMatrix(tr));
        tr.mesh.instanceMatrix.needsUpdate = true;
      }
    }
    const limit = Math.PI / 2 - 0.06;
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      if (f.settle === 0) {
        f.w += (0.5 + 3.2 * Math.sin(f.angle)) * dt * 1.4;
        f.angle += f.w * dt;
        if (f.angle >= limit) {
          f.angle = limit;
          if (f.bounces === 0) {
            g.audio.play('thud');
            const top = new THREE.Vector3(f.tree.x + 0.5, f.tree.y + 0.6, f.tree.z + 0.5).addScaledVector(f.dir, f.tree.size + 1.5);
            const lc = g.palette.leaves;
            const leafHex = f.tree.type === 'pine' ? lc.pine : f.tree.type === 'oak' ? (lc.oak ? lc.oak[0] : null) : lc.birch;
            if (leafHex) g.fx.burst(top, [leafHex, leafHex, 0xffffff], 40, 5, 0.12);
            else if (g.palette.snow) g.fx.burst(top, [0xffffff], 40, 4, 0.1);
            g.shakeCamera(0.25);
          }
          f.bounces++;
          f.w = -f.w * 0.28;
          if (Math.abs(f.w) < 0.25 || f.bounces > 3) { f.settle = 0.001; f.w = 0; }
        }
      } else {
        f.settle += dt;
        if (f.settle > 0.9) {
          // break into logs
          const n = LOGS[f.tree.type];
          const base = new THREE.Vector3(f.tree.x + 0.5, f.tree.y + 0.7, f.tree.z + 0.5);
          for (let k = 0; k < n; k++) {
            const p = base.clone().addScaledVector(f.dir, 0.8 + k * (f.tree.size / n) * 1.0);
            g.spawnDebris('log', p, new THREE.Vector3((Math.random() - 0.5) * 2, 3 + Math.random() * 2, (Math.random() - 0.5) * 2));
          }
          g.spawnDebris('stick', base.clone().addScaledVector(f.dir, 2), new THREE.Vector3(0, 4, 0));
          g.fx.burst(base.clone().addScaledVector(f.dir, f.tree.size * 0.6), [0xb08a5a, 0x8a6a42, 0xd8c09a], 30, 3, 0.1);
          g.audio.play('poof');
          g.scene.remove(f.pivot);
          this.falling.splice(i, 1);
          continue;
        }
      }
      f.pivot.quaternion.setFromAxisAngle(f.axis, f.angle);
    }
  }

  regrow(day) {
    const t = this.g.terrain, p = this.g.player.pos;
    for (const tr of this.trees) {
      if (!tr.alive && day >= tr.regrowDay && Math.hypot(p.x - tr.x - 0.5, p.z - tr.z - 0.5) > 3) {
        tr.alive = true; tr.hp = 0;
        for (let k = 0; k < tr.size; k++) t.addSolid(tr.x, tr.y + k, tr.z);
        this.syncTree(tr);
      }
    }
  }

  saveData() { return this.trees.filter(t => !t.alive).map(t => [t.i, t.regrowDay]); }
  loadData(list) {
    const t = this.g.terrain;
    for (const [i, rd] of list || []) {
      const tr = this.trees[i]; if (!tr) continue;
      tr.alive = false; tr.regrowDay = rd;
      for (let k = 0; k < tr.size; k++) t.removeSolid(tr.x, tr.y + k, tr.z);
      this.syncTree(tr);
    }
  }
}
