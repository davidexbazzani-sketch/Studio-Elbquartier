// FUNKL-Intro: Motion Graphics in Echtzeit (three.js + GSAP).
// Ablauf: Funke → Explosion bunter Formen → (Logo baut sich im HTML darüber zusammen) →
// die Dose fliegt mit Salto herein, beschlägt, Flüssigkeitsbänder wickeln sich um sie →
// danach wechseln die Sorten im Takt: Dose dreht sich, Farben fluten den Raum, Spritzer fliegen.

import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createCan, Condensation, makeLabel, warmLabels, FRONT_YAW, CAN } from './can.js';
import { FLAVORS, studioHDR } from './funkl-data.js';

const TAU = Math.PI * 2;
const { lerp, clamp } = THREE.MathUtils;

/* ---------- Hintergrund: fließender Farbverlauf mit Sonnenstrahlen ---------- */
function backdrop() {
  const mat = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 }, uAspect: { value: 1 },
      uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
      uReveal: { value: 0 }, uRays: { value: 0 }, uFlash: { value: 0 },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.9999, 1.0); }',
    fragmentShader: /* glsl */`
      uniform float uTime, uAspect, uReveal, uRays, uFlash;
      uniform vec3 uC1, uC2, uC3;
      varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), u.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), u.x), u.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; } return v; }
      void main(){
        vec2 p = (vUv - 0.5) * vec2(uAspect, 1.0);
        float t = uTime * 0.12;
        // Farbfelder mit verwirbeltem Rauschen
        vec2 q = vec2(fbm(p * 1.6 + t), fbm(p * 1.6 - t + 3.1));
        float n = fbm(p * 1.2 + q * 1.8 + vec2(t * 0.7, -t * 0.4));
        vec3 col = mix(uC1, uC2, smoothstep(0.25, 0.75, n));
        col = mix(col, uC3, smoothstep(0.55, 0.95, fbm(p * 2.2 - q + t * 0.5)) * 0.85);
        // Lichtkegel in der Mitte
        float r = length(p);
        col += 0.22 * exp(-r * r * 3.0);
        // Sonnenstrahlen (Pop-Art), drehen sich langsam
        float a = atan(p.y, p.x) + uTime * 0.08;
        float rays = smoothstep(0.0, 0.08, sin(a * 14.0)) * smoothstep(1.4, 0.15, r);
        col = mix(col, col * 1.18 + 0.04, rays * uRays * 0.5);
        // Aufdecken vom Zentrum aus (Intro)
        float reveal = smoothstep(uReveal * 1.6 - 0.15, uReveal * 1.6, r);
        col = mix(col, vec3(0.06, 0.03, 0.1), reveal);
        col += uFlash * exp(-r * r * 6.0);
        col += (hash(vUv * 900.0 + uTime) - 0.5) * 0.035; // Korn
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
    depthWrite: false, depthTest: false,
  });
  mat.toneMapped = false;
  const m = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  m.frustumCulled = false;
  m.renderOrder = -10;
  return m;
}

/* ---------- Bonbon-Formen ---------- */
function starShape() {
  const s = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * TAU - Math.PI / 2, r = i % 2 ? 0.09 : 0.2;
    if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  s.closePath();
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.06, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.025, bevelSegments: 3 });
  g.center();
  return g;
}

function shapeKinds() {
  return [
    new THREE.SphereGeometry(0.11, 24, 16),
    new THREE.TorusGeometry(0.11, 0.045, 14, 36),
    new THREE.CapsuleGeometry(0.06, 0.16, 6, 14),
    new RoundedBoxGeometry(0.18, 0.18, 0.18, 3, 0.045),
    starShape(),
    new THREE.ConeGeometry(0.1, 0.2, 24),
  ];
}

/* ---------- Szene ---------- */
export async function createHero({ container, reducedMotion = false, quality, gsap, onFlavor }) {
  const low = quality === 'low' || window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, low ? 1.5 : 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;';
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  scene.environment = await studioHDR(renderer);
  scene.environmentRotation.set(0, -0.6, 0); // Softboxen seitlich: lange Lichtkanten auf der Dose
  scene.environmentIntensity = 1.05;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);

  const bg = backdrop();
  scene.add(bg);

  // Licht für Farbe auf den Formen (Umgebung macht die Spiegelungen)
  const key = new THREE.DirectionalLight('#ffffff', 1.4);
  key.position.set(2, 4, 5);
  const rim = new THREE.DirectionalLight('#ff9a1f', 3);
  rim.position.set(-1.5, 1.5, -4);
  scene.add(key, rim, new THREE.AmbientLight('#ffffff', 0.35));

  // Dose
  const cond = new Condensation(renderer, { size: low ? 512 : 1024, maxDrops: low ? 320 : 560 });
  // Etiketten nacheinander zeichnen und hochladen, mit Luft dazwischen (Handys: kleinere Zeichenfläche)
  const labels = [];
  for (const f of FLAVORS) {
    const l = makeLabel(f, { scale: low ? 0.75 : 1 });
    warmLabels(renderer, [l]);
    labels.push(l);
    await new Promise((r) => setTimeout(r, 0));
  }
  cond.setLevel(0.75, true);
  await cond.prewarmAsync(20); // frisch aus dem Kühlschrank: schon beschlagen, erste Tropfen laufen gleich
  const can = createCan({ label: labels[0], condensation: cond });
  const canPivot = new THREE.Group(); // schwebt, kippt
  const canSpin = new THREE.Group(); // dreht sich
  canSpin.add(can.group);
  can.group.position.y = -CAN.h / 2;
  can.group.rotation.y = FRONT_YAW;
  canPivot.add(canSpin);
  scene.add(canPivot);

  // Flüssigkeitsbänder: Spiralen um die Dose, werden „aufgewickelt“
  const ribbons = [0, 1].map((k) => {
    const pts = [];
    for (let i = 0; i <= 200; i++) {
      const t = i / 200;
      const a = t * TAU * 1.6 + k * Math.PI;
      const rr = 0.42 + 0.12 * Math.sin(t * Math.PI) + k * 0.05;
      pts.push(new THREE.Vector3(Math.cos(a) * rr, -0.9 + t * 1.9 + Math.sin(t * 9 + k) * 0.05, Math.sin(a) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    const geo = new THREE.TubeGeometry(curve, 360, k ? 0.022 : 0.034, 12, false);
    const mat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.08, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.04, transmission: 0, sheen: 0.5, envMapIntensity: 1.3 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.total = geo.index.count;
    geo.setDrawRange(0, 0);
    canPivot.add(mesh);
    return mesh;
  });

  // Bonbon-Formen rund um die Dose
  const kinds = shapeKinds();
  const perKind = low ? 4 : 6;
  const shapeMat = new THREE.MeshPhysicalMaterial({ roughness: 0.18, metalness: 0.0, clearcoat: 1, clearcoatRoughness: 0.06, envMapIntensity: 0.9 });
  const shapes = [];
  const meshes = kinds.map((geo, k) => {
    const im = new THREE.InstancedMesh(geo, shapeMat, perKind);
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    for (let i = 0; i < perKind; i++) {
      const s = {
        mesh: im, i,
        a: Math.random() * TAU, // Winkel auf der Umlaufbahn
        r: 1.15 + Math.random() * 1.7, // Abstand zur Dose (innen bleibt frei)
        y: (Math.random() - 0.5) * 2.4,
        z: -0.4 - Math.random() * 1.6, // eher hinter der Dose
        spin: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4),
        size: 0.35 + Math.pow(Math.random(), 2.4) * 1.5, // wenige große, viele kleine
        speed: 0.15 + Math.random() * 0.35,
        phase: Math.random() * TAU,
        col: new THREE.Color(), colT: new THREE.Color(),
        slot: Math.floor(Math.random() * 3),
      };
      if (s.size > 1.1) { s.r = Math.max(s.r, 2.3); s.z = Math.min(s.z, -1.2); } // große Formen weit außen und hinten
      shapes.push(s);
      im.setColorAt(i, s.col);
    }
    scene.add(im);
    return im;
  });

  // Spritzer: kleine Tropfen in Sortenfarbe
  const splashN = low ? 28 : 44;
  const splashMat = new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.02, clearcoat: 1, envMapIntensity: 1.8, transparent: true, opacity: 0.78, ior: 1.33 });
  const splash = new THREE.InstancedMesh(new THREE.SphereGeometry(0.035, 12, 8), splashMat, splashN);
  splash.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const drops = Array.from({ length: splashN }, () => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), life: 0, s: 1 }));
  scene.add(splash);

  // Perlen (Kohlensäure), steigen auf
  const fizzN = low ? 80 : 180;
  const fizzGeo = new THREE.BufferGeometry();
  const fizzPos = new Float32Array(fizzN * 3), fizzSeed = new Float32Array(fizzN);
  for (let i = 0; i < fizzN; i++) { fizzPos[i * 3] = (Math.random() - 0.5) * 6; fizzPos[i * 3 + 1] = (Math.random() - 0.5) * 4; fizzPos[i * 3 + 2] = (Math.random() - 0.5) * 3; fizzSeed[i] = Math.random(); }
  fizzGeo.setAttribute('position', new THREE.BufferAttribute(fizzPos, 3));
  fizzGeo.setAttribute('seed', new THREE.BufferAttribute(fizzSeed, 1));
  const fizzMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uPx: { value: renderer.getPixelRatio() }, uAlpha: { value: 0 } },
    vertexShader: `attribute float seed; uniform float uTime, uPx; varying float vS;
      void main(){ vec3 p = position; p.y = mod(p.y + uTime * (0.25 + seed * 0.5) + 2.0, 4.0) - 2.0; p.x += sin(uTime * 2.0 + seed * 20.0) * 0.04;
        vS = seed; vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (6.0 + seed * 18.0) * uPx / -mv.z * 3.0; }`,
    fragmentShader: `uniform float uAlpha; varying float vS;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
        float ring = smoothstep(0.5, 0.42, d) - smoothstep(0.4, 0.2, d) * 0.7; float hl = smoothstep(0.18, 0.0, length(c - vec2(-0.15, -0.15)));
        gl_FragColor = vec4(vec3(1.0), (ring * 0.55 + hl * 0.8) * uAlpha); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const fizz = new THREE.Points(fizzGeo, fizzMat);
  scene.add(fizz);

  /* ---------- Zustand, der von GSAP animiert wird ---------- */
  const S = {
    burst: 0, // Formen fliegen aus der Mitte heraus
    swirl: 0, // Drehgeschwindigkeit der Formen
    spread: 1,
    canY: -4.2, canFlip: -TAU, canScale: 1, canSpinT: 0, canSpin: 0,
    ribbon: 0, fizz: 0, cold: 0,
    flavor: 0,
  };
  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };
  addEventListener('pointermove', (e) => {
    pointer.tx = (e.clientX / innerWidth) * 2 - 1;
    pointer.ty = (e.clientY / innerHeight) * 2 - 1;
  }, { passive: true });

  function setPalette(f, instant) {
    const pal = FLAVORS[f].palette.map((c) => new THREE.Color(c));
    const u = bg.material.uniforms;
    if (instant || !gsap) { u.uC1.value.copy(pal[0]); u.uC2.value.copy(pal[1]); u.uC3.value.copy(pal[2]); }
    else ['uC1', 'uC2', 'uC3'].forEach((k, i) => gsap.to(u[k].value, { r: pal[i].r, g: pal[i].g, b: pal[i].b, duration: 1.1, ease: 'power2.inOut' }));
    const shapeCols = [FLAVORS[f].colors[1], FLAVORS[f].colors[0], ...FLAVORS[f].accent, '#ffffff', FLAVORS[f].palette[2]];
    shapes.forEach((s, k) => { s.colT.set(shapeCols[(k + s.slot) % shapeCols.length]); if (instant) s.col.copy(s.colT); });
    const main = new THREE.Color(FLAVORS[f].colors[1]), alt = new THREE.Color(FLAVORS[f].palette[2]);
    ribbons[0].material.color.copy(main); ribbons[1].material.color.copy(alt);
    splashMat.color.copy(main).lerp(new THREE.Color('#ffffff'), 0.35);
    rim.color.set(FLAVORS[f].colors[1]);
  }
  setPalette(0, true);

  function burstSplash() {
    drops.forEach((d) => {
      const a = Math.random() * TAU, up = Math.random();
      d.p.set(Math.cos(a) * 0.3, (Math.random() - 0.3) * 0.8, Math.sin(a) * 0.3);
      d.v.set(Math.cos(a) * (1.2 + Math.random() * 2), 1 + up * 2.6, Math.sin(a) * (1.2 + Math.random() * 2));
      d.life = 1; d.s = 0.4 + Math.random() * 0.9;
    });
  }

  /* ---------- Choreografie ---------- */
  let master = null;
  function nextFlavor() {
    const tl = gsap.timeline();
    tl.fromTo(S, { canSpinT: 0 }, { canSpinT: TAU, duration: 1.1, ease: 'expo.inOut', immediateRender: false })
      .call(() => { const f = (S.flavor + 1) % FLAVORS.length; can.setLabel(labels[f]); S.flavor = f; setPalette(f); onFlavor?.(f); burstSplash(); }, null, 0.5)
      .fromTo(S, { ribbon: 1 }, { ribbon: 0, duration: 0.45, ease: 'power2.in', immediateRender: false }, 0)
      .to(S, { ribbon: 1, duration: 1.4, ease: 'power2.out' }, 0.75)
      .fromTo(bg.material.uniforms.uFlash, { value: 0.0 }, { value: 0.35, duration: 0.18, yoyo: true, repeat: 1, ease: 'power1.out', immediateRender: false }, 0.5)
      .fromTo(S, { canScale: 1 }, { canScale: 1.06, duration: 0.3, yoyo: true, repeat: 1, ease: 'power2.out', immediateRender: false }, 0.5);
    return tl;
  }

  function intro() {
    const u = bg.material.uniforms;
    const tl = gsap.timeline();
    tl.set(S, { burst: 0, canY: -4.2, canFlip: -TAU * 1.0, ribbon: 0, fizz: 0 })
      .set(u.uReveal, { value: 0 })
      .to(u.uFlash, { value: 1.6, duration: 0.22, ease: 'power3.in' })
      .to(u.uReveal, { value: 1, duration: 1.0, ease: 'expo.out' }, '>-0.05')
      .to(u.uFlash, { value: 0, duration: 0.8, ease: 'power2.out' }, '<')
      .to(S, { burst: 1, duration: 1.6, ease: 'expo.out' }, '<')
      .to(S, { swirl: 1, duration: 2, ease: 'power2.inOut' }, '<0.2')
      .to(u.uRays, { value: 1, duration: 2 }, '<')
      // Dose: von unten mit Salto in die Mitte
      .to(S, { canY: 0, duration: 1.4, ease: 'back.out(1.4)' }, 1.9)
      .to(S, { canFlip: 0, duration: 1.4, ease: 'power3.out' }, '<')
      .call(() => { burstSplash(); }, null, 2.6)
      .to(S, { ribbon: 1, duration: 1.6, ease: 'power2.out' }, 2.5)
      .to(S, { fizz: 1, duration: 1.5 }, 2.4);
    return tl;
  }

  function play() {
    if (!gsap || reducedMotion) {
      Object.assign(S, { burst: 1, swirl: 0.3, canY: 0, canFlip: 0, ribbon: 1, fizz: 1 });
      bg.material.uniforms.uReveal.value = 1; bg.material.uniforms.uRays.value = 1;

      return;
    }
    master = gsap.timeline();
    master.add(intro());
    // danach im Takt: 3,6 s zeigen, dann Sortenwechsel (Dreh, Farbflut, Spritzer)
    const loop = gsap.timeline({ repeat: -1 });
    loop.add(nextFlavor(), 3.6);
    master.add(loop, 4.4);
  }

  /* ---------- Schleife ---------- */
  const tmpM = new THREE.Matrix4(), tmpQ = new THREE.Quaternion(), tmpE = new THREE.Euler(), tmpS = new THREE.Vector3(), tmpP = new THREE.Vector3();
  let visible = true, raf = 0, last = performance.now(), time = 0, running = false, lookY = 0.16;

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    time += dt;
    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 3);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 3);

    const u = bg.material.uniforms;
    u.uTime.value = time;

    // Dose
    canPivot.position.set(pointer.x * 0.08, S.canY + Math.sin(time * 1.3) * 0.04 + 0.05, 0);
    canPivot.rotation.set(0.06 + pointer.y * 0.08 + S.canFlip, 0, -0.08 + Math.sin(time * 0.9) * 0.03 - pointer.x * 0.06);
    canSpin.rotation.y = S.canSpinT + Math.sin(time * 0.6) * 0.22;
    canPivot.scale.setScalar(S.canScale);

    // Kondenswasser
    cond.step(dt);
    cond.render(dt);

    // Bänder
    ribbons.forEach((rb, k) => {
      const n = Math.floor(rb.userData.total * clamp(S.ribbon * (k ? 0.92 : 1), 0, 1) / 3) * 3;
      rb.geometry.setDrawRange(0, n);
      rb.rotation.y = time * (k ? -0.5 : 0.4);
    });

    // Formen
    const swirl = S.swirl;
    for (const s of shapes) {
      s.a += dt * s.speed * (0.25 + swirl);
      const b = S.burst;
      const rr = s.r * b * S.spread;
      tmpP.set(Math.cos(s.a) * rr, s.y * b + Math.sin(time * 0.8 + s.phase) * 0.12, Math.sin(s.a) * rr * 0.7 + s.z * b * 0.4);
      // Freiraum um die Dose: was vorn und mittig wäre, weicht zur Seite aus
      const near = Math.max(0, 0.95 - Math.abs(tmpP.x));
      if (tmpP.z > -0.3 && Math.abs(tmpP.y) < 1.0) tmpP.x += Math.sign(tmpP.x || 1) * near * b;
      tmpP.x += -pointer.x * 0.25 * (tmpP.z + 2) * 0.3;
      tmpP.y += pointer.y * 0.18 * (tmpP.z + 2) * 0.3;
      tmpE.set(s.spin.x * time * 0.3 + s.phase, s.spin.y * time * 0.3, s.spin.z * time * 0.3);
      tmpQ.setFromEuler(tmpE);
      const sc = s.size * Math.min(1, b * 1.6);
      tmpS.set(sc, sc, sc);
      tmpM.compose(tmpP, tmpQ, tmpS);
      s.mesh.setMatrixAt(s.i, tmpM);
      s.col.lerp(s.colT, Math.min(1, dt * 3));
      s.mesh.setColorAt(s.i, s.col);
    }
    meshes.forEach((m) => { m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; });

    // Spritzer
    let any = false;
    drops.forEach((d, i) => {
      if (d.life > 0) {
        any = true;
        d.v.y -= 6.5 * dt;
        d.p.addScaledVector(d.v, dt);
        d.life -= dt * 1.6;
      }
      const sc = Math.max(0, d.life) * d.s;
      tmpQ.identity();
      tmpS.set(sc, sc * (1 + Math.min(1.5, d.v.length() * 0.15)), sc);
      tmpM.compose(tmpP.copy(d.p).add(canPivot.position), tmpQ, tmpS);
      splash.setMatrixAt(i, tmpM);
    });
    splash.visible = any;
    splash.instanceMatrix.needsUpdate = true;

    fizzMat.uniforms.uTime.value = time;
    fizzMat.uniforms.uAlpha.value = S.fizz;

    camera.position.set(pointer.x * 0.15, 0.1 - pointer.y * 0.1, camera.position.z);
    camera.lookAt(0, lookY, 0); // Platz für Logo oben und Text unten
    renderer.render(scene, camera);
    if (visible) raf = requestAnimationFrame(frame); else running = false;
  }
  function kick() { if (running || !visible) return; running = true; last = performance.now(); raf = requestAnimationFrame(frame); }

  function resize(w = container.clientWidth, h = container.clientHeight) {
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    // Dose ~52 % der Bildhöhe, hochkant etwas kleiner
    const vis = CAN.h / (camera.aspect < 0.8 ? 0.36 : 0.6);
    lookY = camera.aspect < 0.8 ? -0.38 : 0.2; // hochkant: Dose höher, unten liegt der Text
    camera.position.z = vis / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    camera.updateProjectionMatrix();
    bg.material.uniforms.uAspect.value = camera.aspect;
    S.spread = camera.aspect < 0.8 ? 0.62 : 1;
  }
  const ro = new ResizeObserver(() => resize());
  ro.observe(container);
  // Shader im Hintergrund übersetzen, bevor gezeichnet wird (sonst hakt die Seite beim ersten Bild)
  resize();
  if (renderer.compileAsync) await renderer.compileAsync(scene, camera);
  const io = new IntersectionObserver(([e]) => {
    if (paused) return;
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) { kick(); master?.resume(); } else master?.pause();
  });
  io.observe(container);
  document.addEventListener('visibilitychange', () => {
    visible = document.visibilityState === 'visible';
    if (visible) { kick(); master?.resume(); } else master?.pause();
  });
  resize();
  if (!renderer.compileAsync) renderer.compile(scene, camera);

  let paused = false;
  return {
    play() { play(); kick(); },
    pause() { paused = true; master?.pause(); visible = false; },
    resume() { paused = false; master?.resume(); visible = true; kick(); },
    canvas, renderer, scene, camera, state: S,
    /** Standbild (für die ruhige Ansicht) */
    snapshot({ width, height, type = 'image/webp', quality: qq = 0.88 } = {}) {
      renderer.setPixelRatio(1);
      resize(width, height);
      frame(performance.now());
      const url = canvas.toDataURL(type, qq);
      resize();
      return url;
    },
    dispose() { cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); cond.dispose(); renderer.dispose(); canvas.remove(); },
  };
}
