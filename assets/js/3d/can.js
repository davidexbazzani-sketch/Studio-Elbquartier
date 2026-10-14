// FUNKL-Dose: schlanke 250-ml-Aluminiumdose mit bedrucktem Mantel und Kondenswasser.
//
// Druck wie bei echten Dosen: farbige Lasur direkt auf Aluminium (metallisch schimmernd),
// weiße Deckfarbe für Logo und Schrift (matt-glänzend), blanke Metallstellen (Linien, Funke).
// Dazu eine Karte für Metall/Rauheit, Deckel und Boden aus gebürstetem Aluminium.
//
// Kondenswasser als Simulation auf der Grafikkarte (u = rundherum, v = Höhe):
// - feiner Beschlag aus Mikroperlen (einmal vorberechnet) macht die Dose matt und milchig
// - Tropfen entstehen, wachsen langsam, fließen zusammen; erst große Tropfen laufen los,
//   langsam und ruckelnd, ziehen sich in die Länge und lassen eine Spur aus Perlen zurück
// - Tropfen wirken wie Linsen: der Druck darunter ist verschoben, die Unterkante dunkler

import * as THREE from 'three';

// Maße in Dezimetern (1 = 10 cm): Durchmesser 53 mm, Höhe 134 mm
export const CAN = { r: 0.265, h: 1.34, bodyBottom: 0.1, bodyTop: 1.16 };
export const FRONT_YAW = Math.PI / 2; // so zeigt die Vorderseite des Etiketts zur Kamera (+z)
const BODY_H = CAN.bodyTop - CAN.bodyBottom;
const CIRC = Math.PI * 2 * CAN.r;

/* ------------------------------------------------------------------ */
/* Etikett                                                              */
/* ------------------------------------------------------------------ */

let fontReady = null;
export function loadFonts(base) {
  fontReady ??= (async () => {
    const f = new FontFace('Bricolage Grotesque', `url(${base}bricolage-grotesque-wght.woff2)`, { weight: '200 800', stretch: '75% 100%' });
    try { await f.load(); document.fonts.add(f); } catch (e) { console.warn('Schrift fehlt', e); }
  })();
  return fontReady;
}

function sparkPath(g, x, y, r) {
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.26 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
}

// Druckarten → Metall (B) und Rauheit (G) in der Druck-Karte
const PRINT = {
  ink: 'rgb(0, 76, 150)', // Farblasur auf Alu: metallisch schimmernd, Farbe bleibt kräftig
  white: 'rgb(0, 100, 0)', // weiße Deckfarbe: nicht metallisch, seidig
  dark: 'rgb(0, 95, 25)', // dunkle Deckfarbe
  silver: 'rgb(0, 38, 255)', // blankes Aluminium
};

/**
 * Etikett als zwei Canvas-Texturen (2048 × 1024, u = einmal rundherum):
 * map = Farben, print = Metall/Rauheit des Drucks.
 */
export function makeLabel(flavor) {
  const W = 2048, H = 1024;
  const mk = () => { const c = document.createElement('canvas'); c.width = W; c.height = H; return c; };
  const cCol = mk(), cPrn = mk();
  const draws = (g, mode) => {
    const col = (kind, color) => (mode === 'color' ? color : PRINT[kind]);
    const [a, b, d] = flavor.colors;
    // Grund: Farblasur als Verlauf
    if (mode === 'color') {
      const grad = g.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, a); grad.addColorStop(0.55, b); grad.addColorStop(1, d);
      g.fillStyle = grad;
    } else g.fillStyle = PRINT.ink;
    g.fillRect(0, 0, W, H);
    if (mode === 'color') {
      // weiche Farbwolken, damit die Lasur lebendig wirkt
      for (let i = 0; i < 7; i++) {
        const x = (i / 7) * W + 80, y = H * (0.25 + 0.5 * ((i * 37) % 7) / 7);
        const rg = g.createRadialGradient(x, y, 0, x, y, 420);
        rg.addColorStop(0, flavor.glow + '50'); rg.addColorStop(1, flavor.glow + '00');
        g.fillStyle = rg; g.fillRect(0, 0, W, H);
      }
    }
    // feine Wellenlinien als blankes Metall: schimmern, wenn die Dose sich dreht
    g.save();
    g.strokeStyle = col('silver', 'rgba(236, 238, 242, 0.55)');
    g.lineWidth = 7;
    for (let k = -6; k < 16; k++) {
      g.beginPath();
      for (let x = 0; x <= W; x += 16) {
        const y = k * 120 + Math.sin(x / 140 + k) * 28 + x * 0.32;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    g.restore();

    // Vorderseite (Mitte bei u = 0.75)
    const fx = W * 0.75;
    g.save();
    g.translate(fx, H * 0.53);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '800 285px "Bricolage Grotesque", "Arial Black", sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '-6px';
    g.fillStyle = col('dark', flavor.shadow);
    g.fillText('FUNKL', 9, 13);
    g.fillStyle = col('white', '#fbfbf8');
    g.fillText('FUNKL', 0, 0);
    g.restore();
    g.fillStyle = col('silver', '#eef0f3');
    sparkPath(g, fx + 150, H * 0.15, 56); g.fill();
    g.fillStyle = col('white', '#fbfbf8');
    sparkPath(g, fx + 212, H * 0.22, 22); g.fill();

    // Sorte und Hinweise neben dem Schriftzug
    g.save();
    g.translate(fx + 252, H * 0.53);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center';
    g.fillStyle = col('white', '#fbfbf8');
    g.font = '700 62px "Bricolage Grotesque", Arial, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '6px';
    g.fillText(flavor.name.toUpperCase(), 0, 0);
    g.font = '600 31px "Bricolage Grotesque", Arial, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '8px';
    g.fillText('ENERGY DRINK · ZERO ZUCKER · 250 ML', 0, 56);
    g.restore();

    // Rückseite: Funke, Claim, Zutaten, Strichcode, Pfand
    const bx = W * 0.25;
    g.fillStyle = col('silver', '#eef0f3');
    sparkPath(g, bx, H * 0.24, 110); g.fill();
    g.fillStyle = col('white', '#fbfbf8');
    g.textAlign = 'center';
    g.font = '700 50px "Bricolage Grotesque", Arial, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '2px';
    g.fillText(flavor.tag.toUpperCase(), bx, H * 0.45);
    g.font = '500 22px "Bricolage Grotesque", Arial, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '0px';
    const lines = ['Zutaten: Wasser, Kohlensäure, Säuerungsmittel Citronensäure,', 'natürliches Aroma, Taurin (0,4 %), Koffein (0,032 %), Säureregulator', 'Natriumcitrate, Süßungsmittel Sucralose, Vitamine (Niacin, B6, B12).', 'Erhöhter Koffeingehalt (32 mg/100 ml). Für Kinder und schwangere', 'oder stillende Frauen nicht empfohlen. Gekühlt genießen.'];
    lines.forEach((l, i) => g.fillText(l, bx, H * 0.53 + i * 30));
    // Strichcode auf weißem Feld
    const bcx = bx - 300, bcy = H * 0.74;
    g.fillStyle = col('white', '#fbfbf8'); g.fillRect(bcx, bcy, 230, 120);
    g.fillStyle = col('dark', '#151515');
    let x = bcx + 14;
    for (let i = 0; i < 46; i++) { const w = 2 + ((i * 7) % 5); if (i % 2 === 0) g.fillRect(x, bcy + 12, w, 82); x += w + 1; }
    g.font = '600 18px Arial, sans-serif'; g.fillText('4 260123 450017', bcx + 115, bcy + 110);
    g.fillStyle = col('white', '#fbfbf8');
    g.font = '700 30px "Bricolage Grotesque", Arial, sans-serif';
    g.fillText('250 ml ℮', bx + 180, H * 0.78);
    g.font = '600 22px "Bricolage Grotesque", Arial, sans-serif';
    g.fillText('PFAND · EINWEG 0,25 €', bx + 180, H * 0.83);
    g.fillText('L 2026-10 · MHD siehe Boden', bx + 180, H * 0.87);
  };
  draws(cCol.getContext('2d'), 'color');
  draws(cPrn.getContext('2d'), 'print');
  const tex = (c, srgb) => {
    const t = new THREE.CanvasTexture(c);
    if (srgb) t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 8;
    t.wrapS = THREE.RepeatWrapping;
    return t;
  };
  return { map: tex(cCol, true), print: tex(cPrn, false), top: flavor.colors[0], bottom: flavor.colors[2] };
}

/* ------------------------------------------------------------------ */
/* Geometrie                                                            */
/* ------------------------------------------------------------------ */

function canGeometry() {
  const r = CAN.r;
  // Boden: Standring, nach innen gewölbte Kuppel
  const bottom = [];
  bottom.push(new THREE.Vector2(0.0, 0.05));
  bottom.push(new THREE.Vector2(0.1, 0.044));
  bottom.push(new THREE.Vector2(0.17, 0.022));
  bottom.push(new THREE.Vector2(0.196, 0.004));
  bottom.push(new THREE.Vector2(0.207, 0.0));
  bottom.push(new THREE.Vector2(0.219, 0.003));
  for (let i = 0; i <= 10; i++) {
    const t = i / 10;
    bottom.push(new THREE.Vector2(0.219 + (r - 0.219) * Math.sin(t * Math.PI / 2), 0.003 + (CAN.bodyBottom - 0.003) * (1 - Math.cos(t * Math.PI / 2))));
  }
  // Hals: Schulter, zwei Einzüge, Falz (Bördelrand), Senke mit Deckel
  const top = [];
  top.push(new THREE.Vector2(r, CAN.bodyTop));
  for (let i = 1; i <= 14; i++) {
    const t = i / 14;
    const s = t * t * (3 - 2 * t);
    const ripple = Math.sin(t * Math.PI * 3) * 0.0025 * (1 - t); // feine Stufen im Hals
    top.push(new THREE.Vector2(r - (r - 0.232) * s + ripple, CAN.bodyTop + t * 0.135));
  }
  top.push(new THREE.Vector2(0.233, 1.302));
  top.push(new THREE.Vector2(0.2385, 1.31));
  top.push(new THREE.Vector2(0.2405, 1.322)); // Falz außen
  top.push(new THREE.Vector2(0.239, 1.336));
  top.push(new THREE.Vector2(0.233, 1.341)); // Oberkante
  top.push(new THREE.Vector2(0.226, 1.338));
  top.push(new THREE.Vector2(0.223, 1.325)); // Falz innen
  top.push(new THREE.Vector2(0.219, 1.308)); // Senke
  top.push(new THREE.Vector2(0.212, 1.306));
  top.push(new THREE.Vector2(0.205, 1.311));
  top.push(new THREE.Vector2(0.19, 1.312)); // Deckelfläche
  top.push(new THREE.Vector2(0.0, 1.312));
  const body = new THREE.CylinderGeometry(r, r, BODY_H, 160, 24, true);
  body.translate(0, CAN.bodyBottom + BODY_H / 2, 0);
  // Schulter (bedruckt) bis kurz vor den Falz, Rest blankes Aluminium
  const cut = top.findIndex((p) => p.y >= 1.29);
  const shoulder = top.slice(0, cut + 1);
  const rim = top.slice(cut);
  // Unterkante: kurzer bedruckter Übergang, dann blanker Boden
  const bcut = bottom.findIndex((p) => p.y >= 0.06);
  return {
    body,
    shoulder: new THREE.LatheGeometry(shoulder, 160), top: new THREE.LatheGeometry(rim, 160),
    heel: new THREE.LatheGeometry(bottom.slice(bcut), 160), bottom: new THREE.LatheGeometry(bottom.slice(0, bcut + 1), 160),
  };
}

function tabGeometry() {
  const s = new THREE.Shape();
  const w = 0.07, l = 0.17, rr = 0.033;
  s.moveTo(-w + rr, -l / 2);
  s.lineTo(w - rr, -l / 2); s.quadraticCurveTo(w, -l / 2, w, -l / 2 + rr);
  s.lineTo(w, l / 2 - rr); s.quadraticCurveTo(w, l / 2, w - rr, l / 2);
  s.lineTo(-w + rr, l / 2); s.quadraticCurveTo(-w, l / 2, -w, l / 2 - rr);
  s.lineTo(-w, -l / 2 + rr); s.quadraticCurveTo(-w, -l / 2, -w + rr, -l / 2);
  const hole = new THREE.Path();
  hole.absellipse(0, l * 0.2, 0.034, 0.027, 0, Math.PI * 2, true);
  s.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(s, { depth: 0.005, bevelEnabled: true, bevelThickness: 0.003, bevelSize: 0.003, bevelSegments: 3, curveSegments: 20 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/* ------------------------------------------------------------------ */
/* Kondenswasser                                                        */
/* ------------------------------------------------------------------ */

const QUAD_VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';

export class Condensation {
  constructor(renderer, { size = 1024, maxDrops = 650 } = {}) {
    this.renderer = renderer;
    this.W = size;
    this.H = Math.round(size * BODY_H / CIRC / 8) * 8;
    this.max = maxDrops;
    this.level = 0; this.levelT = 0;
    this.drops = [];
    this.trails = [];
    this.time = 0;
    this.acc = 0; // Takt für die Grafik-Aktualisierung (30 Hz reicht, Tropfen sind langsam)
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.dropRT = new THREE.WebGLRenderTarget(this.W, this.H, opt);
    this.trailRT = new THREE.WebGLRenderTarget(this.W, this.H, opt);
    this.beadRT = new THREE.WebGLRenderTarget(this.W, this.H, opt);
    const mip = { ...opt, type: THREE.UnsignedByteType, generateMipmaps: true, minFilter: THREE.LinearMipmapLinearFilter };
    this.normalRT = new THREE.WebGLRenderTarget(this.W, this.H, mip);
    this.maskRT = new THREE.WebGLRenderTarget(this.W, this.H, mip);
    for (const rt of [this.normalRT, this.maskRT, this.dropRT, this.trailRT, this.beadRT]) rt.texture.wrapS = THREE.RepeatWrapping;
    this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const quad = new THREE.PlaneGeometry(2, 2);

    // Tropfen: flache Linsen (Kontaktwinkel), beim Laufen in die Länge gezogen, oben schmaler
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = quad.index;
    geo.setAttribute('position', quad.attributes.position);
    this.dropAttr = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 3 * 4), 4);
    this.dropAttr.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('drop', this.dropAttr);
    this.dropGeo = geo;
    const maxBlend = { blending: THREE.CustomBlending, blendEquation: THREE.MaxEquation, blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, depthTest: false, depthWrite: false };
    const scale = new THREE.Vector2(2 / CIRC, 2 / BODY_H);
    this.dropMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: scale } },
      vertexShader: `attribute vec4 drop; uniform vec2 uScale; varying vec2 vP; varying float vR; varying float vS;
        void main(){ vP = position.xy; vR = drop.z; vS = drop.w;
          vec2 c = drop.xy * uScale - 1.0;
          vec2 ext = vec2(1.15, 1.15 * drop.w);
          gl_Position = vec4(c + position.xy * ext * drop.z * uScale, 0.0, 1.0); }`,
      fragmentShader: `varying vec2 vP; varying float vR; varying float vS;
        void main(){
          vec2 p = vP * 1.15;
          // Tropfenform: unten bauchig, oben spitzer (je länger gezogen, desto mehr)
          float k = (vS - 1.0);
          p.x *= 1.0 + max(0.0, p.y) * 0.45 * k;
          p.y += -0.12 * k;
          float d2 = dot(p, p); if (d2 > 1.0) discard;
          float h = sqrt(1.0 - d2) * vR * 0.55 / sqrt(vS);
          gl_FragColor = vec4(h, 1.0, 0.0, 1.0); }`,
      ...maxBlend,
    });
    const dropMesh = new THREE.Mesh(geo, this.dropMat);
    dropMesh.frustumCulled = false;
    this.dropScene = new THREE.Scene();
    this.dropScene.add(dropMesh);

    // Spuren (klar, beschlagen langsam wieder)
    const tgeo = new THREE.InstancedBufferGeometry();
    tgeo.index = quad.index;
    tgeo.setAttribute('position', quad.attributes.position);
    this.trailAttr = new THREE.InstancedBufferAttribute(new Float32Array(1600 * 4), 4);
    this.trailAttr.setUsage(THREE.DynamicDrawUsage);
    tgeo.setAttribute('drop', this.trailAttr);
    this.trailGeo = tgeo;
    this.trailMat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: scale } },
      vertexShader: this.dropMat.vertexShader,
      fragmentShader: 'varying vec2 vP; void main(){ float d = length(vP * 1.15); gl_FragColor = vec4(1.0 - smoothstep(0.5, 1.0, d), 0.0, 0.0, 1.0); }',
      ...maxBlend,
    });
    const trailMesh = new THREE.Mesh(tgeo, this.trailMat);
    trailMesh.frustumCulled = false;
    this.fadeMat = new THREE.ShaderMaterial({
      uniforms: { uKeep: { value: 0.99 } },
      vertexShader: QUAD_VS,
      fragmentShader: 'uniform float uKeep; void main(){ gl_FragColor = vec4(uKeep); }',
      blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.ZeroFactor, blendDst: THREE.SrcColorFactor,
      depthTest: false, depthWrite: false,
    });
    this.trailScene = new THREE.Scene();
    this.trailScene.add(new THREE.Mesh(quad, this.fadeMat), trailMesh);

    // Mikroperlen einmal vorberechnen (Zellrauschen), danach nur noch nachschlagen
    const beadMat = new THREE.ShaderMaterial({
      uniforms: { uCells: { value: new THREE.Vector2(240, Math.round(240 * BODY_H / CIRC)) } },
      vertexShader: QUAD_VS,
      fragmentShader: `uniform vec2 uCells; varying vec2 vUv;
        vec2 hash2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        void main(){
          vec2 w = vUv * uCells; vec2 cell = floor(w), f = fract(w); float h = 0.0;
          for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
            vec2 o = vec2(float(i), float(j)); vec2 rnd = hash2(mod(cell + o, uCells));
            float r = mix(0.16, 0.48, rnd.x * rnd.x);
            vec2 d = o + rnd * 0.8 + 0.1 - f; float q = dot(d, d) / (r * r);
            if (q < 1.0) h = max(h, sqrt(1.0 - q) * r);
          }
          gl_FragColor = vec4(h, 0.0, 0.0, 1.0); }`,
      depthTest: false, depthWrite: false,
    });

    // Zusammensetzen: Normal- und Maskenkarte
    const common = `
      uniform sampler2D tDrop, tTrail, tBead; uniform float uLevel; uniform vec2 uTex, uWorld;
      varying vec2 vUv;
      float microH(vec2 uv){
        float m = uLevel * (1.0 - texture2D(tTrail, uv).r);
        return texture2D(tBead, uv).r * 0.0055 * smoothstep(0.05, 0.6, m);
      }
      float H(vec2 uv){ return max(texture2D(tDrop, uv).r, microH(uv)); }
    `;
    this.normalMat = new THREE.ShaderMaterial({
      uniforms: {
        tDrop: { value: this.dropRT.texture }, tTrail: { value: this.trailRT.texture }, tBead: { value: this.beadRT.texture },
        uLevel: { value: 0 }, uTex: { value: new THREE.Vector2(this.W, this.H) }, uWorld: { value: new THREE.Vector2(CIRC, BODY_H) },
      },
      vertexShader: QUAD_VS,
      fragmentShader: common + `
        void main(){
          vec2 e = 1.0 / uTex;
          float hl = H(vUv - vec2(e.x, 0.0)), hr = H(vUv + vec2(e.x, 0.0));
          float hd = H(vUv - vec2(0.0, e.y)), hu = H(vUv + vec2(0.0, e.y));
          vec2 grad = vec2((hr - hl) / (2.0 * e.x * uWorld.x), (hu - hd) / (2.0 * e.y * uWorld.y));
          vec3 n = normalize(vec3(-grad, 1.0));
          gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.maskMat = new THREE.ShaderMaterial({
      uniforms: this.normalMat.uniforms,
      vertexShader: QUAD_VS,
      fragmentShader: common + `
        void main(){
          float drop = texture2D(tDrop, vUv).r;
          float mist = uLevel * (1.0 - texture2D(tTrail, vUv).r);
          float covered = smoothstep(0.0003, 0.0012, drop);
          // R: Beschlag, G: Rauheit des Wasserfilms, B: Tropfen
          gl_FragColor = vec4(mist * (1.0 - covered), mix(0.62, 0.04, covered), covered, 1.0);
        }`,
      depthTest: false, depthWrite: false,
    });
    this.quadScene = new THREE.Scene();
    this.quadMesh = new THREE.Mesh(quad, beadMat);
    this.quadMesh.frustumCulled = false;
    this.quadScene.add(this.quadMesh);
    const r = renderer, prev = r.getRenderTarget();
    r.setRenderTarget(this.beadRT); r.render(this.quadScene, this.cam); r.setRenderTarget(prev);
    beadMat.dispose();
    this.clear();
    this.compose();
  }

  clear() {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    const c = r.getClearColor(new THREE.Color()), a = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    for (const rt of [this.dropRT, this.trailRT]) { r.setRenderTarget(rt); r.clear(); }
    r.setClearColor(c, a);
    r.setRenderTarget(prev);
    this.drops.length = 0;
  }

  setLevel(l, instant = false) { this.levelT = l; if (instant) this.level = l; }

  /** Zeit vorspulen (z. B. „schon eine Weile aus dem Kühlschrank“), ohne zu zeichnen. */
  prewarm(seconds) {
    for (let t = 0; t < seconds; t += 1 / 30) this.step(1 / 30);
    this.trails.length = 0;
    this.compose();
  }

  /** Physik: wachsen, zusammenfließen, langsam ablaufen. */
  step(dt) {
    this.time += dt;
    this.level += (this.levelT - this.level) * (1 - Math.exp(-dt * 0.5));
    const L = this.level;
    const D = this.drops;
    const spawn = L * 300 * dt;
    for (let i = 0; i < spawn && D.length < this.max; i++) {
      D.push({ x: Math.random() * CIRC, y: Math.random() * BODY_H, r: 0.0022 + Math.pow(Math.random(), 3) * 0.006, vy: 0, wob: Math.random() * 6, hold: 0, trailT: 0, stretch: 1, g: 0.2 + Math.pow(Math.random(), 4) * 1.6 });
    }
    const grow = L * 0.0005 * dt; // wachsen langsam, unterschiedlich schnell
    for (const d of D) if (d.r < 0.026) d.r += grow * (d.g ?? 1);

    // zusammenfließen
    const cs = 0.07, nx = Math.ceil(CIRC / cs), grid = new Map();
    D.forEach((d, i) => { const k = (((Math.floor(d.x / cs) % nx) + nx) % nx) + Math.floor(d.y / cs) * nx; (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    const dead = new Uint8Array(D.length);
    for (let i = 0; i < D.length; i++) {
      if (dead[i]) continue;
      const a = D[i];
      const cx = Math.floor(a.x / cs), cy = Math.floor(a.y / cs);
      for (let oy = -1; oy <= 1 && !dead[i]; oy++) for (let ox = -1; ox <= 1 && !dead[i]; ox++) {
        const list = grid.get((((cx + ox) % nx) + nx) % nx + (cy + oy) * nx);
        if (!list) continue;
        for (const j of list) {
          if (j === i || dead[j]) continue;
          const b = D[j];
          let dx = Math.abs(a.x - b.x); dx = Math.min(dx, CIRC - dx);
          if (dx * dx + (a.y - b.y) ** 2 < ((a.r + b.r) * 0.8) ** 2) {
            const [big, small, si] = a.r >= b.r ? [a, b, j] : [b, a, i];
            big.r = Math.cbrt(big.r ** 3 + small.r ** 3);
            if (small.vy < big.vy) big.vy = (big.vy + small.vy) / 2;
            dead[si] = 1;
            if (si === i) break;
          }
        }
      }
    }
    // ablaufen: erst ab ~3 mm, langsam (5–15 mm/s), stockend; hinterlässt Perlen
    const slide = 0.025;
    const add = [];
    for (let i = 0; i < D.length; i++) {
      if (dead[i]) continue;
      const d = D[i];
      if (d.r > slide) {
        if (d.hold > 0) { d.hold -= dt; d.vy *= Math.exp(-dt * 8); }
        else {
          const target = -(0.05 + (d.r - slide) * 3.2);
          d.vy += (target - d.vy) * Math.min(1, dt * 2.5);
          if (Math.random() < dt * 0.5) d.hold = 0.25 + Math.random() * 1.1; // bleibt kurz hängen
        }
        d.x += Math.sin(this.time * 1.3 + d.wob) * 0.0025 * dt;
        const dy = d.vy * dt;
        d.y += dy;
        d.stretch += ((1 + Math.min(0.9, -d.vy * 5)) - d.stretch) * Math.min(1, dt * 4);
        d.r -= Math.abs(dy) * 0.012; // verliert Wasser an die Spur
        d.trailT += Math.abs(dy);
        this.trails.push([d.x, d.y + d.r * 0.6, d.r * 0.7]);
        if (d.trailT > 0.045 + Math.random() * 0.05 && d.r > 0.02) { // Perle bleibt in der Spur zurück
          d.trailT = 0;
          add.push({ x: d.x + (Math.random() - 0.5) * 0.004, y: d.y + d.r * 1.6, r: d.r * (0.18 + Math.random() * 0.12), vy: 0, wob: 0, hold: 0, trailT: 0, stretch: 1 });
        }
        if (d.y < -0.05) dead[i] = 1;
      } else {
        d.stretch += (1 - d.stretch) * Math.min(1, dt * 3);
      }
    }
    this.drops = D.filter((_, i) => !dead[i]).concat(add);
  }

  /** Karten neu zeichnen (gedrosselt auf ~30 Hz). */
  render(dt = 1 / 60) {
    this.acc += dt;
    this.fadeDt = (this.fadeDt || 0) + dt;
    if (this.acc < 1 / 32) return false;
    this.acc = 0;
    this.compose();
    return true;
  }

  compose() {
    const r = this.renderer;
    const prevRT = r.getRenderTarget();
    const prevAuto = r.autoClear;
    const c = r.getClearColor(new THREE.Color()), a = r.getClearAlpha();
    r.setClearColor(0x000000, 0);
    r.autoClear = false;

    const D = this.drops, arr = this.dropAttr.array;
    let n = 0;
    for (const d of D) {
      for (const off of [0, -CIRC, CIRC]) {
        if (off !== 0 && Math.abs(d.x + off - CIRC / 2) > CIRC / 2 + d.r * 2) continue;
        if (n >= this.max * 3) break;
        arr[n * 4] = d.x + off; arr[n * 4 + 1] = d.y; arr[n * 4 + 2] = d.r; arr[n * 4 + 3] = d.stretch || 1; n++;
      }
    }
    this.dropGeo.instanceCount = n;
    this.dropAttr.needsUpdate = true;
    r.setRenderTarget(this.dropRT);
    r.clear();
    if (n) r.render(this.dropScene, this.cam);

    const T = this.trails, ta = this.trailAttr.array;
    const m = Math.min(T.length, ta.length / 4);
    for (let i = 0; i < m; i++) { ta[i * 4] = T[i][0]; ta[i * 4 + 1] = T[i][1]; ta[i * 4 + 2] = T[i][2]; ta[i * 4 + 3] = 1; }
    this.trailGeo.instanceCount = m;
    this.trailAttr.needsUpdate = true;
    this.trails.length = 0;
    this.fadeMat.uniforms.uKeep.value = Math.exp(-(this.fadeDt || 0) / 6); // Spuren beschlagen in ~6 s wieder
    this.fadeDt = 0;
    r.setRenderTarget(this.trailRT);
    r.render(this.trailScene, this.cam);

    this.normalMat.uniforms.uLevel.value = this.level;
    this.quadMesh.material = this.normalMat;
    r.setRenderTarget(this.normalRT); r.clear(); r.render(this.quadScene, this.cam);
    this.quadMesh.material = this.maskMat;
    r.setRenderTarget(this.maskRT); r.clear(); r.render(this.quadScene, this.cam);

    r.autoClear = prevAuto;
    r.setClearColor(c, a);
    r.setRenderTarget(prevRT);
  }

  dispose() {
    for (const rt of [this.dropRT, this.trailRT, this.beadRT, this.normalRT, this.maskRT]) rt.dispose();
    this.dropGeo.dispose(); this.trailGeo.dispose();
  }
}

/* ------------------------------------------------------------------ */
/* Dose zusammensetzen                                                  */
/* ------------------------------------------------------------------ */

const geos = { current: null };

/**
 * Erzeugt eine Dose. label: Ergebnis von makeLabel(), condensation: Condensation oder null.
 */
export function createCan({ label, condensation = null }) {
  geos.current ??= { ...canGeometry(), tab: tabGeometry() };
  const G = geos.current;
  const group = new THREE.Group();

  // gebürstetes Aluminium (Deckel: kreisförmig gebürstet, über die Lathe-UVs)
  const alu = new THREE.MeshPhysicalMaterial({
    color: '#e4e7eb', metalness: 1, roughness: 0.14, anisotropy: 0.45, anisotropyRotation: 0,
    clearcoat: 0.4, clearcoatRoughness: 0.08,
  });
  const inkTop = new THREE.MeshPhysicalMaterial({ color: label.top, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03 });
  const inkBottom = new THREE.MeshPhysicalMaterial({ color: label.bottom, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03 });
  const bodyMat = new THREE.MeshPhysicalMaterial({
    map: label.map, metalnessMap: label.print, metalness: 1, roughness: 1,
    clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.15,
  });
  bodyMat.userData.print = label.print;
  const cond = condensation;
  bodyMat.onBeforeCompile = (sh) => {
    sh.uniforms.tPrint = { value: label.print };
    bodyMat.userData.shader = sh;
    if (cond) { sh.uniforms.tMask = { value: cond.maskRT.texture }; sh.uniforms.tDropN = { value: cond.normalRT.texture }; }
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\nuniform sampler2D tPrint;${cond ? '\nuniform sampler2D tMask, tDropN;' : ''}`)
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec4 cMask = ${cond ? 'texture2D(tMask, vMapUv)' : 'vec4(0.0, 0.5, 0.0, 1.0)'};
        ${cond ? `
        vec3 dn = texture2D(tDropN, vMapUv).xyz * 2.0 - 1.0;
        if (cMask.b > 0.02) {
          // Tropfen als Linse: Druck darunter verschoben und leicht vergrößert, Unterkante dunkler
          // leichte Linse: Druck minimal verschoben und vergrößert
          vec3 refr = texture2D(map, vMapUv - dn.xy * vec2(0.006, 0.009)).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, refr, cMask.b);
          // nur ein schmaler dunkler Rand ganz unten am Tropfen (Totalreflexion)
          float rim = smoothstep(0.5, 0.9, length(dn.xy)) * smoothstep(-0.1, 0.6, -dn.y + dn.x * 0.3);
          diffuseColor.rgb *= 1.0 - rim * 0.55 * cMask.b;
          // Lichtfang an der Unterkante (gebündeltes Licht im Tropfen)
          float caustic = smoothstep(0.35, 0.7, length(dn.xy)) * smoothstep(0.3, 0.8, -dn.y) * (1.0 - rim);
          diffuseColor.rgb += caustic * 0.18 * cMask.b;
        }
        float lumC = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lumC), cMask.r * 0.34);
        diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.9, 0.93, 0.96), cMask.r * 0.3);` : ''}`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        ${cond ? `
        // Glanzpunkt jedes Tropfens (Licht von oben links), unabhängig von der Umgebung
        vec3 dnh = texture2D(tDropN, vMapUv).xyz * 2.0 - 1.0;
        float spec = pow(max(dot(normalize(dnh), normalize(vec3(-0.5, 0.6, 0.62))), 0.0), 60.0);
        totalEmissiveRadiance += vec3(spec) * 1.6 * texture2D(tMask, vMapUv).b;` : ''}`)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = texture2D(tPrint, vMapUv).g;
        ${cond ? 'roughnessFactor = mix(roughnessFactor, 0.62, cMask.r * 0.9); // nur der Beschlag macht matt, Tropfen sind eine eigene Glanzschicht (Klarlack)' : ''}`)
      .replace('#include <metalnessmap_fragment>', `#include <metalnessmap_fragment>
        ${cond ? 'metalnessFactor *= 1.0 - cMask.r * 0.35;' : ''}`);
  };
  bodyMat.customProgramCacheKey = () => (cond ? 'dose-k' : 'dose');
  if (cond) bodyMat.clearcoatNormalMap = cond.normalRT.texture; // Wasser liegt als klare Schicht obenauf: Klarlack bekommt die Tropfenform

  const body = new THREE.Mesh(G.body, bodyMat);
  const bottom = new THREE.Mesh(G.bottom, alu);
  const heel = new THREE.Mesh(G.heel, inkBottom);
  const top = new THREE.Mesh(G.top, alu);
  const shoulder = new THREE.Mesh(G.shoulder, inkTop);
  const tab = new THREE.Mesh(G.tab, alu);
  tab.position.set(0, 1.317, 0.05);
  const rivet = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), alu);
  rivet.position.set(0, 1.312, 0.012);
  rivet.scale.y = 0.35;
  const score = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.0035, 6, 40, Math.PI * 1.25), alu);
  score.rotation.set(Math.PI / 2, 0, Math.PI * 0.12);
  score.position.set(0, 1.313, -0.11);
  group.add(body, shoulder, heel, bottom, top, tab, rivet, score);
  return {
    group, body, bodyMat,
    setLabel(l) {
      bodyMat.map = l.map; bodyMat.metalnessMap = l.print;
      inkTop.color.set(l.top); inkBottom.color.set(l.bottom);
      const sh = bodyMat.userData.shader;
      if (sh) sh.uniforms.tPrint.value = l.print;
      bodyMat.needsUpdate = false;
    },
  };
}

/** Alle Etiketten vorab auf die Grafikkarte laden (kein Ruckler beim Sortenwechsel). */
export function warmLabels(renderer, labels) {
  for (const l of labels) { renderer.initTexture(l.map); renderer.initTexture(l.print); }
}
