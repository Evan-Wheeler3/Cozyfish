// A little rowboat: bobbing buoyancy, rowing with oars, shore collisions.
import * as THREE from 'three';
import { WATER_Y, ICE_Y, POND_MAX_H } from './config.js';
import { MAT } from './mesher.js';
import * as M from './models.js';

const _v = new THREE.Vector3();

export class Boat {
  constructor(game, x, z, heading = 0) {
    this.g = game;
    this.pos = new THREE.Vector3(x, WATER_Y, z);
    this.heading = heading; this.vel = new THREE.Vector2(); this.angVel = 0;
    this.t = Math.random() * 10; this.rowT = 0; this.thrust = 0;
    this.group = new THREE.Group();
    const hull = new THREE.Mesh(M.boatGeo(), MAT.vox);
    hull.position.set(0.125, 0, 0); // centre the hull (geometry runs z: -2..2)
    hull.rotation.y = Math.PI;      // bow faces local -z (forward)
    hull.castShadow = hull.receiveShadow = true;
    this.group.add(hull);
    this.oars = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.78, 0.75, 0.6);
      const oar = new THREE.Mesh(M.oarGeo(), MAT.vox);
      oar.rotation.z = side > 0 ? -0.45 : Math.PI + 0.45;
      oar.castShadow = true;
      pivot.add(oar);
      this.group.add(pivot);
      this.oars.push({ pivot, side });
    }
    game.scene.add(this.group);
    this.inter = { id: 'boat', pos: this.pos.clone(), r: 1.7, label: () => this.g.player.boat ? 'Step out of the boat' : 'Get in the boat', action: () => this.toggle() };
    game.structures.interactables.push(this.inter);
    this.update(0);
  }

  toggle() {
    const g = this.g, p = g.player;
    if (p.boat) {
      // step out onto the nearest dry spot (or into the water)
      let best = null, bd = 1e9;
      for (let a = 0; a < 16; a++) for (const r of [1.6, 2.4, 3.2]) {
        const x = this.pos.x + Math.cos(a / 16 * Math.PI * 2) * r, z = this.pos.z + Math.sin(a / 16 * Math.PI * 2) * r;
        const y = g.terrain.surfaceY(x, z);
        if (y >= 9 && !p.collides(x, y, z) && r < bd) { bd = r; best = [x, y, z]; }
      }
      p.boat = null;
      if (best) p.pos.set(best[0], best[1] + 0.01, best[2]);
      else p.pos.set(this.pos.x + Math.cos(this.heading) * 1.5, WATER_Y - 1, this.pos.z - Math.sin(this.heading) * 1.5);
      g.ui.toast('boat', 'You hop out of the boat.');
    } else {
      if (g.terrain.frozen) { g.ui.toast('snowflake', 'The boat is frozen into the ice until spring.'); return; }
      p.boat = this;
      g.ui.toast('boat', g.touch ? 'Joystick to row. Tap E to get out. You can fish from here.' : 'W/S to row, A/D to turn, E to get out. You can fish from here.');
    }
  }

  seat(out) {
    _v.set(0, 0.35, 0.1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading);
    out.set(this.pos.x + _v.x, this.group.position.y + 0.2, this.pos.z + _v.z);
  }

  blocked(x, z) {
    const t = this.g.terrain;
    if (t.H(x, z) > POND_MAX_H) return true;
    if (t.hasSolid(Math.floor(x), 8, Math.floor(z))) return true; // the dock
    return false;
  }

  update(dt, input) {
    const g = this.g, frozen = g.terrain.frozen;
    this.t += dt;
    const driving = g.player.boat === this && input && !g.paused();
    let thrust = 0, turn = 0;
    if (driving && !frozen) {
      const k = input.keys;
      const ax = input.axis || { x: 0, y: 0 };
      thrust = Math.max(-0.6, Math.min(1, (k.has('KeyW') ? 1 : 0) - (k.has('KeyS') ? 0.6 : 0) + ax.y));
      turn = Math.max(-1, Math.min(1, (k.has('KeyA') ? 1 : 0) - (k.has('KeyD') ? 1 : 0) - ax.x));
      if (Math.abs(thrust) < 0.15) thrust = 0;
      if (Math.abs(turn) < 0.15) turn = 0;
    }
    const fwd = new THREE.Vector2(-Math.sin(this.heading), -Math.cos(this.heading));
    this.vel.addScaledVector(fwd, thrust * 3.2 * dt);
    this.angVel += turn * 1.8 * dt;
    this.vel.multiplyScalar(Math.exp(-0.7 * dt));
    this.angVel *= Math.exp(-2.6 * dt);
    this.heading += this.angVel * dt;
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.y * dt;
    // probe hull corners
    const pts = [[0, -1.9], [0, 1.9], [-0.8, 0], [0.8, 0], [-0.6, -1.3], [0.6, -1.3], [-0.6, 1.3], [0.6, 1.3]];
    let hit = false;
    for (const [lx, lz] of pts) {
      const c = Math.cos(this.heading), s = Math.sin(this.heading);
      const wx = nx + lx * c + lz * s, wz = nz - lx * s + lz * c;
      if (this.blocked(wx, wz)) { hit = true; break; }
    }
    if (hit) {
      if (this.vel.length() > 1.2) { g.audio.play('thud'); g.fx.splash(this.pos, 8, 0.5); }
      this.vel.multiplyScalar(-0.3);
    } else { this.pos.x = nx; this.pos.z = nz; }

    const wy = frozen ? ICE_Y : WATER_Y;
    this.thrust += (thrust - this.thrust) * Math.min(1, dt * 3);
    this.group.position.set(this.pos.x, wy - 0.42 + (frozen ? 0.1 : Math.sin(this.t * 1.4) * 0.05), this.pos.z);
    const roll = frozen ? 0 : Math.sin(this.t * 0.9) * 0.035 - this.angVel * 0.12;
    const pitch = frozen ? 0 : Math.sin(this.t * 1.15) * 0.025 - this.thrust * 0.04;
    this.group.rotation.set(pitch, this.heading, roll, 'YXZ');

    // oars: row when moving
    const rowing = Math.abs(thrust) > 0 || Math.abs(turn) > 0;
    if (rowing) this.rowT += dt * 4.5;
    for (const o of this.oars) {
      const ph = this.rowT + (turn !== 0 && thrust === 0 ? (o.side * turn > 0 ? 0 : Math.PI) : 0);
      o.pivot.rotation.y = rowing ? Math.sin(ph) * 0.6 * o.side : 0;
      o.pivot.rotation.z = rowing ? Math.max(0, Math.cos(ph)) * 0.25 * o.side : 0;
    }
    if (rowing && Math.floor(this.rowT / Math.PI) !== this.lastStroke) {
      this.lastStroke = Math.floor(this.rowT / Math.PI);
      if (Math.cos(this.rowT) > 0) {
        g.audio.play('row');
        for (const o of this.oars) { const w = new THREE.Vector3(2.2 * o.side, 0, 0.6).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.heading).add(this.pos); g.fx.ripple(w, 0.7); }
      }
    }
    if (this.vel.length() > 1 && Math.random() < dt * 4) g.fx.ripple(new THREE.Vector3(this.pos.x, wy, this.pos.z), 1.4, 1.6);
    this.inter.pos.set(this.pos.x, wy + 0.4, this.pos.z);
  }
}
