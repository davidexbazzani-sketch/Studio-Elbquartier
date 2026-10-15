// FUNKL: die drei Sorten und die gemeinsame, bunte Studio-Umgebung für Spiegelungen.
import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

export const FLAVORS = [
  {
    id: 'mango', name: 'Mango Maracuja', short: 'Mango', tag: 'Sonne in der Dose',
    colors: ['#ffd23f', '#ff9a1f', '#ff5a1f'], glow: '#fff3a0', shadow: '#d42a12',
    palette: ['#6a2cff', '#c03cff', '#ff4fa3'], accent: ['#00c2a8', '#ffd23f'], pageShadow: '#2a0b7a', ink: '#3a1200',
    text: 'Reife Mango trifft auf säuerliche Maracuja. Schmeckt nach Sommer, auch im November.',
  },
  {
    id: 'melone', name: 'Wassermelone Limette', short: 'Melone', tag: 'Pink, prickelnd, eiskalt',
    colors: ['#ff8fb8', '#ff2f7d', '#d1004f'], glow: '#ffe0ec', shadow: '#73002f',
    palette: ['#10b981', '#a8ff3e', '#00b3ff'], accent: ['#ff2f7d', '#1d2a6b'], pageShadow: '#064e3b', ink: '#3d0018',
    text: 'Saftige Wassermelone mit einem Spritzer Limette. Pink, prickelnd und frech.',
  },
  {
    id: 'blau', name: 'Blaubeere Yuzu', short: 'Blaubeere', tag: 'Blau machen? Gerne.',
    colors: ['#6fe0ff', '#3a5bff', '#5b21d6'], glow: '#c9f3ff', shadow: '#1c0f6e',
    palette: ['#ffc400', '#ff8a00', '#ff4f3a'], accent: ['#3a5bff', '#ffffff'], pageShadow: '#9a3412', ink: '#0b0838',
    text: 'Waldblaubeere und japanische Yuzu: fruchtig, zitronig, mit Tiefgang.',
  },
];

// Bunte Studio-Umgebung: dunkler Raum, weiße Softbox oben, farbige Lichtflächen rundherum.
export function studioEnvironment(renderer, { colors = ['#ffe6f0', '#e6f6ff', '#fff6dc', '#efe8ff'] } = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#2a2630');
  const lit = (c, k) => new THREE.MeshBasicMaterial({ color: new THREE.Color(c).multiplyScalar(k), side: THREE.DoubleSide });
  const room = new THREE.Mesh(new THREE.SphereGeometry(20, 32, 16), new THREE.MeshBasicMaterial({ color: '#8d8894', side: THREE.BackSide }));
  scene.add(room);
  const add = (w, h, mat, pos, look) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat); m.position.copy(pos); m.lookAt(look); scene.add(m); };
  const O = new THREE.Vector3();
  add(10, 4, lit('#ffffff', 6), new THREE.Vector3(0, 9, 0), O);
  add(3, 8, lit('#ffffff', 4), new THREE.Vector3(-8, 2, 4), O);
  add(2, 8, lit('#ffffff', 3), new THREE.Vector3(8, 2, 3), O);
  colors.forEach((c, i) => {
    const a = (i / colors.length) * Math.PI * 2 + 0.6;
    add(4, 5, lit(c, 2.6), new THREE.Vector3(Math.cos(a) * 9, 0.5 + (i % 2) * 2, Math.sin(a) * 9), O);
  });
  add(30, 30, lit('#4a4650', 1), new THREE.Vector3(0, -6, 0), O);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(scene, 0.02).texture;
  pmrem.dispose();
  scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
  return tex;
}

// Echtes Fotostudio (Poly Haven „Studio Small 09“, CC0) als Licht und Spiegelung für die Dosen
const hdrCache = new WeakMap();
// Laden und Aufhellen nur einmal pro Seite (Hero und Showcase teilen sich das Ergebnis), nur das Licht je Renderer
const srcCache = new Map();
function liftedHDR(url) {
  if (!srcCache.has(url)) {
    srcCache.set(url, new HDRLoader().setDataType(THREE.FloatType).loadAsync(url).then((src) => {
      // wie ein Lichtzelt: dunkle Bereiche anheben, damit Tropfen und Metall hell spiegeln statt schwarz
      const { width: w, height: h, data } = src.image;
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) sum += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      const lift = (sum / (w * h)) * 0.2;
      const out = new Float32Array(data.length);
      for (let i = 0; i < data.length; i += 4) {
        out[i] = data[i] + lift; out[i + 1] = data[i + 1] + lift; out[i + 2] = data[i + 2] + lift * 1.02; out[i + 3] = 1;
      }
      src.dispose();
      return { out, w, h };
    }));
  }
  return srcCache.get(url);
}
export function studioHDR(renderer, url = '../../assets/hdri/studio_small_09_1k.hdr') {
  if (!hdrCache.has(renderer)) {
    hdrCache.set(renderer, liftedHDR(url).then(({ out, w, h }) => {
      const t = new THREE.DataTexture(out, w, h, THREE.RGBAFormat, THREE.FloatType);
      t.flipY = true;
      t.mapping = THREE.EquirectangularReflectionMapping;
      t.colorSpace = THREE.LinearSRGBColorSpace;
      t.minFilter = t.magFilter = THREE.LinearFilter;
      t.needsUpdate = true;
      // dazu zwei hohe Softbox-Streifen und ein Oberlicht wie im Produkt-Studio: klare Lichtkanten auf der Dose
      const scene = new THREE.Scene();
      scene.add(new THREE.Mesh(new THREE.SphereGeometry(30, 64, 32), new THREE.MeshBasicMaterial({ map: t, side: THREE.BackSide })));
      const strip = (x, z, w, h, k) => {
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(k), side: THREE.DoubleSide }));
        m.position.set(x, 0.5, z); m.lookAt(0, 0.5, 0); scene.add(m);
      };
      strip(-6, 4.5, 1.1, 14, 5);
      strip(6.5, 3.5, 0.8, 14, 3.5);
      strip(-2, -7, 2.5, 12, 2.5); // Gegenlicht für die Kante
      const top = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 1, 1).multiplyScalar(2.2), side: THREE.DoubleSide }));
      top.position.y = 10; top.rotation.x = Math.PI / 2; scene.add(top);
      const pmrem = new THREE.PMREMGenerator(renderer);
      const env = pmrem.fromScene(scene, 0.01).texture;
      pmrem.dispose(); t.dispose();
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose(); });
      return env;
    }));
  }
  return hdrCache.get(renderer);
}
