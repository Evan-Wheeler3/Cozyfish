// Particles: voxel debris & splashes, glowing embers & fireflies, ripples,
// and seasonal weather (petals, pollen, leaves, snow).
import * as THREE from 'three';
import { WATER_Y } from './config.js';

const VS = `
attribute vec3 color; attribute float size; uniform float uScale;
varying vec3 vColor;
void main(){
  vColor = color;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_PointSize = size * uScale / max(0.1, -mv.z);
  gl_Position = projectionMatrix * mv;
}`;
const FS_SOLID = `
uniform vec3 uLight; varying vec3 vColor;
void main(){
  gl_FragColor = vec4(vColor * uLight, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
const FS_GLOW = `
varying vec3 vColor;
void main(){
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.0, d);
  gl_FragColor = vec4(vColor * a * a * 2.5, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;

class Pool {
  constructor(n, glow, shared) {
    this.n = n;
    this.pos = new Float32Array(n * 3); this.col = new Float32Array(n * 3); this.size = new Float32Array(n);
    this.vel = new Float32Array(n * 3); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.grav = new Float32Array(n); this.base = new Float32Array(n); this.drag = new Float32Array(n);
    this.i = 0;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3).setUsage(THREE.DynamicDrawUsage));
    g.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    this.geo = g;
    const mat = new THREE.ShaderMaterial({
      uniforms: glow ? { uScale: shared.uScale } : { uScale: shared.uScale, uLight: shared.uLight },
      vertexShader: VS, fragmentShader: glow ? FS_GLOW : FS_SOLID,
      transparent: glow, depthWrite: !glow, blending: glow ? THREE.AdditiveBlending : THREE.NormalBlending,
    });
    this.points = new THREE.Points(g, mat);
    this.points.frustumCulled = false;
  }
  spawn(p, v, c, size, life, grav = 9, drag = 0.5) {
    const i = this.i; this.i = (this.i + 1) % this.n;
    this.pos.set([p.x, p.y, p.z], i * 3); this.vel.set([v.x, v.y, v.z], i * 3);
    this.col.set(c, i * 3); this.size[i] = size; this.base[i] = size;
    this.life[i] = life; this.max[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt, terrain) {
    for (let i = 0; i < this.n; i++) {
      if (this.life[i] <= 0) { if (this.size[i]) this.size[i] = 0; continue; }
      this.life[i] -= dt;
      const o = i * 3;
      this.vel[o + 1] -= this.grav[i] * dt;
      const k = Math.exp(-this.drag[i] * dt);
      this.vel[o] *= k; this.vel[o + 1] *= k; this.vel[o + 2] *= k;
      this.pos[o] += this.vel[o] * dt; this.pos[o + 1] += this.vel[o + 1] * dt; this.pos[o + 2] += this.vel[o + 2] * dt;
      const f = this.life[i] / this.max[i];
      this.size[i] = this.base[i] * Math.min(1, f * 3);
      if (this.grav[i] > 0 && terrain) {
        const fl = terrain.H(this.pos[o], this.pos[o + 2]);
        if (this.pos[o + 1] < fl) { this.pos[o + 1] = fl; this.vel[o + 1] *= -0.3; this.vel[o] *= 0.5; this.vel[o + 2] *= 0.5; }
      }
    }
    this.geo.attributes.position.needsUpdate = true;
    this.geo.attributes.color.needsUpdate = true;
    this.geo.attributes.size.needsUpdate = true;
  }
}

const _v = new THREE.Vector3(), _c = new THREE.Color();
function rgb(hex) { _c.setHex(hex); return [_c.r, _c.g, _c.b]; }

export class FX {
  constructor(game) {
    this.g = game;
    this.shared = { uScale: { value: 400 }, uLight: { value: new THREE.Color(1, 1, 1) } };
    this.solid = new Pool(1600, false, this.shared);
    this.glow = new Pool(700, true, this.shared);
    game.scene.add(this.solid.points, this.glow.points);

    // ripples
    this.ripples = [];
    const rg = new THREE.RingGeometry(0.86, 1, 28); rg.rotateX(-Math.PI / 2);
    for (let i = 0; i < 28; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false; m.renderOrder = 3;
      game.scene.add(m);
      this.ripples.push({ m, t: 0, dur: 1, size: 1 });
    }
    this.ri = 0;

    // weather
    this.wN = 900;
    this.weather = new Pool(this.wN, false, this.shared);
    this.flies = new Pool(110, true, this.shared);
    game.scene.add(this.weather.points, this.flies.points);
    this.wSeed = new Float32Array(this.wN);
    for (let i = 0; i < this.wN; i++) this.wSeed[i] = Math.random() * 100;
    this.kind = null;
    this.hide = [this.solid.points, this.glow.points, this.weather.points, this.flies.points, ...this.ripples.map(r => r.m)];
  }

  resize(h) { this.shared.uScale.value = h * 0.5; }

  burst(pos, colors, n = 12, speed = 3, size = 0.1) {
    for (let i = 0; i < n; i++) {
      const c = rgb(colors[i % colors.length]);
      _v.set((Math.random() - 0.5) * 2, Math.random() * 1.2 + 0.3, (Math.random() - 0.5) * 2).normalize().multiplyScalar(speed * (0.4 + Math.random() * 0.8));
      this.solid.spawn(pos, _v, c, size * (0.6 + Math.random() * 0.8), 0.6 + Math.random() * 0.8, 12, 1.2);
    }
  }
  splash(pos, n = 16, power = 1) {
    const water = this.g.palette && this.g.palette.water ? this.g.palette.water[0] : 0x4aa3a8;
    for (let i = 0; i < n; i++) {
      const c = rgb(i % 3 ? 0xe8f6ff : water);
      _v.set((Math.random() - 0.5) * 2.2, 2.5 + Math.random() * 3, (Math.random() - 0.5) * 2.2).multiplyScalar(power);
      this.solid.spawn(pos, _v, c, 0.06 + Math.random() * 0.06, 0.5 + Math.random() * 0.4, 14, 0.8);
    }
    this.ripple(pos, 1.2 * power);
  }
  ripple(pos, size = 1, dur = 1.3) {
    const r = this.ripples[this.ri]; this.ri = (this.ri + 1) % this.ripples.length;
    const wy = this.g.terrain.waterY();
    r.m.position.set(pos.x, wy + 0.03, pos.z); r.t = 0; r.dur = dur; r.size = size; r.m.visible = true;
  }
  ember(pos) {
    _v.set((Math.random() - 0.5) * 0.4, 1.2 + Math.random() * 1.2, (Math.random() - 0.5) * 0.4);
    this.glow.spawn(pos, _v, rgb(Math.random() < 0.5 ? 0xff9a30 : 0xffd060), 0.07, 1 + Math.random(), -0.2, 0.6);
  }
  smoke(pos) {
    _v.set((Math.random() - 0.5) * 0.3, 0.9 + Math.random() * 0.4, (Math.random() - 0.5) * 0.3);
    const l = 0.35 + Math.random() * 0.15;
    this.solid.spawn(pos, _v, [l, l, l * 1.05], 0.14 + Math.random() * 0.1, 2.2, -0.15, 0.3);
  }
  sparkle(pos, hex = 0xfff0b0, n = 10) {
    for (let i = 0; i < n; i++) {
      _v.set((Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2);
      this.glow.spawn(pos, _v, rgb(hex), 0.12, 0.8 + Math.random() * 0.5, 1, 1.5);
    }
  }

  setWeather(pal) {
    this.kind = pal.weather;
    this.nightKind = pal.night;
    const W = this.weather;
    const palettes = {
      snow: [0xffffff, 0xf0f6ff], petals: [0xf6b8d0, 0xffe4ee, 0xffffff], leaves: [0xdb6a2c, 0xe9a73b, 0xb8422a, 0xd8b040],
      pollen: [0xfff6c8, 0xffffff],
    };
    const cols = palettes[this.kind] || [0xffffff];
    const count = Math.round(({ snow: 900, petals: 260, leaves: 320, pollen: 160 }[this.kind] || 0) * (this.density || 1));
    const p = this.g.camera.position;
    for (let i = 0; i < this.wN; i++) {
      const o = i * 3;
      W.pos[o] = p.x + (Math.random() - 0.5) * 40; W.pos[o + 1] = p.y + (Math.random() - 0.3) * 24; W.pos[o + 2] = p.z + (Math.random() - 0.5) * 40;
      W.col.set(rgb(cols[i % cols.length]), o);
      const base = this.kind === 'snow' ? 0.07 + Math.random() * 0.05 : this.kind === 'pollen' ? 0.04 : 0.09 + Math.random() * 0.04;
      W.base[i] = i < count ? base : 0;
      W.size[i] = W.base[i];
    }
    for (let i = 0; i < this.flies.n; i++) { this.flies.col.set(rgb(0xd8ff70), i * 3); this.flies.size[i] = 0; }
  }

  update(dt, time) {
    const g = this.g, sky = g.sky;
    this.shared.uLight.value.setRGB(1, 1, 1).multiplyScalar(0.35 + 0.65 * sky.dayLight);
    this.solid.update(dt, g.terrain);
    this.glow.update(dt, null);
    for (const r of this.ripples) {
      if (!r.m.visible) continue;
      r.t += dt;
      const k = r.t / r.dur;
      if (k >= 1) { r.m.visible = false; continue; }
      const s = r.size * (0.2 + k * 1.3);
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = (1 - k) * 0.45 * (0.4 + 0.6 * sky.dayLight);
    }
    // weather: drift around the camera and wrap
    const W = this.weather, cp = g.camera.position, k = this.kind;
    const fall = { snow: 1.1, petals: 0.55, leaves: 0.9, pollen: -0.05 }[k] || 0;
    const sway = { snow: 0.4, petals: 1.2, leaves: 1.0, pollen: 0.5 }[k] || 0;
    for (let i = 0; i < this.wN; i++) {
      if (!W.base[i]) continue;
      const o = i * 3, s = this.wSeed[i];
      W.pos[o] += (Math.sin(time * 0.9 + s) * sway + 0.4) * dt;
      W.pos[o + 1] -= (fall + Math.sin(s) * 0.15) * dt;
      W.pos[o + 2] += Math.cos(time * 0.7 + s * 1.3) * sway * dt;
      if (k === 'pollen') W.pos[o + 1] += Math.sin(time * 0.5 + s) * 0.1 * dt;
      // wrap into a 40×24×40 box around the camera
      if (W.pos[o] < cp.x - 20) W.pos[o] += 40; else if (W.pos[o] > cp.x + 20) W.pos[o] -= 40;
      if (W.pos[o + 2] < cp.z - 20) W.pos[o + 2] += 40; else if (W.pos[o + 2] > cp.z + 20) W.pos[o + 2] -= 40;
      if (W.pos[o + 1] < cp.y - 8) W.pos[o + 1] += 24; else if (W.pos[o + 1] > cp.y + 16) W.pos[o + 1] -= 24;
      // leaves & petals flutter (size flicker reads as tumbling)
      W.size[i] = W.base[i] * ((k === 'leaves' || k === 'petals') ? 0.6 + Math.abs(Math.sin(time * 3 + s)) * 0.5 : 1);
      // hide flakes indoors / underground
      if (W.pos[o + 1] < g.terrain.H(W.pos[o], W.pos[o + 2])) W.size[i] = 0;
    }
    W.geo.attributes.position.needsUpdate = true; W.geo.attributes.size.needsUpdate = true; W.geo.attributes.color.needsUpdate = true;

    // fireflies at dusk/night in spring & summer
    const F = this.flies;
    const on = this.nightKind === 'fireflies' ? Math.max(sky.night, sky.dusk * 0.6) : 0;
    for (let i = 0; i < F.n; i++) {
      const o = i * 3;
      if (!F.max[i] || F.pos[o] < cp.x - 26 || F.pos[o] > cp.x + 26 || F.pos[o + 2] < cp.z - 26 || F.pos[o + 2] > cp.z + 26) {
        const x = cp.x + (Math.random() - 0.5) * 50, z = cp.z + (Math.random() - 0.5) * 50;
        F.pos[o] = x; F.pos[o + 2] = z; F.pos[o + 1] = g.terrain.surfaceY(x, z) + 0.5 + Math.random() * 2.5;
        if (g.terrain.isPond(x, z)) F.pos[o + 1] = WATER_Y + 0.6 + Math.random() * 1.5;
        F.max[i] = Math.random() * 100;
      }
      const s = F.max[i];
      F.pos[o] += Math.sin(time * 0.6 + s) * 0.4 * dt;
      F.pos[o + 1] += Math.sin(time * 0.9 + s * 2) * 0.2 * dt;
      F.pos[o + 2] += Math.cos(time * 0.5 + s) * 0.4 * dt;
      const blink = Math.max(0, Math.sin(time * (0.8 + (s % 1)) + s * 7));
      F.size[i] = on * 0.16 * Math.pow(blink, 3);
    }
    F.geo.attributes.position.needsUpdate = true; F.geo.attributes.size.needsUpdate = true; F.geo.attributes.color.needsUpdate = true;
  }
}
