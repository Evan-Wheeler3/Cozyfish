// All DOM UI: title, HUD, minimap, hotbar, toasts, fishing meters, panels.
import { SEASONS, SEASON_ORDER, ITEMS, RECIPES, SHOP, FISH, FISH_BY_ID, RARITY, HOUSE_STAGES, BOAT_NEEDS, RODS, AXES, QUESTS, N, MARKET, HOUSE, CAMP } from './config.js';

const $ = (id) => document.getElementById(id);
const hex = (n) => '#' + n.toString(16).padStart(6, '0');

export function fishIcon(f, unknown = false) {
  if (unknown) return `<svg viewBox="0 0 60 36"><path d="M8 18 C16 6 38 4 50 18 C38 32 16 30 8 18Z M8 18 L1 9 L1 27Z" fill="#cbbba0"/><text x="29" y="23" font-size="14" text-anchor="middle" fill="#fff" font-family="Fredoka">?</text></svg>`;
  if (f.shape === 'boot') return `<svg viewBox="0 0 60 36"><path d="M18 4h14v18h16v10H18z" fill="${hex(f.body)}"/><rect x="18" y="29" width="30" height="4" fill="${hex(f.fin)}"/></svg>`;
  if (f.shape === 'can') return `<svg viewBox="0 0 60 36"><rect x="20" y="4" width="20" height="28" rx="3" fill="${hex(f.body)}"/><rect x="20" y="12" width="20" height="10" fill="${hex(f.belly)}"/></svg>`;
  const tall = (f.tall || 1) * 10;
  const marks = f.stripes ? [18, 26, 34].map(x => `<rect x="${x}" y="${18 - tall + 3}" width="3" height="${tall}" fill="${hex(f.stripes)}" opacity=".8"/>`).join('')
    : f.spots ? [[22, 14], [30, 12], [36, 16], [26, 19]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.6" fill="${hex(f.spots)}"/>`).join('')
    : f.band ? `<rect x="14" y="16" width="32" height="3" fill="${hex(f.band)}"/>`
    : f.patches ? `<circle cx="24" cy="15" r="5" fill="${hex(f.patches)}"/><circle cx="38" cy="19" r="4" fill="${hex(f.patches)}"/>` : '';
  return `<svg viewBox="0 0 60 36"><path d="M9 18 L1 ${18 - tall * 0.8} L3 18 L1 ${18 + tall * 0.8} Z" fill="${hex(f.fin)}"/>
    <path d="M28 ${18 - tall - 3} L34 ${18 - tall + 1} L22 ${18 - tall + 2}Z" fill="${hex(f.fin)}"/>
    <ellipse cx="31" cy="18" rx="22" ry="${tall}" fill="${hex(f.belly)}"/>
    <path d="M9 18 A22 ${tall} 0 0 1 53 18 Z" fill="${hex(f.body)}"/>${marks}
    <circle cx="46" cy="15" r="2.2" fill="#1a1a1a"/><circle cx="46.6" cy="14.4" r=".7" fill="#fff"/></svg>`;
}

function itemIcon(key) {
  if (key.startsWith('fish:')) return fishIcon(FISH_BY_ID[key.slice(5)]);
  return ITEMS[key] ? ITEMS[key].icon : '❔';
}
function itemName(key) {
  if (key.startsWith('fish:')) return FISH_BY_ID[key.slice(5)].name;
  return ITEMS[key] ? ITEMS[key].name : key;
}
function itemPrice(key) {
  if (key.startsWith('fish:')) return FISH_BY_ID[key.slice(5)].price;
  return ITEMS[key] ? ITEMS[key].sell : 0;
}

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
    this.toastEl = $('toasts');
    this.open = null;
    this.mapT = 0;
    this.selSeason = 'summer';
    $('panel-inner').addEventListener('click', (e) => this.onClick(e));
    $('pause-inner').addEventListener('click', (e) => this.onClick(e));
    $('pause-inner').addEventListener('input', (e) => this.onInput(e));
    $('panel').addEventListener('mousedown', (e) => { if (e.target.id === 'panel') this.close(); });
  }

  // ─── Title ───
  initTitle(onSelect) {
    const el = $('season-cards');
    el.innerHTML = SEASON_ORDER.map(k => {
      const s = SEASONS[k];
      return `<div class="season${k === this.selSeason ? ' sel' : ''}" data-season="${k}"><div class="em">${s.emoji}</div><div class="nm">${s.name}</div><div class="bl">${s.blurb}</div></div>`;
    }).join('');
    el.onclick = (e) => {
      const c = e.target.closest('.season'); if (!c) return;
      this.selSeason = c.dataset.season;
      el.querySelectorAll('.season').forEach(n => n.classList.toggle('sel', n === c));
      onSelect(this.selSeason);
    };
  }

  // ─── Toasts / prompt ───
  toast(icon, text, cls = '') {
    const d = document.createElement('div');
    d.className = 'toast ' + cls;
    d.innerHTML = `<span>${icon}</span><span>${text}</span>`;
    this.toastEl.appendChild(d);
    while (this.toastEl.children.length > 5) this.toastEl.firstChild.remove();
    setTimeout(() => d.classList.add('out'), cls === 'goal' ? 4200 : 2800);
    setTimeout(() => d.remove(), cls === 'goal' ? 4700 : 3300);
  }

  prompt(text, key = 'E', hold = -1) {
    const p = $('prompt');
    if (!text) { p.classList.add('hidden'); $('crosshair').classList.remove('on'); return; }
    p.classList.remove('hidden');
    $('crosshair').classList.add('on');
    p.querySelector('.key').textContent = key;
    p.querySelector('.key').style.display = key ? '' : 'none';
    $('prompt-text').textContent = text;
    const h = $('hold');
    h.style.display = hold >= 0 ? 'block' : 'none';
    if (hold >= 0) h.firstElementChild.style.width = (hold * 100).toFixed(0) + '%';
  }

  // ─── HUD ───
  update(dt) {
    const g = this.g, s = g.state;
    const hr = Math.floor(s.time), mn = Math.floor((s.time % 1) * 60);
    const h12 = ((hr + 11) % 12) + 1;
    $('clock').textContent = `${SEASONS[g.season].emoji} Day ${s.day} · ${h12}:${String(mn).padStart(2, '0')} ${hr < 12 ? 'am' : 'pm'}`;
    $('coins').textContent = `🪙 ${s.coins}`;
    const w = $('warmth');
    w.querySelector('i').style.width = s.warmth + '%';
    w.classList.toggle('cold', s.warmth < 35);
    const q = QUESTS[s.quest];
    $('goal-text').textContent = q ? q.text : 'Enjoy your cozy pond life 🎣';
    $('goal-hint').textContent = q ? q.hint : 'Catch every fish in every season, and watch the sunsets.';
    $('frost').style.opacity = s.warmth < 30 ? (1 - s.warmth / 30) * 0.9 : 0;
    $('underwater').style.opacity = g.player.underwater ? 1 : 0;
    this.hotbar();
    this.mapT -= dt;
    if (this.mapT <= 0) { this.mapT = 0.1; this.drawMap(); }
  }

  hotbar() {
    const g = this.g, s = g.state, t = s.tools;
    const slots = [
      ['hands', '✋', true],
      ['rod', '🎣', t.rod > 0],
      ['axe', '🪓', t.axe > 0],
      ['stone', '🪨', g.count('stone') > 0, g.count('stone')],
      ['lantern', '🏮', t.lantern],
    ];
    const key = slots.map(x => x[0] + x[2] + (x[3] || '') + (g.player.held === x[0])).join();
    if (key !== this._hb) {
      this._hb = key;
      $('hotbar').innerHTML = slots.map(([k, ic, ok, c], i) => `<div class="slot${g.player.held === k ? ' sel' : ''}${ok ? '' : ' locked'}"><span class="n">${i + 1}</span>${ic}${c ? `<span class="c">${c}</span>` : ''}</div>`).join('');
    }
    const bait = g.currentBait();
    const bi = g.player.held === 'rod' ? (bait ? `Bait: ${ITEMS[bait].icon} ${ITEMS[bait].name} ×${g.count(bait)}` : 'No bait — dig worms (dirt mounds) or buy some') : g.player.held === 'stone' ? 'Click to throw — skip it across the pond!' : '';
    if (bi !== this._bi) { this._bi = bi; $('baitinfo').textContent = bi; }
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
  }

  drawMap() {
    const g = this.g, cv = $('minimap'), ctx = cv.getContext('2d');
    if (!this.mapBase) return;
    const p = g.player.pos, R = 32, S = cv.width / (R * 2);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#2a3a22'; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(this.mapBase, p.x - R, p.z - R, R * 2, R * 2, 0, 0, cv.width, cv.height);
    const mark = (x, z, ic, size = 22) => {
      let sx = (x - p.x + R) * S, sy = (z - p.z + R) * S;
      const dx = sx - 150, dy = sy - 150, dd = Math.hypot(dx, dy);
      if (dd > 128) { sx = 150 + dx / dd * 128; sy = 150 + dy / dd * 128; size *= 0.75; }
      ctx.font = `${size}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(ic, sx, sy);
    };
    mark(MARKET.x + 2.5, MARKET.z + 1, '🏪');
    mark(HOUSE.x + 4.5, HOUSE.z + 3.5, g.state.house >= 4 ? '🏡' : '🔨');
    if (!g.state.cratesOpened.includes('camp')) mark(CAMP.x, CAMP.z, '⛺');
    else mark(CAMP.x, CAMP.z, '⛺', 16);
    if (g.boat) mark(g.boat.pos.x, g.boat.pos.z, '🛶', 18);
    // player arrow
    ctx.save();
    ctx.translate(150, 150);
    ctx.rotate(-g.player.yaw);
    ctx.fillStyle = '#fff4dc'; ctx.strokeStyle = '#3a2a1c'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -13); ctx.lineTo(9, 10); ctx.lineTo(0, 5); ctx.lineTo(-9, 10); ctx.closePath();
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
    const c = $('catch'), r = RARITY[f.rarity];
    c.innerHTML = `${fishIcon(f)}<div class="nm">${f.name}</div>
      <div class="r" style="color:${r.color}">${'★'.repeat(r.stars) || '·'} ${r.label}</div>
      <div class="w">${f.rarity === 'junk' ? 'Well… it\'s something.' : w + ' kg'} · worth 🪙 ${f.price}</div>
      ${isNew ? '<div class="new">New for your journal!</div>' : ''}`;
    c.classList.remove('hidden');
    c.style.animation = 'none'; void c.offsetWidth; c.style.animation = '';
    clearTimeout(this._ct);
    this._ct = setTimeout(() => c.classList.add('hidden'), 2600);
  }

  // ─── Panels ───
  isOpen() { return !!this.open; }
  show(html) { $('panel-inner').innerHTML = html; $('panel').classList.remove('hidden'); }
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
    this.show(html);
  }
  head(title) { return `<div class="panel-head"><h2>${title}</h2><button class="close" data-act="close">✕</button></div>`; }
  needs(needs) {
    const g = this.g;
    return `<div class="need">${Object.entries(needs).map(([k, n]) => `<span class="${g.count(k) >= n ? 'ok' : 'no'}">${ITEMS[k].icon} ${g.count(k)}/${n} ${ITEMS[k].name}</span>`).join('')}</div>`;
  }

  openInventory(tab = this.invTab || 'pack') {
    const g = this.g, s = g.state;
    this.invTab = tab;
    let body = '';
    if (tab === 'pack') {
      const entries = Object.entries(s.inv).filter(([, n]) => n > 0);
      const tools = [];
      if (s.tools.rod) tools.push(['🎣', RODS[s.tools.rod].name, 'Fishing rod']);
      if (s.tools.axe) tools.push(['🪓', AXES[s.tools.axe].name, 'Chops trees']);
      if (s.tools.lantern) tools.push(['🏮', 'Lantern', 'Press F at night']);
      body = `<div class="section">Tools</div>${tools.length ? `<div class="grid">${tools.map(([i, n, d]) => `<div class="item"><div class="ic">${i}</div><div><div class="nm">${n}</div><div class="sub">${d}</div></div></div>`).join('')}</div>` : '<div class="empty">No tools yet. Craft a Stick Rod!</div>'}
        <div class="section">Pack</div>${entries.length ? `<div class="grid">${entries.map(([k, n]) => `<div class="item"><div class="ic">${itemIcon(k)}</div><div><div class="nm">${itemName(k)}</div><div class="sub">×${n}</div></div></div>`).join('')}</div>` : '<div class="empty">Your pack is empty. Look around the pond!</div>'}`;
    } else {
      body = `<div class="rows">${RECIPES.map(r => {
        const done = r.gives.tool && s.tools[r.gives.tool] >= r.gives.tier;
        const can = g.has(r.needs) && !done;
        return `<div class="row"><div class="ic">${r.icon}</div><div class="mid"><div class="nm">${r.name}</div><div class="ds">${r.desc}</div>${this.needs(r.needs)}</div>
          <button class="btn small" data-act="craft" data-id="${r.id}" ${can ? '' : 'disabled'}>${done ? 'Owned' : 'Craft'}</button></div>`;
      }).join('')}</div>`;
    }
    this.openPanel('inv', `${this.head('Your pack')}
      <div class="tabs"><button class="tab${tab === 'pack' ? ' on' : ''}" data-act="invtab" data-id="pack">🎒 Pack</button><button class="tab${tab === 'craft' ? ' on' : ''}" data-act="invtab" data-id="craft">🔨 Crafting</button></div>${body}`);
  }

  openShop(tab = this.shopTab || 'sell') {
    const g = this.g, s = g.state;
    this.shopTab = tab;
    if (!this.open) this.mabelLine = s.stats.sold === 0 && !s.tools.rod ? "Oh! A new face by the pond. If you want to fish, you'll need string — try that old campsite up north." : MABEL_LINES[Math.floor(Math.random() * MABEL_LINES.length)];
    let body = '';
    if (tab === 'sell') {
      const entries = Object.entries(s.inv).filter(([k, n]) => n > 0 && itemPrice(k) > 0).sort((a, b) => (b[0].startsWith('fish') - a[0].startsWith('fish')));
      const total = entries.filter(([k]) => k.startsWith('fish:')).reduce((t, [k, n]) => t + itemPrice(k) * n, 0);
      body = entries.length ? `${total ? `<div style="margin-bottom:8px"><button class="btn" data-act="sellfish">Sell all fish · 🪙 ${total}</button></div>` : ''}<div class="rows">${entries.map(([k, n]) => `
        <div class="row"><div class="ic">${itemIcon(k)}</div><div class="mid"><div class="nm">${itemName(k)} <span class="ds">×${n}</span></div><div class="ds">🪙 ${itemPrice(k)} each</div></div>
        <button class="btn small ghost" data-act="sell" data-id="${k}" data-n="1">Sell 1</button><button class="btn small" data-act="sell" data-id="${k}" data-n="${n}">All · 🪙 ${itemPrice(k) * n}</button></div>`).join('')}</div>` : '<div class="empty">Nothing to sell yet. Bring me fish, berries or mushrooms!</div>';
    } else {
      const list = SHOP.filter(it => {
        if (it.kind === 'rod') return s.tools.rod < it.tier && it.tier === Math.max(2, s.tools.rod + 1);
        if (it.kind === 'axe') return s.tools.axe < it.tier;
        if (it.kind === 'lantern') return !s.tools.lantern;
        return true;
      });
      body = `<div class="rows">${list.map(it => `<div class="row"><div class="ic">${it.icon}</div><div class="mid"><div class="nm">${it.name}</div><div class="ds">${it.desc}</div></div>
        <div class="price">🪙 ${it.price}</div><button class="btn small" data-act="buy" data-id="${it.id}" ${s.coins >= it.price ? '' : 'disabled'}>Buy</button></div>`).join('')}</div>`;
    }
    this.openPanel('shop', `${this.head("Mabel's Market")}
      <div class="shop-head"><div class="face">👵</div><div class="say"><b>Mabel:</b> “${this.mabelLine}”</div></div>
      <div class="tabs"><button class="tab${tab === 'sell' ? ' on' : ''}" data-act="shoptab" data-id="sell">💰 Sell</button><button class="tab${tab === 'buy' ? ' on' : ''}" data-act="shoptab" data-id="buy">🛒 Buy</button>
      <span class="pill" style="margin-left:auto">🪙 ${s.coins}</span></div>${body}`);
  }

  openBuild(kind) {
    const g = this.g, s = g.state;
    this.buildKind = kind;
    let html;
    if (kind === 'house') {
      if (s.house >= HOUSE_STAGES.length) html = `<div class="empty">Your cabin is finished. Sleep in your bed to skip the night, and warm up by the fireplace. 🏡</div>`;
      else {
        const st = HOUSE_STAGES[s.house];
        html = `<div class="rows">${HOUSE_STAGES.map((h, i) => `<div class="row" style="${i === s.house ? '' : 'opacity:.55'}"><div class="ic">${i < s.house ? '✅' : i === s.house ? '🔨' : '🔒'}</div><div class="mid"><div class="nm">${i + 1}. ${h.name}</div><div class="ds">${h.desc}</div>${i === s.house ? this.needs(h.needs) : ''}</div>
          ${i === s.house ? `<button class="btn" data-act="buildhouse" ${g.has(st.needs) ? '' : 'disabled'}>Build</button>` : ''}</div>`).join('')}</div>`;
      }
      if (s.tools.axe === 0 && s.house === 0) html += `<div class="ds" style="margin-top:10px">Tip: craft a Stone Axe to chop logs. Mabel sells nails.</div>`;
      this.openPanel('build', `${this.head('Your cabin by the pond')}${html}`);
    } else {
      html = s.boat ? `<div class="empty">Your rowboat is tied up at the dock. Walk up to it and press E to climb in. 🛶</div>`
        : `<div class="row"><div class="ic">🛶</div><div class="mid"><div class="nm">Rowboat</div><div class="ds">Reach the deep middle of the pond, where the legendary fish live.</div>${this.needs(BOAT_NEEDS)}</div>
          <button class="btn" data-act="buildboat" ${g.has(BOAT_NEEDS) ? '' : 'disabled'}>Build</button></div>`;
      this.openPanel('build', `${this.head('Boat dock')}${html}`);
    }
  }

  openJournal() {
    const g = this.g, s = g.state, j = s.journal;
    const found = Object.keys(j).length;
    const cards = FISH.map(f => {
      const e = j[f.id], r = RARITY[f.rarity];
      const seasons = f.seasons === 'all' ? 'All seasons' : f.seasons.map(k => SEASONS[k].emoji).join(' ');
      const when = [f.night === true ? '🌙 night' : f.night === 'bonus' ? '🌙 likes night' : '', f.deep ? '🌊 deep water' : '', f.minTier ? `🎣 ${RODS[f.minTier].name}+` : ''].filter(Boolean).join(' · ');
      return e ? `<div class="jcard"><div class="top">${fishIcon(f)}<div><div class="nm">${f.name}</div><div class="r" style="color:${r.color}">${'★'.repeat(r.stars) || '·'} ${r.label}</div></div></div>
          <div class="meta">${seasons}${when ? ' · ' + when : ''}<br>Caught ${e.count} · best ${e.best} kg · 🪙 ${f.price}</div></div>`
        : `<div class="jcard unk"><div class="top">${fishIcon(f, true)}<div><div class="nm">???</div><div class="r" style="color:${r.color}">${'★'.repeat(r.stars) || '·'} ${r.label}</div></div></div><div class="meta">${seasons}${when ? ' · ' + when : ''}</div></div>`;
    }).join('');
    this.openPanel('journal', `${this.head('Fish journal')}
      <div class="stats"><span class="pill">🐟 ${found}/${FISH.length} species</span><span class="pill">🎣 ${s.stats.caught} caught</span><span class="pill">🪨 best skip: ${s.stats.bestSkip}</span><span class="pill">🌲 ${s.stats.chopped} trees</span><span class="pill">📅 Day ${s.day}</span></div>
      <div class="journal-grid">${cards}</div>`);
  }

  openPause() {
    const g = this.g, st = g.settings;
    this.open = 'pause';
    $('pause-inner').innerHTML = `${this.head('Paused')}
      <div class="section">Season</div>
      <div class="seasons mini">${SEASON_ORDER.map(k => `<div class="season${k === g.season ? ' sel' : ''}" data-act="season" data-id="${k}"><div class="em">${SEASONS[k].emoji}</div><div class="nm">${SEASONS[k].name}</div></div>`).join('')}</div>
      <div class="section">Settings</div>
      <div class="settings">
        <label>Mouse sensitivity<input type="range" min="0.5" max="3" step="0.1" value="${st.sens}" data-set="sens"></label>
        <label>Field of view<input type="range" min="60" max="95" step="1" value="${st.fov}" data-set="fov"></label>
        <label>Music volume<input type="range" min="0" max="1" step="0.05" value="${st.music}" data-set="music"></label>
        <label>Sound volume<input type="range" min="0" max="1" step="0.05" value="${st.sfx}" data-set="sfx"></label>
        <label class="chk"><input type="checkbox" ${st.fancy ? 'checked' : ''} data-set="fancy"> Fancy graphics (bloom, god rays)</label>
        <label class="chk"><input type="checkbox" ${st.shadows ? 'checked' : ''} data-set="shadows"> Shadows</label>
        <label class="chk"><input type="checkbox" ${st.invert ? 'checked' : ''} data-set="invert"> Invert mouse Y</label>
      </div>
      <div class="pause-buttons"><button class="btn" data-act="resume">Resume</button><button class="btn ghost" data-act="journal">📖 Journal</button><button class="btn ghost" data-act="save">💾 Save</button><button class="btn warn" data-act="title">Quit to title</button></div>`;
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
      case 'invtab': this.openInventory(id); break;
      case 'shoptab': this.openShop(id); break;
      case 'craft': g.craft(id); this.openInventory('craft'); break;
      case 'buy': g.buy(id); this.openShop('buy'); break;
      case 'sell': g.sell(id, parseInt(b.dataset.n)); this.openShop('sell'); break;
      case 'sellfish': for (const k of Object.keys(g.state.inv)) if (k.startsWith('fish:')) g.sell(k, g.state.inv[k]); this.openShop('sell'); break;
      case 'buildhouse': g.buildHouse(); break;
      case 'buildboat': g.buildBoat(); break;
      case 'season': if (id !== g.season) { g.setSeason(id); this.openPause(); } break;
      case 'save': g.saveGame(); this.toast('💾', 'Saved.'); break;
      case 'journal': $('pause').classList.add('hidden'); this.open = null; this.openJournal(); break;
      case 'title': g.quitToTitle(); break;
    }
  }
}
