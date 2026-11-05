// Greedy-free but face-culled voxel mesher with baked ambient occlusion
// and per-voxel colour jitter — the core of the cozy voxel look.
import * as THREE from 'three';
import { hash3 } from './noise.js';

// Face table: normal + 4 corners (CCW from outside). Side faces are ordered
// [bottom0, top0, top1, bottom1] so they can be split for grass "caps".
const FACES = [
  { n: [1, 0, 0], c: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },
  { n: [-1, 0, 0], c: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },
  { n: [0, 1, 0], c: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { n: [0, -1, 0], c: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { n: [0, 0, 1], c: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },
  { n: [0, 0, -1], c: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },
];
// Precompute AO sample offsets per face corner.
for (const f of FACES) {
  const axis = f.n[0] ? 0 : f.n[1] ? 1 : 2;
  const tang = [0, 1, 2].filter(a => a !== axis);
  f.ao = f.c.map(c => {
    const s1 = [...f.n], s2 = [...f.n], cc = [...f.n];
    const su = c[tang[0]] ? 1 : -1, sv = c[tang[1]] ? 1 : -1;
    s1[tang[0]] += su; s2[tang[1]] += sv; cc[tang[0]] += su; cc[tang[1]] += sv;
    return [s1, s2, cc];
  });
  f.side = f.n[1] === 0;
}
const AO = [0.52, 0.7, 0.86, 1.0];

const _lin = new Map();
export function lin(hex) {
  let v = _lin.get(hex);
  if (!v) { const c = new THREE.Color(hex); v = [c.r, c.g, c.b]; _lin.set(hex, v); }
  return v;
}
export function mixHex(a, b, t) {
  const A = lin(a), B = lin(b);
  return [A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t];
}

export class VoxelMesher {
  constructor(s = 1, ox = 0, oy = 0, oz = 0) {
    this.s = s; this.ox = ox; this.oy = oy; this.oz = oz;
    this.pos = []; this.nor = []; this.col = []; this.idx = []; this.vc = 0;
    this.capFrac = 0.3;
  }

  // solid(x,y,z) → bool, in the same integer grid as x,y,z.
  add(x, y, z, r, g, b, solid, cap = null, skipBottom = false) {
    for (let fi = 0; fi < 6; fi++) {
      const f = FACES[fi];
      if (skipBottom && fi === 3) continue;
      if (solid(x + f.n[0], y + f.n[1], z + f.n[2])) continue;
      const a = [0, 0, 0, 0];
      for (let k = 0; k < 4; k++) {
        const [s1, s2, cc] = f.ao[k];
        const o1 = solid(x + s1[0], y + s1[1], z + s1[2]) ? 1 : 0;
        const o2 = solid(x + s2[0], y + s2[1], z + s2[2]) ? 1 : 0;
        const o3 = solid(x + cc[0], y + cc[1], z + cc[2]) ? 1 : 0;
        a[k] = (o1 && o2) ? 0 : 3 - (o1 + o2 + o3);
      }
      const P = f.c.map(c => [x + c[0], y + c[1], z + c[2]]);
      if (cap && f.side) {
        const t = 1 - this.capFrac;
        const m0 = [P[0][0], y + t, P[0][2]], m1 = [P[3][0], y + t, P[3][2]];
        const am0 = AO[a[0]] + (AO[a[1]] - AO[a[0]]) * t, am1 = AO[a[3]] + (AO[a[2]] - AO[a[3]]) * t;
        this.quad([P[0], m0, m1, P[3]], f.n, [AO[a[0]], am0, am1, AO[a[3]]], r, g, b, false);
        this.quad([m0, P[1], P[2], m1], f.n, [am0, AO[a[1]], AO[a[2]], am1], cap[0], cap[1], cap[2], false);
      } else if (cap && fi === 2) {
        const flip = a[0] + a[2] < a[1] + a[3];
        this.quad(P, f.n, [AO[a[0]], AO[a[1]], AO[a[2]], AO[a[3]]], cap[0], cap[1], cap[2], flip);
      } else {
        const flip = a[0] + a[2] < a[1] + a[3];
        this.quad(P, f.n, [AO[a[0]], AO[a[1]], AO[a[2]], AO[a[3]]], r, g, b, flip);
      }
    }
  }

  quad(P, n, ao, r, g, b, flip) {
    const s = this.s, base = this.vc;
    for (let k = 0; k < 4; k++) {
      this.pos.push(P[k][0] * s + this.ox, P[k][1] * s + this.oy, P[k][2] * s + this.oz);
      this.nor.push(n[0], n[1], n[2]);
      const l = ao[k];
      this.col.push(r * l, g * l, b * l);
    }
    if (flip) this.idx.push(base + 1, base + 2, base + 3, base + 1, base + 3, base);
    else this.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    this.vc += 4;
  }

  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setIndex(this.vc > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    g.computeBoundingBox();
    return g;
  }
}

// A sparse voxel model: set(x,y,z,hex) then build().
export class VoxelModel {
  constructor() { this.map = new Map(); }
  static key(x, y, z) { return ((x + 512) * 1024 + (y + 512)) * 1024 + (z + 512); }
  set(x, y, z, hex) { this.map.set(VoxelModel.key(x, y, z), [x, y, z, hex]); return this; }
  del(x, y, z) { this.map.delete(VoxelModel.key(x, y, z)); }
  has(x, y, z) { return this.map.has(VoxelModel.key(x, y, z)); }
  get(x, y, z) { return this.map.get(VoxelModel.key(x, y, z)); }
  box(x0, y0, z0, x1, y1, z1, hex) {
    for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
      this.set(x, y, z, typeof hex === 'function' ? hex(x, y, z) : hex);
    }
    return this;
  }
  get size() { return this.map.size; }
  values() { return this.map.values(); }
  // s: voxel size; offset applied in world units after scaling
  build(s = 1, ox = 0, oy = 0, oz = 0, jitter = 0.08, seed = 1) {
    const m = new VoxelMesher(s, ox, oy, oz);
    const solid = (x, y, z) => this.has(x, y, z);
    for (const [x, y, z, hex] of this.map.values()) {
      const c = Array.isArray(hex) ? hex : lin(hex);
      const j = 1 + (hash3(x, y, z, seed) - 0.5) * jitter * 2;
      m.add(x, y, z, c[0] * j, c[1] * j, c[2] * j, solid);
    }
    return m.geometry();
  }
}

// Shared uniforms for the "shader pack" look (updated each frame by Sky).
export const SHARED = {
  uTime: { value: 0 },
  uSunView: { value: new THREE.Vector3(0, 1, 0) },   // sun direction in view space
  uSunFog: { value: new THREE.Color(1, 0.7, 0.4) },  // haze colour toward the sun
  uScatter: { value: 0.5 },
  uWind: { value: 1 },
};

// Voxel material with: pixel-grain texel detail, sun-scattering haze and
// optional wind sway (leaves / grass). Clean "Minecraft shaders" vibe.
export function voxMat(opts = {}) {
  const { vertexColors = true, texels = 8, amount = 0.2, sway = 0, swayFrom = 2, swayTo = 6, roughness = 0.92 } = opts;
  const mat = new THREE.MeshStandardMaterial({ vertexColors, roughness, metalness: 0 });
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, SHARED);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform float uTime; uniform float uWind;
        varying vec3 vGrainW; varying vec3 vGrainN; varying vec3 vHazeView;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        ${sway > 0 ? `{
          vec4 sw = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
            sw = instanceMatrix * sw;
          #endif
          sw = modelMatrix * sw;
          float k = smoothstep(${swayFrom.toFixed(2)}, ${swayTo.toFixed(2)}, transformed.y) * ${sway.toFixed(3)} * uWind;
          float ph = sw.x * 0.35 + sw.z * 0.27;
          transformed.x += (sin(uTime * 1.7 + ph) + sin(uTime * 3.1 + ph * 2.3) * 0.35) * k;
          transformed.z += cos(uTime * 1.3 + ph * 1.2) * k * 0.7;
        }` : ''}`)
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 gW = vec4(transformed, 1.0);
        vec3 gN = objectNormal;
        #ifdef USE_INSTANCING
          gW = instanceMatrix * gW; gN = mat3(instanceMatrix) * gN;
        #endif
        vGrainW = (modelMatrix * gW).xyz; vGrainN = normalize(mat3(modelMatrix) * gN);
        vHazeView = mvPosition.xyz;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSunView; uniform vec3 uSunFog; uniform float uScatter;
        varying vec3 vGrainW; varying vec3 vGrainN; varying vec3 vHazeView;
        float gHash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 gp = floor(vGrainW * ${texels.toFixed(1)} - vGrainN * 0.02);
          float gn = gHash(gp);
          float gn2 = gHash(floor(gp * 0.5) + 7.0);
          diffuseColor.rgb *= 1.0 + ((gn - 0.5) * ${amount.toFixed(3)} + (gn2 - 0.5) * ${(amount * 0.6).toFixed(3)});
        }`)
      .replace('#include <fog_fragment>', `
        #ifdef USE_FOG
          float hazeF = smoothstep(fogNear, fogFar, vFogDepth);
          float sc = max(dot(normalize(vHazeView), uSunView), 0.0);
          vec3 hz = mix(fogColor, uSunFog, (pow(sc, 5.0) * 0.8 + pow(sc, 40.0) * 0.6) * uScatter);
          gl_FragColor.rgb = mix(gl_FragColor.rgb, hz, hazeF);
        #endif`);
  };
  mat.customProgramCacheKey = () => ['vox', vertexColors, texels, amount, sway, swayFrom, swayTo].join('|');
  return mat;
}

export const MAT = {
  vox: voxMat(),
  inst: voxMat({ vertexColors: false, roughness: 0.88 }),
  tree: voxMat({ sway: 0.07, swayFrom: 2.5, swayTo: 9 }),
  plant: voxMat({ sway: 0.06, swayFrom: 0.05, swayTo: 0.9 }),
};

export function glowMat(hex, intensity = 2.5) {
  const m = new THREE.MeshBasicMaterial({ color: hex });
  m.color.multiplyScalar(intensity);
  m.toneMapped = true;
  return m;
}

export function boxMesh(w, h, d, hex, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }));
  return m;
}
