import { SHOPS, facadeSVG } from './shops.js';
import { afterInteraction, can3D, hasWebGL2, reducedMotion } from './capability.js';
import './hero-video.js';
import './software-demos.js';

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

  // Hero gleitet beim Scrollen sanft zurück (auf dem Handy ohne Verblassen, sonst wirken die Buttons ausgegraut)
  const wide = matchMedia('(min-width: 760px)').matches;
  gsap.to('.hero__inner', {
    yPercent: wide ? -12 : -4, opacity: wide ? 0.2 : 1, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  gsap.to('.hero__media', {
    yPercent: 14, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
  });
  // Elemente erscheinen beim Hineinscrollen
  ScrollTrigger.batch('[data-reveal]', {
    // früh und zügig, damit beim schnellen Wischen keine leeren Flächen stehen bleiben
    start: 'top 98%',
    once: true,
    // danach Inline-Werte entfernen, damit Hover-Effekte und CSS-Versatz (z. B. Paket-Empfehlung) wieder greifen
    onEnter: (els) => gsap.to(els, {
      opacity: 1, y: 0, duration: 0.7, stagger: 0.06, overwrite: true,
      onComplete: () => els.forEach((el) => { el.classList.add('is-in'); gsap.set(el, { clearProps: 'transform,opacity' }); }),
    }),
  });

  // Bilder öffnen sich beim Hereinscrollen: Ausschnitt zieht auf, Bild zoomt leicht zurück
  gsap.utils.toArray('[data-img]').forEach((fig) => {
    const img = fig.querySelector('img');
    const round = fig.classList.contains('row__media');
    gsap.timeline({ scrollTrigger: { trigger: fig, start: 'top 92%', once: true } })
      .fromTo(fig, { clipPath: round ? 'circle(30% at 50% 50%)' : 'inset(12% 8% 12% 8% round 4px)' },
        { clipPath: round ? 'circle(50% at 50% 50%)' : 'inset(0% 0% 0% 0% round 4px)', duration: 1.3, clearProps: 'clipPath' })
      .fromTo(img, { scale: 1.16 }, { scale: 1, duration: 1.6, clearProps: 'transform' }, 0);
  });

  // Bildband: Bild gleitet langsamer als die Seite (Tiefenwirkung)
  gsap.fromTo('.band__img', { yPercent: -7 }, {
    yPercent: 7, ease: 'none',
    scrollTrigger: { trigger: '.band', start: 'top bottom', end: 'bottom top', scrub: true },
  });

  // Laufband: läuft ruhig, beim Scrollen kurz etwas schneller; außerhalb des Bildschirms angehalten
  const track = document.querySelector('.ribbons .ribbon__track');
  if (track) {
    document.documentElement.classList.add('js-ribbons');
    const loop = gsap.fromTo(track, { xPercent: 0 }, { xPercent: -50, duration: 90, ease: 'none', repeat: -1, paused: true });
    ScrollTrigger.create({
      trigger: '.ribbons', start: 'top bottom', end: 'bottom top',
      onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
      onUpdate: (self) => {
        const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 600, 2.5);
        gsap.to(loop, { timeScale: boost, duration: 0.3, overwrite: true,
          onComplete: () => gsap.to(loop, { timeScale: 1, duration: 1.6, ease: 'power2.out' }) });
      },
    });
  }

  // Drehscheibe zoomt beim Hereinscrollen leicht heran
  gsap.fromTo('.stage', { scale: 0.94 }, { // nur Zoom, kein Verblassen (wirkte auf dem Handy wie ein Ladefehler)
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.stage', start: 'top bottom', end: 'top 45%', scrub: true },
  });
}
initMotion();

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
  }, { rootMargin: '300px 0px' });
  // Erst beim Scrollen starten (nicht nach Zeit oder Mausbewegung): Der 3D-Aufbau blockiert kurz den Browser
  // und würde sonst das Video im Startbereich stocken lassen.
  if (scrollY > 0) io.observe(stage);
  else afterInteraction(() => io.observe(stage), { fallback: Infinity, events: ['scroll', 'wheel', 'keydown', 'touchmove'] });
} else {
  const lead = $('#stage-lead'); if (lead) lead.textContent = 'Wischen Sie durch die Läden und tippen Sie auf einen, um das Beispiel zu öffnen.';
  $('#stage-toggle-text').textContent = cap.why;
  toggleRow.hidden = !hasWebGL2();
  $('#stage-load3d').addEventListener('click', load3D);
}
setActive(0);

/* ---------- Paket-Buttons füllen das Formular vor ---------- */
document.querySelectorAll('[data-plan]').forEach((a) => a.addEventListener('click', () => {
  const chip = $(`#contact-form input[name="paket"][value="${a.dataset.plan}"]`);
  if (chip) chip.checked = true;
}));

// Von den Themenseiten kommend (?interesse=Foto usw.): passendes Interesse im Formular vorauswählen
{
  const wunsch = new URLSearchParams(location.search).get('interesse');
  const chip = wunsch && $(`#contact-form input[name="paket"][value="${CSS.escape(wunsch)}"]`);
  if (chip) chip.checked = true;
}

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
