// Sky dome, sun & moon lighting, day/night colour grading, voxel clouds.
import * as THREE from 'three';
import { mulberry32, smoothstep, clamp } from './noise.js';
import { SHARED } from './mesher.js';

const _c1 = new THREE.Color(), _c2 = new THREE.Color();
function mixC(out, a, b, t) { return out.copy(a).lerp(b, clamp(t, 0, 1)); }

export class Sky {
  constructor(game) {
    this.g = game;
    const scene = game.scene;
    this.sun = new THREE.DirectionalLight(0xffffff, 2.5);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -45; sc.right = 45; sc.top = 45; sc.bottom = -45; sc.near = 1; sc.far = 260;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(0xbfd8ff, 0x5a4a30, 0.8);
    scene.add(this.hemi);
    scene.fog = new THREE.Fog(0xcfe0ea, 35, 170);

    this.lightDir = new THREE.Vector3(0, 1, 0);
    this.sunDir = new THREE.Vector3(0, 1, 0);
    this.sunSpec = new THREE.Color(1, 1, 1);
    this.horizon = new THREE.Color();
    this.top = new THREE.Color();
    this.dayLight = 1;
    this.night = 0;

    this.uniforms = {
      uTop: { value: new THREE.Color() }, uHorizon: { value: new THREE.Color() },
      uSunDir: { value: this.sunDir }, uSunCol: { value: new THREE.Color() },
      uNight: { value: 0 }, uDusk: { value: 0 }, uTime: { value: 0 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(450, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.uniforms, side: THREE.BackSide, depthWrite: false, fog: false,
      vertexShader: SKY_VS, fragmentShader: SKY_FS,
    }));
    this.dome.renderOrder = -1;
    this.dome.frustumCulled = false;
    scene.add(this.dome);

    // voxel clouds
    const rnd = mulberry32(31);
    this.cloudParts = [];
    for (let c = 0; c < 34; c++) {
      const cx = (rnd() - 0.5) * 520, cz = (rnd() - 0.5) * 520, cy = 62 + rnd() * 18;
      const n = 4 + Math.floor(rnd() * 7);
      for (let i = 0; i < n; i++) {
        this.cloudParts.push({
          x: cx + (rnd() - 0.5) * 22, y: cy + rnd() * 3, z: cz + (rnd() - 0.5) * 12,
          sx: 8 + rnd() * 12, sy: 2.5 + rnd() * 3, sz: 6 + rnd() * 9,
        });
      }
    }
    this.cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, fog: false, emissive: 0x000000 });
    this.clouds = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), this.cloudMat, this.cloudParts.length);
    this.clouds.frustumCulled = false;
    scene.add(this.clouds);
    this.wind = 0;
    this.cloudTimer = 0;
  }

  setPalette(pal) {
    this.pal = pal;
    this.P = {
      day: pal.sky.day.map(h => new THREE.Color(h)),
      dusk: pal.sky.dusk.map(h => new THREE.Color(h)),
      night: pal.sky.night.map(h => new THREE.Color(h)),
      sun: new THREE.Color(pal.sun),
    };
  }

  update(dt, hours, focus) {
    const P = this.P;
    const a = (hours - 6) / 12 * Math.PI;
    this.sunDir.set(Math.cos(a) * 0.92, Math.sin(a), 0.38).normalize();
    const e = this.sunDir.y;
    const dayF = smoothstep(-0.12, 0.32, e);
    const duskF = Math.exp(-Math.pow(e / 0.2, 2));
    const nightF = smoothstep(0.02, -0.22, e);
    this.night = nightF;
    this.dusk = duskF;

    mixC(this.top, P.night[0], P.day[0], dayF); this.top.lerp(P.dusk[0], duskF * 0.55);
    mixC(this.horizon, P.night[1], P.day[1], dayF); this.horizon.lerp(P.dusk[1], duskF * 0.8);
    this.uniforms.uTop.value.copy(this.top);
    this.uniforms.uHorizon.value.copy(this.horizon);
    this.uniforms.uNight.value = nightF;
    this.uniforms.uDusk.value = duskF;
    this.uniforms.uTime.value += dt;

    // directional light: sun by day, moon by night
    const golden = _c1.setHex(0xff7a30);
    if (e > -0.06) {
      this.lightDir.copy(this.sunDir);
      this.sun.color.copy(golden).lerp(P.sun, smoothstep(0.04, 0.6, e));
      this.sun.intensity = 3.3 * smoothstep(-0.06, 0.12, e);
    } else {
      this.lightDir.copy(this.sunDir).negate();
      this.sun.color.setHex(0x9ab4ff);
      this.sun.intensity = 0.55 * smoothstep(-0.06, -0.25, e);
    }
    if (this.lightDir.y < 0.1) { this.lightDir.y = 0.1; this.lightDir.normalize(); }
    this.uniforms.uSunCol.value.copy(this.sun.color).multiplyScalar(e > -0.06 ? 1 : 0.0);
    this.sunSpec.copy(this.sun.color).multiplyScalar(Math.min(1.2, this.sun.intensity / 2));

    // shader-pack haze: fog glows warm toward the sun
    const sunUp = smoothstep(-0.08, 0.02, e);
    SHARED.uSunFog.value.copy(this.sun.color).lerp(_c2.setHex(0xfff0d8), 0.25 * (1 - duskF)).multiplyScalar(1.0 + duskF * 0.9);
    SHARED.uScatter.value = (0.35 + duskF * 0.75) * sunUp;
    SHARED.uTime.value += dt;
    if (this.g.camera) {
      this.g.camera.updateMatrixWorld();
      SHARED.uSunView.value.copy(this.sunDir).transformDirection(this.g.camera.matrixWorldInverse);
    }

    this.hemi.color.copy(this.top).lerp(this.horizon, 0.3 + duskF * 0.45).lerp(_c2.setHex(0xffffff), 0.25);
    this.hemi.groundColor.setHex(this.pal.snow ? 0x8a8f9a : 0x6a5236).lerp(golden, duskF * 0.35).lerp(this.horizon, 0.15);
    this.hemi.intensity = 0.55 + 0.75 * dayF + duskF * 0.35 + (this.pal.snow ? 0.1 : 0);
    this.dayLight = 0.22 + 0.78 * dayF;

    const fog = this.g.scene.fog;
    fog.color.copy(this.horizon);
    const misty = this.pal.key === 'fall' && hours > 5 && hours < 9;
    fog.near = misty ? 18 : this.pal.snow ? 40 : 55;
    fog.far = misty ? 120 : this.pal.snow ? 190 : 240;

    // shadows follow the player
    if (focus) {
      this.sun.target.position.copy(focus);
      this.sun.position.copy(focus).addScaledVector(this.lightDir, 120);
      this.dome.position.copy(focus);
    }

    // clouds
    this.wind += dt * 1.6;
    this.cloudTimer -= dt;
    this.cloudMat.color.copy(this.horizon).lerp(_c2.setHex(0xffffff), 0.65 * dayF + 0.1);
    this.cloudMat.emissive.copy(this.horizon).multiplyScalar(0.35 + duskF * 0.3);
    if (this.cloudTimer <= 0) {
      this.cloudTimer = 0.1;
      const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
      const fx = focus ? focus.x : 80, fz = focus ? focus.z : 80;
      this.cloudParts.forEach((c, i) => {
        let x = ((c.x + this.wind + 260 - fx) % 520 + 520) % 520 - 260 + fx;
        m.compose(p.set(x, c.y, c.z + fz * 0.0), q, s.set(c.sx, c.sy, c.sz));
        this.clouds.setMatrixAt(i, m);
      });
      this.clouds.instanceMatrix.needsUpdate = true;
    }
  }
}

const SKY_VS = /* glsl */`
varying vec3 vDir;
void main(){
  vDir = normalize(position);
  vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  gl_Position = p.xyww;
}`;
const SKY_FS = /* glsl */`
uniform vec3 uTop, uHorizon, uSunDir, uSunCol; uniform float uNight, uDusk, uTime;
varying vec3 vDir;
float hash(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
void main(){
  vec3 d = normalize(vDir);
  float y = d.y;
  vec3 col = mix(uHorizon, uTop, pow(smoothstep(-0.02, 0.65, y), 0.75));
  if (y < 0.0) col = mix(uHorizon, uHorizon * 0.75, smoothstep(0.0, -0.3, y));
  float s = max(dot(d, uSunDir), 0.0);
  col += uSunCol * (smoothstep(0.9988, 0.9994, s) * 12.0 + pow(s, 200.0) * 1.6 + pow(s, 9.0) * (0.15 + uDusk * 0.7) + pow(s, 2.5) * uDusk * 0.22);
  float m = max(dot(d, -uSunDir), 0.0);
  col += vec3(1.1, 1.08, 1.0) * smoothstep(0.99935, 0.9996, m) * uNight * 1.6 + vec3(0.4, 0.5, 0.8) * pow(m, 60.0) * uNight * 0.25;
  if (uNight > 0.01 && y > 0.0) {
    vec3 p = floor(d * 260.0);
    float h = hash(p);
    float tw = 0.6 + 0.4 * sin(uTime * 2.0 + h * 50.0);
    col += vec3(0.9, 0.95, 1.0) * step(0.9972, h) * uNight * tw * smoothstep(0.0, 0.25, y) * 1.6;
  }
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}`;
