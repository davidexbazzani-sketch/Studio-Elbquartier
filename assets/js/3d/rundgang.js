// Begehbare Musterwohnung (Solmund · Elbblick-Residenz).
// Licht ist in Blender/Cycles vorberechnet (Lightmaps + Licht je Vertex), Spiegelungen kommen aus
// Raum-Panoramen mit Box-Projektion. Außen: echter Himmel (HDRI), bewegtes Elbwasser, Gegenufer.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';

const EYE = 1.62;            // Augenhöhe in Metern
const RADIUS = 0.3;          // Körperradius für Kollision (etwas Abstand zu Möbeln)
const SPEED = 1.35;          // Gehgeschwindigkeit m/s (gemütlich)
const RUN = 2.4;

// Himmel wie in Blender abbilden: three-Richtung → Blender-Richtung → Drehung um Z → Equirect
const SKY_GLSL = `
  #define OUTDOOR 1.55
  vec2 skyUv(vec3 d, float rot, float minElev){
    vec3 b = vec3(d.x, -d.z, d.y);
    float c = cos(-rot), s = sin(-rot);
    b = vec3(c*b.x - s*b.y, s*b.x + c*b.y, b.z);
    b.z = max(b.z, minElev); b = normalize(b);
    return vec2(atan(b.y, -b.x) / (2.0*PI) + 0.5, asin(clamp(b.z, -1.0, 1.0)) / PI + 0.5);
  }`;

// Blender (x, y, z) → three (x, z, -y)
const b2t = (x, y, z) => new THREE.Vector3(x, z, -y);

export class Rundgang {
  constructor(canvas, { base, lite = false, onProgress = () => {}, onReady = () => {}, onRoom = () => {} } = {}) {
    this.canvas = canvas; this.base = base; this.lite = lite;
    this.onProgress = onProgress; this.onReady = onReady; this.onRoom = onRoom;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NoToneMapping;   // Tonemapping im eigenen Abschluss-Shader
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(66, 1, 0.05, 4000);
    this.camera.rotation.order = 'YXZ';
    this.clock = new THREE.Timer();
    this.yaw = 0; this.pitch = 0; this.tYaw = 0; this.tPitch = 0;
    this.pos = new THREE.Vector3(); this.vel = new THREE.Vector3();
    this.keys = new Set(); this.move = new THREE.Vector2(); // Joystick
    this.exposure = 1.0; this.targetExposure = 1.0;
    this.uniforms = { uTime: { value: 0 } };
    this.dpr = Math.min(window.devicePixelRatio || 1, lite ? 1.25 : 1.6);
    this.running = false;
  }

  // ------------------------------------------------------------------ Laden
  async load() {
    const B = this.base;
    const tex = new THREE.TextureLoader(); const tex_ = tex;
    const lmSuffix = this.lite ? '_klein' : '';
    const files = await (await fetch(B + 'wohnung.json')).json();
    this.meta = files;
    let done = 0; const total = 6 + Object.keys(files.lightmaps).length + Object.keys(files.sonden).length;
    const step = () => this.onProgress(++done / total);

    const gltfP = new Promise((res, rej) => {
      const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
      l.load(B + (this.lite ? files.glb_klein || files.glb : files.glb), (g) => { step(); res(g); }, undefined, rej);
    });
    const lmP = Promise.all(Object.entries(files.lightmaps).map(([k, v]) => new Promise((res) => {
      tex.load(B + `lm_${k}${lmSuffix}.webp`, (t) => {
        t.flipY = false; t.colorSpace = THREE.NoColorSpace; t.channel = 1;
        t.generateMipmaps = true; t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
        t.anisotropy = 4; step(); res([k, t]);
      });
    })));
    const hdr = new HDRLoader(); hdr.setDataType(THREE.HalfFloatType);
    const envP = Promise.all(Object.keys(files.sonden).map((k) => new Promise((res) => {
      hdr.load(B + `env_${k}.hdr`, (t) => { t.mapping = THREE.EquirectangularReflectionMapping; step(); res([k, t]); });
    })));
    const skyP = new Promise((res) => tex.load(B + (this.lite ? 'himmel_4k.webp' : 'himmel_8k.webp'), (t) => {
      t.colorSpace = THREE.SRGBColorSpace; t.mapping = THREE.EquirectangularReflectionMapping;
      t.anisotropy = 8; step(); res(t);
    }));
    const maskP = new Promise((res) => {
      const im = new Image(); im.onload = () => { step(); res(im); }; im.src = B + 'begehbar.png';
    });
    const waterP = new Promise((res) => tex.load(B + 'wasser_normal.webp', (t) => {
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.colorSpace = THREE.NoColorSpace; step(); res(t);
    }));

    const umgP = (async () => {
      try {
        const info = await (await fetch(B + 'umgebung.json')).json();
        const l = new GLTFLoader(); l.setMeshoptDecoder(MeshoptDecoder);
        const [g, ...tex] = await Promise.all([
          new Promise((res, rej) => l.load(B + 'umgebung.glb', res, undefined, rej)),
          ...Object.keys(info.panos).map((k) => new Promise((res) => tex_.load(B + `umgebung_${k}${this.lite ? '_klein' : ''}.webp`, (t) => {
            t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; t.generateMipmaps = true; step(); res([k, t]);
          }))),
        ]);
        return { info, scene: g.scene, panos: Object.fromEntries(tex) };
      } catch (e) { console.warn('Umgebung fehlt', e); return null; }
    })();
    const [gltf, lms, envs, sky, mask, water, umg] = await Promise.all([gltfP, lmP, envP, skyP, maskP, waterP, umgP]);
    this.umgebung = umg;
    this.lightmaps = Object.fromEntries(lms);
    this.setupProbes(Object.fromEntries(envs));
    this.setupSky(sky, water);
    this.setupModel(gltf.scene);
    this.setupMask(mask);
    this.setupDust();
    this.setupPost();
    this.resize();
    const s = files.start;
    this.pos.copy(b2t(s.pos[0], s.pos[1], 0));
    this.yaw = this.tYaw = s.yaw * Math.PI / 180; this.pitch = this.tPitch = 0;
    // Shader im Hintergrund übersetzen (kein Ruckeln beim ersten Bild), dann einmal je Raum vorab zeichnen
    if (this.renderer.compileAsync) await this.renderer.compileAsync(this.scene, this.camera);
    else this.renderer.compile(this.scene, this.camera);
    this.onReady();
  }

  // ------------------------------------------------------------------ Reflexions-Sonden
  setupProbes(envs) {
    const pm = new THREE.PMREMGenerator(this.renderer);
    this.probes = {};
    for (const [k, t] of Object.entries(envs)) {
      const p = this.meta.sonden[k];
      const env = pm.fromEquirectangular(t).texture; t.dispose();
      const [x0, x1, y0, y1, z0, z1] = p.box;
      // Blender-Box → three-Box
      const min = new THREE.Vector3(x0, z0, -y1), max = new THREE.Vector3(x1, z1, -y0);
      this.probes[k] = { env, pos: b2t(...p.pos), min, max, irr: p.irr || 1 };
    }
    pm.dispose();
  }

  probeFor(worldPos) {
    let best = null, bd = 1e9;
    for (const [k, p] of Object.entries(this.probes)) {
      const c = new THREE.Vector3().copy(worldPos).clamp(p.min, p.max);
      const d = c.distanceToSquared(worldPos);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ------------------------------------------------------------------ Materialien
  patchMaterial(mat, { lm, vx, probe, sway = false, art = null }) {
    const lmInfo = lm ? this.meta.lightmaps[lm] : null;
    const u = this.uniforms;
    mat.envMap = probe.env; mat.envMapIntensity = 1.0;
    mat.userData.probe = probe;
    if (lm) { mat.lightMap = this.lightmaps[lm]; mat.lightMapIntensity = 1.0; }
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = u.uTime;
      if (art) { sh.uniforms.artMin = { value: art.min }; sh.uniforms.artMax = { value: art.max }; }
      if (sway) sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader;
      sh.uniforms.boxMin = { value: probe.min }; sh.uniforms.boxMax = { value: probe.max };
      sh.uniforms.probePos = { value: probe.pos }; sh.uniforms.probeIrr = { value: probe.irr };
      if (lmInfo) {
        sh.uniforms.lmK = { value: Math.log(1 + lmInfo.max / lmInfo.a) }; sh.uniforms.lmA = { value: lmInfo.a };
      }
      sh.vertexShader = sh.vertexShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos;
          ${vx ? 'attribute vec4 lmIrr; varying vec3 vLmIrr;' : ''}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          ${sway ? `
          {
            vec3 wp0 = (modelMatrix * vec4(position, 1.0)).xyz;
            float low = clamp(1.0 - wp0.y / 2.85, 0.0, 1.0);
            float s1 = sin(uTime * 0.9 + wp0.x * 2.3 + wp0.z * 1.7) * 0.6 + sin(uTime * 0.37 + wp0.x * 0.8) * 0.4;
            transformed += normal * s1 * 0.018 * low * low;
          }` : ''}`)
        .replace('#include <worldpos_vertex>', `#include <worldpos_vertex>
          vWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
          ${vx ? 'vLmIrr = lmIrr.rgb;' : ''}`);
      sh.fragmentShader = sh.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vWPos;
          uniform vec3 boxMin; uniform vec3 boxMax; uniform vec3 probePos; uniform float probeIrr;
          ${art ? 'uniform vec3 artMin; uniform vec3 artMax;' : ''}
          ${lmInfo ? 'uniform float lmK; uniform float lmA;' : ''}
          ${vx ? 'varying vec3 vLmIrr;' : ''}
          float gSpecOcc = 1.0;
          vec3 boxProject(vec3 dir) {
            vec3 rmax = (boxMax - vWPos) / dir; vec3 rmin = (boxMin - vWPos) / dir;
            vec3 r = max(rmax, rmin);
            float f = min(min(r.x, r.y), r.z);
            return normalize(vWPos + dir * f - probePos);
          }`)
        // Lightmap dekodieren, keine zusätzliche Umgebungs-Diffusbeleuchtung (ist in der Lightmap enthalten)
        .replace('#include <lights_fragment_maps>', `
          #ifdef USE_LIGHTMAP
            vec3 lmEnc = texture2D( lightMap, vLightMapUv ).rgb;
            vec3 lmIrrad = lmA * ( exp( lmEnc * lmK ) - 1.0 );
            irradiance += lmIrrad * PI;
            gSpecOcc = clamp( dot( lmIrrad, vec3(0.3333) ) / probeIrr, 0.0, 1.0 );
          #endif
          ${vx ? `irradiance += vLmIrr * PI; gSpecOcc = clamp( dot( vLmIrr, vec3(0.3333) ) / probeIrr, 0.0, 1.0 );` : ''}
          #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
            radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
            #ifdef USE_CLEARCOAT
              clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
            #endif
          #endif
          radiance *= mix( 0.18, 1.0, sqrt( gSpecOcc ) );
        `)
        .replace('#include <map_fragment>', art ? `
          {
            vec3 rel = clamp((vWPos - artMin) / max(artMax - artMin, vec3(1e-4)), 0.0, 1.0);
            vec2 auv = vec2(${art.u}, rel.y);
            vec4 t = texture2D(map, auv);
            diffuseColor *= t;
          }` : '#include <map_fragment>')
        // Box-Projektion der Spiegelung
        .replace('reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix );',
          'reflectVec = transformDirectionByInverseViewMatrix( reflectVec, viewMatrix ); reflectVec = boxProject( reflectVec );');
    };
    mat.customProgramCacheKey = () => `wg_${lm || ''}_${vx ? 1 : 0}_${sway ? 1 : 0}_${art ? art.u : ''}`;
    mat.needsUpdate = true;
  }

  setupModel(root) {
    const cache = new Map();
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xeef4f2, metalness: 0, roughness: 0.02, transparent: true, opacity: 0.16, depthWrite: false,
      envMapIntensity: 1.8, specularIntensity: 1.0, ior: 1.52,
    });
    this.curtains = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      // Mehrteilige Netze (mehrere Materialien) hängen als Kinder unter dem Knoten mit den Extras
      let kind = o.userData.lm, p = o.parent;
      while (!kind && p) { kind = p.userData.lm; p = p.parent; }
      kind = kind || 'skip';
      const name = o.userData.lm ? o.name : (o.parent?.name || o.name);
      const lm = kind.startsWith('lm_') ? kind.slice(3) : null;
      const vx = kind === 'vx';
      if (vx && o.geometry.attributes._lm) {
        o.geometry.setAttribute('lmIrr', o.geometry.attributes._lm);
        o.geometry.deleteAttribute('_lm');
      }
      o.geometry.computeBoundingSphere();
      const center = o.geometry.boundingSphere.center.clone().applyMatrix4(o.matrixWorld);
      const probe = this.probeFor(center);
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const out = mats.map((m) => {
        if (/^glas/.test(m.name)) {
          const g = glassMat.clone(); g.envMap = probe.env; return g;
        }
        const sway = /^vh_/.test(name);
        // Fotografien an den Wänden: Bild auf die Vorderseite projiziert (Galerie-Kante an den Seiten)
        const ART_U = { kunst_wohnen: 'rel.z', kunst_diele: '1.0 - rel.z', kunst_flur: 'rel.z', kunst_bett: 'rel.x', kunst_arbeiten: 'rel.x' };
        let art = null;
        if (ART_U[name]) {
          const bb = new THREE.Box3().setFromObject(o);
          const t = new THREE.TextureLoader().load(this.base + name + '.webp');
          t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8;
          art = { min: bb.min, max: bb.max, u: ART_U[name], tex: t };
        }
        const key = `${m.uuid}|${lm}|${vx}|${probe.pos.x}|${sway}|${name}`;
        if (!art && cache.has(key)) return cache.get(key);
        const c = m.clone();
        if (art) { c.map = art.tex; c.color.setRGB(1, 1, 1); c.normalMap = null; c.roughness = 0.88; }
        c.vertexColors = false;
        if (/stehleuchte/.test(name) && /leinen/.test(m.name)) { c.emissive = new THREE.Color(0.1, 0.095, 0.085); }   // Leinenschirm im Gegenlicht
        if (/^opal/.test(m.name)) { c.emissive = new THREE.Color(0.2, 0.195, 0.185); }   // Opalglas leuchtet im Tageslicht durch
        if (/vorhang/.test(m.name)) { c.transparent = true; c.opacity = 0.82; c.side = THREE.DoubleSide; c.depthWrite = false; }
        this.patchMaterial(c, { lm, vx, probe, sway, art });
        cache.set(key, c); return c;
      });
      o.material = Array.isArray(o.material) ? out : out[0];
      if (/^vh_/.test(name)) this.curtains.push(o);
      o.matrixAutoUpdate = false; o.updateMatrix();
    });
    this.scene.add(root);
    this.model = root;
  }

  // ------------------------------------------------------------------ Außen: Himmel + Elbe
  setupSky(skyTex, waterNormal) {
    const rotY = this.meta.himmel_drehung || 0;   // Drehung des HDRI um die Hochachse (three)
    const sun = new THREE.Vector3(...this.meta.sonne); // three-Koordinaten, zur Sonne
    const skyMat = new THREE.ShaderMaterial({
      uniforms: { map: { value: skyTex }, rot: { value: rotY }, uExpo: { value: this.meta.himmel_helligkeit || 1 } },
      vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform sampler2D map; uniform float rot; uniform float uExpo; varying vec3 vDir;
        #include <common>
        ${SKY_GLSL}
        void main(){
          vec3 col = texture2D(map, skyUv(normalize(vDir), rot, -1.0)).rgb;
          gl_FragColor = vec4(col * uExpo * OUTDOOR, 1.0);
          #include <colorspace_fragment>
        }`,
      depthWrite: false, side: THREE.BackSide,
    });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(1500, 64, 32), skyMat);
    this.sky.renderOrder = -10; this.sky.frustumCulled = false;
    this.scene.add(this.sky);
    // Wasser
    const wMat = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uniforms.uTime, nmap: { value: waterNormal }, sky: { value: skyTex }, rot: { value: rotY },
        sunDir: { value: sun.clone().normalize() }, uExpo: { value: this.meta.himmel_helligkeit || 1 } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform float uTime; uniform sampler2D nmap; uniform sampler2D sky; uniform float rot; uniform vec3 sunDir; uniform float uExpo;
        varying vec3 vW;
        #include <common>
        ${SKY_GLSL}
        vec3 skyLook(vec3 d){ return texture2D(sky, skyUv(d, rot, 0.02)).rgb; }
        void main(){
          vec2 p = vW.xz;
          vec3 n1 = texture2D(nmap, p * 0.012 + vec2(uTime*0.004, uTime*0.006)).xyz*2.0-1.0;
          vec3 n2 = texture2D(nmap, p * 0.031 - vec2(uTime*0.007, -uTime*0.003)).xyz*2.0-1.0;
          vec3 n3 = texture2D(nmap, p * 0.0031 + vec2(uTime*0.0011, uTime*0.0016)).xyz*2.0-1.0;
          vec3 n = normalize(vec3(n1.x+n2.x+n3.x*1.4, 6.0, n1.y+n2.y+n3.y*1.4));
          vec3 v = normalize(cameraPosition - vW);
          float dist = length(cameraPosition - vW);
          n = normalize(mix(n, vec3(0,1,0), clamp(dist/2400.0, 0.0, 0.85)));
          vec3 r = reflect(-v, n);
          float fres = 0.02 + 0.98 * pow(1.0 - max(dot(n, v), 0.0), 5.0);
          vec3 refl = skyLook(r);
          vec3 deep = vec3(0.028, 0.045, 0.048);
          vec3 col = mix(deep, refl, fres);
          float sp = pow(max(dot(r, sunDir), 0.0), 900.0) * 60.0 + pow(max(dot(r, sunDir), 0.0), 60.0) * 0.6;
          col += vec3(1.0, 0.95, 0.85) * sp;
          // Dunst zum Horizont
          vec3 haze = skyLook(normalize(vec3(-v.x, 0.03, -v.z)));
          col = mix(col, haze, clamp(dist / 2600.0, 0.0, 1.0) * 0.85);
          gl_FragColor = vec4(col * uExpo * OUTDOOR, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    const water = new THREE.Mesh(new THREE.PlaneGeometry(9000, 9000, 1, 1), wMat);
    water.rotation.x = -Math.PI / 2; water.position.set(0, -30.05, 0);
    this.scene.add(water);
    this.water = water;
    this.setupShore(skyTex, sun);
  }

  setupShore(skyTex, sun) {
    const B = this.base, lite = this.lite;
    const photo = new THREE.TextureLoader().load(B + (lite ? 'ufer_klein.webp' : 'ufer.webp'));
    photo.colorSpace = THREE.SRGBColorSpace; photo.anisotropy = 8;
    const rotY = this.meta.himmel_drehung || 0;
    const common = `
      uniform sampler2D sky; uniform float rot; uniform float uExpo;
      ${SKY_GLSL}
      vec3 skyLook(vec3 d){ return texture2D(sky, skyUv(d, rot, 0.015)).rgb; }
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p *= 2.03; a *= 0.5; } return v; }`;
    // --- Gegenufer: Zylinder um die Wohnung, Foto im Süden, sonst flache Uferlinie im Dunst
    const R = 900, Hgt = 112, span = 39 * Math.PI / 180, center = Math.PI * 0.5 + 0.12; // Süden (three +z), leicht östlich
    const shoreMat = new THREE.ShaderMaterial({
      uniforms: { photo: { value: photo }, sky: { value: skyTex }, rot: { value: rotY }, uExpo: { value: this.meta.himmel_helligkeit || 1 },
        span: { value: span }, center: { value: center } },
      vertexShader: `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D photo; uniform float span; uniform float center; varying vec3 vP; varying vec3 vW;
        #include <common>
        ${common}
        void main(){
          float ang = atan(vP.z, vP.x);               // Winkel um die Hochachse
          float hy = vP.y / ${Hgt.toFixed(1)} + 0.5;    // 0 = Wasserlinie, 1 = oben
          float da = ang - center;
          da = mod(da + PI, 2.0*PI) - PI;
          vec4 col = vec4(0.0);
          if (abs(da) < span * 0.5) {
            vec2 uv = vec2(0.5 - da / span, hy);
            col = texture2D(photo, uv);
            col.rgb = col.rgb * col.rgb * 1.08;        // sRGB-Bild grob linear
            // Ränder des Fotos in die flache Uferlinie überblenden
            float e = smoothstep(0.0, 0.08, 0.5 - abs(da / span));
            col.a *= mix(step(hy, 0.05 + 0.05 * fbm(vec2(ang*60.0, 1.0))), 1.0, e);
          }
          // flache Uferlinie mit Bäumen und Hallen
          float h = 0.045 + 0.06 * fbm(vec2(ang * 38.0, 3.0)) + 0.05 * step(0.78, noise(vec2(ang * 9.0, 7.0))) * noise(vec2(ang*120.0,1.0));
          float land = step(hy, h);
          vec3 landCol = mix(vec3(0.05, 0.07, 0.06), vec3(0.11, 0.11, 0.10), fbm(vec2(ang*200.0, hy*30.0)));
          col = mix(vec4(landCol, land), col, col.a);
          if (col.a < 0.01) discard;
          // Dunst über 900 m
          vec3 v = normalize(vW - cameraPosition);
          vec3 haze = skyLook(normalize(vec3(v.x, 0.02, v.z)));
          col.rgb = mix(col.rgb * 0.95, haze, 0.38);
          gl_FragColor = vec4(col.rgb * uExpo * OUTDOOR, col.a);
          #include <colorspace_fragment>
        }`,
      transparent: true, side: THREE.BackSide, depthWrite: false,
    });
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(R, R, Hgt, 360, 1, true), shoreMat);
    cyl.position.set(8, -30 + Hgt / 2, -5); cyl.renderOrder = -8;
    this.scene.add(cyl);
    // Elbhang, Gärten, Villen, Strand: Tiefenmodell, auf das in Blender gerechnete Panoramen projiziert werden
    if (this.umgebung) this.setupUmgebung(skyTex, rotY);
    // Baumkulisse am Elbhang: Kronen-Silhouette rundum über Land (nicht über dem Wasser)
    const baum = new THREE.TextureLoader().load(B + 'baumkante.webp');
    baum.colorSpace = THREE.SRGBColorSpace; baum.wrapS = THREE.MirroredRepeatWrapping; baum.anisotropy = 8;
    const treeMat = new THREE.ShaderMaterial({
      uniforms: { sky: { value: skyTex }, rot: { value: rotY }, baum: { value: baum }, hScale: { value: 28 }, rad: { value: 300 } },
      vertexShader: `varying vec3 vP; varying vec3 vW; void main(){ vP = position; vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `uniform sampler2D baum; uniform float hScale; uniform float rad; varying vec3 vP; varying vec3 vW;
        #include <common>
        ${common}
        void main(){
          float ang = atan(vP.z, vP.x);
          vec2 dir = vec2(cos(ang), sin(ang));
          float land = smoothstep(0.32, 0.1, dir.y);           // Richtung Süden liegt das Wasser
          float hy = vP.y / 40.0 + 0.5;                          // 0 = Hangkante, 1 = 40 m darüber
          vec2 uv = vec2(ang * rad / 139.0, hy * 40.0 / (hScale * land * (0.8 + 0.4 * noise(vec2(ang * 12.0 + rad, 1.0)))));
          if (uv.y > 1.0 || land < 0.02) discard;
          vec4 t = texture2D(baum, uv);
          if (t.a < 0.5) discard;
          vec3 col = t.rgb * 0.9;
          vec3 v = normalize(vW - cameraPosition);
          col = mix(col, skyLook(normalize(vec3(v.x, 0.03, v.z))) * 0.9, 0.38);
          gl_FragColor = vec4(col * OUTDOOR, 1.0);
          #include <colorspace_fragment>
        }`,
      side: THREE.BackSide,
    });
    const trees = new THREE.Mesh(new THREE.CylinderGeometry(300, 300, 40, 720, 1, true), treeMat);
    trees.position.set(8, -14 + 20, -5); trees.renderOrder = -7;
    this.scene.add(trees);
  }

  setupUmgebung(skyTex, rotY) {
    const { info, scene, panos } = this.umgebung;
    const keys = Object.keys(info.panos);
    const c = keys.map((k) => b2t(...info.panos[k]));
    const lat = info.lat.map((d) => d * Math.PI / 180);
    const mat = new THREE.ShaderMaterial({
      uniforms: { pA: { value: panos[keys[0]] }, pB: { value: panos[keys[1]] }, cA: { value: c[0] }, cB: { value: c[1] },
        latMin: { value: lat[0] }, latMax: { value: lat[1] }, skala: { value: info.skala }, mixB: { value: 0 },
        sky: { value: skyTex }, rot: { value: rotY } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
      fragmentShader: `uniform sampler2D pA; uniform sampler2D pB; uniform vec3 cA; uniform vec3 cB; uniform float latMin; uniform float latMax;
        uniform float skala; uniform float mixB; uniform sampler2D sky; uniform float rot; varying vec3 vW;
        #include <common>
        ${SKY_GLSL}
        vec4 pano(sampler2D t, vec3 c){
          vec3 d = normalize(vW - c);
          vec3 b = vec3(d.x, -d.z, d.y);                       // Blender-Richtung
          float lon = atan(b.y, b.x);
          float la = asin(clamp(b.z, -1.0, 1.0));
          return texture2D(t, vec2(0.5 - lon / (2.0 * PI), (la - latMin) / (latMax - latMin)));
        }
        void main(){
          vec4 a = pano(pA, cA), b = pano(pB, cB);
          vec4 p = mix(a, b, mixB);
          if (p.a < 0.45) discard;
          vec3 col = p.rgb * skala;
          vec3 v = normalize(vW - cameraPosition);
          float dist = length(vW - cameraPosition);
          vec3 haze = texture2D(sky, skyUv(normalize(vec3(v.x, 0.03, v.z)), rot, 0.015)).rgb * skala;
          col = mix(col, haze, clamp(dist / 2600.0, 0.0, 1.0) * 0.5);
          gl_FragColor = vec4(col * OUTDOOR, 1.0);
          #include <colorspace_fragment>
        }`,
    });
    this.umgMat = mat;
    scene.traverse((o) => { if (o.isMesh) { o.material = mat; o.frustumCulled = true; } });
    this.scene.add(scene);
  }

  // ------------------------------------------------------------------ Staub im Sonnenlicht
  setupDust() {
    const lm = this.lightmaps.boden; const info = this.meta.lightmaps.boden;
    if (!lm) return;
    const N = this.lite ? 900 : 2600;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      // Wohn-/Essbereich und Schlafzimmer (Blender x, y) → three (x, z = -y)
      const bed = i % 3 === 2;
      const x = bed ? 9.4 + Math.random() * 6.5 : Math.random() * 9.2;
      const y = bed ? Math.random() * 5.1 : Math.random() * 6.4;
      pos[i * 3] = x; pos[i * 3 + 1] = 0.15 + Math.random() * 2.6; pos[i * 3 + 2] = -y; seed[i] = Math.random();
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const sun = new THREE.Vector3(...this.meta.sonne).normalize();
    const m = new THREE.ShaderMaterial({
      uniforms: { uTime: this.uniforms.uTime, lm: { value: lm }, sunDir: { value: sun }, lmK: { value: Math.log(1 + info.max / info.a) }, lmA: { value: info.a },
        px: { value: 1 } },
      vertexShader: `attribute float seed; uniform float uTime; uniform sampler2D lm; uniform vec3 sunDir; uniform float lmK; uniform float lmA; uniform float px;
        varying float vA;
        void main(){
          vec3 p = position;
          float t = uTime * (0.03 + seed * 0.04);
          p += vec3(sin(t * 1.3 + seed * 40.0), sin(t * 0.7 + seed * 13.0) * 0.6 - 0.15 * fract(t * 0.05 + seed), cos(t * 1.1 + seed * 27.0)) * 0.35;
          // Liegt das Teilchen im Sonnenstrahl? Entlang der Sonne auf den Boden projizieren und den Sonnenfleck nachschlagen
          vec3 q = p - sunDir * (p.y / max(sunDir.y, 0.05));
          vec2 uv = vec2(q.x / 16.0, 1.0 - (-q.z) / 10.5);
          float L = 0.0;
          if (uv.x > 0.0 && uv.x < 1.0 && uv.y > 0.0 && uv.y < 1.0) {
            vec3 e = texture2D(lm, uv).rgb; L = dot(lmA * (exp(e * lmK) - 1.0), vec3(0.333));
          }
          float lit = smoothstep(0.55, 1.1, L);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vec3 vdir = normalize(-mv.xyz);
          vec3 sv = normalize((viewMatrix * vec4(sunDir, 0.0)).xyz);
          float fwd = 0.35 + 1.6 * pow(max(dot(-vdir, sv), 0.0), 3.0);   // Vorwärtsstreuung (Blick zur Sonne)
          vA = lit * fwd * (0.4 + 0.6 * fract(seed * 7.13)) * smoothstep(0.2, 1.2, -mv.z) * (1.0 - smoothstep(6.0, 11.0, -mv.z));
          gl_Position = projectionMatrix * mv;
          gl_PointSize = px * (1.0 + 1.5 * fract(seed * 3.7)) * clamp(2.5 / -mv.z, 0.6, 2.0);
        }`,
      fragmentShader: `varying float vA;
        void main(){ vec2 c = gl_PointCoord - 0.5; float a = smoothstep(0.5, 0.0, length(c)); if (vA * a < 0.003) discard;
          gl_FragColor = vec4(vec3(1.0, 0.97, 0.9) * vA * a * 0.9, 1.0); }`,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    this.dust = new THREE.Points(g, m); this.dust.frustumCulled = false; this.dust.renderOrder = 5;
    this.scene.add(this.dust);
  }

  // ------------------------------------------------------------------ Begehbarkeit
  setupMask(img) {
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const cx = cv.getContext('2d'); cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, img.width, img.height).data;
    this.mask = { w: img.width, h: img.height, data: new Uint8Array(img.width * img.height), ...this.meta.maske };
    for (let i = 0; i < this.mask.data.length; i++) this.mask.data[i] = d[i * 4] > 127 ? 1 : 0;
  }

  // Blender-Koordinaten (x, y) aus three (x, -z)
  walkable(x, z) {
    const m = this.mask; const bx = x, by = -z;
    const ix = Math.floor((bx - m.x0) / m.cell), iy = Math.floor((m.y1 - by) / m.cell);
    if (ix < 0 || iy < 0 || ix >= m.w || iy >= m.h) return false;
    return m.data[iy * m.w + ix] === 1;
  }

  free(x, z) {
    const r = RADIUS;
    for (let a = 0; a < 8; a++) {
      const an = a * Math.PI / 4;
      if (!this.walkable(x + Math.cos(an) * r, z + Math.sin(an) * r)) return false;
    }
    return this.walkable(x, z);
  }

  // ------------------------------------------------------------------ Nachbearbeitung
  setupPost() {
    const r = this.renderer;
    const opts = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
    this.rt = new THREE.WebGLRenderTarget(4, 4, { ...opts, samples: this.lite ? 0 : 4 });
    this.bloomRT = [0, 1, 2, 3, 4].map(() => new THREE.WebGLRenderTarget(4, 4, opts));
    this.lumRT = new THREE.WebGLRenderTarget(16, 16, { type: THREE.UnsignedByteType });
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2));
    this.postScene = new THREE.Scene(); this.postScene.add(this.quad);
    this.postCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const vs = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
    this.downMat = new THREE.ShaderMaterial({
      uniforms: { src: { value: null }, texel: { value: new THREE.Vector2() }, thresh: { value: 0 } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D src; uniform vec2 texel; uniform float thresh; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(src, vUv + texel*vec2(-1.,-1.)).rgb + texture2D(src, vUv + texel*vec2(1.,-1.)).rgb
                 + texture2D(src, vUv + texel*vec2(-1.,1.)).rgb + texture2D(src, vUv + texel*vec2(1.,1.)).rgb;
          c *= 0.25;
          if (thresh > 0.0) { float l = max(max(c.r,c.g),c.b); c *= clamp((l - thresh) / max(l, 1e-4), 0.0, 1.0); }
          gl_FragColor = vec4(c, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.upMat = new THREE.ShaderMaterial({
      uniforms: { src: { value: null }, texel: { value: new THREE.Vector2() } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D src; uniform vec2 texel; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(src, vUv + texel*vec2(-1.,0.)).rgb*2.0 + texture2D(src, vUv + texel*vec2(1.,0.)).rgb*2.0
                 + texture2D(src, vUv + texel*vec2(0.,-1.)).rgb*2.0 + texture2D(src, vUv + texel*vec2(0.,1.)).rgb*2.0
                 + texture2D(src, vUv + texel*vec2(-1.,-1.)).rgb + texture2D(src, vUv + texel*vec2(1.,-1.)).rgb
                 + texture2D(src, vUv + texel*vec2(-1.,1.)).rgb + texture2D(src, vUv + texel*vec2(1.,1.)).rgb;
          gl_FragColor = vec4(c / 12.0, 1.0);
        }`,
      depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, transparent: true,
    });
    this.finalMat = new THREE.ShaderMaterial({
      uniforms: { src: { value: null }, bloom: { value: null }, exposure: { value: 1 }, uTime: this.uniforms.uTime,
        res: { value: new THREE.Vector2() } },
      vertexShader: vs,
      fragmentShader: `uniform sampler2D src; uniform sampler2D bloom; uniform float exposure; uniform float uTime; uniform vec2 res;
        varying vec2 vUv;
        #include <common>
        #include <tonemapping_pars_fragment>
        void main(){
          vec3 c = texture2D(src, vUv).rgb;
          c += texture2D(bloom, vUv).rgb * 0.045;
          c *= exposure;
          c = AgXToneMapping(c);
          // Fotografischer Abschluss: sanfte S-Kurve, etwas tieferer Schwarzpunkt, eine Spur mehr Farbe
          c = clamp((c - 0.012) / 0.988, 0.0, 1.0);
          c = mix(c, c * c * (3.0 - 2.0 * c), 0.3);
          float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));
          c = mix(vec3(lum), c, 1.06);
          // leichte Vignette wie bei einem Objektiv
          vec2 q = vUv - 0.5; c *= 1.0 - dot(q, q) * 0.32;
          gl_FragColor = vec4(c, 1.0);
          #include <colorspace_fragment>
          // feines Korn + Dithering gegen Stufen
          float n = fract(sin(dot(vUv * res + uTime * 61.0, vec2(12.9898, 78.233))) * 43758.5453);
          gl_FragColor.rgb += (n - 0.5) / 180.0;
        }`,
      depthTest: false, depthWrite: false,
    });
    this.finalMat.uniforms.toneMappingExposure = { value: 1.0 };
    this.lumBuf = new Uint8Array(16 * 16 * 4);
    this.lumMat = new THREE.ShaderMaterial({
      uniforms: { src: { value: null } }, vertexShader: vs,
      fragmentShader: `uniform sampler2D src; varying vec2 vUv;
        void main(){
          vec2 base = floor(vUv * 16.0) / 16.0; vec3 c = vec3(0.0);
          for (int j = 0; j < 8; j++) for (int i = 0; i < 8; i++) c += texture2D(src, base + (vec2(i, j) + 0.5) / 128.0).rgb;
          c /= 64.0;
          float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
          gl_FragColor = vec4(clamp(log2(l + 1e-3) / 16.0 + 0.6, 0.0, 1.0), 0.0, 0.0, 1.0);   // Helligkeit logarithmisch in 8 Bit
        }`, depthTest: false, depthWrite: false });
  }

  blit(mat, target) {
    this.quad.material = mat;
    this.renderer.setRenderTarget(target);
    this.renderer.render(this.postScene, this.postCam);
  }

  // ------------------------------------------------------------------ Größe
  resize() {
    const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
    this.renderer.setPixelRatio(this.dpr);
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    // Brennweite wie bei Architekturfotos: quer ~76° horizontal (three.js rechnet vertikal), hoch 70° vertikal
    const asp = w / h;
    this.camera.fov = w < h ? 70 : THREE.MathUtils.radToDeg(2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(76) / 2) / asp));
    this.camera.updateProjectionMatrix();
    if (!this.rt) return;
    const W = Math.round(w * this.dpr), H = Math.round(h * this.dpr);
    this.rt.setSize(W, H);
    let bw = W >> 1, bh = H >> 1;
    for (const t of this.bloomRT) { t.setSize(Math.max(1, bw), Math.max(1, bh)); bw >>= 1; bh >>= 1; }
    this.finalMat.uniforms.res.value.set(W, H);
    if (this.dust) this.dust.material.uniforms.px.value = this.dpr * 1.6;
  }

  // ------------------------------------------------------------------ Steuerung (Basis)
  look(dx, dy) {
    this.tYaw -= dx; this.tPitch = THREE.MathUtils.clamp(this.tPitch - dy, -1.25, 1.25);
  }

  update(dt) {
    // Blick weich nachführen (keine ruckartigen Spielbewegungen)
    const k = 1 - Math.exp(-dt * 18);
    this.yaw += (this.tYaw - this.yaw) * k; this.pitch += (this.tPitch - this.pitch) * k;
    // Bewegungswunsch
    const f = (this.keys.has('KeyW') || this.keys.has('ArrowUp') ? 1 : 0) - (this.keys.has('KeyS') || this.keys.has('ArrowDown') ? 1 : 0) + this.move.y;
    const s = (this.keys.has('KeyD') ? 1 : 0) - (this.keys.has('KeyA') ? 1 : 0) + this.move.x;
    // Drehen per Tastatur (Pfeile links/rechts, Q/E) – für Bedienung ohne Maus
    const turn = (this.keys.has('ArrowLeft') || this.keys.has('KeyQ') ? 1 : 0) - (this.keys.has('ArrowRight') || this.keys.has('KeyE') ? 1 : 0);
    if (turn) this.tYaw += turn * dt * 1.6;
    const run = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
    const wish = new THREE.Vector3();
    if (this.autoTarget) {
      const d = new THREE.Vector3(this.autoTarget.x - this.pos.x, 0, this.autoTarget.z - this.pos.z);
      const L = d.length();
      if (L < 0.08 || f || s) this.autoTarget = null;
      else wish.copy(d.normalize()).multiplyScalar(Math.min(1, L / 0.6));
    }
    if (f || s) {
      const fw = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
      const rt = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
      wish.addScaledVector(fw, THREE.MathUtils.clamp(f, -1, 1)).addScaledVector(rt, THREE.MathUtils.clamp(s, -1, 1));
      if (wish.lengthSq() > 1) wish.normalize();
    }
    const vmax = run ? RUN : SPEED;
    const target = wish.multiplyScalar(vmax);
    const acc = 1 - Math.exp(-dt * (target.lengthSq() > 0 ? 6.5 : 9));
    this.vel.lerp(target, acc);
    // Bewegung mit Gleiten an Wänden
    const nx = this.pos.x + this.vel.x * dt, nz = this.pos.z + this.vel.z * dt;
    if (this.free(nx, nz)) { this.pos.x = nx; this.pos.z = nz; }
    else if (this.free(nx, this.pos.z)) { this.pos.x = nx; this.vel.z *= 0.5; }
    else if (this.free(this.pos.x, nz)) { this.pos.z = nz; this.vel.x *= 0.5; }
    else this.vel.multiplyScalar(0.3);
    // Kamera: ganz leichtes, natürliches Schwanken beim Gehen (kein Spiel-Wippen)
    const sp = Math.hypot(this.vel.x, this.vel.z);
    this.stepPhase = (this.stepPhase || 0) + dt * sp * 5.2;
    const bob = Math.sin(this.stepPhase) * 0.006 * Math.min(1, sp / SPEED);
    this.camera.position.set(this.pos.x, EYE + bob, this.pos.z);
    this.camera.rotation.set(this.pitch, this.yaw, Math.sin(this.stepPhase * 0.5) * 0.0015 * Math.min(1, sp));
    this.camera.updateMatrixWorld();
    if (this.umgMat) this.umgMat.uniforms.mixB.value = THREE.MathUtils.smoothstep(this.pos.x, 6.0, 10.0);
    // Raum melden
    const room = this.roomAt(this.pos.x, -this.pos.z);
    if (room !== this.room) { this.room = room; this.onRoom(room); }
  }

  roomAt(x, y) {
    for (const [k, r] of Object.entries(this.meta.raeume)) {
      if (x >= r[0] && x <= r[1] && y >= r[2] && y <= r[3]) return k;
    }
    return null;
  }

  // ------------------------------------------------------------------ Belichtung (Augen-Adaption)
  adapt(dt) {
    // Durchschnittshelligkeit der Szene (16×16) asynchron lesen, Belichtung langsam nachführen
    this.lumTimer = (this.lumTimer || 0) - dt;
    if (this.lumTimer <= 0 && !this.lumPending && this.renderer.readRenderTargetPixelsAsync) {
      this.lumTimer = 0.25; this.lumPending = true;
      this.lumMat.uniforms.src.value = this.rt.texture;
      this.blit(this.lumMat, this.lumRT);
      this.renderer.readRenderTargetPixelsAsync(this.lumRT, 0, 0, 16, 16, this.lumBuf).then(() => {
        let s = 0, n = 0;
        for (let i = 0; i < this.lumBuf.length; i += 4) {
          // Mitte des Bildes stärker gewichten (wie eine mittenbetonte Belichtungsmessung)
          const px = (i / 4) % 16, py = Math.floor(i / 64);
          const wgt = 1.5 - Math.hypot(px - 7.5, py - 7.5) / 10.6;
          s += ((this.lumBuf[i] / 255 - 0.6) * 16 * Math.LN2) * wgt; n += wgt;
        }
        const avg = Math.exp(s / n);
        this.lastLum = avg;
        const key = this.meta.belichtung_ziel || 0.18;
        this.targetExposure = THREE.MathUtils.clamp(key / Math.max(avg, 1e-3), 0.45, 2.2) * (this.meta.belichtung || 1);
        this.lumPending = false;
      }).catch((e) => { this.lumPending = false; this.lumError = String(e); });
    }
    this.exposure += (this.targetExposure - this.exposure) * (1 - Math.exp(-dt * 1.1));
  }

  // ------------------------------------------------------------------ Bild
  render() {
    const r = this.renderer;
    r.setRenderTarget(this.rt); r.render(this.scene, this.camera);
    // Bloom: Kaskade herunter, dann hinauf addieren
    let src = this.rt.texture;
    this.bloomRT.forEach((t, i) => {
      this.downMat.uniforms.src.value = src;
      this.downMat.uniforms.texel.value.set(0.5 / t.width, 0.5 / t.height);
      this.downMat.uniforms.thresh.value = i === 0 ? 1.4 : 0;
      this.blit(this.downMat, t); src = t.texture;
    });
    for (let i = this.bloomRT.length - 1; i > 0; i--) {
      this.upMat.uniforms.src.value = this.bloomRT[i].texture;
      this.upMat.uniforms.texel.value.set(1 / this.bloomRT[i].width, 1 / this.bloomRT[i].height);
      this.blit(this.upMat, this.bloomRT[i - 1]);
    }
    this.finalMat.uniforms.src.value = this.rt.texture;
    this.finalMat.uniforms.bloom.value = this.bloomRT[0].texture;
    this.finalMat.uniforms.exposure.value = this.exposure;
    this.blit(this.finalMat, null);
  }

  frame() {
    if (!this.running) return;
    this.clock.update();
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this.uniforms.uTime.value += dt;
    this.update(dt);
    this.adapt(dt);
    this.render();
    this.raf = requestAnimationFrame(() => this.frame());
  }

  start() { if (this.running) return; this.running = true; this.clock.update(); this.frame(); }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
}
