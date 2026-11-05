// Touch controls: floating joystick (left thumb), drag-to-look (right thumb),
// and big buttons for use / interact / jump, plus journal & menu.
const $ = (id) => document.getElementById(id);

export class Touch {
  constructor(game) {
    const g = this.g = game, inp = game.input;
    inp.axis = { x: 0, y: 0 }; inp.run = false;
    const R = 52;

    // joystick
    const zone = $('stick-zone'), base = $('stick-base'), knob = $('stick-knob');
    let sid = null, ox = 0, oy = 0;
    zone.addEventListener('pointerdown', (e) => {
      if (sid !== null || g.paused()) return;
      sid = e.pointerId; ox = e.clientX; oy = e.clientY;
      zone.setPointerCapture(e.pointerId);
      base.style.display = 'block'; base.style.left = ox + 'px'; base.style.top = oy + 'px';
      knob.style.transform = '';
    });
    zone.addEventListener('pointermove', (e) => {
      if (e.pointerId !== sid) return;
      let dx = e.clientX - ox, dy = e.clientY - oy;
      const d = Math.hypot(dx, dy);
      if (d > R) { dx *= R / d; dy *= R / d; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      inp.axis.x = dx / R; inp.axis.y = -dy / R;
      inp.run = d > R * 0.95;
    });
    const endStick = (e) => {
      if (e.pointerId !== sid) return;
      sid = null; inp.axis.x = 0; inp.axis.y = 0; inp.run = false;
      base.style.display = 'none';
    };
    zone.addEventListener('pointerup', endStick);
    zone.addEventListener('pointercancel', endStick);

    // look (tap = interact)
    const look = $('look-zone');
    let lid = null, lx = 0, ly = 0, moved = 0, t0 = 0;
    look.addEventListener('pointerdown', (e) => {
      if (lid !== null) return;
      lid = e.pointerId; lx = e.clientX; ly = e.clientY; moved = 0; t0 = performance.now();
      look.setPointerCapture(e.pointerId);
    });
    look.addEventListener('pointermove', (e) => {
      if (e.pointerId !== lid) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY; moved += Math.abs(dx) + Math.abs(dy);
      if (!g.paused()) { inp.mouseDX += dx * 2.2; inp.mouseDY += dy * 2.2; }
    });
    const endLook = (e) => {
      if (e.pointerId !== lid) return;
      lid = null;
      if (moved < 10 && performance.now() - t0 < 300 && !g.paused()) g.interact();
    };
    look.addEventListener('pointerup', endLook);
    look.addEventListener('pointercancel', endLook);

    // buttons
    const hold = (el, down, up) => {
      el.addEventListener('pointerdown', (e) => { e.preventDefault(); e.stopPropagation(); el.setPointerCapture(e.pointerId); el.classList.add('on'); if (!g.paused()) down(); });
      const end = (e) => { el.classList.remove('on'); up(); };
      el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
    };
    hold($('t-use'), () => { inp.mouseDown = true; g.useDown(); }, () => { if (inp.mouseDown) { inp.mouseDown = false; g.useUp(); } });
    hold($('t-act'), () => { inp.keys.add('KeyE'); g.interact(); }, () => inp.keys.delete('KeyE'));
    hold($('t-jump'), () => inp.keys.add('Space'), () => inp.keys.delete('Space'));
    $('t-book').addEventListener('click', () => { if (!g.ui.isOpen()) g.ui.openJournal(); });
    $('t-menu').addEventListener('click', () => { if (!g.ui.isOpen()) g.ui.openPause(); });
    $('t-book').innerHTML = g.ui.icons.img('book');
  }

  show(on) { $('touch').classList.toggle('hidden', !on); }
}
