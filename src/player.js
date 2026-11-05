// First-person player: voxel AABB physics, step-up, swimming, head-bob,
// footsteps, and the held-item view model (arm + rod/axe/stone/lantern).
import * as THREE from 'three';
import { WATER_Y, RODS } from './config.js';
import { glowMat } from './mesher.js';
import * as M from './models.js';
import { MAT } from './mesher.js';

const R = 0.3, HGT = 1.75, EYE = 1.58;

function box(w, h, d, hex, mat) {
  return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat || new THREE.MeshStandardMaterial({ color: hex, roughness: 0.85 }));
}

export class Player {
  constructor(game) {
    this.g = game;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0;
    this.onGround = false; this.inWater = false; this.swimming = false; this.underwater = false;
    this.stepSmooth = 0; this.bobT = 0; this.lastStep = 0; this.shake = 0;
    this.boat = null;
    this.held = 'hands';
    this.anim = null; this.animT = 0;
    this.sens = 0.0022;
    this.swimT = 0;
    this.vm = new THREE.Group();
    this.vm.position.set(0.3, -0.3, -0.5);
    this.vm.scale.setScalar(0.85);
    game.camera.add(this.vm);
    this.vm.visible = false; // shown once play starts
    this.setHeld('hands');
  }

  spawn(x, y, z, yaw = 0) {
    this.pos.set(x, y, z); this.vel.set(0, 0, 0); this.yaw = yaw; this.pitch = 0;
  }

  // ─── View model ──────────────────────────────────────────
  setHeld(kind) {
    this.held = kind;
    this.vm.clear();
    this.rodTip = null; this.rodSegs = null; this.tool = null; this.reel = null;
    const skin = 0xf0c8a0, sleeve = new THREE.MeshStandardMaterial({ color: 0xa83a2a, roughness: 0.9 });
    const arm = new THREE.Group();
    const sl = box(0.13, 0.13, 0.42, 0, sleeve); sl.position.set(0, -0.02, 0.18);
    const cuff = box(0.14, 0.14, 0.05, 0x6a2a20); cuff.position.set(0, -0.02, -0.02);
    const hand = box(0.11, 0.11, 0.12, skin); hand.position.set(0, -0.01, -0.09);
    arm.add(sl, cuff, hand);
    arm.rotation.x = 0.15;
    this.vm.add(arm);
    this.arm = arm;
    const g = this.g;
    if (kind === 'rod') {
      const tier = g.state.tools.rod, spec = RODS[tier];
      const mat = new THREE.MeshStandardMaterial({ color: spec.color, roughness: tier >= 3 ? 0.4 : 0.8, metalness: tier === 4 ? 0.6 : 0 });
      const acc = new THREE.MeshStandardMaterial({ color: spec.accent, roughness: 0.5 });
      const base = new THREE.Group();
      base.position.set(0, 0.0, -0.1);
      base.rotation.x = -1.22;
      base.rotation.z = 0.12;
      arm.add(base);
      const reel = box(0.07, 0.07, 0.07, 0, acc); reel.position.set(-0.06, 0.06, 0.02);
      base.add(reel);
      this.reel = reel;
      let parent = base;
      this.rodSegs = [];
      const n = 6, L = 0.27;
      for (let i = 0; i < n; i++) {
        const seg = new THREE.Group();
        if (i > 0) seg.position.y = L;
        const w = 0.04 - i * 0.004;
        const m = box(w, L, w, 0, i % 2 && tier > 1 ? acc : mat); m.position.y = L / 2;
        seg.add(m);
        parent.add(seg);
        this.rodSegs.push(seg);
        parent = seg;
      }
      const tip = new THREE.Object3D(); tip.position.y = L; parent.add(tip);
      this.rodTip = tip;
    } else if (kind === 'axe') {
      const tier = g.state.tools.axe;
      const head = tier >= 2 ? 0xb8bcc4 : 0x8a8884;
      const ax = new THREE.Group();
      const handle = box(0.05, 0.5, 0.05, 0x8a5e38); handle.position.y = 0.2;
      const h = box(0.05, 0.11, 0.16, head, new THREE.MeshStandardMaterial({ color: head, roughness: tier >= 2 ? 0.35 : 0.9, metalness: tier >= 2 ? 0.7 : 0 }));
      h.position.set(0, 0.4, -0.06);
      const bind = box(0.07, 0.06, 0.07, 0xd8c39a); bind.position.y = 0.36;
      ax.add(handle, h, bind);
      ax.position.set(0, 0, -0.1); ax.rotation.x = 0.25;
      ax.userData.rx = 0.25;
      arm.add(ax);
      this.tool = ax;
    } else if (kind === 'stone') {
      const s = new THREE.Mesh(M.stoneGeo(), MAT.vox);
      s.position.set(0, 0.02, -0.12); s.scale.setScalar(0.8);
      arm.add(s);
    } else if (kind === 'lantern') {
      const lan = new THREE.Group();
      const frame = new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 0.6, metalness: 0.4 });
      const top = box(0.14, 0.03, 0.14, 0, frame); top.position.y = 0.2;
      const bot = box(0.14, 0.03, 0.14, 0, frame); bot.position.y = 0.0;
      const glass = box(0.1, 0.16, 0.1, 0, glowMat(0xffb050, 3.5)); glass.position.y = 0.1;
      const handle = box(0.02, 0.08, 0.02, 0, frame); handle.position.y = 0.26;
      lan.add(top, bot, glass, handle);
      lan.position.set(0, -0.22, -0.12);
      arm.add(lan);
      this.lantern = glass;
    }
  }

  play(anim) { this.anim = anim; this.animT = 0; }

  // ─── Physics ────────────────────────────────────────────
  collides(px, py, pz) {
    const t = this.g.terrain;
    const x0 = Math.floor(px - R), x1 = Math.floor(px + R), z0 = Math.floor(pz - R), z1 = Math.floor(pz + R);
    const y0 = Math.floor(py), y1 = Math.floor(py + HGT - 0.01);
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) for (let y = y0; y <= y1; y++) if (t.isSolid(x, y, z)) return true;
    return false;
  }

  moveAxis(axis, d) {
    if (d === 0) return;
    const p = this.pos;
    const steps = Math.ceil(Math.abs(d) / 0.3);
    const sd = d / steps;
    for (let s = 0; s < steps; s++) {
      p[axis] += sd;
      if (!this.collides(p.x, p.y, p.z)) continue;
      if (axis !== 'y' && (this.onGround || this.inWater) && !this.collides(p.x, p.y + 1.02, p.z)) {
        // step up one block (smoothed for the camera)
        const ny = Math.floor(p.y) + 1.001;
        if (ny - p.y <= 1.05 && !this.collides(p.x, ny, p.z)) { this.stepSmooth -= ny - p.y; p.y = ny; continue; }
      }
      p[axis] -= sd;
      if (axis === 'y') {
        if (d < 0) { this.onGround = true; p.y = Math.max(p.y, Math.floor(p.y + 0.001)); }
        this.vel.y = 0;
      } else this.vel[axis] = 0;
      break;
    }
  }

  update(dt, input, active) {
    const g = this.g, t = g.terrain, cam = g.camera;
    if (active) {
      this.yaw -= input.mouseDX * this.sens;
      this.pitch -= input.mouseDY * this.sens * (g.settings.invert ? -1 : 1);
      this.pitch = Math.max(-1.5, Math.min(1.5, this.pitch));
    }
    input.mouseDX = 0; input.mouseDY = 0;

    if (this.boat) {
      this.boat.seat(this.pos);
      this.vel.set(0, 0, 0);
      this.inWater = false; this.swimming = false; this.onGround = true;
    } else {
      const k = active ? input.keys : new Set();
      const ax = active && input.axis ? input.axis : { x: 0, y: 0 };
      const f = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) + ax.y;
      const s = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0) + ax.x;
      const sin = Math.sin(this.yaw), cos = Math.cos(this.yaw);
      let wx = -sin * f + cos * s, wz = -cos * f - sin * s;
      const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }

      const wy = t.waterY();
      const pond = !t.frozen && t.isPond(this.pos.x, this.pos.z);
      const depth = pond ? wy - this.pos.y : 0;
      this.inWater = depth > 0.15;
      this.swimming = depth > 1.05;
      if (this.inWater) g.state.wet = 1;
      const sprint = k.has('ShiftLeft') || k.has('ShiftRight') || (active && input.run);
      let speed = this.swimming ? (sprint ? 3.6 : 2.6) : sprint ? 6.6 : 4.3;
      if (this.inWater && !this.swimming) speed *= 0.7;
      if (g.state.warmth < 20) speed *= 0.78;
      const accel = this.onGround ? 16 : this.swimming ? 5 : 4;
      const kk = 1 - Math.exp(-accel * dt);
      this.vel.x += (wx * speed - this.vel.x) * kk;
      this.vel.z += (wz * speed - this.vel.z) * kk;

      if (this.swimming) {
        const target = wy - 1.4; // float with eyes just above the surface
        if (k.has('KeyC') || k.has('ControlLeft')) this.vel.y -= 9 * dt;
        else if (k.has('Space')) this.vel.y += 9 * dt;
        else this.vel.y += (target - this.pos.y) * 7 * dt;
        this.vel.y *= Math.exp(-2.5 * dt);
        this.vel.y -= 1 * dt;
        this.swimT -= dt;
        if (wl > 0.1 && this.swimT < 0) { this.swimT = 0.9; g.audio.play('swim'); g.fx.ripple(this.pos, 0.8); }
      } else {
        this.vel.y -= (this.inWater ? 18 : 26) * dt;
        if (k.has('Space') && this.onGround) { this.vel.y = this.inWater ? 6 : 8.2; this.onGround = false; }
        if (this.inWater && k.has('Space') && depth > 0.6) this.vel.y = Math.max(this.vel.y, 3);
      }
      if (this.vel.y < -40) this.vel.y = -40;

      const wasGround = this.onGround;
      this.onGround = false;
      this.moveAxis('x', this.vel.x * dt);
      this.moveAxis('z', this.vel.z * dt);
      this.moveAxis('y', this.vel.y * dt);
      if (!this.onGround && wasGround && this.vel.y <= 0 && this.collides(this.pos.x, this.pos.y - 0.06, this.pos.z)) this.onGround = true;
      if (this.pos.y < 0) this.pos.y = 20;

      // footsteps & bob
      const hs = Math.hypot(this.vel.x, this.vel.z);
      if (this.onGround && hs > 0.5) {
        this.bobT += dt * hs * 1.7;
        const step = Math.floor(this.bobT / Math.PI);
        if (step !== this.lastStep) {
          this.lastStep = step;
          const under = Math.floor(this.pos.y - 0.5);
          const surf = this.inWater ? 'water' : t.hasSolid(Math.floor(this.pos.x), under, Math.floor(this.pos.z)) ? 'wood' : g.palette.snow ? 'snow' : 'grass';
          g.audio.play('step', surf);
        }
      } else this.bobT += (Math.round(this.bobT / Math.PI) * Math.PI - this.bobT) * Math.min(1, dt * 6);
    }

    // camera
    this.stepSmooth *= Math.exp(-14 * dt);
    if (Math.abs(this.stepSmooth) < 0.001) this.stepSmooth = 0;
    const bob = this.boat ? 0 : Math.sin(this.bobT * 2) * 0.045;
    this.shake = Math.max(0, this.shake - dt);
    const sh = this.shake * 0.25;
    cam.position.set(this.pos.x + (Math.random() - 0.5) * sh, this.pos.y + EYE + this.stepSmooth + bob + (Math.random() - 0.5) * sh, this.pos.z);
    cam.rotation.set(this.pitch, this.yaw, 0, 'YXZ');
    const sprinting = (input.keys.has('ShiftLeft') || input.run) && Math.hypot(this.vel.x, this.vel.z) > 5;
    const fov = (g.settings.fov || 72) + (sprinting ? 6 : 0);
    if (Math.abs(cam.fov - fov) > 0.05) { cam.fov += (fov - cam.fov) * Math.min(1, dt * 8); cam.updateProjectionMatrix(); }
    const wy = t.waterY();
    this.underwater = !t.frozen && cam.position.y < wy - 0.02 && t.isPond(cam.position.x, cam.position.z);

    this.updateViewModel(dt, input);
  }

  updateViewModel(dt, input) {
    const a = this.arm; if (!a) return;
    const hs = Math.hypot(this.vel.x, this.vel.z);
    const sway = Math.sin(this.bobT) * 0.012 * Math.min(1, hs / 4);
    let rx = 0.15, ry = 0, rz = 0, px = sway, py = Math.abs(Math.cos(this.bobT)) * 0.012 * Math.min(1, hs / 4), pz = 0;
    if (this.anim) {
      this.animT += dt;
      const t = this.animT;
      if (this.anim === 'swing') {
        const k = Math.min(1, t / 0.32);
        const s = Math.sin(k * Math.PI);
        // wind up then chop: the tool arcs, the arm only nudges forward
        const arc = k < 0.3 ? -k / 0.3 * 0.5 : -0.5 + (k - 0.3) / 0.7 * 2.0;
        if (this.tool) this.tool.rotation.x = this.tool.userData.rx - Math.sin(Math.min(1, k) * Math.PI) * 1.3;
        rx += -s * 0.25 + (k < 0.3 ? arc * 0.2 : 0); pz -= s * 0.1; py += s * 0.03; rz += s * 0.15;
        if (k >= 1) { this.anim = null; if (this.tool) this.tool.rotation.x = this.tool.userData.rx; }
      } else if (this.anim === 'cast') {
        const k = Math.min(1, t / 0.45);
        const back = k < 0.35 ? k / 0.35 : 1 - (k - 0.35) / 0.65;
        rx += back * 0.9 - (k > 0.35 ? Math.sin((k - 0.35) / 0.65 * Math.PI) * 0.6 : 0);
        if (k >= 1) this.anim = null;
      } else if (this.anim === 'throw') {
        const k = Math.min(1, t / 0.35);
        rx += (k < 0.4 ? k / 0.4 * 1.2 : 1.2 - (k - 0.4) / 0.6 * 2);
        pz -= Math.sin(k * Math.PI) * 0.1;
        if (k >= 1) this.anim = null;
      } else if (this.anim === 'dig') {
        rx += -0.6 - Math.abs(Math.sin(t * 12)) * 0.4; py -= 0.05;
      } else if (this.anim === 'reel') {
        if (this.reel) this.reel.rotation.x += dt * 20;
        rx += 0.1 + Math.sin(t * 20) * 0.02;
      }
    }
    if (this.held === 'rod') {
      const f = this.g.fishing;
      if (f.state === 'charging') rx += f.power * 0.7;
      if (f.state === 'fight') rx += 0.25;
      // bend the rod with line tension
      const bend = f.state === 'fight' ? f.tension * 0.22 : f.state === 'bite' ? 0.08 : 0;
      if (this.rodSegs) this.rodSegs.forEach((s, i) => { s.rotation.x += ((i > 0 ? -bend * (0.4 + i * 0.25) : 0) - s.rotation.x) * Math.min(1, dt * 10); });
    }
    a.rotation.x += (rx - a.rotation.x) * Math.min(1, dt * 18);
    a.rotation.y = ry; a.rotation.z += (rz - a.rotation.z) * Math.min(1, dt * 18);
    a.position.set(px, py, pz);
  }

  forward(out = new THREE.Vector3()) { return this.g.camera.getWorldDirection(out); }
}
