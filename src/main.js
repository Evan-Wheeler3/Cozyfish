// Cozyfish — main game: state, loop, input, interaction, economy, saving.
import * as THREE from 'three';
import {
  SEASONS, ITEMS, RECIPES, SHOP, RODS, AXES, FISH_BY_ID, HOUSE_STAGES, BOAT_NEEDS, QUESTS,
  SPAWN, HOUSE, CENTER, WATER_Y, ICE_Y, DAY_LENGTH,
} from './config.js';
import { Terrain } from './terrain.js';
import { Forest } from './trees.js';
import { Props } from './props.js';
import { Sky } from './sky.js';
import { FX } from './particles.js';
import { Structures } from './structures.js';
import { Player } from './player.js';
import { Fishing } from './fishing.js';
import { Boat } from './boat.js';
import { Life } from './life.js';
import { Audio } from './audio.js';
import { UI } from './ui.js';
import { Touch } from './touch.js';
import { createRenderer, Post } from './render.js';
import { MAT } from './mesher.js';
import * as M from './models.js';

const SAVE_KEY = 'cozyfish-save-v1', SETTINGS_KEY = 'cozyfish-settings-v1';
const SLOTS = ['hands', 'rod', 'axe', 'stone', 'lantern'];
const $ = (id) => document.getElementById(id);

function store(key, val) { try { if (val === undefined) return JSON.parse(localStorage.getItem(key)); localStorage.setItem(key, JSON.stringify(val)); } catch (e) { return null; } }

function newState(season) {
  return {
    v: 1, season, day: 1, time: 9, coins: 0, inv: {},
    tools: { rod: 0, axe: 0, lantern: false }, lanternOn: false,
    house: 0, boat: false, campfires: [], cratesOpened: [], chopped: [],
    journal: {}, quest: 0, warmth: 100, wet: 0,
    stats: { caught: 0, sold: 0, chopped: 0, legendary: 0, bestSkip: 0 },
    pos: null,
  };
}

class Game {
  constructor() {
    this.canvas = $('game');
    this.touch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || ('ontouchstart' in window && navigator.maxTouchPoints > 0);
    if (this.touch) document.body.classList.add('touch');
    this.renderer = createRenderer(this.canvas, { maxDpr: this.touch ? 1.25 : 1.5, preserve: /[?&]test/.test(location.search) });
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(72, innerWidth / innerHeight, 0.05, 700);
    this.scene.add(this.camera);
    this.settings = Object.assign({ sens: 1, fov: 72, music: 0.5, sfx: 0.9, fancy: true, shadows: true, invert: false, pinTask: false, minimap: false }, store(SETTINGS_KEY) || {});
    this.saved = store(SAVE_KEY);
    this.season = this.saved ? this.saved.season : 'summer';
    this.palette = SEASONS[this.season];
    this.state = newState(this.season);
    this.mode = 'title';
    this.input = { keys: new Set(), mouseDX: 0, mouseDY: 0, mouseDown: false };
    this.audio = new Audio();
    this.clock = new THREE.Clock();
    this.time = 0;

    // pooled point lights (fixed count → no shader recompiles)
    const mk = () => { const l = new THREE.PointLight(0xffa050, 0, 16, 1.6); l.userData.base = 0; this.scene.add(l); return l; };
    this.lights = { lantern: mk(), market: mk(), fireplace: mk(), camp1: mk(), camp2: mk() };

    this.terrain = new Terrain(this);
    this.forest = new Forest(this);
    this.props = new Props(this);
    this.sky = new Sky(this);
    this.fx = new FX(this);
    this.structures = new Structures(this);
    this.structures.build();
    this.lights.market.position.set(this.structures.marketLantern.position.x, 11.2, this.structures.marketLantern.position.z - 0.3);
    this.lights.market.userData.base = 6;
    this.player = new Player(this);
    this.fishing = new Fishing(this);
    this.life = new Life(this);
    this.ui = new UI(this);
    if (this.touch) { this.touchCtl = new Touch(this); this.sky.sun.shadow.mapSize.set(1024, 1024); }
    this.post = new Post(this.renderer, this.scene, this.camera, this.sky);
    this.post.hideForOcc = [...this.fx.hide, this.fishing.line];
    this.fx.resize(this.renderer.getSize(new THREE.Vector2()).y * this.renderer.getPixelRatio());

    this.debris = []; this.projectiles = []; this.timers = [];
    this.target = null; this.digT = 0; this.swingCD = 0; this.questT = 0; this.saveT = 30; this.coldWarned = false;
    this.player.spawn(SPAWN.x, 9.01, SPAWN.z, 0);
    this.applySettings();
    this.applySeason(this.season);
    this.bindInput();
    this.setupTitle();
    window.addEventListener('resize', () => this.resize());
    this.tick = this.tick.bind(this);
    this.testMode = /[?&]test/.test(location.search);
    if (this.testMode) this.step(2); else requestAnimationFrame(this.tick);
  }

  // ─── Inventory helpers (used by config quests) ───
  get tools() { return this.state.tools; }
  get stats() { return this.state.stats; }
  get house() { return this.state.house; }
  get boatBuilt() { return this.state.boat; }
  get journal() { return this.state.journal; }
  count(k) { return this.state.inv[k] || 0; }
  add(k, n = 1) { this.state.inv[k] = (this.state.inv[k] || 0) + n; }
  has(needs) { return Object.entries(needs).every(([k, n]) => this.count(k) >= n); }
  remove(needs) { for (const [k, n] of Object.entries(needs)) { this.state.inv[k] = Math.max(0, this.count(k) - n); if (!this.state.inv[k]) delete this.state.inv[k]; } }
  currentBait() { return this.count('lure') > 0 ? 'lure' : this.count('worm') > 0 ? 'worm' : null; }
  paused() { return this.mode !== 'play' || this.ui.isOpen() || this.sleeping; }
  shakeCamera(a) { this.player.shake = Math.max(this.player.shake, a); }

  // ─── Seasons ───
  applySeason(key) {
    this.season = key;
    this.state.season = key;
    this.palette = SEASONS[key];
    const pal = this.palette;
    this.terrain.build(pal);
    this.forest.build(pal);
    this.props.build(pal);
    this.sky.setPalette(pal);
    this.fx.setWeather(pal);
    this.life.build(pal);
    if (this.mode === 'play') this.ui.buildMap();
    // don't leave the player stuck inside new ice
    const p = this.player.pos;
    if (pal.frozen && this.terrain.isPond(p.x, p.z) && p.y < 9) p.y = 9.02;
  }
  setSeason(key) {
    this.applySeason(key);
    if (this.fishing.active()) this.fishing.cancel();
    this.ui.banner(SEASONS[key].name, SEASONS[key].blurb);
  }

  // ─── Title & start ───
  setupTitle() {
    this.ui.selSeason = this.season;
    this.ui.initTitle((k) => { this.audio.init(); this.applySeason(k); }, this.touch);
    if (this.saved) $('btn-continue').classList.remove('hidden');
    $('btn-new').onclick = () => {
      // in-page confirmation (dialogs aren't available everywhere)
      if (this.saved && !this.confirmNew) { this.confirmNew = true; $('btn-new').textContent = 'Start over? Click again'; return; }
      this.start(false);
    };
    $('btn-continue').onclick = () => this.start(true);
    $('resume').onclick = () => this.lock();
  }

  start(cont) {
    this.audio.init();
    this.audio.setVolume('music', this.settings.music); this.audio.setVolume('sfx', this.settings.sfx);
    if (cont && this.saved) this.state = Object.assign(newState(this.saved.season), this.saved);
    else this.state = newState(this.ui.selSeason);
    this.state.stats = Object.assign(newState('summer').stats, this.state.stats);
    this.mode = 'play';
    this.applySeason(this.state.season);
    this.structures.restore();
    this.forest.loadData(this.state.chopped);
    if (this.state.boat) this.spawnBoat();
    const sp = this.state.pos;
    if (sp) this.player.spawn(sp[0], sp[1] + 0.05, sp[2], sp[3]);
    else this.player.spawn(SPAWN.x, 9.01, SPAWN.z, 0);
    this.player.vm.visible = true;
    $('title').classList.add('hidden');
    $('hud').classList.remove('hidden');
    if (this.touchCtl) this.touchCtl.show(true);
    this.ui.buildMap();
    this.selectSlot(SLOTS.indexOf(this.state.tools.rod ? 'rod' : 'hands'));
    this.lock();
    if (!cont) this.ui.banner('Day 1', 'You wake up by a quiet pond in the deep woods…', 4500);
    else this.ui.banner(`Day ${this.state.day}`, `Welcome back. It's ${SEASONS[this.season].name.toLowerCase()} at the pond.`);
    this.announcedQuest = this.state.quest;
    setTimeout(() => this.announceTask(), 5200);
  }

  quitToTitle() { this.saveGame(); location.reload(); }

  // ─── Input ───
  // Mouse capture where it works; touch or blocked capture falls back gracefully.
  lock() {
    if (this.touch || this.noLock || this.mode !== 'play' || this.ui.isOpen()) return;
    const fail = () => { if (!this.everLocked) this.useFreeMouse(); };
    if (!this.canvas.requestPointerLock) return fail();
    try { const p = this.canvas.requestPointerLock(); if (p && p.catch) p.catch(fail); } catch (e) { fail(); }
  }
  useFreeMouse() {
    if (this.noLock || this.mode !== 'play') return;
    this.noLock = true;
    $('resume').classList.add('hidden');
    this.ui.toast(null, 'Mouse capture is blocked here: hold the right button and drag to look. Esc for the menu.');
  }
  get locked() { return (this.touch || this.noLock) ? this.mode === 'play' && !this.ui.isOpen() : document.pointerLockElement === this.canvas; }

  bindInput() {
    const inp = this.input;
    document.addEventListener('pointerlockchange', () => {
      if (this.locked) { this.everLocked = true; $('resume').classList.add('hidden'); this.expectUnlock = false; return; }
      inp.keys.clear(); inp.mouseDown = false;
      if (this.mode === 'play' && !this.ui.isOpen() && !this.expectUnlock) this.ui.openPause();
      this.expectUnlock = false;
    });
    document.addEventListener('pointerlockerror', () => { if (!this.everLocked) this.useFreeMouse(); });
    document.addEventListener('mousemove', (e) => {
      if (this.noLock) { if (this.dragLook && !this.paused()) { inp.mouseDX += e.movementX; inp.mouseDY += e.movementY; } return; }
      if (this.locked) { inp.mouseDX += e.movementX; inp.mouseDY += e.movementY; }
      else if (this.dragLook && this.mode === 'play' && !this.ui.isOpen()) { inp.mouseDX += e.movementX; inp.mouseDY += e.movementY; }
    });
    this.canvas.addEventListener('mousedown', (e) => {
      if (this.mode !== 'play' || this.ui.isOpen()) return;
      if (e.button === 2) this.dragLook = true;
      if (!this.locked) { this.lock(); return; }
    });
    document.addEventListener('mousedown', (e) => {
      if (this.touch || !this.locked || this.paused() || e.target !== this.canvas && !document.pointerLockElement) return;
      if (e.button === 0) { inp.mouseDown = true; this.useDown(); }
    });
    document.addEventListener('mouseup', (e) => {
      this.dragLook = false;
      if (e.button === 0 && inp.mouseDown) { inp.mouseDown = false; this.useUp(); }
    });
    document.addEventListener('contextmenu', (e) => e.preventDefault());
    document.addEventListener('wheel', (e) => {
      if (!this.locked || this.paused()) return;
      const owned = SLOTS.map((s, i) => [s, i]).filter(([s]) => this.slotOwned(s));
      const cur = owned.findIndex(([s]) => s === this.player.held);
      const next = owned[(cur + (e.deltaY > 0 ? 1 : -1) + owned.length) % owned.length];
      if (next) this.selectSlot(next[1]);
    }, { passive: true });
    document.addEventListener('keydown', (e) => {
      if (this.mode !== 'play') return;
      if (e.code === 'Tab') e.preventDefault();
      if (e.repeat && e.code !== 'KeyE') return;
      if (e.code === 'Escape' && this.noLock && !this.ui.isOpen()) { this.ui.openPause(); return; }
      if (this.ui.isOpen()) {
        const j = this.ui.open === 'journal';
        if (e.code === 'Escape' || (e.code === 'Tab' || e.code === 'KeyJ') && j || e.code === 'KeyE' && this.ui.open !== 'pause') this.ui.close();
        return;
      }
      inp.keys.add(e.code);
      if (this.sleeping) return;
      switch (e.code) {
        case 'Tab': this.ui.openJournal('pack'); break;
        case 'KeyJ': this.ui.openJournal(); break;
        case 'KeyE': if (!e.repeat) this.interact(); break;
        case 'KeyF':
          if (this.state.tools.lantern) { this.state.lanternOn = !this.state.lanternOn; this.audio.play('ui'); }
          else this.ui.toast('lantern', 'You need a lantern — Mabel sells them.');
          break;
        default:
          if (e.code.startsWith('Digit')) { const i = parseInt(e.code.slice(5)) - 1; if (i >= 0 && i < SLOTS.length) this.selectSlot(i); }
      }
    });
    document.addEventListener('keyup', (e) => inp.keys.delete(e.code));
    window.addEventListener('blur', () => { inp.keys.clear(); inp.mouseDown = false; });
  }

  onPanelOpened() {
    this.expectUnlock = true;
    if (this.locked) document.exitPointerLock(); else this.expectUnlock = false;
    this.input.keys.clear(); this.input.mouseDown = false;
    if (this.fishing.state === 'charging') this.fishing.cancel();
  }
  onPanelClosed() { this.lock(); }

  slotOwned(s) {
    const t = this.state.tools;
    return s === 'hands' || (s === 'rod' && t.rod > 0) || (s === 'axe' && t.axe > 0) || (s === 'stone' && this.count('stone') > 0) || (s === 'lantern' && t.lantern);
  }
  selectSlot(i) {
    const s = SLOTS[i];
    if (!this.slotOwned(s)) {
      const why = { rod: 'Craft a Stick Rod first (Tab).', axe: 'Craft a Stone Axe first (Tab).', stone: 'Pick up some stones first.', lantern: 'Buy a lantern from Mabel.' }[s];
      if (why) this.ui.toast(null, why);
      return;
    }
    if (s !== 'rod' && this.fishing.active()) this.fishing.cancel();
    this.player.setHeld(s);
    this.audio.play('ui');
  }

  // ─── Using held items ───
  useDown() {
    const p = this.player, held = p.held;
    if (held === 'rod') return this.fishing.onDown();
    if (held === 'stone') return this.throwStone();
    if (held === 'axe' || held === 'hands') {
      if (this.swingCD > 0) return;
      this.swingCD = held === 'axe' ? 0.42 : 0.35;
      p.play('swing');
      this.audio.play('swing');
      const t = this.target;
      if (t && t.kind === 'tree') {
        if (held === 'hands') { this.ui.toast('hands', 'Ouch! You need an axe for that.'); return; }
        this.later(0.13, () => {
          if (!t.tr.alive) return;
          const r = this.forest.hit(t.tr, p.pos, AXES[this.state.tools.axe].hits);
          if (r === 'felled') { this.state.stats.chopped++; this.ui.toast('log', 'Timber!'); }
        });
      }
    }
  }
  later(t, fn) { this.timers.push({ t, fn }); }
  runTimers(dt) {
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      if ((tm.t -= dt) <= 0) { this.timers.splice(i, 1); tm.fn(); }
    }
  }
  useUp() { if (this.player.held === 'rod') this.fishing.onUp(); }

  throwStone() {
    if (this.count('stone') <= 0) return;
    if (this.swingCD > 0) return;
    this.swingCD = 0.5;
    this.remove({ stone: 1 });
    this.player.play('throw');
    this.audio.play('swing');
    const d = this.player.forward(new THREE.Vector3());
    d.y = d.y * 0.6 + 0.04; d.normalize();
    const mesh = new THREE.Mesh(M.stoneGeo(), MAT.vox);
    mesh.scale.setScalar(0.7);
    this.scene.add(mesh);
    const pos = this.camera.position.clone().addScaledVector(d, 0.6).add(new THREE.Vector3(0, -0.2, 0));
    this.projectiles.push({ mesh, pos, vel: d.multiplyScalar(17), skips: 0, slideT: 0, done: false });
    if (this.count('stone') <= 0) this.selectSlot(0);
  }

  updateProjectiles(dt) {
    const t = this.terrain;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const s = this.projectiles[i];
      s.vel.y -= 14 * dt;
      s.pos.addScaledVector(s.vel, dt);
      s.mesh.position.copy(s.pos);
      s.mesh.rotation.y += dt * 20;
      const wy = t.waterY();
      const finish = () => {
        this.scene.remove(s.mesh); this.projectiles.splice(i, 1);
        if (s.skips > 0) {
          const st = this.state.stats;
          const rec = s.skips > st.bestSkip;
          if (rec) st.bestSkip = s.skips;
          this.ui.toast('stone', `${s.skips} skip${s.skips > 1 ? 's' : ''}!${rec && s.skips > 1 ? ' New record!' : ''}`);
        }
      };
      if (t.isPond(s.pos.x, s.pos.z) && !t.hasSolid(Math.floor(s.pos.x), 8, Math.floor(s.pos.z))) {
        if (t.frozen) {
          if (s.pos.y <= ICE_Y + 0.04) {
            if (s.vel.y < -1) this.audio.play('skip');
            s.pos.y = ICE_Y + 0.04; s.vel.y = 0;
            s.vel.multiplyScalar(Math.exp(-0.5 * dt));
            if (s.vel.length() < 0.4) { s.slideT += dt; if (s.slideT > 1.5) { finish(); continue; } }
          }
        } else if (s.pos.y <= wy) {
          const hs = Math.hypot(s.vel.x, s.vel.z);
          if (s.vel.y < 0 && hs > 4 && -s.vel.y / hs < 0.8 && s.skips < 15) {
            s.skips++;
            s.vel.y = -s.vel.y * 0.5 + 0.8; s.vel.x *= 0.82; s.vel.z *= 0.82;
            s.pos.y = wy + 0.01;
            this.fx.ripple(s.pos, 0.7, 1.1); this.fx.splash(s.pos, 5, 0.35);
            this.audio.play('skip');
          } else {
            this.fx.splash(s.pos, 10, 0.5); this.audio.play('plop');
            finish(); continue;
          }
        }
      } else if (t.isSolid(Math.floor(s.pos.x), Math.floor(s.pos.y), Math.floor(s.pos.z)) || s.pos.y < 0) {
        this.audio.play('dig'); finish(); continue;
      }
      if (s.pos.distanceTo(this.player.pos) > 80) { finish(); continue; }
    }
  }

  // ─── Debris (logs, sticks) with simple physics; logs float! ───
  spawnDebris(type, pos, vel) {
    const mesh = new THREE.Mesh(type === 'log' ? M.logGeo() : M.stickGeo(), MAT.vox);
    mesh.castShadow = true;
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.debris.push({ type, mesh, pos: pos.clone(), vel: vel.clone(), spin: new THREE.Vector3((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8), age: 0 });
  }

  updateDebris(dt) {
    const t = this.terrain, pp = this.player.pos;
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.age += dt;
      const dist = Math.hypot(pp.x - d.pos.x, pp.y + 0.8 - d.pos.y, pp.z - d.pos.z);
      if (d.age > 0.8 && dist < 2.4) {
        // magnet toward the player
        const to = new THREE.Vector3(pp.x, pp.y + 0.9, pp.z).sub(d.pos);
        d.pos.addScaledVector(to, Math.min(1, dt * 9));
        d.mesh.position.copy(d.pos); d.mesh.scale.setScalar(Math.max(0.3, Math.min(1, dist / 1.5)));
        if (dist < 0.7) {
          this.add(d.type, 1);
          this.ui.toast(d.type, `+1 ${ITEMS[d.type].name}`);
          this.audio.play('pickup');
          this.scene.remove(d.mesh); this.debris.splice(i, 1);
        }
        continue;
      }
      const inWater = !t.frozen && t.isPond(d.pos.x, d.pos.z) && d.pos.y < WATER_Y;
      if (inWater) {
        if (!d.floating) { d.floating = true; this.fx.splash(d.pos, 8, 0.5); this.audio.play('plop'); }
        d.vel.y += (WATER_Y - 0.12 - d.pos.y) * 25 * dt;
        d.vel.multiplyScalar(Math.exp(-2.2 * dt));
        d.vel.x += Math.sin(this.time * 0.3 + i) * 0.05 * dt;
        d.spin.multiplyScalar(Math.exp(-3 * dt));
        d.mesh.rotation.x += (0 - d.mesh.rotation.x) * dt * 2;
        d.mesh.rotation.z += (0 - d.mesh.rotation.z) * dt * 2;
      } else {
        d.vel.y -= 18 * dt;
        d.floating = false;
      }
      d.pos.addScaledVector(d.vel, dt);
      const fl = t.floorBelow(d.pos.x, d.pos.y + 0.5, d.pos.z) + 0.16;
      if (d.pos.y < fl) {
        d.pos.y = fl;
        if (d.vel.y < -2) this.audio.play('block');
        d.vel.y = Math.abs(d.vel.y) > 1.5 ? -d.vel.y * 0.35 : 0;
        d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.spin.multiplyScalar(0.5);
        d.mesh.rotation.x *= 0.7; d.mesh.rotation.z *= 0.7;
      }
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
      d.mesh.position.copy(d.pos);
      if (d.age > 600) { this.scene.remove(d.mesh); this.debris.splice(i, 1); }
    }
  }

  // ─── Interaction ───
  computeTarget() {
    const o = this.camera.position, dir = this.player.forward(new THREE.Vector3()), p = this.player.pos;
    if (this.player.boat) return { kind: 'struct', s: this.player.boat.inter };
    let best = null, bt = 3.4;
    const v = new THREE.Vector3();
    const test = (x, y, z, r, payload, reach = 3.4) => {
      v.set(x - o.x, y - o.y, z - o.z);
      const t = v.dot(dir);
      if (t < 0 || t > reach || t > bt) return;
      if (v.lengthSq() - t * t < r * r) { best = payload; bt = t; }
    };
    for (const it of this.props.items) {
      if (Math.abs(it.x - p.x) > 5 || Math.abs(it.z - p.z) > 5 || !this.props.available(it)) continue;
      test(it.x, it.y + (it.type === 'bush' ? 0.5 : 0.25), it.z, it.type === 'bush' ? 0.8 : it.type === 'crate' ? 0.7 : 0.55, { kind: 'prop', it });
    }
    for (const tr of this.forest.near(p.x, p.z, 4)) {
      if (!tr.alive) continue;
      test(tr.x + 0.5, Math.max(tr.y + 0.3, Math.min(tr.y + 2.6, o.y)), tr.z + 0.5, 0.62, { kind: 'tree', tr });
    }
    for (const s of this.structures.interactables) {
      if (s.when && !s.when()) continue;
      if (s.pos.distanceTo(o) > 6) continue;
      test(s.pos.x, s.pos.y, s.pos.z, s.r, { kind: 'struct', s }, s.id === 'boat' ? 4.5 : 3.6);
    }
    return best;
  }

  promptFor(t) {
    if (!t) return this.ui.prompt(null);
    if (t.kind === 'prop') {
      const hold = t.it.type === 'mound' ? (this.digT / this.digTime()) : -1;
      return this.ui.prompt(this.props.label(t.it), 'E', this.digT > 0 ? hold : -1);
    }
    if (t.kind === 'tree') {
      if (this.player.held === 'axe') return this.ui.prompt('Chop tree', 'Click');
      if (this.state.tools.axe) return this.ui.prompt('Equip your axe (3) to chop', '');
      return this.ui.prompt('You need an axe to chop trees', '');
    }
    if (t.kind === 'struct') return this.ui.prompt(t.s.label(), 'E');
  }

  digTime() { return this.palette.snow ? 1.6 : 1.0; }

  interact() {
    const t = this.target;
    if (!t) return;
    if (t.kind === 'prop') {
      if (t.it.type === 'mound') return; // handled as a hold in update
      this.harvest(t.it);
    } else if (t.kind === 'struct') {
      if (t.s.passive) return t.s.action();
      t.s.action();
    }
  }

  harvest(it) {
    const loot = this.props.harvest(it);
    if (!loot) return;
    const pos = new THREE.Vector3(it.x, it.y + 0.3, it.z);
    for (const [k, n] of Object.entries(loot)) {
      if (k === 'coins') { this.state.coins += n; this.ui.toast('coin', `+${n} Coins`, 'gold'); this.audio.play('coin'); continue; }
      this.add(k, n);
      this.ui.toast(k, `+${n} ${ITEMS[k].name}`);
    }
    this.audio.play(it.type === 'mound' ? 'dig' : 'pickup');
    const col = { stick: [0x87593a], stone: [0x8f8d88], fiber: [0xb9d27a], bush: [0x3a4fb8, 0x5a9a44], mushroom: [0xc8322a, 0xf2ead8], mound: [0x6a4a30, 0x5a3e28], crate: [0xd8b04a, 0x8a5e38] }[it.type];
    this.fx.burst(pos, col, it.type === 'mound' ? 18 : 8, 2.5, 0.07);
    if (it.type === 'crate') this.fx.sparkle(pos, 0xffe080, 12);
  }

  // ─── Crafting / shop / building ───
  craft(id) {
    const r = RECIPES.find(x => x.id === id);
    if (!r || !this.has(r.needs)) return;
    if (r.gives.tool && this.state.tools[r.gives.tool] >= r.gives.tier) return;
    if (r.gives.place === 'campfire') {
      const p = this.player.pos;
      const x = Math.floor(p.x - Math.sin(this.player.yaw) * 2), z = Math.floor(p.z - Math.cos(this.player.yaw) * 2);
      if (this.terrain.isPond(x, z) || this.terrain.hasSolid(x, this.terrain.H(x, z), z)) { this.ui.toast('flame', "Can't build a fire there. Face some open ground."); return; }
      this.remove(r.needs);
      this.structures.addCampfire(new THREE.Vector3(x, this.terrain.surfaceY(x, z), z));
      this.ui.toast('flame', 'You build a crackling campfire.');
      this.audio.play('craft');
      return;
    }
    this.remove(r.needs);
    if (r.gives.tool) {
      this.state.tools[r.gives.tool] = r.gives.tier;
      this.ui.toast(r.gives.tool + ':1', `Crafted a ${r.name}`);
      if (r.gives.tool === 'rod') this.selectSlot(1);
      if (r.gives.tool === 'axe') this.selectSlot(2);
    } else {
      this.add(r.gives.item, r.gives.qty);
      this.ui.toast(r.gives.item, `Crafted ${r.name}`);
    }
    this.audio.play('craft');
  }

  buy(id) {
    const it = SHOP.find(x => x.id === id), s = this.state;
    if (!it || s.coins < it.price) return;
    s.coins -= it.price;
    if (it.kind === 'rod') { s.tools.rod = it.tier; if (this.player.held === 'rod') this.player.setHeld('rod'); }
    else if (it.kind === 'axe') { s.tools.axe = it.tier; if (this.player.held === 'axe') this.player.setHeld('axe'); }
    else if (it.kind === 'lantern') { s.tools.lantern = true; s.lanternOn = true; }
    else this.add(it.item, it.qty);
    this.ui.toast(it.kind === 'rod' ? 'rod:' + it.tier : it.kind === 'axe' ? 'axe:' + it.tier : it.item || it.id, `Bought ${it.name}`);
    this.audio.play('coin');
  }

  sell(k, n) {
    n = Math.min(n, this.count(k));
    if (n <= 0) return;
    const price = k.startsWith('fish:') ? FISH_BY_ID[k.slice(5)].price : ITEMS[k].sell;
    this.remove({ [k]: n });
    this.state.coins += price * n;
    if (k.startsWith('fish:')) this.state.stats.sold += n;
    this.audio.play('coin');
  }

  buildHouse() {
    const s = this.state, st = HOUSE_STAGES[s.house];
    if (!st || !this.has(st.needs)) return;
    this.remove(st.needs);
    this.ui.close();
    // step back so the blocks don't land on you
    const p = this.player.pos;
    if (p.x > HOUSE.x - 3 && p.x < HOUSE.x + 10 && p.z > HOUSE.z - 2 && p.z < HOUSE.z + 9) { p.set(HOUSE.x - 3.5, 9.01, HOUSE.z + 3.5); this.player.yaw = -Math.PI / 2; this.player.pitch = 0.1; }
    this.structures.buildHouseStage(s.house);
    s.house++;
    this.ui.toast('house', `${st.name} built!`);
    this.saveGame();
  }

  buildBoat() {
    if (this.state.boat || !this.has(BOAT_NEEDS)) return;
    this.remove(BOAT_NEEDS);
    this.state.boat = true;
    this.spawnBoat();
    this.ui.close();
    this.ui.toast('boat', 'Your rowboat is ready at the end of the dock!');
    this.audio.play('craft');
    this.fx.splash(this.boat.pos, 20, 1);
    this.saveGame();
  }

  spawnBoat() {
    const d = this.terrain.dock;
    let x = d.x1 + 2.5, z = d.z0 + 2.5;
    for (let k = 0; k < 20 && !this.terrain.isPond(x, z); k++) z -= 1;
    this.boat = new Boat(this, x, z, 0);
  }

  // ─── Fish ───
  onCatch(f, w) {
    const s = this.state;
    this.add('fish:' + f.id, 1);
    s.stats.caught++;
    if (f.rarity === 'legendary') s.stats.legendary++;
    const j = s.journal[f.id];
    const isNew = !j;
    s.journal[f.id] = { count: (j ? j.count : 0) + 1, best: Math.max(j ? j.best : 0, w) };
    this.ui.showCatch(f, w, isNew);
    if (f.rarity === 'legendary') this.fx.sparkle(this.camera.position.clone().add(this.player.forward(new THREE.Vector3()).multiplyScalar(2)), 0xffd070, 30);
  }

  // ─── Sleep & days ───
  sleep(where) {
    if (this.sleeping) return;
    const h = this.state.time;
    if (h >= 6 && h < 17) { this.ui.toast('moon', "You're not sleepy yet. Come back after 5 pm."); return; }
    this.sleeping = true;
    if (this.fishing.active()) this.fishing.cancel();
    $('fade').classList.add('on');
    this.audio.play('sleep');
    setTimeout(() => {
      if (h >= 17) this.newDay();
      this.state.time = 7;
      this.state.warmth = 100; this.state.wet = 0;
      this.saveGame();
      $('fade').classList.remove('on');
      this.sleeping = false;
      this.ui.banner(`Day ${this.state.day}`, where === 'tent' ? 'The old tent was surprisingly cozy.' : 'Good morning. You slept wonderfully.');
    }, 1600);
  }

  newDay() {
    this.state.day++;
    this.props.dailyReset();
    this.forest.regrow(this.state.day);
  }

  // ─── Saving / settings ───
  saveGame() {
    if (this.mode !== 'play') return;
    const s = this.state, p = this.player.pos;
    s.pos = this.player.boat ? null : [p.x, p.y, p.z, this.player.yaw];
    s.chopped = this.forest.saveData();
    s.season = this.season;
    store(SAVE_KEY, s);
  }

  setSetting(k, v) { this.settings[k] = v; store(SETTINGS_KEY, this.settings); this.applySettings(); }
  applySettings() {
    const s = this.settings;
    this.player.sens = 0.0022 * s.sens;
    this.post.enabled = !!s.fancy;
    this.sky.sun.castShadow = !!s.shadows;
    this.audio.setVolume('music', s.music); this.audio.setVolume('sfx', s.sfx);
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight; this.camera.updateProjectionMatrix();
    this.post.setSize(innerWidth, innerHeight);
    this.fx.resize(innerHeight * this.renderer.getPixelRatio());
  }

  // ─── Main loop ───
  tick() {
    if (this.testMode) return;
    requestAnimationFrame(this.tick);
    this.frame(Math.min(0.05, this.clock.getDelta()), true);
  }

  // Deterministic stepping for automated playtests (?test in the URL).
  step(n = 1, dt = 1 / 30) { for (let i = 0; i < n; i++) this.frame(dt, i === n - 1); }

  frame(dt, render = true) {
    this.time += dt;
    const s = this.state;
    if (this.mode === 'title') {
      const a = this.time * 0.04;
      this.camera.position.set(CENTER + Math.cos(a) * 40, 23 + Math.sin(this.time * 0.1) * 2, CENTER + Math.sin(a) * 40);
      this.camera.lookAt(CENTER, 9, CENTER);
      this.sky.update(dt, 17.55, new THREE.Vector3(CENTER, 9, CENTER));
      if (!this._titleReady) { this._titleReady = true; $('loading').classList.add('hidden'); }
    } else {
      const paused = this.paused();
      if (!paused) {
        s.time += dt * 24 / DAY_LENGTH;
        if (s.time >= 24) { s.time -= 24; this.newDay(); this.ui.banner(`Day ${s.day}`, 'A new day begins under the stars.'); }
        this.swingCD = Math.max(0, this.swingCD - dt);
        this.runTimers(dt);
      }
      this.player.update(dt, this.input, !paused && (this.locked || this.dragLook));
      if (!paused) {
        this.fishing.update(dt, this.input);
        this.updateProjectiles(dt);
        this.updateDebris(dt);
        // interaction target & dig-hold
        this.target = this.computeTarget();
        const t = this.target;
        if (t && t.kind === 'prop' && t.it.type === 'mound' && this.input.keys.has('KeyE')) {
          this.digT += dt;
          if (this.player.anim !== 'dig') this.player.play('dig');
          if (Math.random() < dt * 8) { this.audio.play('dig'); this.fx.burst(new THREE.Vector3(t.it.x, t.it.y + 0.2, t.it.z), [0x6a4a30, 0x5a3e28], 2, 2, 0.06); }
          if (this.digT >= this.digTime()) { this.digT = 0; this.player.anim = null; this.harvest(t.it); }
        } else { if (this.player.anim === 'dig') this.player.anim = null; this.digT = 0; }
        this.promptFor(this.target);
        this.updateWarmth(dt);
        this.questT -= dt;
        if (this.questT < 0) { this.questT = 0.5; this.checkQuests(); }
        this.saveT -= dt;
        if (this.saveT < 0) { this.saveT = 30; this.saveGame(); }
      } else this.ui.prompt(null);
      if (this.boat) this.boat.update(dt, paused ? null : this.input);
      this.ui.update(dt);
      $('resume').classList.toggle('hidden', this.touch || this.noLock || this.locked || this.ui.isOpen() || this.sleeping || !this.everLocked);
      this.sky.update(dt, s.time, this.player.pos);
    }
    this.forest.update(dt);
    this.props.update(dt);
    this.structures.update(dt, this.time);
    this.life.update(dt);
    this.fx.update(dt, this.time);
    this.terrain.update(dt, this.sky);
    this.updateLights(dt);
    if (this.mode === 'play') {
      this.audio.update(dt, {
        season: this.season, underwater: this.player.underwater, frozen: this.terrain.frozen,
        pondDist: Math.max(0, Math.hypot(this.player.pos.x - CENTER, this.player.pos.z - CENTER) - 22),
        nearFire: this.structures.nearFire(this.player.pos, 6), day: this.sky.dayLight, night: this.sky.night,
      });
      if (this.player.underwater) { const f = this.scene.fog; f.color.setRGB(0.08, 0.25, 0.3); f.near = 0.5; f.far = 16; }
    }
    if (render) this.post.render();
  }

  updateLights(dt) {
    const night = this.sky.night, dusk = this.sky.dusk;
    const vis = 0.25 + 0.75 * Math.max(night, dusk * 0.7);
    for (const [k, l] of Object.entries(this.lights)) {
      if (k === 'lantern') continue;
      const f = 1 + Math.sin(this.time * 13 + l.id) * 0.08 + Math.sin(this.time * 7.3 + l.id * 2) * 0.06;
      l.intensity = l.userData.base * vis * (k === 'market' ? 1 : f);
    }
    const L = this.lights.lantern;
    const on = this.mode === 'play' && this.state.tools.lantern && (this.state.lanternOn || this.player.held === 'lantern');
    L.intensity = on ? 4.5 * vis * (1 + Math.sin(this.time * 9) * 0.04) : 0;
    if (on) L.position.copy(this.player.pos).add(new THREE.Vector3(0, 2.6, 0));
  }

  updateWarmth(dt) {
    const s = this.state, pal = this.palette, p = this.player.pos;
    const warmSpot = this.structures.nearFire(p) || this.structures.insideHouse(p);
    if (warmSpot) { s.warmth = Math.min(100, s.warmth + 9 * dt); s.wet = Math.max(0, s.wet - dt / 5); }
    else {
      const chill = pal.chill * (1 + this.sky.night * 0.8) + s.wet * 0.8;
      if (chill > 0.05) s.warmth -= chill * 0.45 * dt;
      else s.warmth = Math.min(100, s.warmth + 0.8 * dt);
      s.wet = Math.max(0, s.wet - dt / (this.season === 'summer' ? 25 : 45));
    }
    s.warmth = Math.max(0, Math.min(100, s.warmth));
    if (s.warmth < 30 && !this.coldWarned) { this.coldWarned = true; this.ui.toast('snowflake', 'Brr! Warm up by a campfire or indoors.'); }
    if (s.warmth > 50) this.coldWarned = false;
  }

  announceTask() {
    const q = QUESTS[this.state.quest];
    if (q && !this.settings.pinTask) this.ui.banner(q.text, this.touch ? 'Tap the book for your journal.' : 'Press J to open your journal.', 4200);
  }

  checkQuests() {
    const s = this.state;
    let q = QUESTS[s.quest];
    while (q && q.done(this)) {
      s.quest++;
      this.ui.toast('book', `Done: ${q.text}`, 'gold');
      this.audio.play('goal');
      q = QUESTS[s.quest];
    }
    if (this.announcedQuest !== s.quest) { this.announcedQuest = s.quest; this.later(2.5, () => this.announceTask()); }
  }
}

window.game = new Game();
