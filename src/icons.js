// Item icons rendered from real voxel models (same materials & light as the
// game), so the UI speaks the world's language instead of emoji.
import * as THREE from 'three';
import { VoxelModel, MAT } from './mesher.js';
import { FISH_BY_ID, RODS } from './config.js';
import * as M from './models.js';

const SIZE = 64;

function model(fn, s = 0.1) { const m = new VoxelModel(); fn(m); return m.build(s, 0, 0, 0, 0.08, 3); }

const EXTRA = {
  hands: () => model(m => {
    const skin = 0xf0c8a0, cuff = 0xa83a2a;
    m.box(0, 0, 0, 3, 4, 1, skin); m.box(0, 5, 0, 0, 7, 1, skin); m.box(1, 5, 0, 1, 8, 1, skin); m.box(2, 5, 0, 2, 8, 1, skin); m.box(3, 5, 0, 3, 7, 1, skin);
    m.box(4, 1, 0, 5, 3, 1, skin); m.box(-1, -3, -1, 4, -1, 2, cuff);
  }),
  rod: (tier) => model(m => {
    const r = RODS[tier] || RODS[1];
    for (let i = 0; i < 16; i++) m.set(i, i, 0, i % 4 === 3 && tier > 1 ? r.accent : r.color);
    m.box(2, 0, 1, 3, 1, 2, 0x3a3a3a); m.set(2, 2, 1, 0xc8c8c8);
    for (let i = 0; i < 9; i++) m.set(15, 15 - i * 1.6 | 0, 0, 0xf4efe6);
    m.set(15, 1, 0, 0xd8322a); m.set(15, 0, 0, 0xf4f0e8);
  }, 0.08),
  axe: (tier) => model(m => {
    const head = tier >= 2 ? 0xb8bcc4 : 0x8a8884;
    for (let i = 0; i < 12; i++) m.set(i, i, 0, 0x8a5e38);
    m.box(8, 10, -1, 13, 13, 1, head); m.box(9, 9, -1, 12, 9, 1, head); m.set(13, 14, 0, head); m.box(8, 8, 0, 9, 9, 0, 0xd8c39a);
  }, 0.09),
  lantern: () => model(m => {
    m.box(0, 0, 0, 4, 0, 4, 0x2a2620); m.box(0, 6, 0, 4, 6, 4, 0x2a2620); m.box(1, 7, 1, 3, 7, 3, 0x2a2620); m.set(2, 8, 2, 0x2a2620);
    m.box(1, 1, 1, 3, 5, 3, 0xffc860);
    for (const [x, z] of [[0, 0], [4, 0], [0, 4], [4, 4]]) m.box(x, 1, z, x, 5, z, 0x3a342a);
  }),
  string: () => model(m => {
    m.box(0, 0, 0, 4, 0, 4, 0x8a5e38); m.box(0, 6, 0, 4, 6, 4, 0x8a5e38);
    m.box(1, 1, 1, 3, 5, 3, 0xf4efe6); m.box(0, 2, 1, 0, 4, 3, 0xe8e0c8); m.box(4, 2, 1, 4, 4, 3, 0xe8e0c8); m.box(1, 2, 0, 3, 4, 0, 0xece4d0); m.box(1, 2, 4, 3, 4, 4, 0xece4d0);
    m.set(5, 3, 2, 0xf4efe6); m.set(6, 2, 2, 0xf4efe6); m.set(7, 2, 3, 0xf4efe6);
  }),
  worm: () => model(m => {
    const pts = [[0, 0], [1, 0], [2, 1], [3, 1], [4, 0], [5, 0], [6, 1], [7, 2], [7, 3], [6, 4]];
    pts.forEach(([x, z], i) => m.set(x, 0, z, i === pts.length - 1 ? 0xc87070 : i % 3 ? 0xe89a9a : 0xd88080));
    m.set(6, 1, 4, 0xc87070);
  }, 0.12),
  lure: () => model(m => {
    m.box(0, 0, 0, 1, 5, 1, 0xe2b23a); m.box(2, 1, 0, 3, 3, 0, 0xf4f0e8); m.box(-2, 2, 0, -1, 4, 0, 0xd8322a);
    m.set(0, -1, 0, 0x9a9a9a); m.set(0, -2, 1, 0x9a9a9a); m.set(1, -2, 1, 0x9a9a9a); m.set(0, 6, 0, 0x9a9a9a);
  }, 0.11),
  berries: () => model(m => {
    for (const [x, y, z, c] of [[0, 0, 0, 0x3a4fb8], [2, 0, 0, 0x3a4fb8], [1, 0, 2, 0x2e3f9a], [1, 2, 1, 0x3a4fb8], [3, 1, 2, 0xc8324a], [-1, 1, 2, 0x2e3f9a]])
      m.box(x, y, z, x + 1, y + 1, z + 1, c);
    m.box(1, 4, 1, 2, 4, 3, 0x5a9a44); m.set(2, 5, 2, 0x4a7a34);
  }, 0.1),
  plank: () => model(m => { m.box(0, 0, 0, 13, 1, 3, (x, y, z) => (z === 0 && x % 5 === 2) ? 0x8a5e38 : (x % 7 === 0 ? 0x9a6c40 : 0xb08050)); }, 0.09),
  rope: () => model(m => {
    for (let a = 0; a < 24; a++) { const t = a / 24 * Math.PI * 2; for (const r of [3, 4]) m.set(Math.round(Math.cos(t) * r), (a + r) % 2, Math.round(Math.sin(t) * r), (a + r) % 3 ? 0xc8a46a : 0xa8844a); }
    m.set(4, 2, 0, 0xc8a46a); m.set(5, 3, 0, 0xc8a46a);
  }, 0.1),
  nails: () => model(m => {
    for (const [x, z] of [[0, 0], [3, 1], [1, 3]]) { m.box(x, 0, z, x, 5, z, 0x9aa0a8); m.box(x - 1, 6, z, x + 1, 6, z, 0x7a8088); m.set(x, 6, z - 1, 0x7a8088); m.set(x, 6, z + 1, 0x7a8088); }
  }, 0.11),
  coin: () => model(m => {
    for (let y = 0; y < 3; y++) for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) if (x * x + z * z <= 10) m.set(x, y * 2, z, y === 2 && x * x + z * z <= 3 ? 0xf4d26a : 0xe2b23a);
  }, 0.1),
  flame: () => model(m => {
    m.box(-1, 0, -1, 1, 1, 1, 0xff8a20); m.box(-1, 2, 0, 0, 3, 0, 0xffb040); m.set(0, 4, 0, 0xffd870); m.set(1, 2, -1, 0xffb040); m.box(0, 1, 0, 0, 2, 0, 0xffe090);
  }, 0.14),
  house: () => model(m => {
    m.box(0, 0, 0, 7, 0, 5, 0x8a857c);
    m.box(0, 1, 0, 7, 4, 5, (x, y) => y % 2 ? 0x7a5232 : 0x8d6240);
    m.box(3, 1, 0, 4, 2, 0, 0x4a2f1a); m.set(1, 3, 0, 0xffd070); m.set(6, 3, 0, 0xffd070);
    for (let k = 0; k < 4; k++) m.box(-1, 5 + k, k - 1, 8, 5 + k, 6 - k, k % 2 ? 0x8a3a2a : 0xa24c32);
    m.box(6, 7, 3, 6, 10, 3, 0x8a857c);
  }, 0.1),
  book: () => model(m => {
    m.box(0, 0, 0, 9, 1, 6, 0x6a3a22); m.box(1, 2, 0, 9, 2, 6, 0xf2e2c0); m.box(0, 3, 0, 9, 3, 6, 0x6a3a22); m.box(0, 0, 0, 0, 3, 6, 0x4a2814);
    m.box(4, 4, 2, 5, 4, 2, 0xc8a050);
  }, 0.1),
  blossom: () => model(m => {
    const P = 0xf4b4cc, W = 0xfff0f6;
    for (const [x, y] of [[0, 2], [2, 4], [4, 2], [2, 0], [1, 1], [3, 1], [1, 3], [3, 3]]) m.set(x, y, 0, P);
    m.set(0, 3, 0, P); m.set(4, 1, 0, P); m.set(1, 4, 0, P); m.set(3, 0, 0, P);
    m.set(2, 2, 0, 0xf2c23a); m.set(2, 1, 0, W); m.set(2, 3, 0, W); m.set(1, 2, 0, W); m.set(3, 2, 0, W);
  }, 0.12),
  leaf: () => model(m => {
    const rows = [[3, 3], [2, 4], [1, 5], [1, 5], [0, 6], [1, 5], [1, 5], [2, 4], [3, 3]];
    rows.forEach(([a, b], y) => { for (let x = a; x <= b; x++) m.set(x, y, 0, x === 3 ? 0xa8401e : (x + y) % 3 ? 0xdb6a2c : 0xe9a73b); });
    m.set(3, -1, 0, 0x6a3a1e); m.set(3, -2, 0, 0x6a3a1e);
  }, 0.11),
  snowflake: () => model(m => {
    const C = 0xe8f4ff, B = 0xb8d8f4;
    for (let i = -4; i <= 4; i++) { m.set(i, 0, 0, C); m.set(0, i, 0, C); if (Math.abs(i) <= 3) { m.set(i, i, 0, B); m.set(i, -i, 0, B); } }
    for (const [x, y] of [[-3, 1], [-3, -1], [3, 1], [3, -1], [1, 3], [-1, 3], [1, -3], [-1, -3]]) m.set(x, y, 0, C);
  }, 0.1),
  sun: () => model(m => {
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (x * x + y * y <= 10) m.set(x, y, 0, x * x + y * y <= 4 ? 0xffe070 : 0xffc040);
  }, 0.1),
  moon: () => model(m => {
    for (let x = -3; x <= 3; x++) for (let y = -3; y <= 3; y++) if (x * x + y * y <= 10 && (x - 2) * (x - 2) + (y - 1) * (y - 1) > 6) m.set(x, y, 0, 0xe8ecff);
  }, 0.1),
};

export class Icons {
  constructor() {
    this.cache = new Map();
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = SIZE;
    try {
      this.r = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: false, preserveDrawingBuffer: true });
    } catch (e) { this.r = null; }
    if (!this.r) return;
    this.r.setPixelRatio(1);
    this.r.setSize(SIZE, SIZE, false);
    this.r.toneMapping = THREE.ACESFilmicToneMapping;
    this.r.toneMappingExposure = 1.15;
    this.scene = new THREE.Scene();
    this.scene.add(new THREE.HemisphereLight(0xfff4e0, 0x6a5040, 1.5));
    const d = new THREE.DirectionalLight(0xffe2b8, 2.6); d.position.set(3, 5, 4); this.scene.add(d);
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
    this.holder = new THREE.Group();
    this.scene.add(this.holder);
  }

  geoFor(key) {
    if (key.startsWith('fish:')) return [M.fishGeo(FISH_BY_ID[key.slice(5)]), 'side'];
    const [base, arg] = key.split(':');
    switch (base) {
      case 'stick': return [M.stickGeo()];
      case 'stone': return [M.stoneGeo()];
      case 'fiber': return [M.fiberGeo(false)];
      case 'mushroom': return [M.mushroomGeo()];
      case 'log': return [M.logGeo()];
      case 'campfire': return [M.campfireGeo()];
      case 'boat': return [M.boatGeo()];
      case 'rod': return [EXTRA.rod(+arg || 1), 'flat'];
      case 'axe': return [EXTRA.axe(+arg || 1), 'flat'];
      case 'worms': return [EXTRA.worm()];
      case 'mabel': return [null, 'npc'];
    }
    if (EXTRA[base]) return [EXTRA[base](), ['hands', 'sun', 'moon', 'blossom', 'leaf', 'snowflake'].includes(base) ? 'front' : null];
    return [M.stoneGeo()];
  }

  get(key) {
    if (this.cache.has(key)) return this.cache.get(key);
    let url = '';
    if (this.r) {
      try { url = this.render(key); } catch (e) { url = ''; }
    }
    this.cache.set(key, url);
    return url;
  }

  render(key) {
    this.holder.clear();
    const [geo, view] = this.geoFor(key === 'worm' ? 'worms' : key);
    let obj;
    if (view === 'npc') {
      obj = M.npcModel();
      const h = obj.userData.head; obj.clear(); obj = h; obj.position.set(0, 0, 0);
    } else obj = new THREE.Mesh(geo, MAT.vox);
    this.holder.add(obj);
    // frame it
    obj.rotation.set(0, 0, 0);
    if (view === 'side') { obj.rotation.set(0.15, -0.35, 0.12); }
    else if (view === 'flat') { obj.rotation.set(0.25, -0.5, 0); }
    else if (view === 'front' || view === 'npc') { obj.rotation.set(0.1, view === 'npc' ? 0.35 : -0.2, 0); }
    else obj.rotation.set(0.55, -0.75, 0);
    obj.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(obj);
    const c = box.getCenter(new THREE.Vector3()), sz = box.getSize(new THREE.Vector3());
    obj.position.sub(c);
    const half = Math.max(sz.x, sz.y) * 0.58;
    this.cam.left = -half; this.cam.right = half; this.cam.top = half; this.cam.bottom = -half;
    this.cam.position.set(0, 0, 20); this.cam.lookAt(0, 0, 0); this.cam.updateProjectionMatrix();
    this.r.setClearColor(0x000000, 0);
    this.r.render(this.scene, this.cam);
    return this.canvas.toDataURL('image/png');
  }

  img(key, cls = '') { const u = this.get(key); return u ? `<img class="ico ${cls}" src="${u}" alt="">` : `<span class="ico ${cls}"></span>`; }
}
