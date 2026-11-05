// UI: a quiet HUD (hotbar, prompt, contextual meters) and a leather field
// journal for everything else. All icons are rendered voxel models.
import { SEASONS, SEASON_ORDER, ITEMS, RECIPES, SHOP, FISH, FISH_BY_ID, RARITY, HOUSE_STAGES, BOAT_NEEDS, RODS, AXES, QUESTS, N, MARKET, HOUSE, CAMP } from './config.js';
import { Icons } from './icons.js';

const $ = (id) => document.getElementById(id);
const SEASON_ICON = { spring: 'blossom', summer: 'sun', fall: 'leaf', winter: 'snowflake' };
const SLOT_ICON = (g, s) => s === 'rod' ? 'rod:' + (g.state.tools.rod || 1) : s === 'axe' ? 'axe:' + (g.state.tools.axe || 1) : s;

export function itemName(key) { return key.startsWith('fish:') ? FISH_BY_ID[key.slice(5)].name : ITEMS[key] ? ITEMS[key].name : key; }
function itemPrice(key) { return key.startsWith('fish:') ? FISH_BY_ID[key.slice(5)].price : ITEMS[key] ? ITEMS[key].sell : 0; }
function stars(r) { const n = RARITY[r].stars; return `<span class="stars r-${r}">${n ? '★'.repeat(n) : '·'} ${RARITY[r].label}</span>`; }
const RECIPE_ICON = { rod1: 'rod:1', axe1: 'axe:1', rope: 'rope', plank: 'plank', campfire: 'campfire' };
const shopIcon = (it) => it.kind === 'rod' ? 'rod:' + it.tier : it.kind === 'axe' ? 'axe:' + it.tier : it.item || it.id;

const MABEL_LINES = [
  "Well hello, dear! Fresh from the pond?",
  "Bluegills bite best near the lily pads.",
  "Golden hour is when the big ones feed, you know.",
  "My late husband swore there's a sturgeon the size of a canoe out in the deep middle.",
  "Mind the cold out there. A campfire does wonders.",
  "Those woods hide all sorts of old crates. Finders keepers!",
  "Ever seen a Moonlit Ghost? Only at night, in the cold months, way out deep.",
];

export class UI {
  constructor(game) {
    this.g = game;
    this.icons = new Icons();
    this.toastEl = $('toasts');
    this.open = null;
    this.mapT = 0;
    this.selSeason = 'summer';
    this.tab = 'tasks';
    for (const id of ['panel-inner', 'pause-inner']) {
      $(id).addEventListener('click', (e) => this.onClick(e));
      $(id).addEventListener('input', (e) => this.onInput(e));
    }
    $('panel').addEventListener('mousedown', (e) => { if (e.target.id === 'panel') this.close(); });
    $('hotbar').addEventListener('pointerdown', (e) => {
      const s = e.target.closest('.slot'); if (!s) return;
      e.stopPropagation(); this.g.selectSlot(+s.dataset.i);
    });
  }

  ico(key, cls) { return key ? this.icons.img(key, cls) : ''; }

  // ─── Title ───
  initTitle(onSelect, touch) {
    const el = $('season-cards');
    el.innerHTML = SEASON_ORDER.map(k => {
      const s = SEASONS[k];
      return `<button class="season${k === this.selSeason ? ' sel' : ''}" data-season="${k}">${this.ico(SEASON_ICON[k])}<div class="nm">${s.name}</div><div class="bl">${s.blurb}</div></button>`;
    }).join('');
    el.onclick = (e) => {
      const c = e.target.closest('.season'); if (!c) return;
      this.selSeason = c.dataset.season;
      el.querySelectorAll('.season').forEach(n => n.classList.toggle('sel', n === c));
      onSelect(this.selSeason);
    };
    $('controls-hint').innerHTML = touch
      ? '<span><b>Left thumb</b>walk</span><span><b>Right thumb</b>look</span><span><b>Big button</b>cast · reel · chop</span><span><b>E</b>pick up · talk</span>'
      : '<span><b>WASD</b>walk</span><span><b>Mouse</b>look</span><span><b>Click</b>cast · reel · chop</span><span><b>E</b>pick up · talk</span><span><b>Tab</b>pack</span><span><b>J</b>journal</span><span><b>Esc</b>menu</span>';
  }

  // ─── Toasts, banner, prompt ───
  toast(icon, text, cls = '') {
    const last = this.toastEl.lastElementChild;
    // stack repeated pickups: "+1 Stick" → "+3 Stick"
    const m = /^\+(\d+) (.+)$/.exec(text);
    if (m && last && last.dataset.what === m[2] && !last.classList.contains('out')) {
      const n = +last.dataset.n + +m[1];
      last.dataset.n = n; last.querySelector('.tx').textContent = `+${n} ${m[2]}`;
      clearTimeout(last._t1); clearTimeout(last._t2);
      last._t1 = setTimeout(() => last.classList.add('out'), 2600); last._t2 = setTimeout(() => last.remove(), 3000);
      return;
    }
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.innerHTML = `${this.ico(icon)}<span class="tx"></span>`;
    d.querySelector('.tx').textContent = text;
    if (m) { d.dataset.what = m[2]; d.dataset.n = m[1]; }
    this.toastEl.appendChild(d);
    while (this.toastEl.children.length > 4) this.toastEl.firstChild.remove();
    d._t1 = setTimeout(() => d.classList.add('out'), 3200);
    d._t2 = setTimeout(() => d.remove(), 3600);
  }

  banner(title, sub = '', ms = 3800) {
    const b = $('banner');
    b.innerHTML = `<div class="b1"></div><div class="b2"></div>`;
    b.querySelector('.b1').textContent = title; b.querySelector('.b2').textContent = sub;
    b.classList.add('on');
    clearTimeout(this._bt); this._bt = setTimeout(() => b.classList.remove('on'), ms);
  }

  prompt(text, key = 'E', hold = -1) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); $('crosshair').classList.remove('on'); return; }
    p.classList.remove('hidden');
    $('crosshair').classList.add('on');
    const k = $('prompt-key');
    const touch = this.g.touch;
    const label = touch ? (key === 'Click' ? 'USE' : key) : key;
    k.textContent = label; k.style.display = label ? '' : 'none';
    $('prompt-text').textContent = text;
    const h = $('hold');
    h.style.display = hold >= 0 ? 'block' : 'none';
    if (hold >= 0) h.firstElementChild.style.width = (hold * 100).toFixed(0) + '%';
  }

  // ─── HUD ───
  update(dt) {
    const g = this.g, s = g.state;
    // warmth only when it matters
    const showWarm = s.warmth < 96 || s.wet > 0.05;
    $('vitals').classList.toggle('hidden', !showWarm);
    if (showWarm) {
      const n = Math.ceil(s.warmth / 10);
      const key = n + (s.warmth < 35 ? 'c' : '');
      if (key !== this._wk) {
        this._wk = key;
        if (!this._wico) { $('warm-ico').innerHTML = this.ico('flame'); this._wico = true; }
        $('warm-pips').className = 'pips' + (s.warmth < 35 ? ' cold' : '');
        $('warm-pips').innerHTML = Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? '' : 'off'}"></i>`).join('');
      }
    }
    $('frost').style.opacity = s.warmth < 30 ? (1 - s.warmth / 30) * 0.9 : 0;
    $('underwater').style.opacity = g.player.underwater ? 1 : 0;
    // pinned task (optional)
    const pin = g.settings.pinTask, q = QUESTS[s.quest];
    $('pinned').classList.toggle('hidden', !pin || !q);
    if (pin && q && this._pq !== s.quest) { this._pq = s.quest; $('pinned').innerHTML = `<div class="t">Task</div><div class="x"></div>`; $('pinned').querySelector('.x').textContent = q.text; }
    $('mapwrap').classList.toggle('hidden', !g.settings.minimap);
    this.hotbar();
    if (g.settings.minimap) { this.mapT -= dt; if (this.mapT <= 0) { this.mapT = 0.1; this.drawMap($('minimap'), 32); } }
  }

  hotbar() {
    const g = this.g, t = g.state.tools;
    const bait = g.currentBait();
    const slots = [['hands', true], ['rod', t.rod > 0, bait ? g.count(bait) : 0, bait], ['axe', t.axe > 0], ['stone', g.count('stone') > 0, g.count('stone')], ['lantern', t.lantern]];
    const key = slots.map(x => x.join('/')).join() + g.player.held + t.rod + t.axe;
    if (key === this._hb) return;
    this._hb = key;
    $('hotbar').innerHTML = slots.map(([k, ok, c, sub], i) => ok ? `<div class="slot${g.player.held === k ? ' sel' : ''}" data-i="${i}">${g.touch ? '' : `<span class="k">${i + 1}</span>`}${this.ico(SLOT_ICON(g, k))}${sub ? this.ico(sub, 'sub') : ''}${c ? `<span class="c">${c}</span>` : ''}</div>` : '').join('');
    if (g.touch) $('t-use').innerHTML = this.ico(SLOT_ICON(g, g.player.held));
  }

  buildMap() {
    const g = this.g, t = g.terrain;
    const c = document.createElement('canvas'); c.width = N; c.height = N;
    const ctx = c.getContext('2d'), img = ctx.createImageData(N, N);
    const toS = (v) => Math.round(255 * Math.min(1, Math.pow(Math.max(0, v), 1 / 2.2)));
    for (let z = 0; z < N; z++) for (let x = 0; x < N; x++) {
      const i = z * N + x, o = i * 4;
      let r = t.topCols[i * 3], gg = t.topCols[i * 3 + 1], b = t.topCols[i * 3 + 2];
      if (t.isPond(x, z)) { const w = t.frozen ? [0.6, 0.75, 0.85] : [0.15, 0.4, 0.5]; const d = (9 - t.H(x, z)) / 8; r = w[0] * (1 - d * 0.4); gg = w[1] * (1 - d * 0.4); b = w[2] * (1 - d * 0.3); }
      const shade = 1 + (t.H(x, z) - 9) * 0.04;
      img.data[o] = toS(r * shade); img.data[o + 1] = toS(gg * shade); img.data[o + 2] = toS(b * shade); img.data[o + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    ctx.fillStyle = 'rgba(30,60,30,0.55)';
    for (const tr of g.forest.trees) ctx.fillRect(tr.x - 0.5, tr.z - 0.5, 2, 2);
    const d = t.dock;
    ctx.fillStyle = '#a87a4a'; ctx.fillRect(d.x0, d.z0, 2, d.z1 - d.z0 + 1);
    this.mapBase = c;
    this.markImgs = {};
    for (const k of ['coin', 'house', 'campfire', 'boat']) { const im = new Image(); im.src = this.icons.get(k); this.markImgs[k] = im; }
  }

  drawMap(cv, R) {
    const g = this.g, ctx = cv.getContext('2d');
    if (!this.mapBase) return;
    const W = cv.width, p = g.player.pos, S = W / (R * 2);
    const cx = R >= 80 ? 80 : p.x, cz = R >= 80 ? 80 : p.z;
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a3a22'; ctx.fillRect(0, 0, W, W);
    ctx.drawImage(this.mapBase, cx - R, cz - R, R * 2, R * 2, 0, 0, W, W);
    const mark = (x, z, k, size) => {
      const sx = (x - cx + R) * S, sy = (z - cz + R) * S, im = this.markImgs[k];
      if (im && im.complete && im.naturalWidth) ctx.drawImage(im, sx - size / 2, sy - size / 2, size, size);
    };
    const ms = W * 0.09;
    mark(MARKET.x + 2.5, MARKET.z + 1, 'coin', ms);
    mark(HOUSE.x + 4.5, HOUSE.z + 3.5, 'house', ms);
    mark(CAMP.x, CAMP.z, 'campfire', ms);
    if (g.boat) mark(g.boat.pos.x, g.boat.pos.z, 'boat', ms);
    ctx.save();
    ctx.translate((p.x - cx + R) * S, (p.z - cz + R) * S);
    ctx.rotate(-g.player.yaw);
    const a = W * 0.045;
    ctx.fillStyle = '#fff1d0'; ctx.strokeStyle = '#2e1c0e'; ctx.lineWidth = Math.max(2, W / 120);
    ctx.beginPath(); ctx.moveTo(0, -a * 1.4); ctx.lineTo(a, a); ctx.lineTo(0, a * 0.5); ctx.lineTo(-a, a); ctx.closePath();
    ctx.stroke(); ctx.fill();
    ctx.restore();
  }

  // ─── Fishing meters ───
  fishing(f) {
    const ui = $('fishui');
    if (!f) { ui.classList.add('hidden'); return; }
    ui.classList.remove('hidden');
    $('power').classList.toggle('hidden', f.state !== 'charging');
    $('bite').classList.toggle('hidden', f.state !== 'bite');
    $('tension').classList.toggle('hidden', f.state !== 'fight');
    if (f.state === 'charging') $('power').querySelector('i').style.width = (f.power * 100) + '%';
    if (f.state === 'fight') {
      const tb = $('tension').querySelector('.tbar');
      tb.querySelector('i').style.left = Math.min(100, f.tension / 1.05 * 100) + '%';
      tb.classList.toggle('danger', f.danger);
      $('tension').querySelector('.pbar i').style.width = (f.progress * 100) + '%';
    }
  }

  showCatch(f, w, isNew) {
    const c = $('catch');
    c.innerHTML = `${this.ico('fish:' + f.id)}<div class="nm"></div>${stars(f.rarity)}
      <div class="w">${f.rarity === 'junk' ? "Well… it's something." : w + ' kg'}</div>
      ${isNew ? '<div class="new">New in your journal</div>' : ''}`;
    c.querySelector('.nm').textContent = f.name;
    c.classList.remove('hidden');
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    clearTimeout(this._ct);
    this._ct = setTimeout(() => c.classList.add('hidden'), 2600);
  }

  // ─── Panels ───
  isOpen() { return !!this.open; }
  close() {
    if (!this.open) return;
    const wasPause = this.open === 'pause';
    this.open = null;
    $('panel').classList.add('hidden'); $('pause').classList.add('hidden');
    this.g.onPanelClosed(wasPause);
  }
  openPanel(name, html) {
    const wasOpen = this.open;
    this.open = name;
    if (!wasOpen) this.g.onPanelOpened();
    const scroll = $('panel-inner').querySelector('.page');
    const keep = wasOpen === name && scroll ? scroll.scrollTop : 0;
    $('panel-inner').innerHTML = html;
    $('panel').classList.remove('hidden');
    const ns = $('panel-inner').querySelector('.page'); if (ns) ns.scrollTop = keep;
  }
  head(title, tabs = '', extra = '') {
    return `<div class="bhead"><h2>${title}</h2>${extra}<button class="close" data-act="close" aria-label="Close">✕</button>${tabs ? `<div class="tabs">${tabs}</div>` : ''}</div>`;
  }
  tabBtn(id, label, cur, act = 'tab') { return `<button class="tab${id === cur ? ' on' : ''}" data-act="${act}" data-id="${id}">${label}</button>`; }
  needs(needs) {
    const g = this.g;
    return `<div class="need">${Object.entries(needs).map(([k, n]) => `<span class="${g.count(k) >= n ? '' : 'no'}">${this.ico(k)}${g.count(k)}/${n}</span>`).join('')}</div>`;
  }
  coins() { return `<span class="coins">${this.ico('coin')}${this.g.state.coins}</span>`; }

  // The journal: tasks · pack · crafting · fish · map
  openJournal(tab = this.tab) {
    const g = this.g, s = g.state;
    this.tab = tab;
    const tabs = [['tasks', 'Tasks'], ['pack', 'Pack'], ['craft', 'Crafting'], ['fish', 'Fish'], ['map', 'Map']].map(([id, l]) => this.tabBtn(id, l, tab)).join('');
    let body = '';
    if (tab === 'tasks') {
      const hr = Math.floor(s.time), mn = Math.floor((s.time % 1) * 60);
      const night = hr < 6 || hr >= 20;
      body = `<div class="clockline">${this.ico(night ? 'moon' : 'sun')} Day ${s.day} · ${SEASONS[g.season].name} · ${((hr + 11) % 12) + 1}:${String(mn).padStart(2, '0')} ${hr < 12 ? 'am' : 'pm'}</div>`;
      const shown = QUESTS.slice(0, Math.min(QUESTS.length, s.quest + 3));
      body += shown.map((q, i) => {
        const cls = i < s.quest ? 'done' : i === s.quest ? 'cur' : 'locked';
        return `<div class="task ${cls}"><span class="box"></span><div><div class="tx">${i > s.quest ? '???' : q.text}</div>${i === s.quest ? `<div class="hint">${q.hint}</div>` : ''}</div></div>`;
      }).join('');
      if (!QUESTS[s.quest]) body += `<div class="empty">Every task done. Enjoy your pond — and the sunsets.</div>`;
    } else if (tab === 'pack') {
      const tools = [];
      if (s.tools.rod) tools.push(['rod:' + s.tools.rod, RODS[s.tools.rod].name]);
      if (s.tools.axe) tools.push(['axe:' + s.tools.axe, AXES[s.tools.axe].name]);
      if (s.tools.lantern) tools.push(['lantern', 'Lantern']);
      const items = Object.entries(s.inv).filter(([, n]) => n > 0);
      const slot = (k, name, n) => `<div class="islot" tabindex="0">${this.ico(k)}${n ? `<span class="c">${n}</span>` : ''}<span class="tip">${name}</span></div>`;
      body = (tools.length || items.length) ? [
        tools.length ? `<div class="sect">Tools</div><div class="slots">${tools.map(([k, nm]) => slot(k, nm)).join('')}</div>` : '',
        items.length ? `<div class="sect">Gathered</div><div class="slots">${items.map(([k, n]) => slot(k, itemName(k), n)).join('')}</div>` : '',
      ].join('') : `<div class="empty">Nothing yet. Sticks and stones lie all around the pond.</div>`;
    } else if (tab === 'craft') {
      body = `<div class="rows">${RECIPES.map(r => {
        const done = r.gives.tool && s.tools[r.gives.tool] >= r.gives.tier;
        if (done) return '';
        const can = g.has(r.needs);
        return `<div class="row">${this.ico(RECIPE_ICON[r.id])}<div class="mid"><div class="nm">${r.name}</div><div class="ds">${r.desc}</div>${this.needs(r.needs)}</div>
          <button class="btn small" data-act="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>Craft</button></div>`;
      }).join('')}</div>`;
    } else if (tab === 'fish') {
      const j = s.journal, found = Object.keys(j).length;
      body = `<div class="stats"><span>${found}/${FISH.length} species</span><span>${s.stats.caught} caught</span><span>Best skip: ${s.stats.bestSkip}</span></div>
        <div class="jgrid">${FISH.map(f => {
          const e = j[f.id];
          const seasons = f.seasons === 'all' ? 'Any season' : f.seasons.map(k => SEASONS[k].name).join(', ');
          const when = [f.night === true ? 'night only' : f.night === 'bonus' ? 'likes the night' : '', f.deep ? 'deep water' : '', f.minTier ? RODS[f.minTier].name + '+' : ''].filter(Boolean).join(' · ');
          return `<div class="fcard${e ? '' : ' unk'}">${this.ico('fish:' + f.id)}<div><div class="nm">${e ? f.name : '???'}</div>${stars(f.rarity)}
            <div class="meta">${seasons}${when ? ' · ' + when : ''}${e ? `<br>×${e.count} · best ${e.best} kg` : ''}</div></div></div>`;
        }).join('')}</div>`;
    } else if (tab === 'map') {
      body = `<canvas class="mapbig" id="bigmap" width="480" height="480"></canvas>`;
    }
    this.openPanel('journal', `${this.head('Field journal', tabs, this.coins())}<div class="page">${body}</div>`);
    if (tab === 'map') this.drawMap($('bigmap'), 80);
  }

  openShop(tab = this.shopTab || 'sell') {
    const g = this.g, s = g.state;
    this.shopTab = tab;
    if (this.open !== 'shop') this.mabelLine = s.stats.sold === 0 && !s.tools.rod ? "Oh! A new face by the pond. If you want to fish you'll need string — try that old campsite up north." : MABEL_LINES[Math.floor(Math.random() * MABEL_LINES.length)];
    let body = '';
    if (tab === 'sell') {
      const entries = Object.entries(s.inv).filter(([k, n]) => n > 0 && itemPrice(k) > 0).sort((a, b) => (b[0].startsWith('fish') - a[0].startsWith('fish')));
      const total = entries.filter(([k]) => k.startsWith('fish:')).reduce((t, [k, n]) => t + itemPrice(k) * n, 0);
      body = entries.length ? `${total ? `<p><button class="btn" data-act="sellfish">Sell all fish · ${total} coins</button></p>` : ''}<div class="rows">${entries.map(([k, n]) => `
        <div class="row">${this.ico(k)}<div class="mid"><div class="nm">${itemName(k)} ×${n}</div><div class="ds">${itemPrice(k)} coins each</div></div>
        <button class="btn small alt" data-act="sell" data-id="${k}" data-n="1">Sell 1</button>${n > 1 ? `<button class="btn small" data-act="sell" data-id="${k}" data-n="${n}">All</button>` : ''}</div>`).join('')}</div>`
        : '<div class="empty">Nothing to sell yet. Bring me fish, berries or mushrooms!</div>';
    } else {
      const list = SHOP.filter(it => {
        if (it.kind === 'rod') return it.tier === Math.max(2, s.tools.rod + 1);
        if (it.kind === 'axe') return s.tools.axe < it.tier;
        if (it.kind === 'lantern') return !s.tools.lantern;
        return true;
      });
      body = `<div class="rows">${list.map(it => `<div class="row">${this.ico(shopIcon(it))}<div class="mid"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div>
        <span class="price">${this.ico('coin')}${it.price}</span><button class="btn small" data-act="buy" data-id="${it.id}" ${s.coins >= it.price ? '' : 'disabled'}>Buy</button></div>`).join('')}</div>`;
    }
    const tabs = this.tabBtn('sell', 'Sell', tab, 'shoptab') + this.tabBtn('buy', 'Buy', tab, 'shoptab');
    this.openPanel('shop', `${this.head("Mabel's Market", tabs, this.coins())}<div class="page">
      <div class="mabel">${this.ico('mabel')}<div class="say">“${this.mabelLine}”</div></div>${body}</div>`);
  }

  openBuild(kind) {
    const g = this.g, s = g.state;
    let html;
    if (kind === 'house') {
      if (s.house >= HOUSE_STAGES.length) html = `<div class="empty">Your cabin is finished. Sleep in your bed to skip the night, and warm up by the fireplace.</div>`;
      else html = `<div class="rows">${HOUSE_STAGES.map((h, i) => `<div class="row${i === s.house ? '' : ' dim'}">${this.ico(i < s.house ? 'house' : 'plank')}<div class="mid"><div class="nm">${i + 1}. ${h.name}${i < s.house ? ' — built' : ''}</div><div class="ds">${h.desc}</div>${i === s.house ? this.needs(h.needs) : ''}</div>
          ${i === s.house ? `<button class="btn" data-act="buildhouse" ${g.has(h.needs) ? '' : 'disabled'}>Build</button>` : ''}</div>`).join('')}</div>`;
      if (s.tools.axe === 0 && s.house === 0) html += `<p class="ds empty">Craft a Stone Axe to chop logs. Mabel sells nails.</p>`;
      this.openPanel('build', `${this.head('Cabin plot')}<div class="page">${html}</div>`);
    } else {
      html = s.boat ? `<div class="empty">Your rowboat is tied up at the dock. Walk up to it to climb in.</div>`
        : `<div class="row">${this.ico('boat')}<div class="mid"><div class="nm">Rowboat</div><div class="ds">Reach the deep middle of the pond, where the legendary fish live.</div>${this.needs(BOAT_NEEDS)}</div>
          <button class="btn" data-act="buildboat" ${g.has(BOAT_NEEDS) ? '' : 'disabled'}>Build</button></div>`;
      this.openPanel('build', `${this.head('Boat dock')}<div class="page">${html}</div>`);
    }
  }

  openPause() {
    const g = this.g, st = g.settings;
    this.open = 'pause';
    $('pause-inner').innerHTML = `${this.head('Paused')}<div class="page">
      <div class="sect">Season</div>
      <div class="seasons mini">${SEASON_ORDER.map(k => `<button class="season${k === g.season ? ' sel' : ''}" data-act="season" data-id="${k}">${this.ico(SEASON_ICON[k])}<div class="nm">${SEASONS[k].name}</div></button>`).join('')}</div>
      <div class="sect">Settings</div>
      <div class="settings">
        <label>Look sensitivity<input id="set-sens" type="range" min="0.4" max="3" step="0.1" value="${st.sens}" data-set="sens"></label>
        <label>Field of view<input id="set-fov" type="range" min="60" max="95" step="1" value="${st.fov}" data-set="fov"></label>
        <label>Music<input id="set-music" type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"></label>
        <label>Sounds<input id="set-sfx" type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx"></label>
        <label class="chk"><input id="set-pin" type="checkbox" ${st.pinTask ? 'checked' : ''} data-set="pinTask"> Pin current task</label>
        <label class="chk"><input id="set-map" type="checkbox" ${st.minimap ? 'checked' : ''} data-set="minimap"> Show minimap</label>
        <label class="chk"><input id="set-fancy" type="checkbox" ${st.fancy ? 'checked' : ''} data-set="fancy"> Glow &amp; sunbeams</label>
        <label class="chk"><input id="set-shadows" type="checkbox" ${st.shadows ? 'checked' : ''} data-set="shadows"> Shadows</label>
        <label class="chk"><input id="set-invert" type="checkbox" ${st.invert ? 'checked' : ''} data-set="invert"> Invert look</label>
      </div>
      <div class="pause-buttons"><button class="btn" data-act="resume">Resume</button><button class="btn alt" data-act="journal">Journal</button><button class="btn alt" data-act="save">Save</button><button class="btn warn" data-act="title">Quit to title</button></div></div>`;
    $('pause').classList.remove('hidden');
  }

  onInput(e) {
    const k = e.target.dataset.set; if (!k) return;
    const v = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value);
    this.g.setSetting(k, v);
  }

  onClick(e) {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const g = this.g, act = b.dataset.act, id = b.dataset.id;
    g.audio.play('ui');
    switch (act) {
      case 'close': case 'resume': this.close(); break;
      case 'tab': this.openJournal(id); break;
      case 'shoptab': this.openShop(id); break;
      case 'craft': g.craft(id); if (this.open) this.openJournal('craft'); break;
      case 'buy': g.buy(id); this.openShop('buy'); break;
      case 'sell': g.sell(id, parseInt(b.dataset.n)); this.openShop('sell'); break;
      case 'sellfish': for (const k of Object.keys(g.state.inv)) if (k.startsWith('fish:')) g.sell(k, g.state.inv[k]); this.openShop('sell'); break;
      case 'buildhouse': g.buildHouse(); break;
      case 'buildboat': g.buildBoat(); break;
      case 'season': if (id !== g.season) { g.setSeason(id); this.openPause(); } break;
      case 'save': g.saveGame(); this.toast('book', 'Saved'); break;
      case 'journal': $('pause').classList.add('hidden'); this.open = null; this.openJournal(); break;
      case 'title': g.quitToTitle(); break;
    }
  }
}
