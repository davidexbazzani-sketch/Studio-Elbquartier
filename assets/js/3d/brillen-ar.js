// Klarsund – AR-Anprobe: Selfie-Kamera (Handy) bzw. Webcam (Laptop), Gesichtserkennung mit
// MediaPipe Face Landmarker (läuft komplett im Browser, keine Daten verlassen das Gerät),
// Brille in 3D passgenau auf dem Gesicht. Kopf verdeckt die Bügel, Spiegelungen kommen aus dem
// Kamerabild, ein weicher Schatten der Fassung liegt auf dem Gesicht. Fotos per Auslöser.
import * as THREE from 'three';
import { createBrille } from './brillen.js';

const MP = new URL('../../vendor/mediapipe/', import.meta.url).href;
const FACE = new URL('../../models/brillen/gesicht.json', import.meta.url).href;

// Lage der Brille im Gesichtsmodell (cm): Brückenmitte vor der Nasenwurzel, Glasmitte auf Augenhöhe
const OHR_Z = -3.6;   // Kopfkoordinaten (cm): knapp hinter dem vorderen Ohransatz
const SITZ = { x: 0, y: 2.47, z: 5.45, neigung: 8 * Math.PI / 180 };
// Bezugspunkte im Gesichtsmodell für die persönliche Anpassung
const P_BRUECKE = new THREE.Vector3(0, 3.27, 5.24);   // Landmarke 168 (Nasenwurzel)
const P_AUGEN = new THREE.Vector3(0, 2.62, 3.5);      // Mitte zwischen den Pupillen
const P_AUSSEN_L = new THREE.Vector3(-4.45, 2.66, 3.17), P_AUSSEN_R = new THREE.Vector3(4.45, 2.66, 3.17);   // Landmarken 33 / 263

// ---------- Glättung (One-Euro-Filter): ruhig im Stand, ohne Verzögerung bei Bewegung ----------
class OneEuro {
  constructor(minCut = 1.2, beta = 0.6, dCut = 1.0) { Object.assign(this, { minCut, beta, dCut }); this.x = null; this.dx = 0; }
  static a(dt, cut) { const r = 2 * Math.PI * cut * dt; return r / (r + 1); }
  filter(v, dt) {
    if (this.x === null) { this.x = v; return v; }
    const d = (v - this.x) / dt;
    this.dx += OneEuro.a(dt, this.dCut) * (d - this.dx);
    const cut = this.minCut + this.beta * Math.abs(this.dx);
    this.x += OneEuro.a(dt, cut) * (v - this.x);
    return this.x;
  }
}

export class Anprobe {
  constructor({ canvas, video, onStatus = () => {} }) {
    this.canvas = canvas; this.video = video; this.onStatus = onStatus;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, alpha: false });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(63, 16 / 9, 1, 5000);   // wie MediaPipe (vertikal 63°)
    this.kopf = new THREE.Group(); this.kopf.matrixAutoUpdate = false; this.scene.add(this.kopf);
    // Schnittebene hinter dem Ohransatz: was dahinter liegt (Bügelenden), verdecken Ohr und Kopf
    this.renderer.localClippingEnabled = true; this.ohrEbene = new THREE.Plane();
    this.sitz = new THREE.Group(); this.kopf.add(this.sitz);
    this.sitz.position.set(SITZ.x, SITZ.y, SITZ.z); this.sitz.rotation.x = SITZ.neigung;
    this.filters = Array.from({ length: 7 }, (_, i) => new OneEuro(i < 3 ? 1.0 : 1.4, i < 3 ? 0.05 : 0.8));
    this.fitFilters = [new OneEuro(0.8, 0.3), new OneEuro(0.8, 0.3), new OneEuro(0.3, 0.05)];   // Versatz x, y, Maßstab
    this.lost = 0; this.running = false;
    // Licht: Umgebung aus dem Kamerabild + sanftes Oberlicht für Glanzkanten
    this.scene.add(new THREE.HemisphereLight('#ffffff', '#806a5a', 0.6));
    const key = new THREE.DirectionalLight('#ffffff', 0.9); key.position.set(-8, 60, 80); this.scene.add(key);   // weich von vorn oben: Seitenflächen der Bügel bleiben dunkel
    this.envCanvas = document.createElement('canvas'); this.envCanvas.width = 256; this.envCanvas.height = 128;
    this.pmrem = new THREE.PMREMGenerator(this.renderer);
  }

  // ------------------------------------------------------------------ Start
  async start() {
    this.onStatus('Kamera wird gestartet …');
    const stream = await navigator.mediaDevices.getUserMedia({
      // Hochformat am Handy: Hochformat-Bild anfragen (sonst schneidet der Bildschirm das Gesicht seitlich ab)
      audio: false, video: innerHeight > innerWidth
        ? { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 1280 }, aspectRatio: { ideal: 9 / 16 } }
        : { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
    });
    this.stream = stream;
    this.video.srcObject = stream; this.video.muted = true; this.video.playsInline = true;
    await this.video.play();
    this.video.addEventListener('resize', () => this.resize());   // Kamera dreht beim Drehen des Handys
    await new Promise((r) => (this.video.readyState >= 2 ? r() : this.video.addEventListener('loadeddata', r, { once: true })));
    this.onStatus('Gesichtserkennung wird geladen …');
    const vision = await import(MP + 'vision_bundle.mjs');
    const fileset = await vision.FilesetResolver.forVisionTasks(MP.replace(/\/$/, ''));
    const opts = (delegate) => ({
      baseOptions: { modelAssetPath: MP + 'face_landmarker.task', delegate },
      runningMode: 'VIDEO', numFaces: 1, outputFacialTransformationMatrixes: true, outputFaceBlendshapes: false,
      minFaceDetectionConfidence: 0.5, minFacePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, opts('GPU')); }
    catch { this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, opts('CPU')); }
    await this.setupOccluder();
    this.videoTex = new THREE.VideoTexture(this.video); this.videoTex.colorSpace = THREE.SRGBColorSpace;
    this.scene.background = this.videoTex;
    this.resize();
    this.running = true; this.onStatus('');
    this.t0 = performance.now(); this.lastT = this.t0;
    this.loop();
  }

  stop() {
    this.running = false; cancelAnimationFrame(this.raf);
    this.stream?.getTracks().forEach((t) => t.stop());
    this.landmarker?.close?.();
  }

  resize() {
    const vw = this.video.videoWidth || 1280, vh = this.video.videoHeight || 720;
    // Leinwand = Seitenverhältnis des Kamerabilds; CSS schneidet passend zu (object-fit: cover)
    // mindestens 1080 px auf der kurzen Seite (scharfe Fotos), höchstens 2400 px auf der langen
    const scale = Math.min(Math.max(1, 1080 / Math.min(vw, vh)), 2400 / Math.max(vw, vh));
    this.renderer.setPixelRatio(1);
    this.renderer.setSize(Math.round(vw * scale), Math.round(vh * scale), false);
    this.camera.aspect = vw / vh; this.camera.updateProjectionMatrix();
  }

  // ------------------------------------------------------------------ Verdeckung durch den Kopf
  async setupOccluder() {
    const d = await (await fetch(FACE)).json();
    const g = new THREE.BufferGeometry();
    const v = new Float32Array(d.v);
    // Mitte (Nase, Augen, Wangen unter dem Rand) deutlich nach hinten, damit Pads und Rand nie abgeschnitten werden;
    // seitlich (Schläfen) fast auf der echten Oberfläche, damit der Bügel hinter dem Glas verschwindet wie in echt
    for (let i = 0; i < v.length; i += 3) {
      const t = THREE.MathUtils.smoothstep(Math.abs(v[i]), 4.6, 6.4);
      v[i] *= 0.97 + 0.04 * t; v[i + 2] -= 1.3 - 1.05 * t;
    }
    g.setAttribute('position', new THREE.BufferAttribute(v, 3)); g.setIndex(d.f);
    // unsichtbar, schreibt Tiefe (verdeckt Bügel) und Schablone 1 (Schatten nur auf der Haut)
    const occ = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.DoubleSide, stencilWrite: true, stencilRef: 1,
      stencilFunc: THREE.AlwaysStencilFunc, stencilZPass: THREE.ReplaceStencilOp });
    const face = new THREE.Mesh(g, occ); face.renderOrder = -1;
    // Hinterkopf als Ellipsoid (verdeckt die Bügelenden hinter den Ohren)
    const nurTiefe = new THREE.MeshBasicMaterial({ colorWrite: false });   // ohne Schablone: Kontaktschatten nur aufs Gesicht
    const back = new THREE.Mesh(new THREE.SphereGeometry(1, 32, 24), nurTiefe);
    back.scale.set(7.5, 9.4, 7.2); back.position.set(0, 1.4, -4.0); back.renderOrder = -1;   // Vorderkante bei z ≈ 3,2 (hinter Augen und Wangen)
    // Schläfen/Ohren: Zylinder quer durch den Kopf auf Bügelhöhe (verdeckt Bügel, sobald sie hinter die Schläfe gehen)
    const ohr = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), nurTiefe);
    ohr.rotation.z = Math.PI / 2; ohr.scale.set(2.4, 15.0, 2.4); ohr.position.set(0, 1.9, -3.0); ohr.renderOrder = -1;
    // Ohrmuscheln: dort verschwinden die Bügel (sie laufen über den Ohransatz nach hinten)
    const ohren = [-1, 1].map((sx) => {
      const o = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 16), nurTiefe);
      o.scale.set(1.2, 2.0, 2.2); o.position.set(sx * 8.1, 1.6, -4.4); o.renderOrder = -1; return o;
    });
    this.kopf.add(face, back, ohr, ...ohren);
  }

  // ------------------------------------------------------------------ Brille wechseln
  async setBrille(id, farbe, glas) {
    const key = `${id}|${farbe}|${glas}`;
    if (this.key === key) return; this.key = key;
    const b = await createBrille(id, farbe, glas, { spreizung: 7.9, ar: true });
    if (this.key !== key) return;
    if (this.brille) { this.sitz.remove(this.brille); }
    if (this.schatten) { this.sitz.remove(this.schatten); }
    b.traverse((o) => { if (o.isMesh) o.material.clippingPlanes = [this.ohrEbene]; });
    this.brille = b; this.sitz.add(b);
    this.schatten = this.makeShadow(b); this.sitz.add(this.schatten);
    this.applyEnv();
  }

  /** Weicher Schatten der Fassung auf Haut: Silhouette von vorn, weichgezeichnet, leicht nach unten versetzt. */
  makeShadow(brille) {
    const W = 256, H = 128, wcm = 17, hcm = 8.5;
    const rt = new THREE.WebGLRenderTarget(W, H);
    const cam = new THREE.OrthographicCamera(-wcm / 2, wcm / 2, hcm / 2, -hcm / 2, -30, 30);
    const sc = new THREE.Scene(); const clone = brille.clone(true);
    const black = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const none = new THREE.MeshBasicMaterial({ visible: false });
    clone.traverse((o) => { if (o.isMesh) o.material = (o.material.transparent && o.material.opacity < 0.5) || o.material.blending === THREE.AdditiveBlending || o.material.userData.glas ? none : black; });
    sc.add(clone); sc.background = new THREE.Color(0xffffff);
    cam.position.set(0, 0, 10); cam.lookAt(0, 0, 0); cam.far = 13.5; cam.updateProjectionMatrix();   // nur Front und Bügelansatz
    const prevT = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(rt); this.renderer.render(sc, cam); this.renderer.setRenderTarget(prevT);
    const px = new Uint8Array(W * H * 4); this.renderer.readRenderTargetPixels(rt, 0, 0, W, H, px); rt.dispose();
    const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
    const id = g.createImageData(W, H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const s = ((H - 1 - y) * W + x) * 4, t = (y * W + x) * 4;
      id.data[t] = 58; id.data[t + 1] = 30; id.data[t + 2] = 20;   // warmes Dunkelbraun: Haut wird im Schatten satter, nicht grau id.data[t + 3] = 255 - px[s];
    }
    g.putImageData(id, 0, 0);
    const c2 = document.createElement('canvas'); c2.width = W; c2.height = H; const g2 = c2.getContext('2d');
    g2.filter = 'blur(4px)'; g2.drawImage(c, 0, 0); g2.filter = 'none';
    // seitlich ausblenden: an den Backen fällt der Schatten auf die Schläfe, nicht auf die Wand dahinter
    const mask = g2.createLinearGradient(0, 0, W, 0);
    mask.addColorStop(0, 'rgba(0,0,0,0)'); mask.addColorStop(1.5 / wcm, 'rgba(0,0,0,0)'); mask.addColorStop(3 / wcm, 'rgba(0,0,0,1)');
    mask.addColorStop(1 - 3 / wcm, 'rgba(0,0,0,1)'); mask.addColorStop(1 - 1.5 / wcm, 'rgba(0,0,0,0)'); mask.addColorStop(1, 'rgba(0,0,0,0)');
    g2.globalCompositeOperation = 'destination-in'; g2.fillStyle = mask; g2.fillRect(0, 0, W, H);
    const tex = new THREE.CanvasTexture(c2); tex.colorSpace = THREE.SRGBColorSpace;
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.5, depthWrite: false, depthTest: false,
      stencilWrite: true, stencilRef: 1, stencilFunc: THREE.EqualStencilFunc, stencilZPass: THREE.KeepStencilOp });
    const plane = new THREE.Mesh(new THREE.PlaneGeometry(wcm, hcm), m);
    plane.position.set(0, -0.75, -1.3);   // Licht von vorn oben: Schatten 5–8 mm unter Rand und Brücke plane.renderOrder = 0;
    return plane;
  }

  // ------------------------------------------------------------------ Licht aus dem Kamerabild
  updateEnv() {
    const v = this.video; if (!v.videoWidth) return;
    const g = this.envCanvas.getContext('2d', { willReadFrequently: true });
    const W = this.envCanvas.width, H = this.envCanvas.height;
    // Helligkeit und Farbe des Bildes messen → Belichtung der Brille an die Szene anpassen
    g.filter = 'none'; g.drawImage(v, 0, 0, W, H);
    const d = g.getImageData(W / 4, H / 4, W / 2, H / 2).data; let r = 0, gg = 0, b = 0;
    for (let i = 0; i < d.length; i += 4) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    const n = d.length / 4; this.mittel = [r / n / 255, gg / n / 255, b / n / 255];
    // Umgebung: Seiten und Rückraum gedämpft im Grundton des Raums (sonst glänzen Bügel von der Seite weiß) …
    const lum = 0.2126 * this.mittel[0] + 0.7152 * this.mittel[1] + 0.0722 * this.mittel[2];
    const grau = Math.round(255 * Math.min(0.4, 0.06 + lum * 0.45));
    g.fillStyle = `rgb(${grau},${grau},${grau})`; g.fillRect(0, 0, W, H);
    // … vorn (Richtung Kamera, Mitte bei u = 0,75) das unscharfe, entsättigte Kamerabild: dort ist der Raum,
    // in den die Person schaut. Entsättigt, denn im Bild ist vor allem das Gesicht.
    g.filter = 'blur(6px) saturate(0.3)';
    g.drawImage(v, W * 0.5, 0, W * 0.5, H);
    g.filter = 'none';
    for (const [x0, x1] of [[W * 0.5, W * 0.6], [W, W * 0.9]]) {
      const e = g.createLinearGradient(x0, 0, x1, 0);
      e.addColorStop(0, `rgba(${grau},${grau},${grau},1)`); e.addColorStop(1, `rgba(${grau},${grau},${grau},0)`);
      g.fillStyle = e; g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
    }
    // helles Fenster vorn oben, ~35–60° über dem Horizont (Glanzkante auf Rahmen und Gläsern). Nicht bis zum Zenit:
    // dorthin spiegeln die Oberseiten der Bügel, die sonst flächig weiß würden.
    const grd = g.createLinearGradient(0, H * 0.16, 0, H * 0.34);
    grd.addColorStop(0, 'rgba(255,255,255,0)'); grd.addColorStop(0.4, 'rgba(255,255,255,0.95)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(W * 0.56, H * 0.16, W * 0.38, H * 0.18);
    if (!this.envTex) { this.envTex = new THREE.CanvasTexture(this.envCanvas); this.envTex.mapping = THREE.EquirectangularReflectionMapping; this.envTex.colorSpace = THREE.SRGBColorSpace; }
    this.envTex.needsUpdate = true;
    const rt = this.pmrem.fromEquirectangular(this.envTex);
    this.env?.dispose(); this.env = rt;
    this.scene.environment = rt.texture;
    this.applyEnv();
  }

  applyEnv() {
    if (!this.mittel || !this.brille) return;
    const lum = 0.2126 * this.mittel[0] + 0.7152 * this.mittel[1] + 0.0722 * this.mittel[2];
    // Brille so hell wie die Szene: dunkler Raum → Brille dunkler, helles Licht → heller
    this.renderer.toneMappingExposure = THREE.MathUtils.clamp(0.55 + lum * 1.3, 0.6, 1.5);
  }

  // ------------------------------------------------------------------ Schleife
  loop() {
    if (!this.running) return;
    this.raf = requestAnimationFrame(() => this.loop());
    const now = performance.now();
    const dt = Math.max(1 / 120, (now - this.lastT) / 1000); this.lastT = now;
    if (this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const res = this.landmarker.detectForVideo(this.video, now);
      const m = res.facialTransformationMatrixes?.[0];
      if (m) {
        this.lost = 0;
        const M = new THREE.Matrix4().fromArray(m.data);
        const p = new THREE.Vector3(), q = new THREE.Quaternion(), s = new THREE.Vector3();
        M.decompose(p, q, s);
        // Quaternion-Vorzeichen stabil halten, dann filtern
        if (this.lastQ && this.lastQ.dot(q) < 0) q.set(-q.x, -q.y, -q.z, -q.w);
        const f = this.filters;
        p.set(f[0].filter(p.x, dt), f[1].filter(p.y, dt), f[2].filter(p.z, dt));
        q.set(f[3].filter(q.x, dt), f[4].filter(q.y, dt), f[5].filter(q.z, dt), f[6].filter(q.w, dt)).normalize();
        this.lastQ = q.clone();
        let sc = (s.x + s.y + s.z) / 3;
        // Persönliche Anpassung: Brücke (x) und Pupillenhöhe (y) und Augenabstand an die erkannten Landmarken angleichen
        const lm = res.faceLandmarks?.[0];
        const head = new THREE.Matrix4().compose(p, q, new THREE.Vector3(sc, sc, sc));
        if (lm && lm.length > 473) {
          const proj = (v) => v.clone().applyMatrix4(head).project(this.camera);   // NDC
          const ndc = (l) => new THREE.Vector2(l.x * 2 - 1, 1 - l.y * 2);
          const br = proj(P_BRUECKE), au = proj(P_AUGEN);
          const lmBr = ndc(lm[168]), lmAu = ndc(lm[468]).add(ndc(lm[473])).multiplyScalar(0.5);
          const dxN = lmBr.x - br.x, dyN = lmAu.y - au.y;
          // gemessener / modellierter Abstand der äußeren Augenwinkel → Maßstab
          const dl = ndc(lm[33]).distanceTo(ndc(lm[263]));
          const dm = new THREE.Vector2(proj(P_AUSSEN_L).x, proj(P_AUSSEN_L).y).distanceTo(new THREE.Vector2(proj(P_AUSSEN_R).x, proj(P_AUSSEN_R).y));
          const k = THREE.MathUtils.clamp(dl / Math.max(dm, 1e-4), 0.88, 1.12);
          const ff = this.fitFilters;
          const fx = ff[0].filter(THREE.MathUtils.clamp(dxN, -0.08, 0.08), dt), fy = ff[1].filter(THREE.MathUtils.clamp(dyN, -0.08, 0.08), dt), fk = ff[2].filter(k, dt);
          // NDC-Versatz in Kameraraum (Tiefe der Brücke) umrechnen
          const depth = -p.z;
          const th = Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
          p.x += fx * depth * th * this.camera.aspect; p.y += fy * depth * th;
          sc *= fk;
        }
        this.kopf.matrix.compose(p, q, new THREE.Vector3(sc, sc, sc));
        this.kopf.matrixWorldNeedsUpdate = true; this.kopf.updateMatrixWorld();
        this.ohrEbene.setFromNormalAndCoplanarPoint(new THREE.Vector3(0, 0, 1).applyQuaternion(q), this.kopf.localToWorld(new THREE.Vector3(0, 0, OHR_Z)));
        this.kopf.visible = true;
        this.gesicht = true;
      } else if (++this.lost > 6) { this.kopf.visible = false; this.gesicht = false; }
    }
    if (!this.envT || now - this.envT > 700) { this.envT = now; this.updateEnv(); }
    this.renderer.render(this.scene, this.camera);
  }

  // ------------------------------------------------------------------ Foto
  /** Foto (gespiegelt wie im Sucher), mit dezenter Signatur. Liefert einen Blob (JPEG). */
  async foto() {
    this.renderer.render(this.scene, this.camera);
    const src = this.canvas, w = src.width, h = src.height;
    // Hochformat-Ausschnitt 4:5 aus der Mitte (wirkt wie ein Porträt)
    const ch = h, cw = Math.min(w, Math.round(h * 0.8)), cx = (w - cw) / 2;
    const c = document.createElement('canvas'); c.width = cw; c.height = ch;
    const g = c.getContext('2d');
    g.translate(cw, 0); g.scale(-1, 1);
    g.drawImage(src, cx, 0, cw, ch, 0, 0, cw, ch);
    g.setTransform(1, 0, 0, 1, 0, 0);
    const fs = Math.round(ch * 0.03);
    g.font = `500 ${fs}px Inter, system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.85)';
    g.textAlign = 'right'; g.letterSpacing = '0.25em';
    g.shadowColor = 'rgba(0,0,0,0.35)'; g.shadowBlur = fs * 0.5;
    g.fillText('KLARSUND', cw - fs * 1.2, ch - fs * 1.2);
    return new Promise((r) => c.toBlob(r, 'image/jpeg', 0.92));
  }
}
