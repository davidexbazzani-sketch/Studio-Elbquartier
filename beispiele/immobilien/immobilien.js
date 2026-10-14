// Solmund – Startseite: Motion-Graphics-Film (GSAP), Navigation, Einblendungen, Anfrageformular.
const motion = document.documentElement.classList.contains('js-motion');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

function whenGsap() {
  return new Promise((res) => {
    if (window.gsap) return res(window.gsap);
    addEventListener('load', () => res(window.gsap), { once: true });
  });
}

// ------------------------------------------------------------------ Navigation
const nav = $('#nav');
const film = $('.sm-film');
new IntersectionObserver(([e]) => nav.classList.toggle('is-solid', !e.isIntersecting), { rootMargin: '-70px 0px 0px 0px' }).observe(film);

// ------------------------------------------------------------------ Formular (Beispiel, sendet nichts)
const form = $('#form');
$$('[data-objekt]').forEach((a) => a.addEventListener('click', () => { $('#form-objekt').value = a.dataset.objekt; }));
form.addEventListener('submit', (e) => {
  e.preventDefault();
  const note = $('#form-note');
  if (!form.checkValidity()) { note.textContent = 'Bitte geben Sie Name und E-Mail an und bestätigen Sie die Einwilligung.'; form.reportValidity(); return; }
  note.textContent = 'Vielen Dank. Dies ist eine Beispiel-Website – Ihre Anfrage wurde nicht versendet.';
  form.reset();
});

// ------------------------------------------------------------------ Film
const clips = $$('.sm-clip');
const videos = clips.map((c) => c.querySelector('video, img'));   // Szenen sind Filme oder Standbilder
const isVideo = (v) => v && v.tagName === 'VIDEO';
const lines = $$('.sm-line');
const chapters = $$('.sm-chapters li');
const draw = $('#draw');

// Wörter für die Typo-Animation einzeln umschließen
lines.forEach((l) => l.querySelectorAll('span').forEach((s) => {
  s.innerHTML = s.textContent.split(' ').map((w) => `<span class="w">${w}</span>`).join(' ');
}));

let current = 0;
function playClip(i) {
  current = i;
  videos.forEach((v, k) => { if (k !== i && k !== i - 1 && isVideo(v) && !v.paused) v.pause(); });
  const v = videos[i];
  if (!isVideo(v)) return;
  if (v.preload !== 'auto') { v.preload = 'auto'; v.load(); }
  try { v.currentTime = 0; } catch {}
  v.play().catch(() => {});
}
function preload(i) { const v = videos[i]; if (isVideo(v) && v.preload !== 'auto') { v.preload = 'auto'; v.load(); } }

// Fensterrechteck der Zeichnung in Bildschirmkoordinaten (viewBox 1200×700, „slice“)
function fitDrawing() {
  // Hochformat: ganze Zeichnung zeigen (meet), Querformat: bildfüllend (slice)
  draw.setAttribute('preserveAspectRatio', innerWidth < innerHeight ? 'xMidYMid meet' : 'xMidYMid slice');
}
fitDrawing(); addEventListener('resize', fitDrawing);
function windowInset(x, y, w, h) {
  const r = draw.getBoundingClientRect();
  const meet = draw.getAttribute('preserveAspectRatio').includes('meet');
  const s = (meet ? Math.min : Math.max)(r.width / 1200, r.height / 700);
  const ox = (r.width - 1200 * s) / 2, oy = (r.height - 700 * s) / 2;
  const L = ox + x * s, T = oy + y * s, R = r.width - (L + w * s), B = r.height - (T + h * s);
  return `inset(${T}px ${R}px ${B}px ${L}px round 0px)`;
}

async function startFilm() {
  const gsap = await whenGsap();
  if (!gsap) return;
  const shade = $('.sm-film__shade');
  const brand = $('#brand');
  const letters = $$('.sm-brand__letters span');
  const paths = $$('.sm-draw__lines path, .sm-draw__sun');
  paths.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });
  const markParts = $$('.sm-brand__mark path');
  markParts.forEach((p) => { const L = p.getTotalLength(); p.style.strokeDasharray = L; p.style.strokeDashoffset = L; });

  const chap = (i, dur) => gsap.fromTo(chapters[i], { '--p': 0 }, { '--p': 1, duration: dur, ease: 'none' });
  const wordsIn = (l) => gsap.fromTo(l.querySelectorAll('.w'), { yPercent: 110, opacity: 0 },
    { yPercent: 0, opacity: 1, duration: 1.3, ease: 'expo.out', stagger: 0.08 });
  const wordsOut = (l) => gsap.to(l.querySelectorAll('.w'), { yPercent: -60, opacity: 0, duration: 0.9, ease: 'power2.in', stagger: 0.04 });
  const kenBurns = (i, d) => gsap.fromTo(videos[i], { scale: 1.1 }, { scale: 1.0, duration: d, ease: 'none' });

  const tl = gsap.timeline({ repeat: -1, repeatDelay: 0, defaults: { ease: 'power3.inOut' } });
  tl.addLabel('start')
    .set(clips, { clipPath: 'inset(0px 0px 100% 0px round 0px)', zIndex: (i) => i })
    .set(draw, { opacity: 1, scale: 1, transformOrigin: '50% 60%' })
    .set(shade, { opacity: 0 })
    .set(brand, { opacity: 0, pointerEvents: 'none' })
    .set(chapters, { '--p': 0 })
    .set(paths, { strokeDashoffset: (i, el) => el.style.strokeDasharray })
    .call(() => { nav.classList.add('on-light'); film.classList.add('on-light'); }, null, 0)
    .call(() => { nav.classList.remove('on-light'); film.classList.remove('on-light'); }, null, 3.9)
    // Prolog: die Zeichnung entsteht
    .to(paths, { strokeDashoffset: 0, duration: 2.4, ease: 'power2.inOut', stagger: 0.07 }, 0.2)
    // Szene 1: Licht im großen Fenster
    .call(() => playClip(0), null, 2.3)
    .fromTo(clips[0], { clipPath: () => windowInset(560, 545, 260, 0) }, { clipPath: () => windowInset(560, 380, 260, 165), duration: 1.1 }, 2.3)
    .to(clips[0], { clipPath: 'inset(0px 0px 0px 0px round 0px)', duration: 1.6, ease: 'expo.inOut' }, 3.5)
    .to(draw, { opacity: 0, scale: 1.12, duration: 1.4, ease: 'power2.in' }, 3.5)
    .add(kenBurns(0, 7), 2.3)
    .to(shade, { opacity: 1, duration: 1.5 }, 3.8)
    .add(chap(0, 5.6), 2.3)
    .add(wordsIn(lines[0]), 4.4)
    .add(wordsOut(lines[0]), 7.4)
    .call(() => preload(1), null, 4)
    // Szene 2: Bogenfenster öffnet sich
    .call(() => playClip(1), null, 7.9)
    .fromTo(clips[1], { clipPath: 'inset(32% 40% 0% 40% round 50vw 50vw 0vw 0vw)' }, { clipPath: 'inset(0% 0% 0% 0% round 0vw 0vw 0vw 0vw)', duration: 1.9, ease: 'expo.inOut' }, 7.9)
    .add(kenBurns(1, 6.5), 7.9)
    .add(chap(1, 5.1), 7.9)
    .add(wordsIn(lines[1]), 9.0)
    .add(wordsOut(lines[1]), 12.2)
    .call(() => preload(2), null, 9)
    // Szene 3: Schiebetüren gleiten auf – die Elbe am Morgen
    .call(() => playClip(2), null, 12.7)
    .fromTo(clips[2], { clipPath: 'inset(0% 50% 0% 50% round 0px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.7, ease: 'expo.inOut' }, 12.7)
    .add(kenBurns(2, 6.5), 12.7)
    .add(chap(2, 5.1), 12.7)
    .add(wordsIn(lines[2]), 13.8)
    .add(wordsOut(lines[2]), 17.0)
    .call(() => preload(3), null, 14)
    // Szene 4: die Sonne öffnet den Abend
    .call(() => playClip(3), null, 17.5)
    .fromTo(clips[3], { clipPath: 'circle(0% at 72% 36%)' }, { clipPath: 'circle(142% at 72% 36%)', duration: 2.2, ease: 'expo.in' }, 17.5)
    .add(kenBurns(3, 7.5), 17.5)
    .add(chap(3, 5.6), 17.5)
    .add(wordsIn(lines[3]), 18.9)
    .add(wordsOut(lines[3]), 22.4)
    .call(() => preload(4), null, 19)
    // Finale: Vorhang, die Marke setzt sich zusammen
    .call(() => playClip(4), null, 22.9)
    .fromTo(clips[4], { clipPath: 'inset(100% 0% 0% 0% round 0px)' }, { clipPath: 'inset(0% 0% 0% 0% round 0px)', duration: 1.6, ease: 'expo.inOut' }, 22.9)
    .add(kenBurns(4, 14), 22.9)
    .to(shade, { opacity: 1, duration: 1 }, 22.9)
    .fromTo(videos[4], { filter: 'brightness(1) saturate(1)' }, { filter: 'brightness(0.62) saturate(0.85)', duration: 2.2, ease: 'power2.inOut' }, 23.2)
    .add(chap(4, 13.5), 22.9)
    .set(brand, { opacity: 1, pointerEvents: 'auto' }, 23.6)
    .fromTo(markParts[0], { strokeDashoffset: (i, el) => el.style.strokeDasharray }, { strokeDashoffset: 0, duration: 1.6, ease: 'power2.inOut' }, 23.7)
    .fromTo(markParts.slice(1), { strokeDashoffset: (i, el) => el.style.strokeDasharray }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.out', stagger: 0.18 }, 24.3)
    .fromTo(letters, { opacity: 0, y: 30, filter: 'blur(8px)', x: (i) => (i - 3) * 16 },
      { opacity: 1, y: 0, filter: 'blur(0px)', x: 0, duration: 1.8, ease: 'expo.out', stagger: { each: 0.07, from: 'center' } }, 24.6)
    .fromTo('.sm-brand__sub', { opacity: 0, y: 12 }, { opacity: 0.85, y: 0, duration: 1.2, ease: 'power2.out' }, 25.8)
    .fromTo('.sm-brand__cta', { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power2.out' }, 26.3)
    // Halten, dann sanft zurück zum Anfang
    .to([brand, shade], { opacity: 0, duration: 1.4, ease: 'power2.inOut' }, 35.0)
    .to(clips[4], { clipPath: 'inset(0px 0px 100% 0px round 0px)', duration: 1.4, ease: 'power2.inOut' }, 35.2)
    .set({}, {}, 36.6);

  // Anhalten / Weiter
  const btn = $('#film-toggle');
  let manualPause = false;
  const setPaused = (p) => {
    p ? tl.pause() : tl.resume();
    videos.forEach((v) => { if (isVideo(v) && !v.paused && p) v.pause(); });
    if (!p && isVideo(videos[current])) videos[current].play().catch(() => {});
  };
  btn.addEventListener('click', () => {
    manualPause = !manualPause; setPaused(manualPause);
    btn.setAttribute('aria-pressed', String(manualPause));
  });
  // Wer per Tastatur zu den Knöpfen im Film springt, bekommt das ruhige Schlussbild
  $('.sm-brand__cta').addEventListener('focusin', () => {
    manualPause = true; tl.pause(); tl.seek(30); btn.setAttribute('aria-pressed', 'true'); videos[4].play().catch(() => {});
  });
  // Nur laufen lassen, wenn sichtbar
  new IntersectionObserver(([e]) => { if (!manualPause) setPaused(!e.isIntersecting); }, { threshold: 0.15 }).observe(film);
  document.addEventListener('visibilitychange', () => { if (!manualPause) setPaused(document.hidden); });
  addEventListener('resize', () => tl.invalidate());
  window.__film = tl;
}

// ------------------------------------------------------------------ Scroll-Effekte
async function scrollFx() {
  const gsap = await whenGsap();
  if (!gsap || !window.ScrollTrigger) return;
  gsap.registerPlugin(window.ScrollTrigger);
  $$('.sm-reveal, .sm-obj, .sm-section-head, .sm-zahlen div').forEach((el) => {
    gsap.fromTo(el, { opacity: 0, y: 30 }, { opacity: 1, y: 0, duration: 1.2, ease: 'power3.out',
      scrollTrigger: { trigger: el, start: 'top 86%', once: true } });
  });
  const img = $('.sm-tour__media img');
  gsap.fromTo(img, { yPercent: -8 }, { yPercent: 0, ease: 'none', scrollTrigger: { trigger: '.sm-tour', start: 'top bottom', end: 'bottom top', scrub: true } });
}

if (motion) { videos[0].preload = 'auto'; startFilm(); scrollFx(); }
else {
  // Ruhige Fassung: Schlussbild mit Marke
  const v = videos[4]; if (v) { v.removeAttribute('src'); v.load(); }
  $('#brand').style.opacity = 1;
}
