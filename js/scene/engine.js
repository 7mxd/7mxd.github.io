import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'https://esm.sh/three@0.160.0/examples/jsm/postprocessing/UnrealBloomPass.js';

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createEngine(canvas, { reducedMotion = false, lowQuality = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x0a0d12, 1);
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x0a0d12, 0.0019);
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  const home = new THREE.Vector3(0, 40, 360);
  camera.position.copy(home);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.minDistance = 60; controls.maxDistance = 700;
  controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.PointLight(0xffffff, 1.2, 0, 0); key.position.set(120, 200, 200); scene.add(key);

  // Starfield — static dim points in a large shell
  (function addStarfield() {
    const count = 600;
    const starPos = new Float32Array(count * 3);
    const rng2 = mulberry32(42);
    for (let i = 0; i < count; i++) {
      // random point on sphere shell, radius 600-900
      const r = 600 + rng2() * 300;
      const theta = Math.acos(2 * rng2() - 1);
      const phi = rng2() * Math.PI * 2;
      starPos[i*3]   = r * Math.sin(theta) * Math.cos(phi);
      starPos[i*3+1] = r * Math.sin(theta) * Math.sin(phi);
      starPos[i*3+2] = r * Math.cos(theta);
    }
    const starGeo = new THREE.BufferGeometry();
    starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starMat = new THREE.PointsMaterial({ color: 0xd4d8e0, size: 1.2, transparent: true, opacity: 0.25, sizeAttenuation: true, blending: THREE.AdditiveBlending });
    scene.add(new THREE.Points(starGeo, starMat));
  })();

  const useBloom = !reducedMotion && !lowQuality;
  let composer = null;
  if (useBloom) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.5, 0.15);
    composer.addPass(bloom);
  }

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    if (composer) { composer.setSize(w, h); }
    camera.aspect = w / h; camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const frameCbs = [];
  let raf = null, running = false;
  const clock = new THREE.Clock();
  function tick() {
    const t = clock.getElapsedTime();
    controls.update();
    for (const cb of frameCbs) cb(t);
    if (composer) { composer.render(); } else { renderer.render(scene, camera); }
    raf = requestAnimationFrame(tick);
  }
  function start() { if (!running) { running = true; clock.start(); if (!document.hidden && raf == null) raf = requestAnimationFrame(tick); } }
  function stop() { running = false; if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function onVisibility() {
    if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } }
    else if (running && raf == null) { raf = requestAnimationFrame(tick); }
  }
  document.addEventListener('visibilitychange', onVisibility);

  function focusOn(p, distance = 90) {
    const target = new THREE.Vector3(p.x, p.y, p.z);
    controls.target.copy(target);
    const dir = new THREE.Vector3().subVectors(camera.position, target).normalize();
    camera.position.copy(target.clone().add(dir.multiplyScalar(distance)));
  }
  function resetView() { controls.target.set(0, 0, 0); camera.position.copy(home); }

  function dispose() {
    stop(); window.removeEventListener('resize', resize);
    document.removeEventListener('visibilitychange', onVisibility);
    controls.dispose(); renderer.dispose();
  }
  return { THREE, scene, camera, renderer, controls, addFrame: (fn)=>frameCbs.push(fn), start, stop, dispose, focusOn, resetView };
}
