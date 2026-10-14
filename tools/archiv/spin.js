// Drehansicht aus vorgerenderten Einzelbildern: Die Drinks der Bar sind mit Path Tracing fotorealistisch
// gerechnet (Lichtbrechung, Spiegelung, Schärfentiefe), je Drink eine volle Drehung in einzelnen Bildern.
// Ziehen, Wischen oder Pfeiltasten drehen das Glas, sonst dreht es sich langsam von selbst.
// Zwischen zwei Bildern wird überblendet, damit die Drehung weich wirkt. Braucht kein WebGL.

const easeOut = (t) => 1 - Math.pow(1 - t, 3);

/**
 * @param {object} o
 * @param {HTMLElement} o.container  Element, das die Leinwand aufnimmt
 * @param {(id: string, i: number) => string} o.src  Adresse von Bild i eines Drinks
 * @param {number} [o.frames]  Bilder je Umdrehung
 */
export function createSpin({ container, src, frames = 24, reducedMotion = false }) {
  const canvas = document.createElement('canvas');
  canvas.className = 'spin';
  canvas.tabIndex = 0;
  canvas.setAttribute('role', 'img');
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:pan-y;cursor:grab;outline-offset:-4px;';
  container.appendChild(canvas);
  const g = canvas.getContext('2d');

  const sets = new Map(); // Drink → Bilder
  function set(id) {
    if (!sets.has(id)) {
      const imgs = Array.from({ length: frames }, () => null);
      const s = { imgs, ok: new Array(frames).fill(false), first: null, all: false };
      const load = (i) => new Promise((res) => {
        const img = new Image();
        img.decoding = 'async';
        img.onload = () => { imgs[i] = img; s.ok[i] = true; dirty = true; wake(); res(true); };
        img.onerror = () => res(false);
        img.src = src(id, i);
      });
      s.first = load(0);
      s.loadAll = () => {
        if (s.all) return;
        s.all = true;
        s.first.then(async () => { // zuerst jedes vierte Bild (grobe Drehung sofort), dann die übrigen
          const order = [...Array(frames).keys()].slice(1).sort((a, b) => (a % 4 === 0 ? 0 : 1) - (b % 4 === 0 ? 0 : 1) || a - b);
          for (let k = 0; k < order.length; k += 4) await Promise.all(order.slice(k, k + 4).map(load));
        });
      };
      sets.set(id, s);
    }
    return sets.get(id);
  }

  let id = null, prev = null, wanted = null, switchT = 1, switchDir = 1;
  let angle = 0, vel = 0, autoOn = !reducedMotion, lastInput = -1e9, keyTarget = null;
  const AUTO_SPEED = 1.15; // Bilder pro Sekunde (eine Umdrehung in etwa 14 s)
  let dirty = true;

  /** nächstes geladenes Bild in der Nähe von i */
  function nearest(s, i) {
    for (let d = 0; d < frames; d++) {
      const a = (((i + d) % frames) + frames) % frames, b = (((i - d) % frames) + frames) % frames;
      if (s.ok[b]) return b;
      if (s.ok[a]) return a;
    }
    return -1;
  }

  function drawImage(img, alpha, dx) {
    if (!img) return;
    const cw = canvas.width, ch = canvas.height, k = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);
    const w = img.naturalWidth * k, h = img.naturalHeight * k;
    g.globalAlpha = alpha;
    g.drawImage(img, (cw - w) / 2 + dx, (ch - h) / 2, w, h);
  }

  function drawSet(sid, alpha, dx) {
    const s = sets.get(sid);
    if (!s) return;
    const f = ((angle % frames) + frames) % frames, i0 = Math.floor(f), i1 = (i0 + 1) % frames, t = f - i0;
    if (s.ok[i0] && s.ok[i1]) {
      drawImage(s.imgs[i0], alpha, dx);
      drawImage(s.imgs[i1], alpha * t, dx); // Überblendung zum nächsten Bild
    } else {
      const n = nearest(s, Math.round(f));
      if (n >= 0) drawImage(s.imgs[n], alpha, dx);
    }
  }

  function draw() {
    g.globalAlpha = 1;
    g.fillStyle = '#0e0a0a';
    g.fillRect(0, 0, canvas.width, canvas.height);
    const e = easeOut(switchT), shift = canvas.width * 0.06;
    if (prev && switchT < 1) drawSet(prev, 1, -switchDir * shift * e);
    if (id) drawSet(id, prev && switchT < 1 ? e : 1, prev && switchT < 1 ? switchDir * shift * (1 - e) : 0);
    g.globalAlpha = 1;
  }

  // --- Ziehen mit Schwung ---
  let dragX = null, dragT = 0;
  const perPixel = () => frames / Math.max(240, canvas.clientWidth * 1.15); // ganze Breite ≈ knapp eine Umdrehung
  canvas.addEventListener('pointerdown', (e) => {
    dragX = e.clientX; dragT = performance.now(); vel = 0; keyTarget = null;
    canvas.style.cursor = 'grabbing';
    try { canvas.setPointerCapture(e.pointerId); } catch {}
    wake();
  });
  canvas.addEventListener('pointermove', (e) => {
    if (dragX === null) return;
    const now = performance.now(), dx = e.clientX - dragX, dt = Math.max(1, now - dragT) / 1000;
    angle -= dx * perPixel();
    vel = vel * 0.6 + ((-dx * perPixel()) / dt) * 0.4;
    dragX = e.clientX; dragT = now; lastInput = now; dirty = true;
    wake();
  });
  const end = () => { if (dragX === null) return; dragX = null; lastInput = performance.now(); canvas.style.cursor = 'grab'; };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    e.preventDefault();
    keyTarget = Math.round(keyTarget ?? angle) + (e.key === 'ArrowRight' ? 1 : -1);
    vel = 0; lastInput = performance.now();
    wake();
  });

  // --- Ablauf: zeichnet nur, solange sich etwas bewegt und die Bühne sichtbar ist ---
  let raf = 0, last = 0, visible = true;
  function wake() { if (!raf && visible) { last = performance.now(); raf = requestAnimationFrame(tick); } }
  function tick(now) {
    raf = 0;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    let moving = false;
    if (dragX === null) {
      if (keyTarget !== null) {
        const d = keyTarget - angle;
        angle += d * (1 - Math.exp(-dt * 10));
        if (Math.abs(d) < 0.002) { angle = keyTarget; keyTarget = null; }
        moving = true;
      } else if (Math.abs(vel) > 0.05) {
        angle += vel * dt;
        vel *= Math.exp(-dt * 2.6);
        moving = true;
      } else if (autoOn && now - lastInput > 2500) {
        angle += AUTO_SPEED * dt;
        moving = true;
      }
    } else moving = true;
    if (switchT < 1) { switchT = Math.min(1, switchT + dt / 0.55); moving = true; if (switchT >= 1) prev = null; }
    if (moving || dirty) { draw(); dirty = false; }
    if (moving && visible) raf = requestAnimationFrame(tick);
  }

  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; if (visible) wake(); });
  io.observe(canvas);
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.round(canvas.clientWidth * dpr), h = Math.round(canvas.clientHeight * dpr);
    if (w && h && (w !== canvas.width || h !== canvas.height)) { canvas.width = w; canvas.height = h; dirty = true; draw(); }
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);
  resize();

  return {
    canvas,
    /** zeigt einen Drink; das erste Bild kommt sofort, die übrigen laden im Hintergrund */
    async show(next, { dir = 1, instant = false } = {}) {
      wanted = next;
      if (next === id) return;
      const s = set(next);
      s.loadAll();
      await s.first;
      if (wanted !== next) return; // inzwischen wurde schon ein anderer Drink gewählt
      if (instant || !id) { prev = null; switchT = 1; } else { prev = id; switchT = 0; switchDir = dir; }
      id = next;
      angle = Math.round(angle) % frames; // neuer Drink beginnt auf einem ganzen Bild
      dirty = true;
      wake();
    },
    /** Erstes Bild eines Drinks vorab laden (die übrigen erst beim Anzeigen) */
    prepare(pid) { set(pid); },
    setAutoRotate(on) { autoOn = on && !reducedMotion; lastInput = -1e9; wake(); },
    dispose() { cancelAnimationFrame(raf); io.disconnect(); ro.disconnect(); canvas.remove(); },
  };
}
