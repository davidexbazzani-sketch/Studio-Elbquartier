import { can3D, reducedMotion } from '../../assets/js/capability.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const IMG = '../../assets/img/juwelier/';

const METAL = { gelbgold: 'Gelbgold', weissgold: 'Weißgold', rosegold: 'Roségold' };
const PIECES = {
  elbe: {
    type: 'Verlobungsring', name: 'Solitär „Elbe“', price: 'ab 5.900 €', metal: 'gelbgold',
    meta: (m) => `750er ${METAL[m]} · Brillant 1,00 ct`,
  },
  speicherstadt: {
    type: 'Memoire-Ring', name: 'Memoire „Speicherstadt“', price: '3.980 €', metal: 'weissgold',
    meta: (m) => `750er ${METAL[m]} · 24 Brillanten, zus. 1,20 ct`,
  },
  hafenlicht: {
    type: 'Ohrstecker', name: 'Ohrstecker „Hafenlicht“', price: '4.450 €', metal: 'weissgold',
    meta: (m) => `750er ${METAL[m]} · 2 Brillanten, zus. 1,00 ct`,
  },
  alster: {
    type: 'Anhänger', name: 'Anhänger „Alster“', price: '2.290 €', metal: 'weissgold',
    meta: (m) => `750er ${METAL[m]} · Saphir 1,10 ct · Kette 42 cm`,
  },
  moewe: {
    type: 'Armreif', name: 'Armreif „Möwe“', price: '2.650 €', metal: 'rosegold',
    meta: (m) => `750er ${METAL[m]} · 5 Brillanten, zus. 0,25 ct`,
  },
  blankenese: {
    type: 'Perlenstecker', name: 'Perlenstecker „Blankenese“', price: '690 €', metal: 'gelbgold',
    meta: (m) => `Südsee-Zuchtperlen 9 mm · 750er ${METAL[m]}`,
  },
};

/* ---------- Navigation ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 40);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- 3D-Viewer (wird nur einmal geladen) ---------- */
let viewerPromise = null;
let viewer = null;
let inDialog = false;
const loadViewer = () => {
  viewerPromise ??= import('../../assets/js/3d/viewer.js').then(({ createViewer }) =>
    createViewer({ hdrUrl: '../../assets/hdri/studio_small_09_1k.hdr', reducedMotion }));
  return viewerPromise;
};

/* ---------- Hero ---------- */
const stage = $('#stage');
const stageCanvas = $('#stage-canvas');
const poster = $('#poster');
const heroTools = $('#hero-tools');
let heroMetal = 'gelbgold';

function setChecked(group, metal) {
  $$('button', group).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.metal === metal)));
}

$('#hero-metals').addEventListener('click', (e) => {
  const b = e.target.closest('[data-metal]');
  if (!b) return;
  heroMetal = b.dataset.metal;
  setChecked(e.currentTarget, heroMetal);
  poster.src = `${IMG}elbe-${heroMetal}.webp`;
  poster.alt = `Solitärring „Elbe“ in ${METAL[heroMetal]} mit einem Brillanten`;
  $('#hero-meta').textContent = PIECES.elbe.meta(heroMetal);
  if (viewer && !inDialog) viewer.setMetal(heroMetal);
});

async function startHero3D() {
  stage.classList.add('is-loading');
  $('#load3d').hidden = true;
  try {
    viewer = await loadViewer();
    bindViewer(viewer);
    if (inDialog) return; // Vollbild ist offen; beim Schließen zieht der Viewer in den Hero
    viewer.mount(stageCanvas);
    viewer.setPiece('elbe', { metal: heroMetal });
    await viewer.whenRendered();
    stage.classList.add('is-live');
    heroTools.hidden = false;
  } catch (err) {
    console.warn('3D konnte nicht geladen werden:', err);
    $('#load3d').hidden = false;
  } finally {
    stage.classList.remove('is-loading');
  }
}

stageCanvas.addEventListener('pointerdown', () => stage.classList.add('is-touched'));
if (matchMedia('(pointer: fine)').matches) {
  $('#hint').lastChild.textContent = ' Ziehen zum Drehen · Doppelklick für den Stein';
}

// Werkzeuge (Hero und Vollbild teilen sich die Logik)
function tools(root) {
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !viewer) return;
    const act = b.dataset.act;
    if (act === 'zoom-in') viewer.zoomBy(0.75);
    if (act === 'zoom-out') viewer.zoomBy(1.33);
    if (act === 'closeup') viewer.toggleCloseup();
    if (act === 'reset') viewer.reset();
    if (act === 'spin') {
      const paused = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(paused));
      b.setAttribute('aria-label', paused ? 'Drehung fortsetzen' : 'Drehung anhalten');
      viewer.setAutoRotate(!paused);
    }
    stage.classList.add('is-touched');
  });
}
tools(heroTools);
tools($('.hut-viewer__foot .hut-tools'));

let bound = false;
function bindViewer(v) {
  if (bound) return;
  bound = true;
  v.onChange(({ zoom }) => {
    const near = zoom < 0.6;
    $('[data-act="closeup"]', heroTools).textContent = near ? 'Ganzer Ring' : 'Stein ansehen';
    $('.hut-viewer__foot [data-act="closeup"]').textContent = near ? 'Ganzes Stück' : 'Näher';
  });
}

const cap = can3D();
if (cap.ok) {
  // Der Ring ist sofort sichtbar: 3D nach dem ersten Zeichnen der Seite nachladen
  const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1200 }) : setTimeout(fn, 200));
  if (document.readyState === 'complete') idle(startHero3D);
  else addEventListener('load', () => idle(startHero3D), { once: true });
} else {
  $('#load3d-why').textContent = cap.why;
  $('#load3d').hidden = false;
  $('#load3d').addEventListener('click', startHero3D);
}

/* ---------- Kollektion ---------- */
const cube = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z M12 12l8-4.5 M12 12v9 M12 12L4 7.5" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round"/></svg>';
$('#rail').innerHTML = Object.entries(PIECES).map(([id, p]) => `
  <li class="hut-card">
    <div class="hut-card__media">
      <img src="${IMG}karte-${id}.webp" width="880" height="1100" loading="lazy" alt="${p.name} in ${METAL[p.metal]}">
    </div>
    <p class="hut-eyebrow">${p.type}</p>
    <h3 class="hut-card__name">${p.name}</h3>
    <p class="hut-card__meta">${p.meta(p.metal)}</p>
    <div class="hut-card__foot">
      <span class="hut-card__price">${p.price}</span>
      <button type="button" class="hut-card__3d" data-piece="${id}">${cube}In 3D ansehen</button>
    </div>
  </li>`).join('');

/* ---------- Vollbild-Viewer ---------- */
const dlg = $('#viewer');
const dlgStage = $('#viewer-stage');
let dlgPiece = 'elbe';

async function openPiece(id) {
  const p = PIECES[id];
  dlgPiece = id;
  inDialog = true;
  $('#viewer-type').textContent = p.type;
  $('#viewer-title').textContent = p.name;
  $('#viewer-meta').textContent = p.meta(p.metal);
  $('#viewer-price').textContent = p.price;
  setChecked($('#viewer-metals'), p.metal);
  dlg.showModal();
  document.documentElement.classList.add('is-locked');
  dlgStage.classList.add('is-loading');
  try {
    viewer = await loadViewer();
    bindViewer(viewer);
    if (!inDialog) return; // inzwischen geschlossen
    viewer.mount(dlgStage);
    viewer.setPiece(id, { metal: p.metal });
    await viewer.whenRendered();
  } catch (err) {
    console.warn(err);
    $('#viewer-meta').textContent = '3D konnte auf diesem Gerät nicht geladen werden.';
  } finally {
    dlgStage.classList.remove('is-loading');
  }
}

$('#rail').addEventListener('click', (e) => {
  const b = e.target.closest('[data-piece]');
  if (b) openPiece(b.dataset.piece);
});
$('#viewer-close').addEventListener('click', () => dlg.close());
$('#viewer-metals').addEventListener('click', (e) => {
  const b = e.target.closest('[data-metal]');
  if (!b || !viewer) return;
  setChecked(e.currentTarget, b.dataset.metal);
  $('#viewer-meta').textContent = PIECES[dlgPiece].meta(b.dataset.metal);
  viewer.setMetal(b.dataset.metal);
});
dlg.addEventListener('close', () => {
  inDialog = false;
  document.documentElement.classList.remove('is-locked');
  if (!viewer) return;
  // Viewer zurück in den Hero: dort wieder der Ring im gewählten Metall
  viewer.mount(stageCanvas);
  viewer.setPiece('elbe', { metal: heroMetal });
  stage.classList.add('is-live');
  heroTools.hidden = false;
  $('#load3d').hidden = true;
});

/* ---------- Beratungstermin (Demo) ---------- */
const form = $('#visit-form');
const dateInput = form.querySelector('[name="datum"]');
const today = new Date();
dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = form.querySelector('[name="name"]');
  let ok = true;
  [name, dateInput].forEach((f) => {
    const valid = f.value.trim() !== '';
    f.closest('.hut-field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  const status = $('#visit-status');
  if (!ok) {
    status.textContent = 'Bitte Name und Wunschtermin angeben.';
    status.classList.remove('is-ok');
    return;
  }
  const [y, m, day] = dateInput.value.split('-').map(Number); // lokal, nicht UTC
  const d = new Date(y, m - 1, day).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  status.textContent = `Danke, ${name.value.trim()}! Hier käme jetzt die Bestätigung für ${d}, ${form.zeit.value} Uhr. (Beispiel: Es wurde nichts gesendet.)`;
  status.classList.add('is-ok');
  form.reset();
});

/* ---------- Scroll-Animationen ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  gsap.fromTo('[data-hero]', { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 1.3, stagger: 0.12, delay: 0.1 });

  // Haltung: Wörter leuchten beim Scrollen nacheinander auf
  const st = $('#statement');
  st.innerHTML = st.textContent.trim().split(/\s+/).map((w) => `<span class="w">${w}</span>`).join(' ');
  gsap.fromTo('#statement .w', { opacity: 0.14 }, {
    opacity: 1, ease: 'none', stagger: 0.06,
    scrollTrigger: { trigger: st, start: 'top 82%', end: 'bottom 45%', scrub: true },
  });

  // Detailbilder zoomen sanft heran
  $$('.hut-detail').forEach((fig) => {
    gsap.fromTo($('img', fig), { scale: 1.2 }, {
      scale: 1, ease: 'none',
      scrollTrigger: { trigger: fig, start: 'top bottom', end: 'center center', scrub: true },
    });
  });

  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, overwrite: true }),
  });

  // Kollektion: auf großen Bildschirmen seitlich durch die Stücke scrollen
  const mm = gsap.matchMedia();
  mm.add('(min-width: 900px)', () => {
    const sec = $('.hut-collection');
    const rail = $('#rail');
    sec.classList.add('is-pinned');
    const dist = () => Math.max(0, rail.scrollWidth - document.documentElement.clientWidth);
    const tween = gsap.to(rail, {
      x: () => -dist(),
      ease: 'none',
      scrollTrigger: {
        trigger: sec, start: () => `top ${nav.offsetHeight}px`, end: () => `+=${dist()}`,
        pin: true, scrub: 0.6, invalidateOnRefresh: true,
      },
    });
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
      gsap.set(rail, { clearProps: 'transform' });
      sec.classList.remove('is-pinned');
    };
  });
}
initMotion();
