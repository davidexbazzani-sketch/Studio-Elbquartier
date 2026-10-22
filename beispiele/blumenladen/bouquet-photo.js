// Strauß aus echten Fotos (freigestellte Blumen, Papier, Schleife) – wie von der Floristin gebunden.
// Die Stiele kreuzen sich im Bindepunkt (Spiraltechnik), die Blüten liegen auf einer Kuppel (bouquet-layout.js).
// Bewegung nur über transform/opacity (Grafikkarte): Stiele werden von der Seite eingelegt, der Strauß dreht
// sich dabei leicht in der Hand, die Schleife wird zum Schluss gebunden, im Ruhezustand wiegt sich alles sanft.

import { layoutBouquet } from '../../assets/js/bouquet-layout.js';

const W = 1000, H = 1000;          // Zeichenfläche (wird auf die Bühne skaliert)
const BX = 500, BY = 720;          // Bindepunkt
const R = 460;                     // Abstand Bindepunkt → Blüte (Grundmaß)
// Abstand und Größe je Sorte (Pfingstrosen sind größer und sitzen tiefer, Grün ragt weiter hinaus)
const KIND = { rose: 1, peony: 1.0, tulip: 1.05, eucalyptus: 1.1, gypsophila: 1.02, lavender: 1.1 };
// Schleifenknoten im Bild (Anteil von Breite/Höhe)
const KNOT = { salbei: [0.5, 0.21], rose: [0.53, 0.25], creme: [0.49, 0.225], bordeaux: [0.49, 0.19] };
const EASE = 'cubic-bezier(.22,1,.36,1)';

function rnd(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619); return ((h >>> 0) % 100000) / 100000; }

export async function createPhotoBouquet(host, { reducedMotion = false, base = '../../assets/img/blumen/strauss/' } = {}) {
  const meta = await fetch(base + 'strauss-meta.json').then((r) => r.json());
  const src = (name) => `${base}${name}.webp`;
  const motion = !reducedMotion && !!Element.prototype.animate;

  host.innerHTML = `
    <div class="pb" aria-hidden="true">
      <div class="pb__space">
        <div class="pb__shadow"></div>
        <div class="pb__bunch">
          <div class="pb__paper pb__paper--back"></div>
          <div class="pb__stems"></div>
          <div class="pb__paper pb__paper--front"></div>
          <div class="pb__ribbon"></div>
        </div>
      </div>
    </div>`;
  const space = host.querySelector('.pb__space');
  const bunch = host.querySelector('.pb__bunch');
  const stemsEl = host.querySelector('.pb__stems');
  const backEl = host.querySelector('.pb__paper--back');
  const frontEl = host.querySelector('.pb__paper--front');
  const ribbonEl = host.querySelector('.pb__ribbon');
  const shadowEl = host.querySelector('.pb__shadow');

  // Zeichenfläche einpassen
  let hostW = 0;
  function fit() {
    const w = (hostW = host.clientWidth), h = host.clientHeight;
    if (!w || !h) return;
    const s = Math.min(w / W, h / H) * 1.02;
    space.style.transform = `translate(${(w - W * s) / 2}px, ${(h - H * s) / 2}px) scale(${s})`;
  }
  new ResizeObserver(fit).observe(host);
  fit();

  // Bilder vorladen (nur die gerade gebrauchten)
  const loaded = new Map();
  const load = (name) => {
    if (!loaded.has(name)) loaded.set(name, new Promise((res) => { const i = new Image(); i.decoding = 'async'; i.onload = i.onerror = () => res(i); i.src = src(name); }));
    return loaded.get(name);
  };

  const nodes = new Map(); // uid → { el, img, sway }
  const sways = [];
  let current = { paper: null, ribbon: null };
  let busyUntil = 0, first = true, visible = true;

  // Drehung des Straußes um seine Achse (Ziehen/Wischen); Blüten bleiben zum Betrachter gewandt wie beim echten Strauß
  let spin = 0;
  const dirOf = (slot) => [Math.sin(slot.theta) * Math.cos(slot.phi + spin), Math.cos(slot.theta), Math.sin(slot.theta) * Math.sin(slot.phi + spin)];

  function stemTransform(m, slot, uid, type) {
    const [dx, dy, dz] = dirOf(slot);
    const z = dz;                                  // < 0 hinten, > 0 vorn
    const nat = Math.atan2((m.hx - m.ax) * m.w, (m.ay - m.hy) * m.h); // Neigung des Stiels im Foto
    const alpha = Math.atan2(dx, dy) * 1.06;       // Richtung im Strauß
    const len = R * slot.reach * KIND[type] * (1 - z * 0.07);
    const dist = Math.hypot((m.hx - m.ax) * m.w, (m.ay - m.hy) * m.h);
    const s = (len / dist) * (1 + z * 0.06);
    const flip = (type === 'rose' || type === 'peony') ? 1 : (rnd(uid + 'f') > 0.5 ? -1 : 1);
    const w = m.w * s, h = m.h * s, ox = m.ax * w, oy = m.ay * h;
    return { w, h, ox, oy, z, transform: `translate(${BX - ox}px, ${BY - oy}px) rotate(${alpha}rad) scaleX(${flip}) rotate(${-nat * flip}rad)`, alpha };
  }

  const seen = new Promise((res) => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { io.disconnect(); res(); } }, { threshold: 0.3 });
    io.observe(host);
  });
  let latest = null, running = null;
  function set(comp) {
    latest = comp;
    if (!running) running = (async () => { while (latest) { const c = latest; latest = null; await apply(c); } running = null; })();
    return running;
  }

  async function apply({ stems, paperStyle = 'kraft', ribbonColor = 'salbei' }) {
    if (first) await seen;
    // eindeutige Kennung je Stiel: Sorte + Farbe + laufende Nummer → Farbwechsel = Blumen tauschen
    const per = {};
    const items = stems.map((s) => {
      const k = (per[s.key] = (per[s.key] ?? -1) + 1);
      const name = s.key.endsWith(':') ? s.type : `${s.type}-${s.key.split(':')[1]}`;
      return { id: `${s.key}#${k}`, type: s.type, name };
    });
    await Promise.all([...new Set(items.map((i) => i.name)), `paper-${paperStyle}`, `ribbon-${ribbonColor}`].map(load));
    const { slots, cap } = layoutBouquet(items);

    // Strauß-Breite → Papier- und Schleifengröße
    const spread = Math.sin(Math.min(1.15, cap * 1.06));
    const bw = 2 * R * spread * 0.85 + 260;

    // neue / bleibende / entfernte Stiele
    const keep = new Set(items.map((i) => i.id));
    let delay = 0;
    const now = performance.now();
    const order = [...items].sort((a, b) => slots.get(a.id).theta - slots.get(b.id).theta); // von innen nach außen binden
    for (const it of order) {
      const m = meta[it.name];
      const t = stemTransform(m, slots.get(it.id), it.id, it.type);
      let n = nodes.get(it.id);
      const isNew = !n;
      if (isNew) {
        const el = document.createElement('div');
        el.className = 'pb__stem';
        const img = new Image();
        img.src = src(it.name); img.alt = ''; img.decoding = 'async'; img.draggable = false;
        el.appendChild(img);
        n = { el, img, type: it.type };
        nodes.set(it.id, n);
      }
      Object.assign(n, { m, slot: slots.get(it.id), uid: it.id });
      const { el, img } = n;
      Object.assign(el.style, { width: `${t.w}px`, height: `${t.h}px`, transformOrigin: `${t.ox}px ${t.oy}px` });
      img.style.transformOrigin = `${t.ox}px ${t.oy}px`;
      n.z = t.z;
      shade(n, t.z);
      el.style.transform = t.transform;
      if (isNew) {
        stemsEl.appendChild(el);
        if (motion) {
          // eingelegt von rechts oben (dort, wo die Hand der Floristin ist)
          const from = `translate(${BX - t.ox + 260}px, ${BY - t.oy - 170}px) rotate(${t.alpha + 0.55}rad) scaleX(1) rotate(0rad)`;
          const a = el.animate([
            { transform: from, opacity: 0 },
            { opacity: 1, offset: 0.25 },
            { transform: t.transform.replace(/rotate\(([-\d.e]+)rad\) scaleX/, (m0, v) => `rotate(${(+v - 0.05).toFixed(4)}rad) scaleX`), offset: 0.8 },
            { transform: t.transform, opacity: 1 },
          ], { duration: first ? 820 : 760, delay, easing: EASE, fill: 'backwards' });
          a.onfinish = () => sway(n);
          delay += first ? 115 : 70;
        } else sway(n);
      } else if (motion) {
        el.style.transition = `transform 700ms ${EASE}, filter 450ms ease`;
      }
    }
    for (const [id, n] of nodes) {
      if (keep.has(id)) continue;
      nodes.delete(id);
      n.slot = null;
      n.sway?.cancel();
      if (motion) {
        const a = n.el.animate([{ opacity: 1 }, { transform: `${n.el.style.transform} translateY(-90px)`, opacity: 0 }], { duration: 420, easing: 'ease-in' });
        a.onfinish = () => n.el.remove();
      } else n.el.remove();
    }
    restack();
    // die Floristin dreht den Strauß beim Einlegen leicht in der Hand
    if (motion && delay > 0) {
      bunch.animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(-2.2deg)', offset: 0.45 }, { transform: 'rotate(0.8deg)', offset: 0.8 }, { transform: 'rotate(0deg)' }],
        { duration: Math.max(1100, delay + 700), easing: 'ease-in-out', composite: 'replace' });
    }
    busyUntil = now + delay + 800;

    // Papier (hinten höher, vorn tiefer – wie beim echten Einschlag)
    const pm = meta[`paper-${paperStyle}`];
    // Papier etwas in die Breite gezogen: echter Einschlag ist breiter als hoch; Rand hinten etwa auf Höhe der unteren Blüten
    const pw = Math.min(940, Math.max(560, bw * 1.04));
    const ph = pw * 0.66;
    const placePaper = (el, flip) => Object.assign(el.style, {
      width: `${pw}px`, height: `${ph}px`,
      transform: `translate(${BX - pw * pm.tx}px, ${BY + 95 - ph}px) scaleX(${flip})`,
      transformOrigin: `${pw * pm.tx}px ${ph}px`,
    });
    placePaper(backEl, 1); placePaper(frontEl, -1);
    if (current.paper !== paperStyle) {
      for (const el of [backEl, frontEl]) {
        const img = new Image(); img.src = src(`paper-${paperStyle}`); img.alt = ''; img.draggable = false;
        const old = el.querySelector('img');
        el.appendChild(img);
        if (motion && old) {
          img.animate([{ opacity: 0, transform: 'scale(.94) rotate(-2deg)' }, { opacity: 1, transform: 'none' }], { duration: 650, easing: EASE });
          old.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 650 }).onfinish = () => old.remove();
        } else if (old) old.remove();
      }
      if (motion && current.paper) wrapSqueeze();
      current.paper = paperStyle;
    }
    shadowEl.style.transform = `translate(${BX - pw * 0.42}px, ${BY + 215}px) scale(${pw / 800}, 1)`;

    // Schleife am Bindepunkt
    const rm = meta[`ribbon-${ribbonColor}`];
    const rw = Math.max(170, Math.min(240, bw * 0.26)), rh = rw * rm.h / rm.w;
    const [kx, ky] = KNOT[ribbonColor] || [0.5, 0.22];
    Object.assign(ribbonEl.style, { width: `${rw}px`, height: `${rh}px`, transform: `translate(${BX - rw * kx}px, ${BY - rh * ky + 6}px)`, transformOrigin: `${rw * kx}px ${rh * ky}px` });
    if (current.ribbon !== ribbonColor) {
      const img = new Image(); img.src = src(`ribbon-${ribbonColor}`); img.alt = ''; img.draggable = false;
      img.style.transformOrigin = `${rw * kx}px ${rh * ky}px`;
      const old = ribbonEl.querySelector('img');
      ribbonEl.appendChild(img);
      if (old) old.remove();
      if (motion) tie(img, first ? delay + 250 : 0);
      if (first) nudge(delay + 1600);
      current.ribbon = ribbonColor;
    } else if (motion && delay > 0) {
      // nach dem Nachlegen wird die Schleife neu gezogen
      const img = ribbonEl.querySelector('img');
      if (img) tie(img, delay + 150, true);
    }
    first = false;
  }

  // Tiefe: Reihenfolge nach Rang (ändert sich nur, wenn zwei Blüten aneinander vorbeiziehen)
  function restack() {
    [...nodes.values()].filter((n) => n.slot).sort((a, b) => a.z - b.z).forEach((n, i) => {
      const zi = String(i + 1);
      if (n.el.style.zIndex !== zi) n.el.style.zIndex = zi;
    });
  }
  // hinten liegende Blüten etwas dunkler; beim Drehen erst in Ruhe angepasst (Filter neu zu setzen kostet am Handy viel)
  function shade(n, z) {
    const f = z < -0.12 ? `brightness(${(1 + Math.round(z * 8) / 8 * 0.24).toFixed(3)})` : '';
    if (n.el.style.filter !== f) n.el.style.filter = f;
  }
  // alle Stiele für den aktuellen Drehwinkel neu stellen (ohne Übergang, folgt direkt dem Finger)
  function relayout(resting = false) {
    for (const n of nodes.values()) {
      if (!n.slot) continue;
      const t = stemTransform(n.m, n.slot, n.uid, n.type);
      n.z = t.z;
      n.el.style.transform = t.transform;
      if (resting) shade(n, t.z);
    }
    restack();
  }
  const settle = () => { for (const n of nodes.values()) n.el.style.transition = ''; relayout(true); };

  /* ---------- Drehen: Maus ziehen oder seitlich wischen, mit Schwung ---------- */
  let drag = null, vel = 0, raf = 0, last = 0, touched = false;
  const onTouched = [];
  const rate = () => (Math.PI * 1.6) / Math.max(320, hostW); // eine Bühnenbreite ≈ gut eine halbe Drehung
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000 || 0.016);
    last = now;
    if (!drag) { spin += vel * dt; vel *= Math.exp(-dt * 3.4); }
    relayout();
    raf = (drag || Math.abs(vel) > 0.02) ? requestAnimationFrame(loop) : 0;
    if (!raf) settle();
  }
  const kickLoop = () => {
    if (raf) return;
    for (const n of nodes.values()) n.el.style.transition = 'none';
    last = performance.now();
    raf = requestAnimationFrame(loop);
  };
  function start(x) {
    drag = { x, spin, lastX: x, t: performance.now(), v: 0 };
    vel = 0;
    if (!touched) { touched = true; onTouched.forEach((fn) => fn()); }
    kickLoop();
  }
  function move(x) {
    if (!drag) return;
    spin = drag.spin + (x - drag.x) * rate();
    const now = performance.now(), dts = Math.max(0.008, (now - drag.t) / 1000);
    drag.v = drag.v * 0.5 + ((x - drag.lastX) * rate() / dts) * 0.5;
    drag.lastX = x; drag.t = now;
  }
  function end() {
    if (!drag) return;
    vel = performance.now() - drag.t < 90 && motion ? Math.max(-5, Math.min(5, drag.v)) : 0;
    drag = null;
    kickLoop();
  }
  host.style.cursor = 'grab';
  host.style.touchAction = 'pan-y';
  host.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'touch' || e.button !== 0) return;
    host.setPointerCapture(e.pointerId); host.style.cursor = 'grabbing';
    start(e.clientX);
  });
  host.addEventListener('pointermove', (e) => { if (e.pointerType !== 'touch') move(e.clientX); });
  const up = (e) => { if (e.pointerType !== 'touch') { host.style.cursor = 'grab'; end(); } };
  host.addEventListener('pointerup', up);
  host.addEventListener('pointercancel', up);
  // Finger: seitlich wischen dreht (die Seite bleibt stehen), senkrecht scrollt die Seite
  let tch = null;
  host.addEventListener('touchstart', (e) => { if (e.touches.length === 1) tch = { x: e.touches[0].clientX, y: e.touches[0].clientY, mode: null }; }, { passive: true });
  host.addEventListener('touchmove', (e) => {
    if (!tch || e.touches.length !== 1) return;
    const p = e.touches[0];
    if (!tch.mode) {
      const dx = p.clientX - tch.x, dy = p.clientY - tch.y;
      if (Math.hypot(dx, dy) < 6) return;
      tch.mode = Math.abs(dx) > Math.abs(dy) * 0.75 ? 'turn' : 'scroll';
      if (tch.mode === 'turn') start(p.clientX);
    }
    if (tch.mode !== 'turn') return;
    if (e.cancelable) e.preventDefault();
    move(p.clientX);
  }, { passive: false });
  const tend = () => { if (tch?.mode === 'turn') end(); tch = null; };
  host.addEventListener('touchend', tend);
  host.addEventListener('touchcancel', tend);

  // einmal kurz hin- und zurückdrehen, damit man sieht: der Strauß lässt sich drehen
  function nudge(delay) {
    if (!motion) return;
    setTimeout(() => {
      if (touched || !visible || raf) return;
      const t0 = performance.now(), D = 2200, A = 0.7;
      for (const n of nodes.values()) n.el.style.transition = 'none';
      const step = (now) => {
        if (touched) return;
        const p = Math.min(1, (now - t0) / D);
        spin = A * Math.sin(Math.PI * (p < 0.5 ? 2 * p * p : 1 - 2 * (1 - p) * (1 - p)));
        relayout();
        if (p < 1) requestAnimationFrame(step); else settle();
      };
      requestAnimationFrame(step);
    }, delay);
  }

  // Schleife binden: aufziehen, festziehen, nachfedern
  function tie(img, delay = 0, soft = false) {
    img.animate(soft
      ? [{ transform: 'scale(1)' }, { transform: 'scale(.9) rotate(-4deg)', offset: 0.35 }, { transform: 'scale(1.04) rotate(1.5deg)', offset: 0.7 }, { transform: 'scale(1)' }]
      : [{ transform: 'scale(.2) rotate(-35deg)', opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: 'scale(1.1) rotate(6deg)', offset: 0.65 }, { transform: 'scale(.96) rotate(-2deg)', offset: 0.85 }, { transform: 'scale(1) rotate(0)', opacity: 1 }],
      { duration: soft ? 700 : 900, delay, easing: 'ease-out', fill: 'backwards' });
    if (!soft) setTimeout(wrapSqueeze, delay + 250);
  }
  // Papier wird beim Binden kurz zusammengezogen
  function wrapSqueeze() {
    for (const el of [backEl, frontEl]) {
      el.firstElementChild?.animate([{ transform: 'scaleX(1)' }, { transform: 'scaleX(.95)', offset: 0.4 }, { transform: 'scaleX(1.01)', offset: 0.75 }, { transform: 'scaleX(1)' }],
        { duration: 650, easing: 'ease-in-out', composite: 'add' });
    }
  }
  // sanftes Wiegen: jede Blüte ein wenig anders (Werte fest, damit es die Grafikkarte allein rechnet)
  function sway(n) {
    if (!motion || n.sway) return;
    const amp = n.type === 'gypsophila' || n.type === 'eucalyptus' ? 1.4 : 0.8;
    n.sway = n.img.animate([{ transform: `rotate(${-amp}deg)` }, { transform: `rotate(${amp}deg)` }],
      { duration: 2600 + Math.random() * 2200, direction: 'alternate', iterations: Infinity, easing: 'ease-in-out', delay: -Math.random() * 4000 });
    if (!visible) n.sway.pause();
    sways.push(n.sway);
  }
  // außerhalb des Bildschirms anhalten
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    for (const n of nodes.values()) if (n.sway) visible ? n.sway.play() : n.sway.pause();
  }).observe(host);

  return { set, meta, src, onTouched: (fn) => onTouched.push(fn), get busy() { return performance.now() < busyUntil; } };
}
