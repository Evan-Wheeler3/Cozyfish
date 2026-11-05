// Heightmap voxel terrain: the pond, its shore, the woods and the hills.
import * as THREE from 'three';
import { N, CENTER, WATER_Y, ICE_Y, POND_MAX_H, LAND_H, HOUSE, MARKET, CAMP, SPAWN, DOCK_X } from './config.js';
import { fbm, valueNoise, hash2, hash3, smoothstep, clamp } from './noise.js';
import { VoxelMesher, lin, MAT, SHARED } from './mesher.js';

const CH = 32; // chunk size

export const K = { GRASS: 0, SAND: 1, BED: 2, PATH: 3, FOREST: 4 };

function distToSeg(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const t = clamp(((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz), 0, 1);
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}
function distToPoly(px, pz, pts) {
  let d = 1e9;
  for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distToSeg(px, pz, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1]));
  return d;
}

export class Terrain {
  constructor(game) {
    this.g = game;
    this.h = new Int16Array(N * N);
    this.kind = new Uint8Array(N * N);
    this.forest = new Float32Array(N * N);
    this.solids = new Set();
    this.frozen = false;
    this.chunks = [];
    this.group = new THREE.Group();
    game.scene.add(this.group);
    this.generate();
  }

  pondR(a) {
    return 20.5 + (valueNoise(Math.cos(a) * 1.6 + 5, Math.sin(a) * 1.6 + 5, 3) - 0.5) * 8
      + (valueNoise(Math.cos(a) * 4 + 9, Math.sin(a) * 4 + 9, 4) - 0.5) * 2.5;
  }

  generate() {
    const paths = [
      [[80.5, 102], [80.5, 112], [84, 115.5], [89.5, 115.5]],
      [[101, 82.5], [105, 82.5], [108.6, 82.5]],
      [[79, 58], [74, 52], [69, 46], [CAMP.x + 2, CAMP.z + 3]],
    ];
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x;
      const dx = x + 0.5 - CENTER, dz = z + 0.5 - CENTER;
      const d = Math.hypot(dx, dz), a = Math.atan2(dz, dx);
      const r = this.pondR(a);
      let h, k;
      if (d < r) {
        const f = 1 - d / r;
        let depth = Math.floor(Math.pow(f, 0.6) * 6.6 + (fbm(x * 0.17, z * 0.17, 7) - 0.5) * 1.6);
        if (d > r - 1.2) depth = 0;
        depth = clamp(depth, 0, 6);
        h = POND_MAX_H - depth; k = K.BED;
      } else {
        const shore = d - r;
        const cheb = Math.max(Math.abs(dx), Math.abs(dz));
        const hills = smoothstep(5, 30, shore) * (fbm(x * 0.045, z * 0.045, 3) * 7 - 2.2);
        const edge = smoothstep(58, 77, cheb) * 17 + smoothstep(70, 79, cheb) * 10;
        const bumps = shore > 7 ? smoothstep(7, 12, shore) * (fbm(x * 0.11, z * 0.11, 13) > 0.6 ? 1 : 0) : 0;
        h = LAND_H + Math.max(0, Math.floor(hills + edge)) + (hills + edge < 1 ? bumps : 0);
        const f = smoothstep(r + 6, r + 18, d);
        this.forest[i] = f;
        k = shore < 1.2 + fbm(x * 0.3, z * 0.3, 11) * 1.6 ? K.SAND : (f > 0.5 ? K.FOREST : K.GRASS);
        // shore path ring + trails
        const wob = (valueNoise(x * 0.15, z * 0.15, 21) - 0.5) * 0.5;
        if ((shore > 4.3 + wob && shore < 6.0 + wob) || distToPoly(x + 0.5, z + 0.5, paths[0]) < 0.85 + wob
          || distToPoly(x + 0.5, z + 0.5, paths[1]) < 0.85 + wob || distToPoly(x + 0.5, z + 0.5, paths[2]) < 0.8 + wob) {
          if (h <= LAND_H + 1 || shore < 8) k = K.PATH;
        }
      }
      this.h[i] = h; this.kind[i] = k;
    }
    // flatten building zones
    const flatRect = (x0, z0, x1, z1, hh, keepPath = true) => {
      for (let z = z0; z <= z1; z++) for (let x = x0; x <= x1; x++) {
        const i = z * N + x;
        if (this.h[i] <= POND_MAX_H) continue;
        this.h[i] = hh;
        if (!(keepPath && this.kind[i] === K.PATH)) this.kind[i] = K.GRASS;
      }
    };
    flatRect(HOUSE.x - 3, HOUSE.z - 3, HOUSE.x + 11, HOUSE.z + 9, LAND_H);
    flatRect(MARKET.x - 3, MARKET.z - 3, MARKET.x + 7, MARKET.z + 5, LAND_H);
    flatRect(Math.floor(SPAWN.x) - 3, Math.floor(SPAWN.z) - 3, Math.floor(SPAWN.x) + 3, Math.floor(SPAWN.z) + 3, LAND_H);
    // campsite: level to its centre height
    const ch = this.h[CAMP.z * N + CAMP.x];
    for (let z = CAMP.z - 7; z <= CAMP.z + 7; z++) for (let x = CAMP.x - 7; x <= CAMP.x + 7; x++) {
      const dd = Math.hypot(x - CAMP.x, z - CAMP.z);
      if (dd < 6.5) { this.h[z * N + x] = ch; if (this.kind[z * N + x] !== K.PATH) this.kind[z * N + x] = K.GRASS; this.forest[z * N + x] = 0.3; }
    }
    this.campY = ch;

    // dock: find the south shoreline at DOCK_X
    let zStart = CENTER + 40;
    for (let z = CENTER + 40; z > CENTER; z--) {
      if (this.h[z * N + DOCK_X] <= POND_MAX_H && this.h[z * N + DOCK_X + 1] <= POND_MAX_H) { zStart = z; break; }
    }
    this.dock = { x0: DOCK_X, x1: DOCK_X + 1, z0: zStart - 9, z1: zStart + 1 };
    for (let z = this.dock.z0; z <= this.dock.z1; z++) for (let x = this.dock.x0; x <= this.dock.x1; x++) {
      if (this.h[z * N + x] <= POND_MAX_H) this.addSolid(x, 8, z);
    }

    // pond bookkeeping
    this.pondCells = [];
    let minx = N, maxx = 0, minz = N, maxz = 0;
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) if (this.h[z * N + x] <= POND_MAX_H) {
      this.pondCells.push([x, z]);
      minx = Math.min(minx, x); maxx = Math.max(maxx, x); minz = Math.min(minz, z); maxz = Math.max(maxz, z);
    }
    this.pondBox = { x0: minx - 2, z0: minz - 2, x1: maxx + 3, z1: maxz + 3 };
  }

  idx(x, z) { return z * N + x; }
  H(x, z) {
    x = Math.floor(x); z = Math.floor(z);
    if (x < 0 || z < 0 || x >= N || z >= N) return 60;
    return this.h[z * N + x];
  }
  kindAt(x, z) { x = Math.floor(x); z = Math.floor(z); if (x < 0 || z < 0 || x >= N || z >= N) return K.FOREST; return this.kind[z * N + x]; }
  isPond(x, z) { return this.H(x, z) <= POND_MAX_H; }
  depthAt(x, z) { return WATER_Y - this.H(x, z); }
  waterY() { return this.frozen ? ICE_Y : WATER_Y; }
  key(x, y, z) { return (y * N + z) * N + x; }
  addSolid(x, y, z) { this.solids.add(this.key(x, y, z)); }
  removeSolid(x, y, z) { this.solids.delete(this.key(x, y, z)); }
  hasSolid(x, y, z) { return this.solids.has(this.key(x, y, z)); }

  isSolid(x, y, z) {
    if (x < 0 || z < 0 || x >= N || z >= N) return true;
    if (y < 0) return true;
    const h = this.h[z * N + x];
    if (y < h) return true;
    if (this.frozen && y === 8 && h <= POND_MAX_H) return true;
    if (y > 80) return false;
    return this.solids.has(this.key(x, y, z));
  }

  // Highest solid top at or below y in this column.
  floorBelow(x, y, z) {
    const ix = Math.floor(x), iz = Math.floor(z);
    for (let iy = Math.floor(y); iy >= 0; iy--) if (this.isSolid(ix, iy, iz)) return iy + 1;
    return 0;
  }
  // Top of the land/structure surface you'd stand on.
  surfaceY(x, z) { return this.floorBelow(x, 70, z); }

  // ─── Rendering ────────────────────────────────────────────
  topColor(x, z, pal) {
    const i = z * N + x, k = this.kind[i], h = this.h[i];
    const n = fbm(x * 0.12, z * 0.12, 31);
    let c;
    if (k === K.BED) {
      const dep = clamp((POND_MAX_H - h) / 6, 0, 1);
      const s = lin(pal.snow ? 0xcfc2a0 : pal.sand), mud = lin(0x4a4636);
      const t = clamp(dep * 1.1 + (n - 0.5) * 0.4, 0, 1);
      c = [s[0] + (mud[0] - s[0]) * t, s[1] + (mud[1] - s[1]) * t, s[2] + (mud[2] - s[2]) * t];
      if (hash2(x, z, 77) > 0.9) c = c.map(v => v * 0.75);
    } else if (pal.snow) {
      const base = k === K.PATH ? lin(0xd9d2c6) : lin(0xf3f7fc);
      const t = (n - 0.5) * 0.12;
      c = [base[0] * (1 + t) * 0.98, base[1] * (1 + t), base[2] * (1 + t) * 1.02];
    } else if (k === K.SAND) c = lin(pal.sand).slice();
    else if (k === K.PATH) { const a = lin(0xa8845a), b = lin(0xbf9a6a); c = [a[0] + (b[0] - a[0]) * n, a[1] + (b[1] - a[1]) * n, a[2] + (b[2] - a[2]) * n]; }
    else {
      const g1 = lin(pal.grass), g2 = lin(pal.grassDark);
      const t = clamp(n * 1.3 - 0.15, 0, 1);
      c = [g1[0] + (g2[0] - g1[0]) * t, g1[1] + (g2[1] - g1[1]) * t, g1[2] + (g2[2] - g1[2]) * t];
      const f = this.forest[i];
      if (f > 0) { // mossy forest floor with leaf litter
        const lit = lin(pal.key === 'fall' ? 0xa0602c : 0x5a6a2e);
        const ft = f * (0.35 + 0.3 * hash2(x, z, 5));
        c = [c[0] + (lit[0] - c[0]) * ft, c[1] + (lit[1] - c[1]) * ft, c[2] + (lit[2] - c[2]) * ft];
      }
    }
    return c;
  }

  build(pal) {
    for (const m of this.chunks) { m.geometry.dispose(); this.group.remove(m); }
    this.chunks = [];
    this.topCols = new Float32Array(N * N * 3);
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const c = this.topColor(x, z, pal);
      this.topCols.set(c, (z * N + x) * 3);
    }
    const solid = (x, y, z) => y < this.H(x, z);
    const dirt = lin(pal.dirt), stone = lin(pal.stone), sand = lin(pal.snow ? 0xcfc2a0 : pal.sand);
    for (let cz = 0; cz < N; cz += CH) for (let cx = 0; cx < N; cx += CH) {
      const m = new VoxelMesher(1);
      m.capFrac = 0.28;
      for (let z = cz; z < cz + CH; z++) for (let x = cx; x < cx + CH; x++) {
        const i = z * N + x, h = this.h[i], k = this.kind[i];
        const minN = Math.min(this.H(x + 1, z), this.H(x - 1, z), this.H(x, z + 1), this.H(x, z - 1));
        const y0 = Math.max(0, Math.min(minN, h - 1));
        for (let y = y0; y < h; y++) {
          const j = 1 + (hash3(x, y, z, 3) - 0.5) * 0.12;
          let c, cap = null;
          if (y === h - 1) {
            const t = this.topCols;
            const top = [t[i * 3] * j, t[i * 3 + 1] * j, t[i * 3 + 2] * j];
            if (k === K.BED) c = top;
            else { cap = top; c = k === K.SAND ? sand : dirt; }
          } else if (k === K.SAND || k === K.BED) c = y >= h - 3 ? sand : stone;
          else c = y >= h - 3 ? dirt : stone;
          const sj = y < h - 3 ? 1 + (hash3(x, y, z, 9) - 0.5) * 0.25 : j;
          m.add(x, y, z, c[0] * sj, c[1] * sj, c[2] * sj, solid, cap, true);
        }
      }
      const mesh = new THREE.Mesh(m.geometry(), MAT.vox);
      mesh.receiveShadow = true; mesh.castShadow = true;
      this.group.add(mesh);
      this.chunks.push(mesh);
    }
    this.buildWater(pal);
  }

  buildWater(pal) {
    const b = this.pondBox, w = b.x1 - b.x0, d = b.z1 - b.z0;
    if (!this.water) {
      const data = new Uint8Array(w * d * 4);
      for (let z = 0; z < d; z++) for (let x = 0; x < w; x++) {
        const dep = clamp((WATER_Y - this.H(b.x0 + x, b.z0 + z)) / 7, 0, 1);
        const o = (z * w + x) * 4;
        data[o] = data[o + 1] = data[o + 2] = Math.round(dep * 255); data[o + 3] = 255;
      }
      const tex = new THREE.DataTexture(data, w, d, THREE.RGBAFormat);
      tex.magFilter = THREE.LinearFilter; tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true;
      const geo = new THREE.PlaneGeometry(w, d, w, d);
      geo.rotateX(-Math.PI / 2);
      this.waterUniforms = {
        uTime: { value: 0 }, uDepth: { value: tex },
        uBoxMin: { value: new THREE.Vector2(b.x0, b.z0) }, uBoxSize: { value: new THREE.Vector2(w, d) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) }, uSunCol: { value: new THREE.Color(1, 1, 1) },
        uSky: { value: new THREE.Color(0.6, 0.8, 1) }, uSkyTop: { value: new THREE.Color(0.3, 0.5, 0.9) }, uSunFog: { value: new THREE.Color(1, 0.7, 0.4) }, uDeep: { value: new THREE.Color() }, uShallow: { value: new THREE.Color() },
        uFogCol: { value: new THREE.Color() }, uFogNear: { value: 40 }, uFogFar: { value: 160 },
        uFrozen: { value: 0 }, uLight: { value: 1 },
      };
      const mat = new THREE.ShaderMaterial({
        uniforms: this.waterUniforms, transparent: true, side: THREE.DoubleSide, depthWrite: false,
        vertexShader: WATER_VS, fragmentShader: WATER_FS,
      });
      this.water = new THREE.Mesh(geo, mat);
      this.water.position.set(b.x0 + w / 2, WATER_Y, b.z0 + d / 2);
      this.water.renderOrder = 2;
      this.water.receiveShadow = false;
      this.g.scene.add(this.water);
    }
    this.frozen = !!pal.frozen;
    this.waterUniforms.uFrozen.value = this.frozen ? 1 : 0;
    this.waterUniforms.uShallow.value.setHex(pal.water[0]);
    this.waterUniforms.uDeep.value.setHex(pal.water[1]);
    this.water.position.y = this.frozen ? ICE_Y : WATER_Y;
  }

  update(dt, sky) {
    if (!this.water) return;
    const u = this.waterUniforms;
    u.uTime.value += dt;
    u.uSunDir.value.copy(sky.lightDir);
    u.uSunCol.value.copy(sky.sunSpec);
    u.uSky.value.copy(sky.horizon);
    u.uSkyTop.value.copy(sky.top);
    u.uSunFog.value.copy(SHARED.uSunFog.value).multiplyScalar(SHARED.uScatter.value);
    u.uFogCol.value.copy(this.g.scene.fog.color);
    u.uFogNear.value = this.g.scene.fog.near; u.uFogFar.value = this.g.scene.fog.far;
    u.uLight.value = sky.dayLight;
  }
}

const WATER_VS = /* glsl */`
uniform float uTime; uniform float uFrozen;
varying vec3 vWorld; varying float vFogDepth;
void main(){
  vec4 wp = modelMatrix * vec4(position, 1.0);
  if (uFrozen < 0.5) {
    wp.y += sin(wp.x * 0.7 + uTime * 1.3) * 0.025 + cos(wp.z * 0.9 + uTime * 1.1) * 0.025;
  }
  vWorld = wp.xyz;
  vec4 mv = viewMatrix * wp;
  vFogDepth = -mv.z;
  gl_Position = projectionMatrix * mv;
}`;

const WATER_FS = /* glsl */`
uniform float uTime, uFrozen, uFogNear, uFogFar, uLight;
uniform vec3 uSunDir, uSunCol, uSky, uSkyTop, uSunFog, uDeep, uShallow, uFogCol;
uniform sampler2D uDepth; uniform vec2 uBoxMin, uBoxSize;
varying vec3 vWorld; varying float vFogDepth;
float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
float waves(vec2 p){
  return noise(p * 0.9 + vec2(uTime * 0.35, uTime * 0.22)) * 0.6 + noise(p * 2.1 - vec2(uTime * 0.3, -uTime * 0.41)) * 0.4;
}
void main(){
  vec2 uv = (vWorld.xz - uBoxMin) / uBoxSize;
  float depth = texture2D(uDepth, uv).r;
  vec3 V = normalize(cameraPosition - vWorld);
  bool below = cameraPosition.y < vWorld.y;
  vec3 col; float alpha;
  if (uFrozen > 0.5) {
    vec2 p = vWorld.xz;
    float n = noise(p * 0.8) * 0.6 + noise(p * 3.0) * 0.4;
    float crack = smoothstep(0.03, 0.0, abs(noise(p * 0.6 + 3.0) - 0.5)) * 0.5 + smoothstep(0.02, 0.0, abs(noise(p * 1.4 + 9.0) - 0.5)) * 0.35;
    col = mix(vec3(0.74, 0.86, 0.95), vec3(0.42, 0.60, 0.78), smoothstep(0.1, 0.9, depth) * 0.85 + n * 0.18);
    col = mix(col, vec3(0.96, 0.97, 1.0), smoothstep(0.62, 0.8, noise(p * 0.35 + 20.0)) * 0.7); // snow drifts
    col = mix(col, vec3(0.95, 0.98, 1.0), crack);
    vec3 N = normalize(vec3((n - 0.5) * 0.1, 1.0, 0.0));
    vec3 H = normalize(uSunDir + V);
    col += uSunCol * pow(max(dot(N, H), 0.0), 90.0) * 0.8;
    col *= mix(0.25, 1.0, uLight);
    col += uSky * 0.12;
    alpha = 0.93;
  } else {
    vec2 p = vWorld.xz;
    float e = 0.12;
    float h0 = waves(p), hx = waves(p + vec2(e, 0.0)), hz = waves(p + vec2(0.0, e));
    vec3 N = normalize(vec3((h0 - hx) * 2.2, 1.0, (h0 - hz) * 2.2));
    if (below) N = -N;
    float fres = pow(1.0 - clamp(abs(dot(N, V)), 0.0, 1.0), 4.0);
    vec3 base = mix(uShallow, uDeep, smoothstep(0.02, 0.75, depth));
    base *= mix(0.18, 1.0, uLight);
    // reflect the actual sky gradient: horizon at grazing angles, zenith looking down
    vec3 R = reflect(-V, N);
    vec3 skyR = mix(uSky, uSkyTop, smoothstep(0.0, 0.5, R.y));
    skyR += uSunFog * pow(max(dot(normalize(vec3(R.x, max(R.y, 0.0), R.z)), uSunDir), 0.0), 6.0) * 0.8;
    col = mix(base, skyR, 0.12 + fres * 0.7);
    vec3 H = normalize(uSunDir + V);
    float spec = pow(max(dot(N, H), 0.0), 220.0) * 3.5 + pow(max(dot(N, H), 0.0), 45.0) * 0.45 + pow(max(dot(N, H), 0.0), 8.0) * 0.06;
    col += uSunCol * spec;
    float foam = smoothstep(0.1, 0.0, depth) * (0.4 + 0.6 * noise(p * 4.0 + uTime * 0.5));
    col = mix(col, vec3(0.95) * mix(0.3, 1.0, uLight), foam * 0.45);
    alpha = mix(0.5, 0.88, smoothstep(0.0, 0.5, depth));
    alpha = max(alpha, fres * 0.9);
    if (below) { col = mix(uDeep * 0.8, uSky, 0.3) * mix(0.3, 1.0, uLight); alpha = 0.75; }
  }
  float f = smoothstep(uFogNear, uFogFar, vFogDepth);
  float sc = max(dot(-V, uSunDir), 0.0);
  col = mix(col, uFogCol + uSunFog * pow(sc, 5.0) * 0.8, f);
  gl_FragColor = vec4(col, alpha);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
