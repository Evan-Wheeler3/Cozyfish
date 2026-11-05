// Small voxel models: pickups, fish, bobber, boat, NPC, campfire …
import * as THREE from 'three';
import { VoxelModel, MAT } from './mesher.js';
import { hash3, mulberry32 } from './noise.js';

const cache = new Map();
function cached(key, fn) { if (!cache.has(key)) cache.set(key, fn()); return cache.get(key); }

export function stickGeo() {
  return cached('stick', () => {
    const m = new VoxelModel();
    for (let x = 0; x < 9; x++) m.set(x, 0, 0, x % 3 === 0 ? 0x6a4428 : 0x87593a);
    m.set(3, 0, 1, 0x87593a); m.set(4, 0, 2, 0x87593a); m.set(6, 0, -1, 0x6a4428);
    return m.build(0.11, -0.5, 0, -0.05, 0.1, 2);
  });
}
export function stoneGeo() {
  return cached('stone', () => {
    const m = new VoxelModel();
    m.box(0, 0, 0, 2, 0, 1, 0x8f8d88); m.set(1, 1, 0, 0xa0a09a);
    m.set(0, 0, 2, 0x7d7b77); m.set(2, 1, 1, 0x9a9893);
    return m.build(0.14, -0.21, 0, -0.2, 0.15, 3);
  });
}

export function fiberGeo(dry) {
  return cached('fiber' + dry, () => {
    const m = new VoxelModel(), rnd = mulberry32(5);
    const base = dry ? 0xb89a5a : 0x8aa84a, tip = dry ? 0xdcc488 : 0xd8d088;
    for (let b = 0; b < 14; b++) {
      const x = Math.floor(rnd() * 8), z = Math.floor(rnd() * 8), h = 8 + Math.floor(rnd() * 8);
      const lean = rnd() < 0.5 ? 1 : -1;
      for (let y = 0; y < h; y++) m.set(x + (y > h * 0.65 ? lean : 0), y, z, y > h - 4 ? tip : base);
      if (b % 3 === 0) { m.set(x + lean, h, z, tip); m.set(x + lean * 2, h + 1, z, tip); }
    }
    return m.build(0.065, -0.26, 0, -0.26, 0.12, 6);
  });
}
export function bushGeo(season) {
  return cached('bush' + season, () => {
    const m = new VoxelModel();
    const leaf = season === 'fall' ? 0x9a7a3a : season === 'winter' ? 0x6a5a48 : season === 'summer' ? 0x3f7f3a : 0x5a9a44;
    for (let x = -3; x <= 3; x++) for (let y = 0; y <= 4; y++) for (let z = -3; z <= 3; z++) {
      const d = (x * x) / 10 + ((y - 1.5) * (y - 1.5)) / 6 + (z * z) / 10;
      if (d < 1 - hash3(x, y, z, 2) * 0.3) {
        if (season === 'winter' && hash3(x, y, z, 7) > 0.35) continue;
        m.set(x, y, z, season === 'winter' && y >= 3 ? 0xf0f4fa : leaf);
      }
    }
    return m.build(0.2, 0, 0, 0, 0.18, 9);
  });
}
export function berriesGeo() {
  return cached('berries', () => {
    const m = new VoxelModel(), rnd = mulberry32(8);
    for (let i = 0; i < 22; i++) {
      const a = rnd() * Math.PI * 2, y = 1 + Math.floor(rnd() * 3);
      const r = 2.9 - Math.abs(y - 1.5) * 0.4;
      m.set(Math.round(Math.cos(a) * r * 2), y * 2 + 1, Math.round(Math.sin(a) * r * 2), i % 3 ? 0x3a4fb8 : 0xc8324a);
    }
    return m.build(0.1, 0.05, 0, 0.05, 0.1, 3);
  });
}
export function mushroomGeo() {
  return cached('mushroom', () => {
    const m = new VoxelModel();
    m.box(0, 0, 0, 0, 2, 0, 0xf2ead8);
    m.box(-1, 3, -1, 1, 3, 1, 0xc8322a); m.set(0, 4, 0, 0xc8322a);
    m.set(-1, 3, 1, 0xffffff); m.set(1, 3, -1, 0xffffff); m.set(0, 4, 0, 0xd8402e);
    // a little buddy
    m.box(2, 0, 1, 2, 1, 1, 0xf2ead8); m.set(2, 2, 1, 0xb8302a);
    return m.build(0.09, -0.05, 0, -0.05, 0.08, 4);
  });
}
export function moundGeo(snow) {
  return cached('mound' + snow, () => {
    const m = new VoxelModel();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      const h = Math.max(0, Math.round(2.4 - Math.hypot(x, z) * 0.75 + hash3(x, 0, z, 3) * 0.6));
      for (let y = 0; y < h; y++) m.set(x, y, z, snow && y === h - 1 ? 0xeef2f8 : (hash3(x, y, z) > 0.5 ? 0x6a4a30 : 0x5a3e28));
    }
    m.set(1, 2, 0, 0xd88a8a); // a worm peeking out
    return m.build(0.16, 0, 0, 0, 0.12, 5);
  });
}
export function crateGeo() {
  return cached('crate', () => {
    const body = new VoxelModel();
    body.box(0, 0, 0, 7, 3, 4, (x, y, z) => (x === 0 || x === 7 || y === 0) ? 0x5a3c24 : (y % 2 ? 0x8a5e38 : 0x7a5232));
    body.box(3, 2, -1, 4, 2, -1, 0xd8b04a);
    const lid = new VoxelModel();
    lid.box(0, 0, 0, 7, 1, 4, (x, y, z) => (x === 0 || x === 7) ? 0x5a3c24 : 0x8a5e38);
    return { body: body.build(0.12, -0.48, 0, -0.3, 0.1, 2), lid: lid.build(0.12, -0.48, 0, -0.6, 0.1, 3) };
  });
}
export function grassTuftGeo(hex, n = 5, seed = 1) {
  return cached('tuft' + hex + n + seed, () => {
    const m = new VoxelModel(), rnd = mulberry32(seed);
    for (let b = 0; b < n; b++) {
      const x = Math.floor(rnd() * 4), z = Math.floor(rnd() * 4), h = 2 + Math.floor(rnd() * 3);
      for (let y = 0; y < h; y++) m.set(x, y, z, hex);
    }
    return m.build(0.12, -0.24, 0, -0.24, 0.2, seed);
  });
}
export function flowerGeo(hex, seed = 1) {
  return cached('flower' + hex + seed, () => {
    const m = new VoxelModel();
    m.box(0, 0, 0, 0, 2, 0, 0x4f8a3a);
    m.set(-1, 3, 0, hex); m.set(1, 3, 0, hex); m.set(0, 3, -1, hex); m.set(0, 3, 1, hex); m.set(0, 3, 0, 0xf2c23a);
    m.set(1, 1, 0, 0x5a9a44);
    return m.build(0.09, -0.04, 0, -0.04, 0.1, seed);
  });
}
export function reedGeo(dry) {
  return cached('reed' + dry, () => {
    const m = new VoxelModel(), rnd = mulberry32(3);
    for (let b = 0; b < 5; b++) {
      const x = Math.floor(rnd() * 5), z = Math.floor(rnd() * 5), h = 13 + Math.floor(rnd() * 9);
      for (let y = 0; y < h; y++) m.set(x, y, z, dry ? 0xb8a070 : 0x5f8f3a);
      if (b % 2 === 0) { m.set(x, h, z, 0x6a4026); m.set(x, h + 1, z, 0x6a4026); m.set(x, h + 2, z, 0x6a4026); m.set(x, h + 3, z, dry ? 0xb8a070 : 0x7fae4a); }
    }
    return m.build(0.065, -0.13, 0, -0.13, 0.1, 7);
  });
}
export function lilyGeo(flower) {
  return cached('lily' + flower, () => {
    const m = new VoxelModel();
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) {
      if (x * x + z * z > 10) continue;
      if (x > 0 && Math.abs(z) < 1) continue; // notch
      m.set(x, 0, z, hash3(x, 0, z) > 0.5 ? 0x4f8f3a : 0x5c9e44);
    }
    if (flower) { m.set(-1, 1, -1, 0xf6c2d8); m.set(-1, 1, 0, 0xf6c2d8); m.set(0, 1, -1, 0xf6c2d8); m.set(-1, 2, -1, 0xfff0f6); }
    return m.build(0.12, 0, 0, 0, 0.1, 2);
  });
}
export function logGeo() {
  return cached('log', () => {
    const m = new VoxelModel();
    for (let x = 0; x < 6; x++) for (let y = 0; y < 2; y++) for (let z = 0; z < 2; z++) m.set(x, y, z, (x === 0 || x === 5) ? 0xd2a46a : (hash3(x, y, z) > 0.5 ? 0x6e4b31 : 0x5a3c26));
    return m.build(0.16, -0.48, -0.16, -0.16, 0.08, 5);
  });
}
export function boulderGeo(seed, snow, moss) {
  return cached('boulder' + seed + snow + moss, () => {
    const m = new VoxelModel(), rnd = mulberry32(seed);
    const rx = 2 + rnd() * 1.5, ry = 1.4 + rnd(), rz = 2 + rnd() * 1.5;
    for (let x = -4; x <= 4; x++) for (let y = 0; y <= 4; y++) for (let z = -4; z <= 4; z++) {
      const d = (x / rx) ** 2 + (y / ry) ** 2 + (z / rz) ** 2;
      if (d < 1 - hash3(x, y, z, seed) * 0.25) m.set(x, y, z, hash3(x, y, z, seed + 1) > 0.5 ? 0x8a8884 : 0x7a7874);
    }
    for (const [x, y, z] of [...m.values()]) if (!m.has(x, y + 1, z) && y > 0) m.set(x, y, z, snow ? 0xf0f4fa : moss && hash3(x, y, z, 4) > 0.3 ? 0x5f8a3a : 0x8a8884);
    return m.build(0.25, 0, 0, 0, 0.1, seed);
  });
}

// ─── Fish ───────────────────────────────────────────────────
export function fishGeo(f) {
  return cached('fish_' + f.id, () => {
    const m = new VoxelModel();
    if (f.shape === 'boot') {
      m.box(0, 0, 0, 2, 5, 2, f.body); m.box(3, 0, 0, 5, 1, 2, f.body); m.box(0, 0, 0, 5, 0, 2, f.fin);
      m.box(0, 5, 0, 2, 5, 2, f.belly);
      return m.build(0.07, -0.18, -0.2, -0.07, 0.1, 3);
    }
    if (f.shape === 'can') {
      m.box(0, 0, 0, 2, 4, 2, f.body); m.box(0, 2, 0, 2, 3, 2, f.belly); m.set(1, 4, 1, 0x3a2a20);
      return m.build(0.07, -0.1, -0.15, -0.1, 0.25, 3);
    }
    const L = f.len, tall = (f.tall || 1) * L * 0.26;
    for (let x = 0; x < L; x++) {
      const t = x / (L - 1); // 0 = tail, 1 = nose
      const prof = Math.sin(Math.min(1, t * 1.15) * Math.PI) ** 0.7;
      const hh = Math.max(1, Math.round(tall * prof)), ww = Math.max(1, Math.round(tall * prof * 0.45));
      for (let y = -hh; y <= hh; y++) for (let z = -ww; z <= ww; z++) {
        if ((y * y) / (hh * hh + 0.01) + (z * z) / (ww * ww + 0.5) > 1.05) continue;
        let c = y > 0 ? f.body : f.belly;
        if (y === 0 && f.band && x > 1 && x < L - 1) c = f.band;
        if (f.stripes && y > -1 && x % 2 === 0 && x > 1 && x < L - 2) c = f.stripes;
        if (f.spots && y >= 0 && hash3(x, y, z, 5) > 0.82) c = f.spots;
        if (f.patches && hash3(x >> 1, y >> 1, z, 9) > 0.55 && y > -2) c = f.patches;
        if (f.scutes && y === hh) c = f.scutes;
        m.set(x, y, z, c);
      }
    }
    // tail
    for (let y = -3; y <= 3; y++) { const k = Math.abs(y); if (k >= 1) m.set(-1 - (k > 2 ? 1 : 0), y, 0, f.fin); m.set(-1, 0, 0, f.fin); }
    m.set(-2, 2, 0, f.fin); m.set(-2, -2, 0, f.fin); m.set(-3, 3, 0, f.fin); m.set(-3, -3, 0, f.fin);
    // dorsal fin
    const top = Math.round(tall);
    for (let x = Math.floor(L * 0.35); x < Math.floor(L * 0.7); x++) m.set(x, top + 1, 0, f.fin);
    m.set(Math.floor(L * 0.5), top + 2, 0, f.fin);
    // eye
    const ex = L - 2, ew = Math.max(1, Math.round(tall * 0.45 * 0.6));
    m.set(ex, 1, ew, 0x101010); m.set(ex, 1, -ew, 0x101010);
    if (f.whiskers) { m.set(L, 0, 1, 0x3a3a3a); m.set(L + 1, -1, 1, 0x3a3a3a); m.set(L, 0, -1, 0x3a3a3a); m.set(L + 1, -1, -1, 0x3a3a3a); }
    const s = 0.035 + L * 0.0035;
    return m.build(s, -L * s * 0.5, 0, 0, 0.06, 7);
  });
}

export function bobberGeo() {
  return cached('bobber', () => {
    const m = new VoxelModel();
    m.box(-1, 0, -1, 1, 1, 1, 0xf4f0e8); m.box(-1, 2, -1, 1, 2, 1, 0xd8322a); m.set(0, 3, 0, 0xd8322a); m.set(0, -1, 0, 0xf4f0e8);
    return m.build(0.06, 0, -0.03, 0, 0.05, 3);
  });
}

// ─── Boat ───────────────────────────────────────────────────
export function boatGeo() {
  return cached('boat', () => {
    const m = new VoxelModel();
    const L = 16, W = 7;
    for (let z = 0; z < L; z++) {
      const bow = z > L - 5 ? (z - (L - 5)) : 0, stern = z < 1 ? 1 : 0;
      const half = Math.max(1, Math.floor(W / 2) - Math.ceil(bow * 0.75) - stern);
      for (let x = -half; x <= half; x++) {
        m.set(x, 0, z, 0x6e4a2c); // hull bottom
        const edge = Math.abs(x) === half;
        if (edge || z === 0 || z === L - 1) for (let y = 1; y <= 3; y++) m.set(x, y, z, y === 3 ? 0xc8964f : (y === 2 ? 0x2f6f8f : 0x8a5e38));
      }
    }
    // seats
    m.box(-2, 2, 4, 2, 2, 5, 0xb08050); m.box(-2, 2, 10, 2, 2, 10, 0xb08050);
    return m.build(0.25, 0, 0, -2, 0.08, 4);
  });
}
export function oarGeo() {
  return cached('oar', () => {
    const m = new VoxelModel();
    for (let x = 0; x < 12; x++) m.set(x, 0, 0, 0xc8964f);
    m.box(12, 0, -1, 15, 0, 1, 0xa87a40);
    return m.build(0.12, 0, -0.06, -0.06, 0.08, 2);
  });
}

// ─── Mabel (the market keeper) ──────────────────────────────
export function npcModel() {
  const g = new THREE.Group();
  const body = new VoxelModel();
  body.box(-2, 0, -1, 1, 5, 1, 0x7a4a8a); // dress
  body.box(-2, 1, 1, 1, 4, 1, 0xf2e6d0);  // apron
  body.box(-2, 6, -1, 1, 8, 1, 0x7a4a8a);  // torso
  body.box(-3, 5, -1, -3, 8, 0, 0x7a4a8a); body.box(2, 5, -1, 2, 8, 0, 0x7a4a8a); // arms
  body.set(-3, 4, 0, 0xf0c8a0); body.set(2, 4, 0, 0xf0c8a0);
  g.add(new THREE.Mesh(body.build(0.12, 0, 0, 0, 0.06, 2), MAT.vox));
  const head = new VoxelModel();
  head.box(-2, 0, -2, 1, 3, 1, 0xf0c8a0);
  head.box(-2, 4, -2, 1, 4, 1, 0xd8d8d8); head.box(-2, 0, -2, 1, 3, -2, 0xd8d8d8); head.set(-2, 3, 1, 0xd8d8d8); head.set(1, 3, 1, 0xd8d8d8); head.box(-2, 3, -1, -2, 3, 0, 0xd8d8d8); head.box(1, 3, -1, 1, 3, 0, 0xd8d8d8); // hair
  head.box(-1, 5, -1, 0, 5, 0, 0xc8c8c8); // bun
  head.set(-1, 2, 1, 0x2a1a10); head.set(0, 2, 1, 0x2a1a10);  // eyes (front = +z)
  head.set(-2, 1, 1, 0xe89a8a); head.set(1, 1, 1, 0xe89a8a);  // cheeks
  head.set(-1, 0, 2, 0xf0c8a0); // little nose
  const hm = new THREE.Mesh(head.build(0.12, 0, 0, 0, 0.04, 3), MAT.vox);
  hm.position.y = 9 * 0.12;
  g.add(hm);
  g.userData.head = hm;
  g.traverse(o => { o.castShadow = true; });
  return g;
}

// ─── Campfire ───────────────────────────────────────────────
export function campfireGeo() {
  return cached('campfire', () => {
    const m = new VoxelModel();
    for (let a = 0; a < 10; a++) {
      const x = Math.round(Math.cos(a / 10 * Math.PI * 2) * 3.6), z = Math.round(Math.sin(a / 10 * Math.PI * 2) * 3.6);
      m.set(x, 0, z, a % 2 ? 0x8a8884 : 0x6f6d69); m.set(x, 1, z, 0x7a7874);
    }
    m.box(-2, 0, 0, 2, 0, 0, 0x6e4b31); m.box(0, 1, -2, 0, 1, 2, 0x5a3c26); m.box(-1, 0, -1, 1, 0, 1, 0x2a2420);
    return m.build(0.16, 0, 0, 0, 0.1, 4);
  });
}
export function flameGeo() {
  return cached('flame', () => {
    const m = new VoxelModel();
    m.box(-1, 0, -1, 1, 1, 1, 0xffffff); m.box(-1, 2, 0, 0, 3, 0, 0xffffff); m.set(0, 4, 0, 0xffffff); m.set(1, 2, -1, 0xffffff);
    return m.build(0.14, 0, 0, 0, 0, 1);
  });
}

export function signGeo() {
  return cached('sign', () => {
    const m = new VoxelModel();
    m.box(0, 0, 0, 0, 7, 0, 0x6e4b31);
    m.box(-3, 5, 1, 3, 8, 1, (x, y) => (y === 5 || y === 8 || Math.abs(x) === 3) ? 0x6e4b31 : 0xc8a06a);
    m.box(-1, 6, 2, 1, 7, 2, 0x3a2a1a);
    return m.build(0.14, -0.07, 0, -0.07, 0.08, 2);
  });
}

export function duckGeo(baby) {
  return cached('duck' + baby, () => {
    const m = new VoxelModel();
    if (baby) {
      m.box(-1, 0, -1, 1, 1, 1, 0xf2d24a); m.box(-1, 2, 1, 0, 3, 2, 0xf2d24a); m.set(0, 2, 3, 0xe08a2a); m.set(-1, 3, 2, 0x101010);
      return m.build(0.07, 0, 0, 0, 0.05, 1);
    }
    m.box(-2, 0, -3, 2, 2, 3, 0x8a6a4a); m.box(-2, 2, -2, 2, 2, 1, 0x6a5038);
    m.box(-1, 3, 2, 1, 5, 4, 0x2f6f3a); m.set(0, 4, 5, 0xe8b02a); m.set(0, 3, 5, 0xe8b02a);
    m.set(-1, 5, 3, 0x101010); m.set(1, 5, 3, 0x101010); m.box(-2, 1, -4, 2, 2, -4, 0x5a4030);
    m.box(-1, 2, 2, 1, 2, 2, 0xffffff);
    return m.build(0.07, 0, 0, 0, 0.06, 2);
  });
}
