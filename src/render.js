// Renderer + post-processing: god rays, soft bloom, warm grade, vignette.
import * as THREE from 'three';
import { EffectComposer } from '../vendor/three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from '../vendor/three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from '../vendor/three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from '../vendor/three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from '../vendor/three/addons/postprocessing/OutputPass.js';
import { smoothstep } from './noise.js';

const QUAD_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uWarm: { value: 1.0 }, uVignette: { value: 0.42 }, uSat: { value: 1.1 }, uTint: { value: new THREE.Color(1, 1, 1) } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uWarm, uVignette, uSat; uniform vec3 uTint; varying vec2 vUv;
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      vec3 col = c.rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      // warm highlights, slightly cool lilac shadows — the classic shader-pack split tone
      vec3 warm = vec3(1.0 + 0.07 * uWarm, 1.0 + 0.01 * uWarm, 1.0 - 0.12 * uWarm);
      vec3 cool = vec3(0.97, 0.97, 1.05);
      col *= mix(cool, warm, smoothstep(0.02, 0.5, l));
      col += vec3(0.010, 0.005, 0.0) * uWarm;
      col *= uTint;
      vec2 q = vUv - 0.5;
      float v = smoothstep(0.85, 0.2, length(q * vec2(1.15, 1.0)));
      col *= mix(1.0, v, uVignette);
      gl_FragColor = vec4(col, c.a);
    }`,
};

const GodRayShader = {
  uniforms: { tDiffuse: { value: null }, tOcc: { value: null }, uSun: { value: new THREE.Vector2(0.5, 0.5) }, uIntensity: { value: 0 }, uColor: { value: new THREE.Color(1, 0.8, 0.5) } },
  vertexShader: QUAD_VS,
  fragmentShader: `
    uniform sampler2D tDiffuse, tOcc; uniform vec2 uSun; uniform float uIntensity; uniform vec3 uColor; varying vec2 vUv;
    void main(){
      vec4 base = texture2D(tDiffuse, vUv);
      if (uIntensity <= 0.001) { gl_FragColor = base; return; }
      vec2 stepv = (uSun - vUv) / 56.0;
      vec2 uv = vUv; float decay = 1.0; vec3 acc = vec3(0.0);
      for (int i = 0; i < 56; i++) {
        uv += stepv;
        vec2 inb = step(vec2(0.0), uv) * step(uv, vec2(1.0));
        acc += texture2D(tOcc, uv).rgb * decay * inb.x * inb.y;
        decay *= 0.962;
      }
      acc /= 56.0;
      gl_FragColor = vec4(base.rgb + acc * uColor * uIntensity, base.a);
    }`,
};

const SUN_MASK_FS = `
  uniform vec3 uSunDir; varying vec3 vDir;
  void main(){
    vec3 d = normalize(vDir);
    float s = max(dot(d, uSunDir), 0.0);
    float v = smoothstep(0.9982, 0.9994, s) * 4.0 + pow(s, 80.0) * 1.6 + pow(s, 10.0) * 0.22;
    v *= smoothstep(-0.04, 0.03, d.y);
    gl_FragColor = vec4(vec3(v), 1.0);
  }`;
const SUN_MASK_VS = `varying vec3 vDir; void main(){ vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`;

export function createRenderer(canvas, opts = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', preserveDrawingBuffer: !!opts.preserve });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, opts.maxDpr || 1.5));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return renderer;
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3();

export class Post {
  constructor(renderer, scene, camera, sky) {
    this.renderer = renderer; this.scene = scene; this.camera = camera; this.sky = sky;
    this.composer = new EffectComposer(renderer);
    this.composer.addPass(new RenderPass(scene, camera));
    const size = renderer.getSize(new THREE.Vector2());

    // god rays: occlusion buffer (sun glow, everything else black) at half res
    this.occRT = new THREE.WebGLRenderTarget(Math.max(1, size.x >> 1), Math.max(1, size.y >> 1));
    this.occScene = new THREE.Scene();
    this.sunMask = new THREE.Mesh(sky.dome.geometry, new THREE.ShaderMaterial({
      uniforms: { uSunDir: { value: sky.sunDir } }, vertexShader: SUN_MASK_VS, fragmentShader: SUN_MASK_FS,
      side: THREE.BackSide, depthWrite: false,
    }));
    this.sunMask.frustumCulled = false;
    this.occScene.add(this.sunMask);
    this.black = new THREE.MeshBasicMaterial({ color: 0x000000, fog: false });
    this.rays = new ShaderPass(GodRayShader);
    this.rays.uniforms.tOcc.value = this.occRT.texture;
    this.composer.addPass(this.rays);

    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.45, 0.7, 0.82);
    this.composer.addPass(this.bloom);
    this.grade = new ShaderPass(GradeShader);
    this.composer.addPass(this.grade);
    this.composer.addPass(new OutputPass());
    this.enabled = true;
    this.godrays = true;
    this.hideForOcc = [];
  }

  setSize(w, h) {
    this.renderer.setSize(w, h); this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.occRT.setSize(Math.max(1, (w * pr) >> 1), Math.max(1, (h * pr) >> 1));
  }

  renderOcclusion() {
    const r = this.renderer, cam = this.camera, sky = this.sky;
    const e = sky.sunDir.y;
    // where is the sun on screen?
    _v.copy(cam.position).addScaledVector(sky.sunDir, 400).project(cam);
    cam.getWorldDirection(_d);
    const facing = _d.dot(sky.sunDir);
    const u = (_v.x + 1) / 2, v = (_v.y + 1) / 2;
    const off = Math.max(Math.abs(u - 0.5), Math.abs(v - 0.5));
    let k = smoothstep(-0.05, 0.08, e) * (1 - smoothstep(0.55, 1.25, off)) * smoothstep(0.0, 0.35, facing);
    k *= 0.55 + sky.dusk * 0.95;
    this.rays.uniforms.uIntensity.value = this.godrays ? k * 2.2 : 0;
    if (!this.godrays || k < 0.01) return;
    this.rays.uniforms.uSun.value.set(u, v);
    this.rays.uniforms.uColor.value.copy(sky.sun.color).lerp(_c.setRGB(1, 0.85, 0.6), 0.3);

    const prevTarget = r.getRenderTarget(), prevAuto = r.autoClear, prevShadow = r.shadowMap.autoUpdate;
    r.getClearColor(_cc); const prevAlpha = r.getClearAlpha();
    r.setRenderTarget(this.occRT);
    r.setClearColor(0x000000, 1);
    r.autoClear = false;
    r.clear();
    this.sunMask.position.copy(cam.position);
    r.render(this.occScene, cam);
    const dome = sky.dome, domeVis = dome.visible;
    dome.visible = false;
    const hidden = this.hideForOcc.filter(o => o.visible);
    hidden.forEach(o => (o.visible = false));
    r.shadowMap.autoUpdate = false;
    this.scene.overrideMaterial = this.black;
    r.render(this.scene, cam);
    this.scene.overrideMaterial = null;
    r.shadowMap.autoUpdate = prevShadow;
    hidden.forEach(o => (o.visible = true));
    dome.visible = domeVis;
    r.autoClear = prevAuto;
    r.setClearColor(_cc, prevAlpha);
    r.setRenderTarget(prevTarget);
  }

  render() {
    if (this.enabled) {
      const d = this.sky.dusk;
      this.grade.uniforms.uWarm.value = 1.0 + d * 1.2 - this.sky.night * 0.6;
      this.grade.uniforms.uSat.value = 1.1 + d * 0.08;
      this.renderOcclusion();
      this.composer.render();
    } else this.renderer.render(this.scene, this.camera);
  }
}
const _c = new THREE.Color(), _cc = new THREE.Color();
