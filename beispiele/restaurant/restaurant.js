import { reducedMotion } from '../../assets/js/capability.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- Navigation ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ---------- Speisekarte ---------- */
const tabs = $$('#menu-tabs [role="tab"]');
const photoFor = { 'tab-vor': ['vor'], 'tab-haupt': ['haupt', 'haupt2'], 'tab-dessert': ['dessert'] };
function selectTab(btn) {
  tabs.forEach((t) => {
    const on = t === btn;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
    $(`#${t.getAttribute('aria-controls')}`).hidden = !on;
  });
  const show = photoFor[btn.getAttribute('aria-controls')];
  $$('#menu-photos figure').forEach((f) => { f.hidden = !show.includes(f.dataset.tab); });
}
$('#menu-tabs').addEventListener('click', (e) => {
  const b = e.target.closest('[role="tab"]');
  if (b) selectTab(b);
});
$('#menu-tabs').addEventListener('keydown', (e) => {
  const i = tabs.indexOf(document.activeElement);
  if (i < 0 || !['ArrowRight', 'ArrowLeft'].includes(e.key)) return;
  const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
  next.focus();
  selectTab(next);
});

/* ---------- Reservierung (Demo) ---------- */
const DAY = 24 * 60 * 60 * 1000;
const TIMES = ['12:00', '12:30', '13:00', '13:30', '14:00', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00'];
const booking = { day: null, time: null, people: 2, wishes: new Set() };
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 1000; return h / 1000; };
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const today = new Date();
today.setHours(0, 0, 0, 0);
const days = Array.from({ length: 14 }, (_, i) => new Date(today.getTime() + i * DAY));
$('#book-days').innerHTML = days.map((d, i) => {
  const closed = d.getDay() === 1; // Montag Ruhetag
  const label = i === 0 ? 'Heute' : i === 1 ? 'Morgen' : d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '');
  const date = d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' });
  return `<button type="button" role="radio" aria-checked="false" data-day="${iso(d)}" ${closed ? 'disabled' : ''}>
    ${label}<small>${closed ? 'Ruhetag' : date}</small></button>`;
}).join('');

function renderTimes() {
  const el = $('#book-times');
  if (!booking.day) { el.innerHTML = '<p class="fz-hint">Bitte zuerst einen Tag wählen.</p>'; return; }
  const now = new Date();
  el.innerHTML = TIMES.map((t) => {
    const [h, m] = t.split(':').map(Number);
    const slot = new Date(`${booking.day}T${t}:00`);
    const past = slot.getTime() < now.getTime() + 60 * 60 * 1000;
    const full = hash(booking.day + t + booking.people) > 0.74;
    const off = past || full;
    return `<button type="button" role="radio" aria-checked="${booking.time === t}" data-time="${t}" ${off ? 'disabled' : ''}>
      ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}${full && !past ? '<small>ausgebucht</small>' : ''}</button>`;
  }).join('');
}

$('#book-days').addEventListener('click', (e) => {
  const b = e.target.closest('[data-day]');
  if (!b || b.disabled) return;
  booking.day = b.dataset.day;
  booking.time = null;
  $$('#book-days [data-day]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  renderTimes();
});
$('#book-times').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time]');
  if (!b || b.disabled) return;
  booking.time = b.dataset.time;
  $$('#book-times [data-time]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
});
$('.fz-stepper').addEventListener('click', (e) => {
  const b = e.target.closest('[data-step]');
  if (!b) return;
  booking.people = Math.max(1, Math.min(8, booking.people + Number(b.dataset.step)));
  $('#book-people').textContent = booking.people;
  $('[data-step="-1"]', e.currentTarget).disabled = booking.people === 1;
  $('[data-step="1"]', e.currentTarget).disabled = booking.people === 8;
  $('#book-people-hint').textContent = booking.people === 8 ? 'Größere Gruppe? Rufen Sie uns gern an.' : '';
  renderTimes(); // Verfügbarkeit hängt von der Personenzahl ab
});
$('#book-wishes').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  on ? booking.wishes.add(b.textContent) : booking.wishes.delete(b.textContent);
});
renderTimes();

$('#book').addEventListener('submit', (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const confirm = $('#book-confirm');
  let ok = true;
  ['name', 'kontakt'].forEach((n) => {
    const f = form[n];
    const valid = f.value.trim() !== '';
    f.closest('.fz-field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  confirm.hidden = false;
  if (!booking.day || !booking.time) {
    confirm.innerHTML = 'Bitte wählen Sie noch Tag und Uhrzeit.';
    return;
  }
  if (!ok) { confirm.innerHTML = 'Bitte geben Sie Ihren Namen und eine Telefonnummer oder E-Mail an.'; return; }
  const [y, m, d] = booking.day.split('-').map(Number);
  const day = new Date(y, m - 1, d).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const wishes = booking.wishes.size ? ` Wünsche: ${[...booking.wishes].join(', ')}.` : '';
  confirm.innerHTML = `<strong>Danke, ${form.name.value.trim()}!</strong>Ihr Tisch für ${booking.people} ${booking.people === 1 ? 'Person' : 'Personen'} am ${day} um ${booking.time} Uhr wäre jetzt angefragt.${wishes} In der echten Website käme die Bestätigung per E-Mail.`;
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
  gsap.fromTo('[data-hero]', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, delay: 0.1 });
  gsap.fromTo('.fz-hero__media img', { scale: 1.12 }, { scale: 1, duration: 2.2, ease: 'power2.out' });
  gsap.fromTo('.fz-place__media img', { scale: 1.15 }, {
    scale: 1, ease: 'none',
    scrollTrigger: { trigger: '.fz-place', start: 'top bottom', end: 'center center', scrub: true },
  });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.1, overwrite: true }),
  });
}
initMotion();
