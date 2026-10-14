// Klarsund – Produktansicht: Brille in 3D auf hellem Studiogrund, langsam drehend, per Ziehen drehbar.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createBrille } from './brillen.js';

export function createAnsicht(container, { auto = true, hell = '#f1eee8' } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping; renderer.toneMappingExposure = 1.05;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.cssText = 'width:100%;height:100%;display:block;touch-action:pan-y';
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(renderer);
  scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.9;
  const camera = new THREE.PerspectiveCamera(26, 1, 1, 400);
  camera.position.set(0, 6, 37); camera.lookAt(0, -0.6, 0);
  const key = new THREE.DirectionalLight('#fff7ee', 2.2); key.position.set(-14, 30, 18);
  key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 6;
  Object.assign(key.shadow.camera, { left: -14, right: 14, top: 14, bottom: -14, near: 1, far: 80 });
  scene.add(key, new THREE.HemisphereLight('#ffffff', '#d9d2c6', 0.5));
  // Boden fängt nur den Schatten auf (Hintergrund kommt aus dem CSS)
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.16 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -3.1; floor.receiveShadow = true; scene.add(floor);
  const pivot = new THREE.Group(); scene.add(pivot);
  let brille = null, yaw = -0.5, vel = 0, drag = null, visible = true, raf = 0, last = performance.now();

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    camera.fov = w / h < 1 ? 36 : 27; camera.updateProjectionMatrix();
  }
  resize(); new ResizeObserver(resize).observe(container);

  const el = renderer.domElement;
  el.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, t: performance.now() }; el.setPointerCapture(e.pointerId); });
  el.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; drag.x = e.clientX; yaw += dx * 0.012; vel = dx * 0.012 / Math.max(1 / 60, (performance.now() - drag.t) / 1000); drag.t = performance.now(); });
  el.addEventListener('pointerup', () => { drag = null; });
  new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) loop(); }).observe(container);

  function loop() {
    cancelAnimationFrame(raf);
    if (!visible) return;
    raf = requestAnimationFrame(loop);
    const now = performance.now(), dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!drag) { vel *= Math.exp(-dt * 3); yaw += vel * dt + (auto ? dt * 0.22 : 0); }
    pivot.rotation.y = yaw;
    pivot.position.y = Math.sin(now / 1400) * 0.12;
    renderer.render(scene, camera);
  }
  loop();

  return {
    async set(id, farbe, glas) {
      const key = `${id}|${farbe}|${glas}`; this.key = key;
      const b = await createBrille(id, farbe, glas);
      if (this.key !== key) return;
      b.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      // Bügel halb geöffnet: Brille steht leicht schräg, Front zur Kamera
      b.position.set(0, 0, 3.2);
      if (brille) pivot.remove(brille);
      brille = b; pivot.add(b);
    },
    snapTo(y) { yaw = y; vel = 0; },
  };
}
