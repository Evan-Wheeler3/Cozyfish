// Fishing: charge & cast, bobber physics, nibbles vs. bites, a tension-based
// reeling fight (rod bends!), ice fishing in winter, and the catch.
import * as THREE from 'three';
import { RODS, FISH, RARITY, POND_MAX_H, WATER_Y } from './config.js';
import { MAT } from './mesher.js';
import * as M from './models.js';

const _tip = new THREE.Vector3(), _d = new THREE.Vector3(), _a = new THREE.Vector3();
const SEG = 28;

export class Fishing {
  constructor(game) {
    this.g = game;
    this.state = 'idle';
    this.power = 0; this.tension = 0; this.dist = 0;
    this.bob = new THREE.Mesh(M.bobberGeo(), MAT.vox);
    this.bob.visible = false;
    game.scene.add(this.bob);
    this.bobPos = new THREE.Vector3(); this.bobVel = new THREE.Vector3();
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SEG * 3), 3));
    this.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf4efe6, transparent: true, opacity: 0.8 }));
    this.line.frustumCulled = false; this.line.visible = false;
    game.scene.add(this.line);
    this.holes = [];
    this.hang = null;
  }

  get rod() { return RODS[this.g.state.tools.rod] || RODS[1]; }
  active() { return this.state !== 'idle'; }

  onDown() {
    const g = this.g, p = g.player;
    switch (this.state) {
      case 'idle':
        if (p.swimming) { g.ui.toast('🏊', "You can't fish while swimming."); return; }
        this.state = 'charging'; this.power = 0; this.chargeT = 0;
        break;
      case 'waiting':
        if (this.nibbleT > 0) { g.ui.toast('🐟', 'Too early! You spooked it.'); this.timer = this.biteTime() + 2; this.nibbleT = 0; }
        else this.reelBack();
        break;
      case 'bite': this.hook(); break;
    }
  }
  onUp() {
    if (this.state === 'charging') this.cast();
  }

  cast() {
    const g = this.g, p = g.player;
    this.tipPos(_tip);
    p.forward(_d);
    _d.y = Math.max(_d.y, -0.15) + 0.32; _d.normalize();
    const speed = 4 + this.power * this.rod.cast * 0.78;
    this.bobPos.copy(_tip);
    this.bobVel.copy(_d).multiplyScalar(speed);
    this.state = 'flying';
    this.bob.visible = true; this.line.visible = true;
    this.bait = g.currentBait();
    p.play('cast');
    g.audio.play('cast');
  }

  tipPos(out) {
    const p = this.g.player;
    if (p.rodTip) { p.rodTip.getWorldPosition(out); }
    else out.copy(this.g.camera.position);
    return out;
  }

  biteTime() {
    const g = this.g, sky = g.sky;
    let t = 4 + Math.random() * 9;
    if (!this.bait) t *= 2.4; else if (this.bait === 'lure') t *= 0.8;
    if (sky.dusk > 0.4) t *= 0.75; // fish feed at golden hour
    if (g.terrain.frozen) t *= 1.15;
    return t;
  }

  pickFish() {
    const g = this.g, t = g.terrain;
    const season = g.season, night = g.sky.night > 0.5, tier = g.state.tools.rod;
    const deep = t.H(this.bobPos.x, this.bobPos.z) <= POND_MAX_H - 4;
    const list = [];
    for (const f of FISH) {
      if (f.seasons !== 'all' && !f.seasons.includes(season)) continue;
      if (f.night === true && !night) continue;
      if (f.deep && !deep) continue;
      if ((f.minTier || 1) > tier) continue;
      let w = RARITY[f.rarity].weight;
      if (!this.bait) { if (f.rarity === 'junk') w *= 4; if (f.rarity === 'rare' || f.rarity === 'legendary') w *= 0.15; }
      if (this.bait === 'lure') { if (f.rarity === 'uncommon') w *= 1.4; if (f.rarity === 'rare' || f.rarity === 'legendary') w *= 2; if (f.rarity === 'junk') w *= 0.5; }
      if (f.rarity === 'rare' || f.rarity === 'legendary') w *= 1 + this.rod.rare;
      if (f.night === 'bonus' && night) w *= 2.5;
      if (deep && (f.rarity === 'uncommon' || f.rarity === 'rare')) w *= 1.3;
      list.push([f, w]);
    }
    let sum = list.reduce((s, [, w]) => s + w, 0), r = Math.random() * sum;
    for (const [f, w] of list) { r -= w; if (r <= 0) return f; }
    return list[0][0];
  }

  hook() {
    const g = this.g;
    if (this.bait) g.remove({ [this.bait]: 1 });
    this.state = 'fight';
    this.tension = 0.3; this.overT = 0; this.slackT = 0;
    this.pulling = true; this.pullT = 0.6;
    this.stamina = this.maxStamina = 3 + this.fish.strength * 7;
    const p = g.player.pos;
    this.dist = this.startDist = Math.hypot(this.bobPos.x - p.x, this.bobPos.z - p.z);
    this.lateral = 0; this.latTarget = 0;
    g.audio.play('splash', 0.8);
    g.fx.splash(this.bobPos, 18, 0.8);
    g.ui.toast('🎣', 'Hooked! Hold to reel — ease off when it pulls.');
  }

  reelBack() { this.state = 'reelback'; this.ui(); }

  endCatch(success) {
    this.state = 'reelback';
  }

  cancel() {
    this.state = 'idle';
    this.bob.visible = false; this.line.visible = false;
    if (this.hang) { this.g.scene.remove(this.hang); this.hang = null; }
    this.g.ui.fishing(null);
  }

  makeIceHole(pos) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.32, 12), new THREE.MeshBasicMaterial({ color: 0x1d3a52 }));
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, this.g.terrain.waterY() + 0.015, pos.z);
    this.g.scene.add(m);
    this.holes.push(m);
    if (this.holes.length > 6) this.g.scene.remove(this.holes.shift());
    this.g.fx.burst(m.position, [0xe8f4ff, 0xc8dcec], 14, 2.5, 0.07);
  }

  ui() {
    const st = this.state;
    if (st === 'idle') return this.g.ui.fishing(null);
    this.g.ui.fishing({
      state: st, power: this.power, tension: this.tension,
      progress: st === 'fight' ? 1 - Math.max(0, (this.dist - 1.6) / Math.max(1, this.startDist - 1.6)) : 0,
      danger: this.overT > 0, bait: this.bait,
    });
  }

  update(dt, input) {
    const g = this.g, p = g.player, t = g.terrain;
    if (this.state === 'idle') return;
    if (p.held !== 'rod' || (p.swimming && this.state !== 'reelback')) { this.cancel(); return; }
    const wy = t.waterY();
    this.tipPos(_tip);

    switch (this.state) {
      case 'charging':
        this.chargeT += dt;
        this.power = Math.min(1, this.chargeT / 1.1);
        break;
      case 'flying': {
        this.bobVel.y -= 13 * dt;
        this.bobVel.multiplyScalar(Math.exp(-0.25 * dt));
        this.bobPos.addScaledVector(this.bobVel, dt);
        const ix = Math.floor(this.bobPos.x), iy = Math.floor(this.bobPos.y), iz = Math.floor(this.bobPos.z);
        if (this.bobPos.y <= wy && t.isPond(this.bobPos.x, this.bobPos.z) && !t.hasSolid(ix, 8, iz)) {
          this.bobPos.y = wy;
          if (t.frozen) { this.makeIceHole(this.bobPos); g.audio.play('dig'); }
          else { g.fx.splash(this.bobPos, 10, 0.6); g.audio.play('plop'); }
          this.state = 'waiting'; this.timer = this.biteTime(); this.nibbleT = 0; this.nextNibble = 1 + Math.random() * 2;
          this.bait = g.currentBait();
          if (!this.bait) g.ui.toast('🪱', 'No bait… bites will be slow. Dig worms from dirt mounds.');
        } else if (t.isSolid(ix, iy, iz) || this.bobPos.y < 0) {
          g.ui.toast('🎣', 'Cast into the water!');
          this.reelBack();
        }
        break;
      }
      case 'waiting': {
        this.timer -= dt;
        this.nibbleT = Math.max(0, this.nibbleT - dt);
        this.nextNibble -= dt;
        if (this.nextNibble < 0 && this.timer > 1) {
          this.nextNibble = 1.5 + Math.random() * 3;
          this.nibbleT = 0.3;
          g.audio.play('nibble');
          g.fx.ripple(this.bobPos, 0.4, 0.7);
        }
        const dip = this.nibbleT > 0 ? Math.sin(this.nibbleT * 20) * 0.05 : 0;
        this.bobPos.y = wy + Math.sin(performance.now() / 600) * 0.02 - Math.abs(dip);
        if (this.timer <= 0) {
          this.state = 'bite';
          this.fish = this.pickFish();
          this.biteT = this.rod.window;
          g.audio.play('bite');
          if (!t.frozen) g.fx.splash(this.bobPos, 8, 0.5);
        }
        const pp = p.pos;
        if (Math.hypot(pp.x - this.bobPos.x, pp.z - this.bobPos.z) > this.rod.cast + 14) { g.ui.toast('🎣', 'You walked too far — reeled in.'); this.reelBack(); }
        break;
      }
      case 'bite':
        this.biteT -= dt;
        this.bobPos.y = wy - 0.18 + Math.sin(this.biteT * 30) * 0.03;
        if (this.biteT <= 0) {
          g.ui.toast('🐟', 'It got away… wait for the next bite.');
          this.state = 'waiting'; this.timer = this.biteTime(); this.nextNibble = 2;
        }
        break;
      case 'fight': this.fight(dt, input, wy); break;
      case 'caught': {
        this.caughtT -= dt;
        if (this.hang) {
          this.hang.position.copy(_tip).add(_a.set(0, -0.45, 0));
          this.hang.rotation.set(0, g.player.yaw + Math.PI / 2, -Math.PI / 2 + Math.sin(performance.now() / 70) * 0.35);
        }
        this.bobPos.copy(_tip).add(_a.set(0, -0.15, 0));
        if (this.caughtT <= 0) {
          g.scene.remove(this.hang); this.hang = null;
          this.state = 'idle'; this.bob.visible = false; this.line.visible = false;
          g.onCatch(this.fish, this.weight);
        }
        break;
      }
      case 'reelback': {
        _d.copy(_tip).sub(this.bobPos);
        const L = _d.length();
        if (L < 0.4) { this.cancel(); return; }
        this.bobPos.addScaledVector(_d.normalize(), Math.min(L, dt * 28));
        if (Math.random() < dt * 12) g.audio.play('reel');
        break;
      }
    }
    this.bob.position.copy(this.bobPos);
    this.updateLine(_tip);
    this.ui();
    if (this.state === 'fight' && input.mouseDown) { if (p.anim !== 'reel') p.play('reel'); } else if (p.anim === 'reel') p.anim = null;
  }

  fight(dt, input, wy) {
    const g = this.g, f = this.fish, rod = this.rod, p = g.player.pos;
    this.pullT -= dt;
    if (this.pullT <= 0) {
      this.pulling = !this.pulling;
      this.pullT = this.pulling ? 0.5 + Math.random() * 1.3 * (0.5 + f.strength) : 0.7 + Math.random() * 1.3 * (1.2 - f.strength);
      if (this.pulling) { this.latTarget = (Math.random() - 0.5) * 1.4; if (!g.terrain.frozen) { g.fx.splash(this.bobPos, 12, 0.7); g.audio.play('splash', 0.5); } }
    }
    const sf = Math.max(0, this.stamina / this.maxStamina);
    const pull = this.pulling ? f.strength * (0.45 + 0.55 * sf) : 0.08 * f.strength;
    const reeling = input.mouseDown;
    const target = (reeling ? 0.42 : 0.06) + pull * (reeling ? 0.95 : 0.45) / rod.strength * 1.25;
    this.tension += (target - this.tension) * Math.min(1, dt * 5) + (this.pulling ? (Math.random() - 0.5) * 0.03 : 0);
    this.tension = Math.max(0, Math.min(1.1, this.tension));
    if (reeling) {
      this.dist -= rod.reel * Math.max(0.15, this.pulling ? 1 - 0.8 * pull / rod.strength : 1) * dt;
      if (Math.random() < dt * 14) g.audio.play('reel');
    } else if (this.pulling) this.dist += pull * 2.4 * dt;
    this.dist = Math.min(this.dist, this.startDist + 6);
    this.stamina -= dt * (reeling ? 1 : 0.5);
    if (this.tension > 0.93) this.overT += dt; else this.overT = Math.max(0, this.overT - dt * 2);
    if (!reeling && !this.pulling) this.slackT += dt; else this.slackT = 0;

    // move the bobber / fish
    if (!g.terrain.frozen) {
      _d.set(this.bobPos.x - p.x, 0, this.bobPos.z - p.z);
      if (_d.lengthSq() < 0.01) _d.set(0, 0, -1);
      _d.normalize();
      this.lateral += (this.latTarget * (this.pulling ? 1 : 0.2) - this.lateral) * dt * 1.5;
      const ang = Math.atan2(_d.z, _d.x) + this.lateral * dt;
      let nx = p.x + Math.cos(ang) * this.dist, nz = p.z + Math.sin(ang) * this.dist;
      if (!g.terrain.isPond(nx, nz)) { nx = this.bobPos.x; nz = this.bobPos.z; }
      this.bobPos.set(nx, wy - 0.12 + Math.sin(performance.now() / 90) * 0.04, nz);
      if (Math.random() < dt * 3) g.fx.ripple(this.bobPos, 0.6, 0.8);
    } else this.bobPos.y = wy - 0.1 + Math.sin(performance.now() / 60) * 0.03 * (this.pulling ? 1 : 0.2);

    const flatDist = Math.hypot(this.bobPos.x - p.x, this.bobPos.z - p.z);
    if (this.overT > 0.75) {
      g.audio.play('snap');
      g.ui.toast('💥', `Snap! The line broke — the ${f.rarity === 'junk' ? 'junk' : 'fish'} got away.`);
      this.cancel();
    } else if (this.slackT > 3.5) {
      g.ui.toast('🐟', 'Too much slack — it slipped the hook.');
      this.reelBack();
    } else if (this.dist < 1.6 || (g.terrain.frozen && this.dist < 1.6) || flatDist < 1.2) {
      this.state = 'caught'; this.caughtT = 1.4;
      this.weight = +(f.w[0] + Math.pow(Math.random(), 1.6) * (f.w[1] - f.w[0])).toFixed(2);
      this.hang = new THREE.Mesh(M.fishGeo(f), MAT.vox);
      this.hang.scale.setScalar(1);
      g.scene.add(this.hang);
      g.audio.play(f.rarity === 'legendary' ? 'legendary' : 'catch');
      if (!g.terrain.frozen) g.fx.splash(this.bobPos, 20, 1);
      if (f.glow) g.fx.sparkle(this.bobPos, 0xfff0a0, 20);
    }
  }

  updateLine(tip) {
    const pos = this.line.geometry.attributes.position.array;
    const b = this.bobPos;
    const dist = tip.distanceTo(b);
    let sag = 0;
    if (this.state === 'waiting' || this.state === 'bite') sag = Math.min(1.5, dist * 0.09);
    else if (this.state === 'fight') sag = (1 - Math.min(1, this.tension)) * dist * 0.06;
    else if (this.state === 'flying') sag = dist * 0.03;
    for (let i = 0; i < SEG; i++) {
      const k = i / (SEG - 1);
      pos[i * 3] = tip.x + (b.x - tip.x) * k;
      pos[i * 3 + 1] = tip.y + (b.y + 0.12 - tip.y) * k - Math.sin(k * Math.PI) * sag;
      pos[i * 3 + 2] = tip.z + (b.z - tip.z) * k;
    }
    this.line.geometry.attributes.position.needsUpdate = true;
  }
}
