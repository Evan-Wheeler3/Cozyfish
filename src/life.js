// Ambient pond life: ducks (with ducklings in spring) and jumping fish.
import * as THREE from 'three';
import { WATER_Y, FISH } from './config.js';
import { MAT } from './mesher.js';
import * as M from './models.js';

export class Life {
  constructor(game) {
    this.g = game;
    this.ducks = [];
    this.jumpT = 5;
    this.jumper = null;
  }

  build(pal) {
    const g = this.g;
    for (const d of this.ducks) g.scene.remove(d.mesh);
    this.ducks = [];
    if (pal.frozen) return;
    const cells = g.terrain.pondCells.filter(([x, z]) => g.terrain.H(x, z) <= 6);
    const families = pal.key === 'fall' ? 1 : 2;
    for (let f = 0; f < families; f++) {
      const [cx, cz] = cells[Math.floor(Math.random() * cells.length)];
      const mom = this.addDuck(false, cx + 0.5, cz + 0.5, null);
      if (pal.key === 'spring') {
        let lead = mom;
        for (let i = 0; i < 3; i++) lead = this.addDuck(true, cx + 0.5, cz + 1 + i * 0.4, lead);
      }
    }
  }

  addDuck(baby, x, z, follow) {
    const mesh = new THREE.Mesh(M.duckGeo(baby), MAT.vox);
    mesh.castShadow = true;
    this.g.scene.add(mesh);
    const d = { mesh, baby, pos: new THREE.Vector3(x, WATER_Y, z), heading: Math.random() * 6, speed: 0, target: null, follow, t: Math.random() * 10, quackT: 5 + Math.random() * 20 };
    this.ducks.push(d);
    return d;
  }

  update(dt) {
    const g = this.g, t = g.terrain;
    for (const d of this.ducks) {
      d.t += dt;
      let tx, tz;
      if (d.follow) { tx = d.follow.pos.x - Math.sin(d.follow.heading) * -0.5; tz = d.follow.pos.z - Math.cos(d.follow.heading) * -0.5; }
      else {
        if (!d.target || d.pos.distanceTo(d.target) < 0.8 || Math.random() < dt * 0.05) {
          const cells = t.pondCells;
          const [cx, cz] = cells[Math.floor(Math.random() * cells.length)];
          if (t.H(cx, cz) <= 7) d.target = new THREE.Vector3(cx + 0.5, WATER_Y, cz + 0.5);
        }
        // shy: paddle away from the player
        const p = g.player.pos;
        if (Math.hypot(p.x - d.pos.x, p.z - d.pos.z) < 4) d.target = new THREE.Vector3(d.pos.x * 2 - p.x, WATER_Y, d.pos.z * 2 - p.z);
        tx = d.target ? d.target.x : d.pos.x; tz = d.target ? d.target.z : d.pos.z;
      }
      const want = Math.atan2(-(tx - d.pos.x), -(tz - d.pos.z));
      let dh = want - d.heading; dh = Math.atan2(Math.sin(dh), Math.cos(dh));
      d.heading += dh * Math.min(1, dt * 2);
      const dist = Math.hypot(tx - d.pos.x, tz - d.pos.z);
      const sp = Math.min(d.follow ? 1.4 : 0.9, dist * 0.8);
      const nx = d.pos.x - Math.sin(d.heading) * sp * dt, nz = d.pos.z - Math.cos(d.heading) * sp * dt;
      if (t.isPond(nx, nz) && t.H(nx, nz) <= 7 && !t.hasSolid(Math.floor(nx), 8, Math.floor(nz))) { d.pos.x = nx; d.pos.z = nz; }
      else d.target = null;
      d.mesh.position.set(d.pos.x, WATER_Y - 0.06 + Math.sin(d.t * 2) * 0.015, d.pos.z);
      d.mesh.rotation.y = d.heading + Math.PI;
      if (!d.baby) { d.quackT -= dt; if (d.quackT < 0) { d.quackT = 10 + Math.random() * 25; if (g.player.pos.distanceTo(d.pos) < 25) g.audio.play('quack'); } }
      if (sp > 0.3 && Math.random() < dt * 0.8) g.fx.ripple(d.pos, 0.35, 1.2);
    }

    // fish jumping — a hint of what's below
    if (!t.frozen) {
      this.jumpT -= dt;
      if (this.jumpT < 0 && !this.jumper) {
        this.jumpT = 6 + Math.random() * 12;
        const cells = t.pondCells.filter(([x, z]) => t.H(x, z) <= 6);
        const [x, z] = cells[Math.floor(Math.random() * cells.length)];
        const options = FISH.filter(f => f.len && f.rarity !== 'legendary' && (f.seasons === 'all' || f.seasons.includes(g.season)));
        const f = options[Math.floor(Math.random() * options.length)];
        const mesh = new THREE.Mesh(M.fishGeo(f), MAT.vox);
        g.scene.add(mesh);
        const a = Math.random() * Math.PI * 2;
        this.jumper = { mesh, x: x + 0.5, z: z + 0.5, a, t: 0 };
        g.fx.splash(new THREE.Vector3(x + 0.5, WATER_Y, z + 0.5), 8, 0.5);
        if (g.player.pos.distanceTo(new THREE.Vector3(x, WATER_Y, z)) < 30) g.audio.play('fishjump');
      }
      const j = this.jumper;
      if (j) {
        j.t += dt;
        const k = j.t / 0.8;
        const px = j.x + Math.cos(j.a) * k * 1.4, pz = j.z + Math.sin(j.a) * k * 1.4;
        j.mesh.position.set(px, WATER_Y + Math.sin(k * Math.PI) * 0.9 - 0.1, pz);
        j.mesh.rotation.set(0, -j.a, Math.cos(k * Math.PI) * 0.9);
        if (k >= 1) {
          g.fx.splash(new THREE.Vector3(px, WATER_Y, pz), 10, 0.5);
          g.scene.remove(j.mesh); this.jumper = null;
        }
      }
    }
  }
}
