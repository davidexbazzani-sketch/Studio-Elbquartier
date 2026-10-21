import { can3D, reducedMotion, whenScrolledNear } from '../../assets/js/capability.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const esc = (t) => String(t).replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));

/* ---------- Navigation und Öffnungszeiten ---------- */
const nav = $('#nav');
const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 30);
addEventListener('scroll', onScroll, { passive: true });
onScroll();
const today = new Date();
$$('#hours tr').forEach((tr) => tr.classList.toggle('is-today', tr.dataset.days.split(',').includes(String(today.getDay()))));

/* ---------- Der Stoff ---------- */
const COLORS = {
  ecru: { label: 'Ecru', hex: '#e6dfd2' },
  sand: { label: 'Sand', hex: '#cdb999' },
  salbei: { label: 'Salbei', hex: '#9fac94' },
  rose: { label: 'Rosé', hex: '#d4aa9c' },
  terrakotta: { label: 'Terrakotta', hex: '#b0664c' },
  marine: { label: 'Marine', hex: '#2e3a4e' },
};
const WEIGHTS = {
  leicht: { label: 'Leicht', gsm: 150, note: 'Fließt weich und luftig: für Blusen, Kleider und heiße Tage.' },
  mittel: { label: 'Mittel', gsm: 190, note: 'Unser Allrounder für Hemden und Hosen: kühl, aber nicht durchsichtig.' },
  schwer: { label: 'Schwer', gsm: 240, note: 'Steht schön und knittert edel: für Jacken, Röcke und den Herbst.' },
};
const fabric = { color: 'sand', weight: 'mittel' };
const stage = $('#fabric-stage');
const poster = $('#fabric-poster');
let cloth = null, loading = false;

$('#colors').innerHTML = Object.entries(COLORS).map(([k, c]) =>
  `<button type="button" role="radio" data-color="${k}" style="--sw:${c.hex}" aria-label="${c.label}" title="${c.label}"></button>`).join('');
$('#weights').innerHTML = Object.entries(WEIGHTS).map(([k, w]) =>
  `<button type="button" role="radio" data-weight="${k}">${w.label}<small>${w.gsm} g/m²</small></button>`).join('');

const labelOf = () => [`Leinen · ${COLORS[fabric.color].label}`, `${WEIGHTS[fabric.weight].gsm} g/m²`];

function renderFabric(changed) {
  $$('[data-color]').forEach((b) => { const on = b.dataset.color === fabric.color; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  $$('[data-weight]').forEach((b) => { const on = b.dataset.weight === fabric.weight; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  $('#color-name').textContent = COLORS[fabric.color].label;
  $('#weight-note').textContent = WEIGHTS[fabric.weight].note;
  if (cloth) {
    cloth.set({ color: COLORS[fabric.color].hex, weight: fabric.weight, label: labelOf() });
    if (changed === 'color') cloth.poke();
  } else if (changed === 'color') {
    const src = `../../assets/img/boutique/stoff-${fabric.color}.webp`;
    poster.classList.add('is-swapping');
    const img = new Image();
    img.src = src;
    img.decode().catch(() => {}).then(() => {
      poster.src = src;
      poster.alt = `Leinenstoff in ${COLORS[fabric.color].label}, in weichen Falten an einem Holzstab hängend`;
      poster.classList.remove('is-swapping');
    });
  }
}
function radioKeys(container, attr, apply) {
  container.addEventListener('click', (e) => {
    const b = e.target.closest(`[${attr}]`);
    if (b) apply(b.getAttribute(attr));
  });
  container.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    const items = $$(`[${attr}]`, container);
    const i = items.indexOf(document.activeElement) + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1);
    const next = items[(i + items.length) % items.length];
    next.focus();
    apply(next.getAttribute(attr));
    e.preventDefault();
  });
}
radioKeys($('#colors'), 'data-color', (k) => { fabric.color = k; renderFabric('color'); });
radioKeys($('#weights'), 'data-weight', (k) => { fabric.weight = k; renderFabric('weight'); });
renderFabric();

async function load3D() {
  if (cloth || loading) return;
  loading = true;
  $('#fabric-load').hidden = true;
  try {
    const { createCloth } = await import('../../assets/js/3d/cloth.js');
    const c = createCloth({ container: $('#fabric-view'), reducedMotion, textureUrl: '../../assets/img/boutique/leinen-textur.webp' });
    await c.ready;
    c.set({ color: COLORS[fabric.color].hex, weight: fabric.weight, label: labelOf() });
    await c.whenRendered();
    cloth = c;
    cloth.canvas.setAttribute('aria-label', 'Leinenstoff in 3D. Mit Maus oder Finger am Stoff ziehen.');
    stage.dataset.mode = '3d';
    const hint = $('#fabric-hint');
    hint.hidden = false;
    cloth.canvas.addEventListener('pointerdown', () => { hint.style.opacity = '0'; }, { once: true });
  } catch (err) {
    console.warn('3D konnte nicht geladen werden:', err);
    $('#fabric-load').hidden = false;
  } finally {
    loading = false;
  }
}
const cap = can3D();
if (cap.ok) {
  whenScrolledNear(stage, load3D, { margin: '500px 0px' }); // erst beim Scrollen, damit die Seite sofort flüssig bedienbar ist
} else {
  $('#fabric-load').hidden = false;
  $('#fabric-load').title = cap.why;
}
$('#fabric-load').addEventListener('click', load3D);

/* ---------- Anprobe-Liste ---------- */
const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const fit = new Map(); // id → { name, price, size, thumb }
const fitBtn = $('#fit-open');

function syncFit() {
  const n = fit.size;
  $('#fit-count').textContent = n;
  fitBtn.classList.toggle('has-items', n > 0);
  fitBtn.setAttribute('aria-label', `Anprobe, ${n} ${n === 1 ? 'Teil' : 'Teile'} vorgemerkt`);
  $$('[data-add]').forEach((b) => {
    const on = fit.has(b.dataset.add);
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? 'Vorgemerkt ✓' : b.dataset.short ? 'Vormerken' : 'Zur Anprobe vormerken';
  });
}
function toggleFit(id, item) {
  if (fit.has(id)) fit.delete(id);
  else {
    fit.set(id, item);
    fitBtn.classList.remove('bump');
    void fitBtn.offsetWidth; // Animation neu starten
    fitBtn.classList.add('bump');
  }
  syncFit();
}

/* ---------- Neu im Laden ---------- */
const PRODUCTS = [
  { id: 'hemd-ecru', name: 'Henley-Hemd Ecru', fabric: 'Leinen, 190 g/m²', price: 89, alt: 'Kurzärmeliges Henley-Hemd aus ecrufarbenem Leinen auf einem Holzbügel', sizes: ['S', 'M', 'L'] },
  { id: 'hemd-streifen', name: 'Stehkragenhemd Nadelstreifen', fabric: 'Leinen, 150 g/m²', price: 95, alt: 'Kurzärmeliges Stehkragenhemd mit feinen blauen Streifen auf einem Holzbügel', sizes: ['S', 'M', 'XL'] },
  { id: 'hemd-marine', name: 'Kurzarmhemd Marine', fabric: 'Leinen, 190 g/m²', price: 89, alt: 'Kurzärmeliges Hemd aus marineblauem Leinen auf einem Holzbügel', sizes: ['XS', 'S', 'M', 'L', 'XL'] },
  { id: 'hemd-grau', name: 'Shirt mit V-Ausschnitt', fabric: 'Leinen-Jersey, 160 g/m²', price: 69, alt: 'Graues Shirt mit V-Ausschnitt aus Leinen auf einem Holzbügel', sizes: ['M', 'L', 'XL'] },
];
const chosenSize = Object.fromEntries(PRODUCTS.map((p) => [p.id, p.sizes.includes('M') ? 'M' : p.sizes[0]]));
$('#products').innerHTML = PRODUCTS.map((p) => `
  <li class="ll-product" data-reveal>
    <figure><img src="../../assets/img/boutique/${p.id}.webp" width="900" height="1200" loading="lazy" alt="${p.alt}"></figure>
    <h3>${p.name}</h3>
    <p class="ll-product__meta"><span>${p.fabric}</span><strong>${euro.format(p.price)}</strong></p>
    <div class="ll-sizes" role="radiogroup" aria-label="Größe ${p.name}" data-product="${p.id}">
      ${SIZES.map((s) => `<button type="button" role="radio" data-size="${s}" ${p.sizes.includes(s) ? '' : 'disabled title="Gerade nicht da"'}>${s}</button>`).join('')}
    </div>
    <button type="button" class="ll-btn ll-add" data-add="${p.id}" aria-pressed="false">Zur Anprobe vormerken</button>
  </li>`).join('');

function syncSizes() {
  $$('.ll-sizes').forEach((group) => {
    const id = group.dataset.product;
    $$('[data-size]', group).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.size === chosenSize[id])));
  });
}
$('#products').addEventListener('click', (e) => {
  const size = e.target.closest('[data-size]');
  if (size && !size.disabled) {
    const id = size.closest('[data-product]').dataset.product;
    chosenSize[id] = size.dataset.size;
    if (fit.has(id)) fit.get(id).size = chosenSize[id];
    syncSizes();
    return;
  }
  const add = e.target.closest('[data-add]');
  if (!add) return;
  const p = PRODUCTS.find((x) => x.id === add.dataset.add);
  toggleFit(p.id, { name: p.name, price: p.price, size: chosenSize[p.id], thumb: `<img src="../../assets/img/boutique/${p.id}.webp" alt="">` });
});
syncSizes();

/* ---------- Lookbook ---------- */
const LOOK = [
  { id: 'look-hemd', x: 57.5, y: 30, name: 'Oversize-Hemd Creme', text: 'Leinen, 150 g/m², fällt locker über die Hose.', price: 99 },
  { id: 'look-zopf', x: 65.5, y: 62, name: 'Zopfstrick-Jacke', text: 'Wolle und Leinen, gestrickt in Litauen.', price: 149 },
  { id: 'look-zimt', x: 74, y: 36, name: 'Feinstrick Zimt', text: 'Leinen und Baumwolle, angenehm auf der Haut.', price: 109 },
  { id: 'look-teddy', x: 90, y: 55, name: 'Teddyjacke Natur', text: 'Wollfleece mit Futter aus Leinen.', price: 189 },
];
const look = $('#look');
look.insertAdjacentHTML('beforeend', LOOK.map((l, i) => `
  <button type="button" class="ll-spot" style="left:${l.x}%;top:${l.y}%" aria-expanded="false" aria-controls="pop-${i}" aria-label="${l.name}">
    <svg viewBox="0 0 14 14" aria-hidden="true"><path d="M7 1v12M1 7h12" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
  </button>`).join(''));
// Schmal wird das Bild quadratisch zugeschnitten (rechter Teil der Stange): Punkte umrechnen
const CROP = { from: 0.1875, span: 0.75 };
const spotX = (l) => (look.clientWidth < 640 ? ((l.x / 100 - CROP.from) / CROP.span) * 100 : l.x);
function placeSpots() {
  $$('.ll-spot', look).forEach((b, i) => { b.style.left = `${spotX(LOOK[i])}%`; });
}
placeSpots();
addEventListener('resize', placeSpots);
let openPop = null;
function closePop() {
  if (!openPop) return;
  openPop.btn.setAttribute('aria-expanded', 'false');
  openPop.el.remove();
  openPop = null;
}
look.addEventListener('click', (e) => {
  const add = e.target.closest('[data-add]');
  if (add) {
    const l = LOOK.find((x) => x.id === add.dataset.add);
    toggleFit(l.id, { name: l.name, price: l.price, size: 'M', thumb: `<i class="ll-thumb" style="display:block;width:52px;height:64px;border-radius:4px;background:url(../../assets/img/boutique/boutique-lookbook.webp) ${l.x}% ${l.y}% / 520% auto"></i>` });
    return;
  }
  const spot = e.target.closest('.ll-spot');
  if (!spot) return;
  const i = $$('.ll-spot', look).indexOf(spot);
  const wasOpen = openPop?.btn === spot;
  closePop();
  if (wasOpen) return;
  const l = LOOK[i];
  const el = document.createElement('div');
  el.className = 'll-pop';
  el.id = `pop-${i}`;
  el.innerHTML = `<h3>${l.name}</h3><p>${l.text}</p><div class="ll-pop__row"><strong>${euro.format(l.price)}</strong><button type="button" class="ll-btn ll-add" data-add="${l.id}" data-short="1" aria-pressed="false" style="width:auto;margin:0;min-height:40px;padding:0 18px;font-size:13.5px">Vormerken</button></div>`;
  // Karte so setzen, dass sie im Bild bleibt (schmal: mittig unter bzw. über dem Punkt)
  el.style.top = `calc(${l.y}% + 26px)`;
  if (l.y > 55) { el.style.top = 'auto'; el.style.bottom = `calc(${100 - l.y}% + 26px)`; }
  if (look.clientWidth < 640) { el.style.left = '50%'; el.style.translate = '-50% 0'; }
  else if (l.x > 62) el.style.right = `${Math.max(2, 100 - l.x - 6)}%`;
  else el.style.left = `${spotX(l)}%`;
  look.appendChild(el);
  spot.setAttribute('aria-expanded', 'true');
  openPop = { btn: spot, el };
  syncFit();
});
document.addEventListener('click', (e) => { if (openPop && !look.contains(e.target)) closePop(); });
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePop(); });

/* ---------- Anprobe reservieren (Demo) ---------- */
const dlg = $('#fit');
const form = $('#fit-form');
const OPEN = { 2: [11, 19], 3: [11, 19], 4: [11, 19], 5: [11, 19], 6: [10, 16] };
let day = null, time = null;

function days() {
  const out = [];
  const d = new Date(today);
  d.setHours(0, 0, 0, 0);
  for (let i = 0; out.length < 6 && i < 14; i++) {
    const dd = new Date(d.getTime() + i * 864e5);
    const h = OPEN[dd.getDay()];
    if (!h) continue;
    if (i === 0 && today.getHours() >= h[1] - 1) continue; // heute schon zu spät
    out.push(dd);
  }
  return out;
}
function times(d) {
  const [o, c] = OPEN[d.getDay()];
  const list = [];
  for (let h = o; h < c; h++) {
    if (d.toDateString() === today.toDateString() && h <= today.getHours()) continue;
    list.push(`${h}:00`);
  }
  return list;
}
function renderDialogList() {
  const list = $('#fit-list');
  if (!fit.size) {
    list.innerHTML = '<li class="ll-fitlist__empty">Noch nichts vorgemerkt. Sie können trotzdem eine Kabine reservieren und im Laden stöbern.</li>';
    return;
  }
  list.innerHTML = [...fit.entries()].map(([id, it]) => `
    <li data-id="${id}">${it.thumb}
      <div><strong>${it.name}</strong><small>${euro.format(it.price)} · Größe
        <select aria-label="Größe ${it.name}" data-fitsize="${id}">${SIZES.map((s) => `<option${s === it.size ? ' selected' : ''}>${s}</option>`).join('')}</select></small></div>
      <button type="button" data-remove="${id}">Entfernen</button>
    </li>`).join('');
}
function renderTimes() {
  const t = times(day);
  if (!t.includes(time)) time = t[0];
  $('#fit-times').innerHTML = t.map((x) => `<button type="button" role="radio" aria-checked="${x === time}" data-time="${x}">${x}</button>`).join('');
}
function openFit() {
  closePop();
  const ds = days();
  day = ds[0];
  $('#fit-days').innerHTML = ds.map((d, i) => `<button type="button" role="radio" aria-checked="${i === 0}" data-day="${i}">
    ${d.toLocaleDateString('de-DE', { weekday: 'short' }).replace('.', '')}<small>${d.toLocaleDateString('de-DE', { day: 'numeric', month: 'numeric' })}</small></button>`).join('');
  $('#fit-days').onclick = (e) => {
    const b = e.target.closest('[data-day]');
    if (!b) return;
    day = ds[+b.dataset.day];
    $$('[data-day]', $('#fit-days')).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
    renderTimes();
  };
  renderTimes();
  renderDialogList();
  const status = $('#fit-status');
  status.textContent = 'Beispiel-Formular: Es wird nichts gesendet.';
  status.classList.remove('is-ok');
  $('#fit-submit').hidden = false;
  $('#fit-cancel').textContent = 'Zurück';
  dlg.showModal();
  document.documentElement.classList.add('is-locked');
}
fitBtn.addEventListener('click', openFit);
$('#fit-times').addEventListener('click', (e) => {
  const b = e.target.closest('[data-time]');
  if (!b) return;
  time = b.dataset.time;
  $$('[data-time]', $('#fit-times')).forEach((x) => x.setAttribute('aria-checked', String(x === b)));
});
$('#fit-list').addEventListener('click', (e) => {
  const b = e.target.closest('[data-remove]');
  if (!b) return;
  fit.delete(b.dataset.remove);
  syncFit();
  renderDialogList();
});
$('#fit-list').addEventListener('change', (e) => {
  const s = e.target.closest('[data-fitsize]');
  if (!s) return;
  const it = fit.get(s.dataset.fitsize);
  it.size = s.value;
  if (chosenSize[s.dataset.fitsize]) { chosenSize[s.dataset.fitsize] = s.value; syncSizes(); }
});
$('#fit-cancel').addEventListener('click', () => dlg.close());
dlg.addEventListener('close', () => document.documentElement.classList.remove('is-locked'));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  let ok = true;
  ['name', 'kontakt'].forEach((n) => {
    const f = form[n];
    const valid = f.value.trim() !== '';
    f.closest('.ll-field').classList.toggle('is-invalid', !valid);
    if (!valid) ok = false;
  });
  if (!ok) return;
  const when = day.toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' });
  const until = new Date(day.getTime() + 3 * 864e5).toLocaleDateString('de-DE', { weekday: 'long' });
  const what = fit.size ? `${fit.size} ${fit.size === 1 ? 'Teil' : 'Teile'} in Ihrer Größe` : 'eine Kabine';
  const status = $('#fit-status');
  status.innerHTML = `<strong>Danke, ${esc(form.name.value.trim())}!</strong> Wir hätten ${what} am ${when} um ${time} Uhr für Sie bereit, reserviert bis ${until}. <small>Beispiel: Es wurde nichts gesendet.</small>`;
  status.classList.add('is-ok');
  $('#fit-submit').hidden = true;
  $('#fit-cancel').textContent = 'Schließen';
});
syncFit();

/* ---------- Scroll-Animationen ---------- */
function initMotion() {
  const { gsap, ScrollTrigger } = window;
  if (!gsap || !ScrollTrigger || reducedMotion) {
    document.documentElement.classList.remove('js-motion');
    return;
  }
  gsap.registerPlugin(ScrollTrigger);
  gsap.defaults({ ease: 'power3.out' });
  gsap.fromTo('[data-hero]:not(.ll-hero__media)', { opacity: 0, y: 26 }, { opacity: 1, y: 0, duration: 1.2, stagger: 0.09, delay: 0.1 });
  gsap.from('.ll-hero__media', { y: 26, duration: 1.2, delay: 0.1 }); // Hauptbild nur bewegen, nicht ausblenden (LCP)
  gsap.fromTo('.ll-hero__media img', { scale: 1.06 }, { scale: 1, duration: 2.4, ease: 'power2.out' });
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, { opacity: 1, y: 0, duration: 1.1, stagger: 0.09, overwrite: true }),
  });
}
initMotion();
