import { whenScrolledNear } from '../../assets/js/capability.js';
// Klarsund – Seite: 3D-Kollektion, Live-Anprobe (Kamera + Gesichtserkennung), Fotos, Terminformular.
import { MODELLE, GLAESER } from '../../assets/js/3d/brillen.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const hasWebGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();

// Gewählte Ausführung je Modell (wird zwischen Kollektion und Anprobe geteilt)
const wahl = Object.fromEntries(Object.entries(MODELLE).map(([id, m]) => [id, { farbe: Object.keys(m.farben)[0], glas: m.glaeser ? m.glaeser[0] : null }]));

// ------------------------------------------------------------------ Kollektion
const grid = $('#grid');
grid.innerHTML = Object.entries(MODELLE).map(([id, m]) => `
  <article class="ks-card" data-modell="${id}">
    <div class="ks-card__stage" data-stage="${id}" role="img" aria-label="Modell ${m.name} in 3D – zum Drehen ziehen"></div>
    <div class="ks-card__body">
      <div class="ks-card__top"><h3 class="ks-card__name">${m.name}</h3><span class="ks-card__price">${euro.format(m.preis)}</span></div>
      <p class="ks-card__art">${m.art}</p>
      <p class="ks-card__text">${m.text}</p>
      <div class="ks-swatches" role="radiogroup" aria-label="Farbe von ${m.name}">
        ${Object.entries(m.farben).map(([k, f]) => `<button class="ks-sw" type="button" role="radio" style="--sw:${f.sw}" data-farbe="${k}" aria-label="${f.label}" aria-checked="${k === wahl[id].farbe}"></button>`).join('')}
        <small data-label>${Object.values(m.farben)[0].label}</small>
      </div>
      <button class="ks-btn ks-btn--solid" type="button" data-anprobe="${id}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/><circle cx="12" cy="13" r="3.4" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>
        Live anprobieren
      </button>
    </div>
  </article>`).join('');

const ansichten = {};
async function initAnsicht(el, id, opt, farbe = wahl[id].farbe) {
  if (!hasWebGL) { el.innerHTML = `<p style="padding:30px;color:#5f646b">3D wird von diesem Browser nicht unterstützt.</p>`; return; }
  const { createAnsicht } = await import('../../assets/js/3d/brillen-ansicht.js');
  const a = createAnsicht(el, opt);
  await a.set(id, farbe, wahl[id].glas);
  return a;
}
// 3D gestaffelt laden: die Brille oben erst nach dem Seitenaufbau (Text und Bild sind sofort da),
// die Produktkarten erst beim Scrollen in ihre Nähe. Früher starteten mehrere 3D-Ansichten gleichzeitig beim Laden.
const startHeroStage = () => {
  const el = $('#hero-stage'); if (!el) return;
  initAnsicht(el, 'elbe', { auto: true }, 'havanna').then((a) => { ansichten.hero = a; });
};
const idle = (fn) => (window.requestIdleCallback ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 300));
if (document.readyState === 'complete') idle(startHeroStage); else addEventListener('load', () => idle(startHeroStage), { once: true });
$$('[data-stage]').forEach((el) => whenScrolledNear(el, () => {
  const id = el.dataset.stage || 'elbe';
  initAnsicht(el, id, {}).then((a) => { ansichten[id] = a; });
}, { margin: '300px 0px' }));

grid.addEventListener('click', (e) => {
  const sw = e.target.closest('[data-farbe]'); if (!sw) return;
  const card = sw.closest('[data-modell]'); const id = card.dataset.modell;
  wahl[id].farbe = sw.dataset.farbe;
  $$('[data-farbe]', card).forEach((b) => b.setAttribute('aria-checked', String(b === sw)));
  $('[data-label]', card).textContent = MODELLE[id].farben[sw.dataset.farbe].label;
  ansichten[id]?.set(id, wahl[id].farbe, wahl[id].glas);
});

// ------------------------------------------------------------------ Live-Anprobe
const tryEl = $('#try');
let anprobe = null, aktiv = 'elbe', faceTimer = 0;

function status(t) { $('#try-status').textContent = t; }

function renderControls() {
  const m = MODELLE[aktiv], w = wahl[aktiv];
  $('#try-models').innerHTML = Object.entries(MODELLE).map(([id, mm]) =>
    `<button type="button" role="radio" data-m="${id}" aria-checked="${id === aktiv}">${mm.name}</button>`).join('');
  $('#try-colors').innerHTML = Object.entries(m.farben).map(([k, f]) =>
    `<button class="ks-sw" type="button" role="radio" style="--sw:${f.sw}" data-c="${k}" aria-label="${f.label}" aria-checked="${k === w.farbe}"></button>`).join('');
  $('#try-lenses').innerHTML = m.glaeser ? m.glaeser.map((g) =>
    `<button type="button" role="radio" data-g="${g}" aria-checked="${g === w.glas}">${GLAESER[g].label}</button>`).join('') : '';
  const extra = m.glaeser && GLAESER[w.glas].preis ? ` + ${GLAESER[w.glas].label} ${euro.format(GLAESER[w.glas].preis)}` : '';
  $('#try-info').textContent = `${m.name} · ${m.farben[w.farbe].label} · ${euro.format(m.preis)}${extra}`;
}

async function applyBrille() {
  renderControls();
  await anprobe?.setBrille(aktiv, wahl[aktiv].farbe, wahl[aktiv].glas || 'klar');
}

async function openTry(id) {
  aktiv = id || aktiv;
  tryEl.hidden = false; document.body.style.overflow = 'hidden';
  renderControls();
  $('#try-close').focus();
  if (!navigator.mediaDevices?.getUserMedia || !hasWebGL) {
    status('Dieser Browser erlaubt keinen Kamerazugriff. Bitte aktuelles Chrome, Safari, Firefox oder Edge verwenden.'); return;
  }
  if (!isSecureContext) { status('Die Kamera funktioniert nur über eine sichere Verbindung (https).'); return; }
  try {
    const { Anprobe } = await import('../../assets/js/3d/brillen-ar.js');
    anprobe = new Anprobe({ canvas: $('#try-canvas'), video: $('#try-video'), onStatus: status });
    window.__anprobe = anprobe;
    await anprobe.start();
    await applyBrille();
    // Hinweis, wenn kein Gesicht im Bild
    faceTimer = setInterval(() => {
      tryEl.classList.toggle('no-face', !anprobe.gesicht);
      if (!anprobe.gesicht && $('#photo').hidden) status('Schauen Sie in die Kamera – Ihr Gesicht in den Rahmen.');
      else if (anprobe.gesicht && $('#try-status').textContent.startsWith('Schauen')) status('');
    }, 400);
  } catch (err) {
    console.warn(err);
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    status(denied ? 'Ohne Kamerafreigabe geht die Anprobe leider nicht. Sie können sie in den Browser-Einstellungen erlauben.' :
      err && err.name === 'NotFoundError' ? 'Keine Kamera gefunden.' : 'Die Anprobe konnte nicht gestartet werden.');
  }
}

function closeTry() {
  clearInterval(faceTimer);
  anprobe?.stop(); anprobe = null;
  tryEl.hidden = true; tryEl.classList.remove('no-face'); $('#photo').hidden = true; status('');
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-anprobe]'); if (b) openTry(b.dataset.anprobe);
});
$('#try-close').addEventListener('click', closeTry);
addEventListener('keydown', (e) => { if (e.key === 'Escape' && !tryEl.hidden) closeTry(); });
$('#try-models').addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) { aktiv = b.dataset.m; applyBrille(); } });
$('#try-colors').addEventListener('click', (e) => { const b = e.target.closest('[data-c]'); if (b) { wahl[aktiv].farbe = b.dataset.c; applyBrille(); } });
$('#try-lenses').addEventListener('click', (e) => { const b = e.target.closest('[data-g]'); if (b) { wahl[aktiv].glas = b.dataset.g; applyBrille(); } });
addEventListener('resize', () => anprobe?.resize());

// Foto
let fotoUrl = null, fotoBlob = null;
$('#try-shot').addEventListener('click', async () => {
  if (!anprobe?.running) return;
  const f = $('#flash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  fotoBlob = await anprobe.foto();
  if (fotoUrl) URL.revokeObjectURL(fotoUrl);
  fotoUrl = URL.createObjectURL(fotoBlob);
  $('#photo-img').src = fotoUrl; $('#photo-save').href = fotoUrl;
  const file = new File([fotoBlob], 'klarsund-anprobe.jpg', { type: 'image/jpeg' });
  $('#photo-share').hidden = !(navigator.canShare && navigator.canShare({ files: [file] }));
  $('#photo').hidden = false;
});
$('#photo-again').addEventListener('click', () => { $('#photo').hidden = true; });
$('#photo-share').addEventListener('click', async () => {
  const file = new File([fotoBlob], 'klarsund-anprobe.jpg', { type: 'image/jpeg' });
  try { await navigator.share({ files: [file], title: 'Meine Klarsund-Brille', text: `${MODELLE[aktiv].name} von Klarsund` }); } catch {}
});

// ------------------------------------------------------------------ Termin (Beispiel)
$('#form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target, note = $('#form-note');
  if (!f.checkValidity()) { note.textContent = 'Bitte Name, Kontakt und Einverständnis ausfüllen.'; f.reportValidity(); return; }
  note.textContent = 'Danke! Das ist eine Beispiel-Website – die Anfrage wurde nicht verschickt.'; f.reset();
});
