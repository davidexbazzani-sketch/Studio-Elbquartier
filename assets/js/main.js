import { SHOPS, facadeSVG } from './shops.js';
import { afterInteraction, can3D, hasWebGL2, reducedMotion } from './capability.js';

const $ = (s, r = document) => r.querySelector(s);

/* ---------- Navigation ---------- */
const nav = $('#nav');
const toggle = $('.nav__toggle', nav);
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 8);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
toggle.addEventListener('click', () => {
  const open = nav.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
  toggle.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
});
nav.querySelectorAll('.nav__sheet a').forEach((a) => a.addEventListener('click', () => {
  nav.classList.remove('is-open');
  toggle.setAttribute('aria-expanded', 'false');
}));

$('#year').textContent = new Date().getFullYear();

/* ---------- Scroll-Animationen (GSAP) ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });

  // Hero: ruhiges Einblenden, Titel Buchstabe für Buchstabe
  const title = $('.hero__title');
  // Buchstaben einzeln animieren, aber Wörter zusammenhalten (sonst bricht „Elbquartier“ auf dem Handy mitten im Wort um);
  // Screenreader und Suchmaschinen bekommen den Namen als normalen Text
  const text = title.textContent.trim();
  title.innerHTML = `<span class="visually-hidden">${text}</span><span aria-hidden="true">${text.split(' ').map((word) => `<span style="display:inline-block;white-space:nowrap">${
    [...word].map((ch) => `<span class="char" style="display:inline-block">${ch}</span>`).join('')}</span>`).join(' ')}</span>`;
  const tl = gsap.timeline({ delay: 0.15 });
  tl.from('[data-hero]', { opacity: 0, y: 24, duration: 1.2, stagger: 0.09 })
    .from('.hero__title .char', { opacity: 0, yPercent: 40, rotateX: -50, duration: 1.1, stagger: 0.025 }, 0.15);

  // Hero gleitet beim Scrollen sanft zurück
  gsap.to('.hero__inner', {
    yPercent: -12, opacity: 0.2, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  // Die schwebenden Beispiel-Fenster gleiten beim Scrollen auseinander und verblassen
  gsap.to('.hero__cards', {
    scale: 1.12, yPercent: -10, opacity: 0, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__aura', {
    yPercent: 18, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });

  // Elemente erscheinen beim Hineinscrollen
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, overwrite: true }),
  });

  // Drehscheibe zoomt beim Hereinscrollen leicht heran
  gsap.fromTo('.stage', { scale: 0.94, opacity: 0.4 }, {
    scale: 1, opacity: 1, ease: 'none',
    scrollTrigger: { trigger: '.stage', start: 'top bottom', end: 'top 45%', scrub: true },
  });
}
initMotion();

/* ---------- Hero-Band (Handy): läuft von selbst weiter, lässt sich jederzeit wischen ---------- */
const heroStrip = $('.hero__strip');
if (heroStrip) {
  const track = $('.hero__track', heroStrip);
  const SPEED = 34; // px pro Sekunde
  let pos = 0, lastSet = -1, resumeAt = 0, touching = false, visible = false, raf = 0, last = 0;
  const half = () => track.scrollWidth / 2 + 9; // Inhalt ist doppelt vorhanden (Lücke 18 px)
  const wrap = () => { // endlos in beide Richtungen
    const h = half();
    if (heroStrip.scrollLeft >= h) heroStrip.scrollLeft -= h;
    else if (heroStrip.scrollLeft < 2) heroStrip.scrollLeft += h;
  };
  const pauseFor = (ms) => { resumeAt = performance.now() + ms; };
  const step = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (!touching && now > resumeAt && !reducedMotion) {
      pos += SPEED * dt;
      const h = half();
      if (pos >= h) pos -= h;
      heroStrip.scrollLeft = pos;
      lastSet = heroStrip.scrollLeft;
    } else {
      pos = heroStrip.scrollLeft;
    }
    raf = visible ? requestAnimationFrame(step) : 0;
  };
  // Start in der Mitte des doppelten Inhalts, damit man auch gleich nach links wischen kann
  requestAnimationFrame(() => { heroStrip.scrollLeft = pos = half(); });
  heroStrip.addEventListener('touchstart', () => { touching = true; }, { passive: true });
  heroStrip.addEventListener('touchend', () => { touching = false; pauseFor(2500); }, { passive: true });
  heroStrip.addEventListener('pointerdown', () => pauseFor(2500), { passive: true });
  heroStrip.addEventListener('scroll', () => {
    if (Math.abs(heroStrip.scrollLeft - lastSet) > 1) { pauseFor(1800); wrap(); pos = heroStrip.scrollLeft; }
  }, { passive: true });
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting && heroStrip.offsetParent !== null;
    if (visible && !raf) { last = performance.now(); raf = requestAnimationFrame(step); }
  }).observe(heroStrip);
}

/* ---------- Hero: Beispiel-Fenster folgen der Maus mit Tiefe ---------- */
const heroCards = $('.hero__cards');
if (heroCards && !reducedMotion && matchMedia('(pointer: fine)').matches) {
  let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
  const step = () => {
    x += (tx - x) * 0.08; y += (ty - y) * 0.08;
    heroCards.style.setProperty('--mx', x.toFixed(2));
    heroCards.style.setProperty('--my', y.toFixed(2));
    raf = Math.abs(tx - x) + Math.abs(ty - y) > 0.05 ? requestAnimationFrame(step) : 0;
  };
  addEventListener('pointermove', (e) => {
    if (window.scrollY > innerHeight) return; // nur solange das Startbild zu sehen ist
    tx = (e.clientX / innerWidth - 0.5) * -36;
    ty = (e.clientY / innerHeight - 0.5) * -28;
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: true });
}

/* ---------- Drehscheibe ---------- */
const stage = $('#stage');
const canvasWrap = $('#stage-canvas');
const strip = $('#shop-strip');
const dots = $('#stage-dots');
const info = $('.stage__info');
const toggleRow = $('#stage-toggle');
let current = 0;
let turntable = null;

// Ersatzansicht aufbauen
strip.innerHTML = SHOPS.map((s, i) => `
  <li class="shop-card${i === 0 ? ' is-active' : ''}" data-index="${i}">
    <a href="${s.url}" class="shop-card__link" aria-label="${s.type} ${s.name}: Beispiel-Website öffnen">
      <div class="shop-card__art" style="background:${s.colors.body}33">${facadeSVG(s)}</div>
    </a>
  </li>`).join('');

dots.innerHTML = SHOPS.map((s, i) =>
  `<button type="button" role="tab" aria-selected="${i === 0}" aria-label="${s.type} ${s.name}" data-index="${i}"></button>`).join('');

let switchTimer = 0;
function setActive(i, { fromStrip = false } = {}) {
  if (i === current && info.dataset.ready) return;
  current = i;
  info.dataset.ready = '1';
  const s = SHOPS[i];
  info.classList.add('is-switching');
  clearTimeout(switchTimer);
  switchTimer = setTimeout(() => {
    $('#stage-type').textContent = `${s.type} · ${s.district}`;
    $('#stage-name').textContent = s.name;
    $('#stage-teaser').textContent = s.teaser;
    $('#stage-open').href = s.url;
    info.classList.remove('is-switching');
  }, reducedMotion ? 0 : 180);
  dots.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
  strip.querySelectorAll('.shop-card').forEach((c, k) => c.classList.toggle('is-active', k === i));
  if (!turntable && !fromStrip) {
    const card = strip.children[i];
    strip.scrollTo({ left: card.offsetLeft - (strip.clientWidth - card.clientWidth) / 2, behavior: reducedMotion ? 'auto' : 'smooth' });
  }
}

function go(delta) {
  if (turntable) delta > 0 ? turntable.next() : turntable.prev();
  else setActive((current + delta + SHOPS.length) % SHOPS.length);
}
$('#stage-prev').addEventListener('click', () => go(-1));
$('#stage-next').addEventListener('click', () => go(1));
dots.addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const i = Number(b.dataset.index);
  turntable ? turntable.goTo(i) : setActive(i);
});
stage.addEventListener('keydown', (e) => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'ArrowRight') { go(1); e.preventDefault(); }
  if (e.key === 'ArrowLeft') { go(-1); e.preventDefault(); }
});

// Aktive Karte in der Ersatzansicht beim Wischen erkennen
let stripTimer = 0;
strip.addEventListener('scroll', () => {
  clearTimeout(stripTimer);
  stripTimer = setTimeout(() => {
    const mid = strip.scrollLeft + strip.clientWidth / 2;
    let best = 0, dist = Infinity;
    [...strip.children].forEach((c, k) => {
      const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
      if (d < dist) { dist = d; best = k; }
    });
    if (best !== current) setActive(best, { fromStrip: true });
  }, 80);
}, { passive: true });

async function load3D() {
  if (turntable) return;
  toggleRow.hidden = true;
  stage.dataset.mode = '3d';
  try {
    const { createTurntable } = await import('./turntable.js');
    turntable = await createTurntable({
      container: canvasWrap,
      hint: $('#stage-hint'),
      reducedMotion,
      onChange: (i) => setActive(i),
      onOpen: (i) => { location.href = SHOPS[i].url; },
    });
    requestAnimationFrame(() => canvasWrap.classList.add('is-ready'));
    turntable.goTo(current);
  } catch (err) {
    console.warn('3D konnte nicht geladen werden:', err);
    stage.dataset.mode = 'fallback';
    turntable = null;
  }
}

const cap = can3D();
if (cap.ok) {
  // 3D erst laden, wenn der Abschnitt bald sichtbar wird – und erst, wenn jemand die Seite bedient
  // (scrollen, tippen, Maus). Sonst rechnet das Handy schon beim Seitenaufbau am 3D und die Startanimation hakt.
  const io = new IntersectionObserver((entries) => {
    if (entries.some((e) => e.isIntersecting)) { io.disconnect(); load3D(); }
  }, { rootMargin: '600px 0px' });
  afterInteraction(() => io.observe(stage));
} else {
  $('#beispiele .section-head .t-lead').textContent = 'Wischen Sie durch die Läden und öffnen Sie ein Beispiel. Alle Namen sind erfunden, die Ideen sind echt.';
  $('#stage-toggle-text').textContent = cap.why;
  toggleRow.hidden = !hasWebGL2();
  $('#stage-load3d').addEventListener('click', load3D);
}
setActive(0);

/* ---------- Paket-Buttons füllen das Formular vor ---------- */
document.querySelectorAll('[data-plan]').forEach((a) => a.addEventListener('click', () => {
  $('#contact-form select[name="paket"]').value = a.dataset.plan;
}));

/* ---------- Kontaktformular ---------- */
const form = $('#contact-form');
const status = $('#contact-status');
$('#contact-ts').value = String(Math.floor(Date.now() / 1000));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  status.className = 'contact__status t-small';
  let valid = true;
  form.querySelectorAll('[required]').forEach((f) => {
    const ok = f.type === 'checkbox' ? f.checked : f.checkValidity() && f.value.trim() !== '';
    f.closest('.field')?.classList.toggle('field--invalid', !ok);
    if (!ok) valid = false;
  });
  if (!valid) {
    status.textContent = 'Bitte füllen Sie die markierten Felder aus und bestätigen Sie die Einwilligung.';
    status.classList.add('is-error');
    return;
  }
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  status.textContent = 'Wird gesendet …';
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) throw new Error(data.message || 'Senden fehlgeschlagen.');
    form.reset();
    status.textContent = 'Danke! Ihre Nachricht ist angekommen. Wir melden uns bald.';
    status.classList.add('is-ok');
  } catch (err) {
    status.textContent = `${err.message} Sie erreichen uns auch unter 0176 31685816 oder per E-Mail an hallo@studio-elbquartier.de.`;
    status.classList.add('is-error');
  } finally {
    btn.disabled = false;
  }
});
