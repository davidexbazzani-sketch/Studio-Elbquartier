// Showroom für das Autohaus: ein heller Ausstellungsraum mit poliertem Steinboden,
// Lichtbändern an der Decke, Leuchtwänden und einer bündig eingelassenen Drehscheibe.
//
// Damit die Autos echt wirken (und nicht wie Spielzeug):
// - Licht und Spiegelungen kommen aus demselben Raum (Umgebung wird aus der Raumgeometrie
//   berechnet), die Lichtbänder laufen also sichtbar über Dach und Motorhaube
// - Lack mit Klarlackschicht, Glas, Chrom, Gummi und Kunststoff mit echten Werten
// - Boden mit weicher Spiegelung (Fresnel, unscharf wie polierter Stein), Fugen und
//   leichter Unregelmäßigkeit; Kontaktschatten unter jedem Auto
// - Umgebungsverdeckung (GTAO) für Radkästen, Fugen und den Spalt unter dem Auto
// - Kamera in Augenhöhe mit Teleobjektiv-Brennweite, wie man vor einem Auto steht
//
// Rendert nur, wenn sich etwas bewegt. Auf Handys ohne GTAO und mit kleinerer Spiegelung.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { GTAOPass } from 'three/addons/postprocessing/GTAOPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { CARS } from './cars.js';

const { clamp, lerp, damp } = THREE.MathUtils;
const TAU = Math.PI * 2;

// Raummaße (Meter)
const FLOOR_R = 10.3; // ebener Boden bis zur Hohlkehle
const COVE_R = 1.2; // Radius der Hohlkehle zwischen Boden und Wand
const WALL_R = FLOOR_R + COVE_R;
const CEIL_Y = 6.2;
const PLATFORM_R = 3.3; // Drehscheibe
const SLOTS = 12; // senkrechte Lichtfugen in der Wand

/* ------------------------------------------------------------------ */
/* Raum                                                                 */
/* ------------------------------------------------------------------ */

function basic(color, intensity = 1) {
  return new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) });
}

// Wand mit Hohlkehle als Drehkörper, Helligkeit über Vertex-Farben:
// Hohlkehle dunkler (klare Horizontlinie in den Flanken), Wand in Augenhöhe am hellsten, oben dunkler
function buildWalls(env) {
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * (Math.PI / 2);
    pts.push(new THREE.Vector2(FLOOR_R + Math.sin(a) * COVE_R, COVE_R - Math.cos(a) * COVE_R));
  }
  for (let i = 1; i <= 12; i++) pts.push(new THREE.Vector2(WALL_R, COVE_R + (i / 12) * (CEIL_Y - COVE_R)));
  const geo = new THREE.LatheGeometry(pts, 144);
  const pos = geo.attributes.position;
  const col = new Float32Array(pos.count * 3);
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    let v;
    if (env) v = y < COVE_R * 0.9 ? 0.07 : 0.3 + 0.1 * Math.exp(-((y - 2.2) ** 2) / 2);
    else v = 0.5 + 0.26 * Math.exp(-((y - 2.4) ** 2) / 5) - 0.1 * Math.max(0, 1 - y / COVE_R) - 0.16 * Math.max(0, (y - 4.2) / 2);
    col[i * 3] = v * 0.99; col[i * 3 + 1] = v * 0.995; col[i * 3 + 2] = v;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide }));
}

// env = true: Fassung für Licht und Spiegelungen (dunkle Flächen, kräftige Lichtquellen, zusätzliche Softboxen)
function buildRoom({ env = false } = {}) {
  const room = new THREE.Group();
  room.name = 'raum';
  room.add(buildWalls(env));
  const strips = []; // alles, was leuchtet (wird beim „Licht an“ hochgefahren)
  const light = (mesh) => { mesh.userData.base = mesh.material.color.clone(); strips.push(mesh); room.add(mesh); return mesh; };

  const ceiling = new THREE.Mesh(new THREE.CircleGeometry(WALL_R, 96), basic('#ffffff', env ? 0.06 : 0.5));
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = CEIL_Y;
  room.add(ceiling);

  // Lichtbänder an der Decke längs zum Auto: die typischen Streifen auf Dach und Haube
  for (let i = -2; i <= 2; i++) {
    // breite, weiche Bänder: schmale Linien zeichnen auf leicht unebenen Modellen Zickzack-Kanten
    const s = light(new THREE.Mesh(new THREE.PlaneGeometry(9, env ? 0.42 : 0.2), basic('#fffaf2', env ? 8 : 6)));
    s.rotation.x = Math.PI / 2;
    s.position.set(0, CEIL_Y - 0.02, i * 1.45);
  }
  // große Softbox über der Drehscheibe
  const soft = light(new THREE.Mesh(new THREE.PlaneGeometry(5.6, 3.0), basic('#fff8ee', env ? 7 : 1.6)));
  soft.rotation.x = Math.PI / 2;
  soft.position.y = CEIL_Y - 0.05;

  // senkrechte Lichtfugen in der Wand: Architektur im Bild und lange Lichtkanten auf den Flanken
  for (let i = 0; i < SLOTS; i++) {
    const a = (i / SLOTS) * Math.PI * 2 + Math.PI / SLOTS;
    const hSlot = CEIL_Y - COVE_R - 0.1;
    const slot = light(new THREE.Mesh(new THREE.PlaneGeometry(env ? 0.12 : 0.06, hSlot), basic('#fff7ec', env ? 9 : 2.2)));
    slot.position.set(Math.sin(a) * (WALL_R - 0.03), COVE_R + 0.1 + hSlot / 2, Math.cos(a) * (WALL_R - 0.03));
    slot.lookAt(0, slot.position.y, 0);
  }

  if (env) {
    // seitliche Softboxen wie im Fotostudio (nur in den Spiegelungen)
    for (const z of [-1, 1]) {
      const box = light(new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), basic('#fffaf3', 6)));
      box.position.set(0, 1.0, z * (WALL_R - 0.4));
      box.lookAt(0, 1.0, 0);
    }
    // Lichtfuge rundum in Höhe der Hohlkehle: lange, klare Kante auf Türen und Flanken
    const band = light(new THREE.Mesh(new THREE.CylinderGeometry(WALL_R - 0.05, WALL_R - 0.05, 0.06, 144, 1, true), basic('#fff6ea', 5)));
    band.material.side = THREE.BackSide;
    band.position.y = COVE_R + 0.25;
  }
  return { room, strips };
}

// Umgebung für Licht und Spiegelungen aus derselben Raumgeometrie (Kamera auf 1 m Höhe).
// mirror = true liefert die an der Bodenebene gespiegelte Umgebung für das Spiegelbild im Boden.
function captureEnvironment(renderer, mirror) {
  const env = new THREE.Scene();
  const { room } = buildRoom({ env: true });
  const floor = new THREE.Mesh(new THREE.CircleGeometry(WALL_R, 64), basic('#d6d4cf', 0.34));
  floor.rotation.x = -Math.PI / 2;
  room.add(floor);
  room.position.y = mirror ? 1 : -1;
  room.scale.y = mirror ? -1 : 1;
  env.add(room);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(env, 0, 0.1, 60);
  pmrem.dispose();
  env.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return rt.texture;
}

/* ------------------------------------------------------------------ */
/* Boden mit weicher Spiegelung                                          */
/* ------------------------------------------------------------------ */

function floorMaterial() {
  return new THREE.ShaderMaterial({
    uniforms: {
      tReflect: { value: null },
      uViewport: { value: new THREE.Vector2(1, 1) },
      uAngle: { value: 0 },
      uPlatR: { value: PLATFORM_R },
      uAlbedo: { value: new THREE.Color('#d9d7d2') },
      uLight: { value: 0.62 },
      uReflect: { value: 1 },
      tShadow: { value: null },
      uShadowBox: { value: new THREE.Vector4(0, 0, 1, 1) }, // Mitte x/z und Größe im Fahrzeug-System
      uShadow: { value: 0 },
    },
    vertexShader: /* glsl */`
      varying vec3 vWorld;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vWorld = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */`
      uniform sampler2D tReflect;
      uniform vec2 uViewport;
      uniform float uAngle, uPlatR, uLight, uReflect;
      uniform vec3 uAlbedo;
      uniform sampler2D tShadow;
      uniform vec4 uShadowBox;
      uniform float uShadow;
      varying vec3 vWorld;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
      }
      float fbm(vec2 p) { return noise(p) * 0.5 + noise(p * 2.07) * 0.3 + noise(p * 4.13) * 0.2; }

      void main() {
        vec2 p = vWorld.xz;
        float r = length(p);
        float dist = length(cameraPosition - vWorld);
        float onPlat = 1.0 - smoothstep(uPlatR - 0.004, uPlatR + 0.004, r);
        float c = cos(uAngle), s = sin(uAngle);
        vec2 q = mat2(c, -s, s, c) * p;

        // gegossener, polierter Boden: fugenlos, nur sehr feine Dehnfugen alle 4,5 m (verblassen mit Abstand)
        vec2 t = p / 4.5 + 0.5;
        vec2 g = abs(fract(t) - 0.5);
        float fw = fwidth(t.x) + fwidth(t.y);
        float joint = (1.0 - smoothstep(0.0, 0.0007 + fw * 0.5, 0.5 - max(g.x, g.y))) * (1.0 - smoothstep(4.0, 11.0, dist)) * (1.0 - onPlat);
        // Drehscheibe: feiner Schliff in Drehrichtung (bewegt sich mit)
        float ang = atan(q.y, q.x);
        float grain = noise(vec2(ang * 160.0, length(q) * 2.5)) - 0.5;
        float mottling = (fbm(p * 0.9) - 0.5) * 0.07 + (fbm(p * 5.0) - 0.5) * 0.025 + (hash(floor(p * 140.0)) - 0.5) * 0.012;
        vec3 albedo = uAlbedo * (1.0 + mottling + onPlat * (grain * 0.015 - 0.03)) * (1.0 - joint * 0.06);

        float seam = 1.0 - smoothstep(0.0, 0.005 + fwidth(r), abs(r - uPlatR));

        // Licht: hell unter der Softbox, zu den Wänden ~35 % dunkler
        float light = uLight * mix(0.65, 1.0, exp(-r * r / 40.0));
        vec3 diffuse = albedo * light;

        // Kontaktschatten im Fahrzeug-System (dreht mit der Scheibe), Bild oben = -z, rechts = -x
        vec2 suv = vec2(0.5 - (q.x - uShadowBox.x) / uShadowBox.z, 0.5 - (q.y - uShadowBox.y) / uShadowBox.w);
        float inBox = step(0.0, suv.x) * step(suv.x, 1.0) * step(0.0, suv.y) * step(suv.y, 1.0);
        float shA = texture2D(tShadow, clamp(suv, 0.0, 1.0)).a * inBox * uShadow;
        float sh = smoothstep(0.0, 0.42, shA);

        // Spiegelung: nah am Auto schärfer, weiter weg weicher (wie polierter Stein)
        vec2 uv = gl_FragCoord.xy / uViewport;
        vec2 wob = (vec2(noise(p * 7.0), noise(p * 7.0 + 7.3)) - 0.5) * 0.003;
        vec3 V = normalize(cameraPosition - vWorld);
        float cosT = clamp(V.y, 0.0, 1.0);
        float F = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);
        float lod = mix(2.6, 1.3, smoothstep(0.0, 0.25, shA)) + noise(p * 2.5) * 0.6 + onPlat * 0.3;
        vec2 px = exp2(lod) / uViewport;
        vec3 refl = textureLod(tReflect, uv + wob, lod).rgb * 0.28;
        refl += textureLod(tReflect, uv + wob + vec2( 1.5,  0.6) * px, lod).rgb * 0.18;
        refl += textureLod(tReflect, uv + wob + vec2(-1.5, -0.6) * px, lod).rgb * 0.18;
        refl += textureLod(tReflect, uv + wob + vec2(-0.6,  1.5) * px, lod).rgb * 0.18;
        refl += textureLod(tReflect, uv + wob + vec2( 0.6, -1.5) * px, lod).rgb * 0.18;
        float reflAmt = F * 0.55 * uReflect * (1.0 - seam * 0.8);

        diffuse *= 1.0 - sh * 0.93;
        reflAmt *= 1.0 - sh * 0.8;
        vec3 col = diffuse * (1.0 - F * 0.5) + refl * reflAmt;
        col *= 1.0 - seam * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/* ------------------------------------------------------------------ */
/* Kontaktschatten (einmal je Auto berechnet, liegt auf der Drehscheibe) */
/* ------------------------------------------------------------------ */

function bakeContactShadow(renderer, car, box) {
  const size = 256;
  const pad = 1.0;
  const w = box.max.x - box.min.x + pad * 2;
  const d = box.max.z - box.min.z + pad * 2;
  const cx = (box.min.x + box.max.x) / 2, cz = (box.min.z + box.max.z) / 2;
  const height = 2.4; // alles darüber (auch das Dach, falls der Unterboden fehlt) beschattet den Boden

  const cam = new THREE.OrthographicCamera(-w / 2, w / 2, d / 2, -d / 2, 0, height);
  cam.position.set(cx, 0, cz);
  cam.up.set(0, 0, -1); // Bildoberkante = -z, damit die Textur ohne Spiegelung auf die Ebene passt
  cam.lookAt(cx, 1, cz);

  const depthMat = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    vertexShader: 'varying float vH; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vH = w.y; gl_Position = projectionMatrix * viewMatrix * w; }',
    // breiter weicher Anteil für die ganze Grundfläche + kräftiger Anteil nah am Boden (Reifen, Schweller)
    fragmentShader: `varying float vH; void main(){
      float wide = 0.62 * (1.0 - clamp(vH / ${height.toFixed(2)}, 0.0, 1.0));
      float near = pow(1.0 - clamp(vH / 0.32, 0.0, 1.0), 2.0);
      gl_FragColor = vec4(vec3(0.0), max(wide, near)); }`,
  });
  const mk = () => new THREE.WebGLRenderTarget(size, Math.round(size * d / w), { type: THREE.HalfFloatType });
  const rtA = mk(), rtB = mk();

  const scene = new THREE.Scene();
  scene.overrideMaterial = depthMat;
  const parent = car.parent;
  scene.add(car);
  const prevClear = renderer.getClearColor(new THREE.Color()), prevAlpha = renderer.getClearAlpha();
  renderer.setClearColor(0x000000, 0);
  renderer.setRenderTarget(rtA);
  renderer.clear();
  renderer.render(scene, cam);
  scene.remove(car);
  if (parent) parent.add(car);

  // weichzeichnen: zweimal horizontal + vertikal
  const blur = new THREE.ShaderMaterial({
    uniforms: { t: { value: null }, dir: { value: new THREE.Vector2() } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D t; uniform vec2 dir; varying vec2 vUv;
      void main(){ vec4 s = vec4(0.0);
        float w[5]; w[0]=0.227; w[1]=0.1945; w[2]=0.1216; w[3]=0.054; w[4]=0.0162;
        s += texture2D(t, vUv) * w[0];
        for (int i = 1; i < 5; i++) { s += texture2D(t, vUv + dir * float(i)) * w[i]; s += texture2D(t, vUv - dir * float(i)) * w[i]; }
        gl_FragColor = s; }`,
    depthTest: false, depthWrite: false,
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), blur);
  const qs = new THREE.Scene(); qs.add(quad);
  const qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const pass = (from, to, dx, dy) => {
    blur.uniforms.t.value = from.texture;
    blur.uniforms.dir.value.set(dx / from.width, dy / from.height);
    renderer.setRenderTarget(to); renderer.render(qs, qc);
  };
  for (const s of [1.0, 2.2, 4.5]) { pass(rtA, rtB, s, 0); pass(rtB, rtA, 0, s); }
  renderer.setRenderTarget(null);
  renderer.setClearColor(prevClear, prevAlpha);
  rtB.dispose(); blur.dispose(); quad.geometry.dispose(); depthMat.dispose();

  return { texture: rtA.texture, box: new THREE.Vector4(cx, cz, w, d), dispose: () => rtA.dispose() };
}

/* ------------------------------------------------------------------ */
/* Materialien der Autos                                                */
/* ------------------------------------------------------------------ */

function makePaint() {
  const m = new THREE.MeshPhysicalMaterial({
    name: 'lack',
    color: '#888888',
    metalness: 0.55,
    roughness: 0.32,
    clearcoat: 1,
    clearcoatRoughness: 0.025,
    envMapIntensity: 1,
  });
  m.userData.flakes = FLAKES;
  return m;
}

export function applyPaint(mat, paint) {
  mat.color.set(paint.color);
  const lum = mat.color.r * 0.2126 + mat.color.g * 0.7152 + mat.color.b * 0.0722;
  if (paint.kind === 'metallic') {
    Object.assign(mat, { metalness: lum < 0.02 ? 0.5 : lum > 0.3 ? 0.85 : 0.62, roughness: lum < 0.02 ? 0.35 : 0.38, clearcoat: 1, clearcoatRoughness: mat.userData.soften ?? 0.03 });
    mat.normalScale.set(0.09, 0.09); // feine Effektpigmente unter dem Klarlack
    mat.normalMap = mat.userData.flakes || null;
  } else if (paint.kind === 'matte') {
    Object.assign(mat, { metalness: 0.4, roughness: 0.55, clearcoat: 0.1, clearcoatRoughness: 0.6, normalMap: null });
  } else {
    Object.assign(mat, { metalness: 0, roughness: 0.3, clearcoat: 1, clearcoatRoughness: mat.userData.soften ?? 0.03, normalMap: null });
  }
  mat.needsUpdate = true;
}

// Normalmap für Metallic-Effektpigmente (zufällige Plättchen, kachelbar)
function flakeTexture() {
  const n = 256;
  const data = new Uint8Array(n * n * 4);
  for (let i = 0; i < n * n; i++) {
    const x = Math.random() * 2 - 1, y = Math.random() * 2 - 1;
    data[i * 4] = 128 + x * 70; data[i * 4 + 1] = 128 + y * 70; data[i * 4 + 2] = 255; data[i * 4 + 3] = 255;
  }
  const t = new THREE.DataTexture(data, n, n);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(30, 30);
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}
const FLAKES = flakeTexture();

// Händlerschild statt Kennzeichen (wie bei Ausstellungsfahrzeugen üblich)
let plateTex = null;
function plateTexture() {
  if (plateTex) return plateTex;
  const c = document.createElement('canvas');
  c.width = 1040; c.height = 220;
  const g = c.getContext('2d');
  g.fillStyle = '#f4f4f2'; g.fillRect(0, 0, c.width, c.height);
  g.strokeStyle = '#1b1c1d'; g.lineWidth = 10; g.strokeRect(14, 14, c.width - 28, c.height - 28);
  g.fillStyle = '#1b1c1d';
  g.font = '300 110px Inter, Helvetica, Arial, sans-serif';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  if ('letterSpacing' in g) g.letterSpacing = '28px';
  g.fillText('HALDEN', c.width / 2 + 14, 100);
  g.font = '400 34px Inter, Helvetica, Arial, sans-serif';
  if ('letterSpacing' in g) g.letterSpacing = '14px';
  g.fillText('AUTOMOBILE · HAMBURG', c.width / 2 + 7, 170);
  plateTex = new THREE.CanvasTexture(c);
  plateTex.colorSpace = THREE.SRGBColorSpace;
  plateTex.anisotropy = 4;
  return plateTex;
}

// Glas: die Spiegelung bleibt voll erhalten, nur der Durchblick wird über die Deckkraft gesteuert
// (sonst würde three.js auch die Reflexe mit der Deckkraft abschwächen und Scheiben wirken wie graue Folie)
function glassShader(m) {
  m.premultipliedAlpha = true;
  m.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <opaque_fragment>', `
        vec3 glassSpec = outgoingLight - totalDiffuse;
        gl_FragColor = vec4(totalDiffuse * diffuseColor.a + glassSpec, diffuseColor.a);`)
      .replace('#include <premultiplied_alpha_fragment>', '');
  };
  m.customProgramCacheKey = () => 'glas';
}

function refine(src, kind, paintMat) {
  if (kind === 'paint') {
    if (src.aoMap && !paintMat.aoMap) { paintMat.aoMap = src.aoMap; paintMat.needsUpdate = true; }
    return paintMat;
  }
  let m = src;
  if (!src.isMeshPhysicalMaterial) {
    // MeshStandard → Physical (für Klarlack): Standardwerte übernehmen, Physical-Werte bleiben Vorgabe
    m = new THREE.MeshPhysicalMaterial();
    THREE.MeshStandardMaterial.prototype.copy.call(m, src);
    m.defines = { STANDARD: '', PHYSICAL: '' };
  }
  m.transmission = 0; // echte Lichtbrechung kostet einen zusätzlichen Durchgang; Glas unten über Transparenz
  switch (kind) {
    case 'glass':
      Object.assign(m, { metalness: 0, roughness: 0.04, transparent: true, opacity: 0.45, depthWrite: false, envMapIntensity: 2, map: null, metalnessMap: null, roughnessMap: null, alphaMap: null });
      m.color.set('#0c0f11');
      m.specularIntensity = 1; m.ior = 1.52;
      glassShader(m);
      break;
    case 'tint':
      Object.assign(m, { metalness: 0, roughness: 0.06, transparent: true, opacity: 0.6, depthWrite: false, envMapIntensity: 1.6, map: null });
      m.color.set('#050607');
      glassShader(m);
      break;
    case 'lens':
      Object.assign(m, { metalness: 0, roughness: 0.01, transparent: true, opacity: 0.08, depthWrite: false, envMapIntensity: 1.8, map: null, normalMap: m.normalMap });
      m.color.set('#ffffff');
      m.ior = 1.5;
      glassShader(m);
      break;
    case 'rim': // Felge mit Textur: polierte Teile glänzen, lackierte Bereiche bleiben aus der Textur
      Object.assign(m, { roughness: 0.48, envMapIntensity: 2.2 });
      break;
    case 'reflector': // Scheinwerfer-Reflektoren und Leuchten
      // Streuscheibe mit Reflektor dahinter: fängt im hellen Raum viel Licht, sonst wirkt sie wie ein schwarzes Loch
      Object.assign(m, { metalness: 1, roughness: 0.12, clearcoat: 1, clearcoatRoughness: 0.02, envMapIntensity: 1.6, map: null, metalnessMap: null, roughnessMap: null, transparent: false, opacity: 1, depthWrite: true });
      m.color.set('#dfe1e3');
      break;
    case 'chrome':
      Object.assign(m, { metalness: 1, roughness: 0.07, metalnessMap: null, roughnessMap: null, envMapIntensity: 1.6 });
      m.color.set('#e8e8e8');
      break;
    case 'alloy': // Leichtmetallfelge ohne Vorlagen-Textur (deren Färbung passt nicht): helles, fein gebürstetes Aluminium
      Object.assign(m, { metalness: 1, roughness: 0.22, map: null, metalnessMap: null, roughnessMap: null, transparent: false, opacity: 1, envMapIntensity: 1.8 });
      m.color.set('#c3c6ca');
      break;
    case 'satin':
      Object.assign(m, { metalness: 1, roughness: 0.32, transparent: false, opacity: 1, metalnessMap: null, roughnessMap: null });
      m.color.set('#5a5c5e');
      break;
    case 'tire':
      Object.assign(m, { metalness: 0, roughness: 0.88, metalnessMap: null, clearcoat: 0, sheen: 0.2, sheenRoughness: 0.8 });
      if (!m.map) m.color.set('#1c1c1c');
      break;
    case 'plastic':
      Object.assign(m, { metalness: 0, roughness: 0.62, metalnessMap: null, roughnessMap: null, clearcoat: 0 });
      m.color.set('#121212');
      break;
    case 'gloss':
      Object.assign(m, { metalness: 0, roughness: 0.12, metalnessMap: null, roughnessMap: null, clearcoat: 1, clearcoatRoughness: 0.03 });
      m.color.set('#070707');
      break;
    case 'plate':
      Object.assign(m, { map: plateTexture(), color: new THREE.Color('#ffffff'), metalness: 0, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.1, transparent: false, opacity: 1 });
      break;
    case 'caliper':
      Object.assign(m, { metalness: 0.1, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08 });
      break;
    default: {
      // Spiel-Vorlagen haben oft „Metall 1, Rauheit 0“ für alles: das wirkt wie Spielzeug-Chrom
      const lum = m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722;
      if (m.metalness > 0.85 && m.roughness < 0.06 && !m.metalnessMap) {
        if (lum < 0.2) Object.assign(m, { metalness: 0, roughness: 0.35 });
        else Object.assign(m, { roughness: 0.12 });
      }
      if (m.metalness > 0.85 && m.roughness > 0.9 && !m.metalnessMap) m.metalness = 0; // stumpfes „Metall“ = Kunststoff
    }
  }
  m.roughness = Math.max(0.015, m.roughness);
  if (m.transparent && m.opacity > 0.97 && kind === 'keep') { m.transparent = false; m.opacity = 1; }
  m.needsUpdate = true;
  return m;
}

/* ------------------------------------------------------------------ */
/* Showroom                                                             */
/* ------------------------------------------------------------------ */

export async function createShowroom({
  container,
  quality = (window.innerWidth < 768 || (navigator.deviceMemory ?? 8) < 6) ? 'low' : 'high',
  reducedMotion = false,
  preserveDrawingBuffer = false,
  autoRotate = true,
  powerPreference = 'high-performance',
} = {}) {
  const high = quality === 'high';
  const renderer = new THREE.WebGLRenderer({ antialias: !high, alpha: false, preserveDrawingBuffer, powerPreference });
  const dprCap = high ? 1.75 : 1.6;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = reducedMotion ? 1 : 0;
  renderer.setClearColor('#cfcdc8', 1);
  const canvas = renderer.domElement;
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline:none;';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const envMain = captureEnvironment(renderer, false);
  const envMirror = captureEnvironment(renderer, true);
  scene.environment = envMain;
  scene.environmentIntensity = 1;

  const world = new THREE.Group(); // alles außer dem Boden (wird für die Spiegelung umgeklappt)
  scene.add(world);
  const { room, strips } = buildRoom();
  world.add(room);

  const turntable = new THREE.Group();
  world.add(turntable);

  const floorMat = floorMaterial();
  const floor = new THREE.Mesh(new THREE.CircleGeometry(FLOOR_R + 0.02, 128), floorMat);
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.05, 80);

  // Spiegelung: halbe Auflösung, mit Mipmaps für die Unschärfe
  const reflRT = new THREE.WebGLRenderTarget(16, 16, {
    type: THREE.HalfFloatType,
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
    magFilter: THREE.LinearFilter,
  });
  floorMat.uniforms.tReflect.value = reflRT.texture;
  const reflScale = high ? 0.5 : 0.36;

  // Nachbearbeitung (nur „high“): GTAO für Kontakt und Tiefe
  let composer = null, gtao = null;
  if (high) {
    const rt = new THREE.WebGLRenderTarget(16, 16, { type: THREE.HalfFloatType, samples: 4 });
    composer = new EffectComposer(renderer, rt);
    composer.addPass(new RenderPass(scene, camera));
    gtao = new GTAOPass(scene, camera, 16, 16);
    gtao.output = GTAOPass.OUTPUT.Default;
    gtao.blendIntensity = 0.7;
    gtao.updateGtaoMaterial({ radius: 0.28, distanceExponent: 1.4, thickness: 1.2, scale: 1, samples: 16, distanceFallOff: 1 });
    gtao.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    composer.addPass(gtao);
    composer.addPass(new OutputPass());
  }

  /* ---------- Autos ---------- */
  const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
  const cache = new Map();
  let current = null;

  async function loadCar(id, onProgress) {
    if (cache.has(id)) return cache.get(id);
    const cfg = CARS[id];
    const p = loader.loadAsync(cfg.url, (e) => onProgress?.(e.total ? e.loaded / e.total : 0)).then((gltf) => prepare(id, cfg, gltf.scene));
    cache.set(id, p);
    return p;
  }

  function prepare(id, cfg, root) {
    const paintMat = makePaint();
    const done = new Map();
    const meshes = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = [].concat(o.material);
      const out = mats.map((m) => {
        const rule = cfg.rules.find(([re]) => re.test(m.name || ''));
        const kind = rule ? rule[1] : 'keep';
        if (kind === 'hide') return null;
        const key = m.uuid + kind;
        if (!done.has(key)) done.set(key, refine(m, kind, paintMat));
        return done.get(key);
      });
      if (out.some((m) => m === null)) { o.visible = false; return; }
      o.material = Array.isArray(o.material) ? out : out[0];
      // Spiel-Modelle haben grobe Normalen; auf dem Lack werden Glanzlichter sonst zackig
      if (cfg.smoothPaint && out[0] === paintMat && !Array.isArray(o.material)) {
        const g = o.geometry;
        const keep = {};
        for (const k of Object.keys(g.attributes)) if (k !== 'normal') keep[k] = g.attributes[k];
        if (g.attributes.position.normalized || g.attributes.position.array instanceof Float32Array === false) {
          // quantisierte Positionen für die Neuberechnung in Gleitkomma umwandeln
          for (const [k, a] of Object.entries(keep)) {
            const f = new Float32Array(a.count * a.itemSize);
            for (let i = 0; i < a.count; i++) for (let c = 0; c < a.itemSize; c++) f[i * a.itemSize + c] = a.getComponent(i, c);
            g.setAttribute(k, new THREE.BufferAttribute(f, a.itemSize));
          }
        }
        g.deleteAttribute('normal');
        if (g.attributes.tangent) g.deleteAttribute('tangent');
        o.geometry = toCreasedNormals(g, THREE.MathUtils.degToRad(50));
      }
      meshes.push(o);
    });

    // Ausrichten: Länge entlang x, Front nach +x, Räder auf dem Boden, Mitte im Ursprung
    const holder = new THREE.Group();
    holder.add(root);
    root.rotation.y = cfg.yaw ?? 0;
    root.updateMatrixWorld(true);
    const box = new THREE.Box3();
    for (const m of meshes) box.expandByObject(m, true);
    const size = box.getSize(new THREE.Vector3());
    const s = cfg.length / Math.max(size.x, size.z);
    root.scale.multiplyScalar(s);
    root.updateMatrixWorld(true);
    box.makeEmpty();
    for (const m of meshes) box.expandByObject(m, true);
    const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    root.updateMatrixWorld(true);
    box.makeEmpty();
    for (const m of meshes) box.expandByObject(m, true);

    // Händlerschild: eigene UVs als Projektion auf die Schildfläche (Front von vorn, Heck von hinten lesbar)
    for (const m of meshes) {
      if (!m.material || m.material.map !== plateTex || !plateTex) continue;
      const g = m.geometry.clone();
      const pos = g.attributes.position, v = new THREE.Vector3();
      const pts = [];
      for (let i = 0; i < pos.count; i++) pts.push(v.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).clone());
      const groups = [pts.filter((p) => p.x > 0), pts.filter((p) => p.x <= 0)];
      const ranges = groups.map((gr) => gr.length ? new THREE.Box3().setFromPoints(gr) : null);
      const uv = new Float32Array(pos.count * 2);
      pts.forEach((p, i) => {
        const front = p.x > 0, r = ranges[front ? 0 : 1];
        const u = (p.z - r.min.z) / Math.max(1e-4, r.max.z - r.min.z);
        uv[i * 2] = front ? 1 - u : u;
        uv[i * 2 + 1] = (p.y - r.min.y) / Math.max(1e-4, r.max.y - r.min.y);
      });
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      m.geometry = g;
    }

    if (cfg.paintSoften) paintMat.userData.soften = cfg.paintSoften; // Klarlack minimal weicher bei unebenen Modellen
    const car = { id, cfg, holder, root, meshes, box, paintMat, shadow: null, paint: null };
    setPaint(car, cfg.paint);
    return car;
  }

  function setPaint(car, paintId) {
    const p = car.cfg.paints.find((x) => x.id === paintId) || car.cfg.paints[0];
    car.paint = p.id;
    applyPaint(car.paintMat, p);
  }

  /* ---------- Kamera ---------- */
  const view = {
    az: 0.95, azT: 0.95, el: 0.09, elT: 0.09, zoom: 1, zoomT: 1,
    target: new THREE.Vector3(0, 0.62, 0), targetT: new THREE.Vector3(0, 0.62, 0),
    detail: false,
  };
  const ZMIN = 0.42, ZMAX = 1.5;
  let baseDist = 8;
  let spin = 0, spinT = 0; // Winkel der Drehscheibe
  let auto = autoRotate && !reducedMotion;
  let lastInteract = -1e9;

  function frameCar() {
    if (!current) return;
    const b = current.box;
    const L = b.max.x - b.min.x, H = b.max.y - b.min.y;
    const vFov = THREE.MathUtils.degToRad(camera.fov);
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * camera.aspect);
    // Auto soll ~72 % der Breite einnehmen, in Schrägansicht etwas weniger Länge sichtbar
    // Auto füllt in der Seitenansicht ~70 % der Bildbreite (hochkant ~90 %, sonst wirkt es winzig)
    const needW = L / (camera.aspect < 0.8 ? 0.9 : 0.7);
    const dW = needW / 2 / Math.tan(hFov / 2);
    const dH = (H * 1.9) / 2 / Math.tan(vFov / 2);
    baseDist = clamp(Math.max(dW, dH), 4.6, 15);
    view.targetT.set(0, H * 0.42, 0);
  }

  // Mindestabstand: Kamera bleibt außerhalb der (leicht vergrößerten) Fahrzeugbox
  const ray = new THREE.Ray(), hit = new THREE.Vector3(), tmpBox = new THREE.Box3();
  function minDistance(dir, target) {
    if (!current) return 1;
    tmpBox.copy(current.box).expandByScalar(view.detail ? 0.12 : 0.45);
    tmpBox.applyMatrix4(new THREE.Matrix4().makeRotationY(spin));
    ray.set(target, dir);
    const p = ray.intersectBox(tmpBox, hit);
    return p ? target.distanceTo(p) + 0.25 : 1;
  }

  const dir = new THREE.Vector3();
  function placeCamera() {
    const d0 = baseDist * view.zoom;
    dir.set(Math.sin(view.az) * Math.cos(view.el), Math.sin(view.el), Math.cos(view.az) * Math.cos(view.el));
    const dist = view.detail ? Math.max(d0, 0.7) : Math.max(d0, minDistance(dir, view.target));
    camera.position.copy(view.target).addScaledVector(dir, dist);
    if (camera.position.y < 0.14) camera.position.y = 0.14;
    camera.lookAt(view.target);
  }

  /* ---------- Licht-Animation (Belichtung) ---------- */
  let exposure = reducedMotion ? 1 : 0, exposureT = exposure;
  const EXPOSURE = 1.15;
  let stripLevel = reducedMotion ? 1 : 0, stripT = stripLevel;
  function setStrips(level) {
    strips.forEach((s, i) => {
      const k = clamp(level * strips.length - i * 0.55, 0, 1);
      s.material.color.copy(s.userData.base).multiplyScalar(k * k);
    });
  }
  setStrips(stripLevel);

  /* ---------- Schleife ---------- */
  let visible = true, running = false, raf = 0, last = 0;
  let pending = [];
  const listeners = new Set();
  const tmpV = new THREE.Vector2();

  function renderReflection() {
    const db = renderer.getDrawingBufferSize(tmpV);
    const w = Math.max(2, Math.round(db.x * reflScale)), h = Math.max(2, Math.round(db.y * reflScale));
    if (reflRT.width !== w || reflRT.height !== h) reflRT.setSize(w, h);
    floorMat.uniforms.uViewport.value.copy(db);
    world.scale.y = -1;
    floor.visible = false;
    scene.environment = envMirror;
    renderer.setRenderTarget(reflRT);
    renderer.clear();
    renderer.render(scene, camera);
    renderer.setRenderTarget(null);
    scene.environment = envMain;
    world.scale.y = 1;
    floor.visible = true;
  }

  function draw() {
    renderReflection();
    if (composer) composer.render();
    else renderer.render(scene, camera);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    const idle = now - lastInteract > 4000;
    if (auto && idle && !drag && !view.detail) spinT += dt * 0.14;
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 6);
    view.az = lerp(view.az, view.azT, k);
    view.el = lerp(view.el, view.elT, k);
    view.zoom = lerp(view.zoom, view.zoomT, reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    view.target.lerp(view.targetT, reducedMotion ? 1 : 1 - Math.exp(-dt * 5));
    spin = lerp(spin, spinT, reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
    turntable.rotation.y = spin;
    floorMat.uniforms.uAngle.value = -spin;
    exposure = damp(exposure, exposureT, exposureT > exposure ? 1.6 : 4.5, dt);
    stripLevel = damp(stripLevel, stripT, stripT > stripLevel ? 1.3 : 5, dt);
    renderer.toneMappingExposure = exposure * EXPOSURE;
    setStrips(stripLevel);

    placeCamera();
    draw();
    if (pending.length) { const cbs = pending; pending = []; cbs.forEach((cb) => cb()); }

    const moving = Math.abs(view.azT - view.az) > 1e-4 || Math.abs(view.elT - view.el) > 1e-4 || Math.abs(view.zoomT - view.zoom) > 1e-4
      || view.target.distanceToSquared(view.targetT) > 1e-7 || Math.abs(spinT - spin) > 1e-4
      || Math.abs(exposureT - exposure) > 1e-3 || Math.abs(stripT - stripLevel) > 1e-3;
    if (visible && (moving || (auto && !view.detail) || drag)) raf = requestAnimationFrame(frame);
    else running = false;
  }
  function kick() {
    if (running || !visible) return;
    running = true;
    last = performance.now();
    raf = requestAnimationFrame(frame);
  }

  function resize() {
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 0.8 ? 34 : 28; // hochkant etwas weiter
    camera.updateProjectionMatrix();
    if (composer) {
      const pr = renderer.getPixelRatio();
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
    }
    frameCar();
    kick();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  const io = new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && document.visibilityState === 'visible';
    if (visible) kick();
  }, { rootMargin: '100px' });
  io.observe(container);
  const onVis = () => { visible = document.visibilityState === 'visible'; if (visible) kick(); };
  document.addEventListener('visibilitychange', onVis);

  /* ---------- Eingabe ---------- */
  const pointers = new Map();
  let drag = null, pinch = null;
  let fullMode = false;
  const touchNote = () => { lastInteract = performance.now(); };
  const EL_MIN = -0.03, EL_MAX = 1.05;

  canvas.addEventListener('pointerdown', (e) => {
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    touchNote();
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.zoomT };
      drag = null;
      return;
    }
    const immediate = e.pointerType === 'mouse' || fullMode;
    drag = { id: e.pointerId, x: e.clientX, y: e.clientY, az: view.azT, el: view.elT, mode: immediate ? 'rotate' : null };
    if (drag.mode) { canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; }
    kick();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinch && pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      view.zoomT = clamp(pinch.z * (pinch.d / Math.max(d, 1)), ZMIN, ZMAX);
      touchNote(); kick(); emit();
      return;
    }
    if (!drag || drag.id !== e.pointerId) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.mode && Math.hypot(dx, dy) > 6) {
      drag.mode = Math.abs(dx) > Math.abs(dy) ? 'rotate' : 'scroll';
      if (drag.mode === 'rotate') canvas.setPointerCapture(e.pointerId);
    }
    if (drag.mode !== 'rotate') return;
    const s = 4.6 / Math.max(360, canvas.clientWidth);
    view.azT = drag.az - dx * s;
    const elMin = view.detail ? -0.25 : EL_MIN;
    view.elT = clamp(drag.el + dy * s * 0.6, elMin, EL_MAX);
    touchNote(); kick();
  });
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (pointers.size < 2) pinch = null;
    if (drag && drag.id === e.pointerId) { drag = null; canvas.style.cursor = 'grab'; }
  };
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', (e) => {
    if (!fullMode && !e.ctrlKey && !e.metaKey) return; // in der Seite scrollt das Mausrad die Seite
    e.preventDefault();
    view.zoomT = clamp(view.zoomT * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), ZMIN, ZMAX);
    touchNote(); kick(); emit();
  }, { passive: false });
  canvas.addEventListener('dblclick', (e) => focusAt(e.clientX, e.clientY));
  canvas.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: [0.25, 0], ArrowRight: [-0.25, 0], ArrowUp: [0, 0.08], ArrowDown: [0, -0.08] }[e.key];
    if (step) { view.azT += step[0]; view.elT = clamp(view.elT + step[1], EL_MIN, EL_MAX); e.preventDefault(); }
    else if (e.key === '+' || e.key === '=') zoomBy(0.82);
    else if (e.key === '-') zoomBy(1.22);
    else return;
    touchNote(); kick();
  });

  // Doppelklick: auf die Stelle am Auto heranfahren (z. B. Felge, Scheinwerfer)
  const raycaster = new THREE.Raycaster();
  function focusAt(x, y) {
    if (!current) return;
    const r = canvas.getBoundingClientRect();
    raycaster.setFromCamera(new THREE.Vector2(((x - r.left) / r.width) * 2 - 1, -((y - r.top) / r.height) * 2 + 1), camera);
    const hits = raycaster.intersectObjects(current.meshes, false).filter((h) => h.object.visible && !h.object.material.transparent);
    if (!hits.length) { reset(); return; }
    if (view.detail && view.zoomT < 0.5) { reset(); return; }
    const h = hits[0];
    view.detail = true;
    view.targetT.copy(h.point);
    // Kamera bleibt in ihrer Richtung, rückt aber auf ~1,5 m heran
    view.zoomT = clamp(1.5 / baseDist, 0.12, 1);
    touchNote(); kick(); emit();
  }
  function zoomBy(f) {
    const min = view.detail ? 0.1 : ZMIN;
    view.zoomT = clamp(view.zoomT * f, min, ZMAX);
    touchNote(); kick(); emit();
  }

  const VIEWS = { // Blickwinkel relativ zum Auto (Front = +x)
    schraeg: { az: 0.95, el: 0.09 },
    front: { az: Math.PI / 2, el: 0.08 },
    seite: { az: 0.0, el: 0.06 },
    heck: { az: -2.2, el: 0.14 },
    oben: { az: 0.7, el: 0.85 },
  };
  function setView(name) {
    const v = VIEWS[name];
    if (!v) return;
    view.detail = false;
    view.targetT.y = current ? (current.box.max.y - current.box.min.y) * 0.42 : 0.62;
    view.targetT.x = view.targetT.z = 0;
    const az = v.az + spin; // relativ zur aktuellen Stellung der Drehscheibe
    view.azT = view.az + ((((az - view.az) % TAU) + TAU + Math.PI) % TAU - Math.PI);
    view.elT = v.el;
    view.zoomT = name === 'oben' ? 1.15 : 1;
    touchNote(); kick(); emit();
  }
  function reset() { setView('schraeg'); }

  /* ---------- Fahrzeugwechsel ---------- */
  let token = 0;
  async function setCar(id, { paint, onProgress, instant = false } = {}) {
    const my = ++token;
    const wasLit = exposureT > 0.5 && current;
    if (wasLit && !instant && !reducedMotion) {
      exposureT = 0.04; stripT = 0.0; kick();
    }
    const [car] = await Promise.all([
      loadCar(id, onProgress),
      wasLit && !instant && !reducedMotion ? new Promise((r) => setTimeout(r, 650)) : null,
    ]);
    if (my !== token) return;
    if (paint) setPaint(car, paint);
    if (current) turntable.remove(current.holder);
    if (!car.shadow) car.shadow = bakeContactShadow(renderer, car.root, car.box);
    floorMat.uniforms.tShadow.value = car.shadow.texture;
    floorMat.uniforms.uShadowBox.value.copy(car.shadow.box);
    floorMat.uniforms.uShadow.value = 1;
    turntable.add(car.holder);
    current = car;
    frameCar();
    // neuer Blick: leicht von der Seite herein, als würde man um das Auto gehen
    spinT = spin = 0;
    view.detail = false;
    view.target.copy(view.targetT);
    view.azT = 0.95; view.az = reducedMotion || instant ? 0.95 : 0.55;
    view.elT = 0.09; view.el = reducedMotion || instant ? 0.09 : 0.06;
    view.zoomT = 1; view.zoom = reducedMotion || instant ? 1 : 1.12;
    if (instant || reducedMotion) { exposure = exposureT = 1; stripLevel = stripT = 1; }
    else if (wasLit) { exposureT = 1; stripT = 1; }
    renderer.compile(scene, camera);
    kick();
    emit();
    if (visible) await new Promise((r) => { pending.push(r); kick(); });
  }

  function lightsOn() { exposureT = 1; stripT = 1; kick(); }

  function emit() { listeners.forEach((fn) => fn({ car: current?.id, paint: current?.paint, zoom: view.zoomT, detail: view.detail, auto })); }

  resize();

  return {
    canvas, renderer, scene, camera,
    setCar,
    preload: (id) => loadCar(id),
    setPaint: (paintId) => { if (current) { setPaint(current, paintId); kick(); emit(); } },
    setView, reset, zoomBy, lightsOn,
    setAutoRotate: (on) => { auto = on && !reducedMotion; touchNote(); kick(); emit(); },
    get autoRotate() { return auto; },
    setFullMode: (on) => { fullMode = on; canvas.style.touchAction = on ? 'none' : 'pan-y'; resize(); },
    onChange: (fn) => { listeners.add(fn); return () => listeners.delete(fn); },
    whenRendered: () => new Promise((r) => { pending.push(r); kick(); }),
    kick,
    /** Standbild in fester Größe (Ersatzbilder ohne 3D). */
    snapshot({ width, height, view: v = 'schraeg', type = 'image/webp', quality: q = 0.9 }) {
      const prevPr = renderer.getPixelRatio();
      renderer.setPixelRatio(1);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      if (composer) { composer.setPixelRatio(1); composer.setSize(width, height); }
      frameCar();
      const p = VIEWS[v];
      view.az = view.azT = p.az; view.el = view.elT = p.el; view.zoom = view.zoomT = 1;
      view.target.copy(view.targetT);
      spin = spinT = 0; turntable.rotation.y = 0;
      exposure = exposureT = 1; stripLevel = stripT = 1; setStrips(1);
      renderer.toneMappingExposure = EXPOSURE;
      placeCamera();
      draw();
      const url = canvas.toDataURL(type, q);
      renderer.setPixelRatio(prevPr);
      resize();
      return url;
    },
    dispose() {
      cancelAnimationFrame(raf);
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      reflRT.dispose();
      composer?.dispose?.();
      renderer.dispose();
      canvas.remove();
    },
  };
}
