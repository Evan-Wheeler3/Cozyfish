// Graphics preview harness: ?season=fall&time=17.5&view=shore
import * as THREE from 'three';
import { SEASONS, SPAWN, CENTER } from './config.js';
import { Terrain } from './terrain.js';
import { Forest } from './trees.js';
import { Props } from './props.js';
import { Sky } from './sky.js';
import { createRenderer, Post } from './render.js';

const q = new URLSearchParams(location.search);
const season = q.get('season') || 'summer';
const hours = parseFloat(q.get('time') || '16.5');
const view = q.get('view') || 'shore';
const pal = SEASONS[season];

const renderer = createRenderer(document.getElementById('c'), { preserve: true, maxDpr: 1 });
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(70, innerWidth / innerHeight, 0.05, 700);
const game = { camera, scene, season, palette: pal, state: { cratesOpened: [], day: 1 }, player: { pos: new THREE.Vector3() } };
game.terrain = new Terrain(game);
game.forest = new Forest(game);
game.props = new Props(game);
game.sky = new Sky(game);
game.terrain.build(pal); game.forest.build(pal); game.props.build(pal); game.sky.setPalette(pal);

const VIEWS = {
  shore:  { p: [SPAWN.x, 10.6, SPAWN.z - 6], t: [CENTER, 9.5, CENTER] },
  aerial: { p: [CENTER - 5, 45, CENTER + 62], t: [CENTER, 8, CENTER] },
  woods:  { p: [0, 0, 0], t: [CENTER, 10, CENTER] },
  dock:   { p: [75, 10.6, game.terrain.dock.z0 + 1], t: [CENTER + 10, 9, CENTER - 15] },
  sunset: { p: [CENTER + 27, 10.7, CENTER + 6], t: [CENTER - 30, 10.6, CENTER + 14] },
  hill:   { p: [CENTER + 44, 24, CENTER + 18], t: [CENTER - 30, 8, CENTER + 6] },
  low:    { p: [CENTER + 14, 9.3, CENTER + 14], t: [CENTER - 20, 11, CENTER - 20] },
};
const v = VIEWS[view];
if (view === 'woods') { const cx = 66, cz = 41; v.p = [cx, game.terrain.H(cx, cz) + 1.6, cz]; v.t = [cx - 12, game.terrain.H(cx, cz) + 2, cz - 6]; }
camera.position.set(...v.p); camera.lookAt(...v.t);
const post = new Post(renderer, scene, camera, game.sky);
let frames = 0;
function loop() {
  game.sky.update(1 / 60, hours, camera.position);
  game.terrain.update(1 / 60, game.sky);
  post.render();
  if (++frames === 3 && q.has('still')) { window.READY = true; return; }
  if (frames === 3) window.READY = true;
  requestAnimationFrame(loop);
}
loop();
window.addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); post.setSize(innerWidth, innerHeight); });
