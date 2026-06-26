import * as THREE from 'https://esm.sh/three@0.160.0';
import { OrbitControls } from 'https://esm.sh/three@0.160.0/examples/jsm/controls/OrbitControls.js';

export function createEngine(canvas, { reducedMotion = false } = {}) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 2000);
  const home = new THREE.Vector3(0, 40, 360);
  camera.position.copy(home);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true; controls.dampingFactor = 0.08;
  controls.enablePan = false; controls.minDistance = 60; controls.maxDistance = 700;
  controls.autoRotate = !reducedMotion; controls.autoRotateSpeed = 0.35;

  scene.add(new THREE.AmbientLight(0xffffff, 0.6));
  const key = new THREE.PointLight(0xffffff, 1.2, 0, 0); key.position.set(120, 200, 200); scene.add(key);

  function resize() {
    const r = canvas.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
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
    renderer.render(scene, camera);
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
