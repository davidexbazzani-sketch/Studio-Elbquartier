// Seite „3D-Rundgang“: Laden, Start, Steuerung (Maus/Tastatur, Touch), Grundriss.
import { Rundgang } from '../../assets/js/3d/rundgang.js';
import * as THREE from 'three';

const $ = (s) => document.querySelector(s);
const canvas = $('#rg-canvas');
const touch = matchMedia('(pointer: coarse)').matches;
document.body.classList.toggle('rg--touch', touch);
const params = new URLSearchParams(location.search);
const lite = params.has('lite') || (touch && Math.min(screen.width, screen.height) < 500);

// Ohne WebGL 2 kein Rundgang – freundlich erklären
if (!document.createElement('canvas').getContext('webgl2')) {
  $('#rg-load-text').textContent = 'Dieser Browser kann den 3D-Rundgang leider nicht darstellen. Gern zeigen wir Ihnen die Wohnung persönlich.';
  $('.rg-load').hidden = true;
  $('#rg-go').outerHTML = '<a class="sm-btn sm-btn--light" href="index.html#kontakt">Besichtigung anfragen</a>';
  throw new Error('kein WebGL2');
}

const rg = new Rundgang(canvas, {
  base: '../../assets/wohnung/',
  lite,
  onProgress: (p) => {
    $('#rg-bar').style.transform = `scaleX(${p})`;
    $('.rg-load').setAttribute('aria-valuenow', Math.round(p * 100));
  },
  onRoom: (r) => showRoom(r),
});
window.__rg = rg;   // für Tests

// ------------------------------------------------------------------ Laden
let ready = false;
rg.load().then(() => {
  ready = true;
  $('#rg-load-text').textContent = 'Die Wohnung ist bereit.';
  $('#rg-go').disabled = false;
  buildRooms(); buildPlan();
  // Hintergrund schon zeigen (Standbild), noch ohne Steuerung
  rg.resize(); rg.update(0); rg.render();
  document.body.classList.add('rg--ready');
  if (params.has('auto')) begin();
}).catch((e) => {
  console.error(e);
  $('#rg-load-text').textContent = 'Der Rundgang konnte nicht geladen werden. Bitte laden Sie die Seite neu.';
});

addEventListener('resize', () => { rg.resize(); if (!rg.running && ready) rg.render(); });

// ------------------------------------------------------------------ Start / Pause
function begin() {
  $('#rg-start').classList.add('is-hidden');
  $('#rg-hud').hidden = false;
  rg.start();
  if (!touch && !params.has('auto')) lock();
}
$('#rg-go').addEventListener('click', begin);

function lock() { canvas.requestPointerLock?.({ unadjustedMovement: false })?.catch?.(() => {}); }
let paused = false, wasLocked = false;
function pause() {
  if (paused) return;
  paused = true; rg.keys.clear(); rg.move.set(0, 0); rg.stop();
  $('#rg-pause').hidden = false; $('#rg-weiter').focus();
}
function resume() {
  paused = false; $('#rg-pause').hidden = true; rg.start();
  if (!touch && !params.has('auto')) lock(); else canvas.focus?.();
}
document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && wasLocked && rg.running && !touch) pause();
  if (locked) { wasLocked = true; }
});
$('#rg-weiter').addEventListener('click', resume);
canvas.addEventListener('click', () => { if (!touch && rg.running && document.pointerLockElement !== canvas) lock(); });

// ------------------------------------------------------------------ Tastatur + Maus
const KEYS = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
addEventListener('keydown', (e) => {
  if (e.code === 'Escape' && $('#rg-hud').hidden === false && document.pointerLockElement !== canvas) {
    paused ? resume() : pause(); e.preventDefault(); return;
  }
  if (!rg.running || paused) return;
  if (KEYS.includes(e.code)) { rg.keys.add(e.code); e.preventDefault(); }
});
addEventListener('keyup', (e) => rg.keys.delete(e.code));
addEventListener('blur', () => rg.keys.clear());
const SENS = 0.0022;
document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  // Ausreißer mancher Browser beim Sperren abfangen
  if (Math.abs(e.movementX) > 300 || Math.abs(e.movementY) > 300) return;
  rg.look(e.movementX * SENS, e.movementY * SENS);
});

// ------------------------------------------------------------------ Touch: Joystick links, Blick rechts, Tippen = hingehen
const stick = $('#rg-stick'), knob = stick.querySelector('.rg-stick__knob');
const pointers = new Map();
canvas.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse') return;
  try { canvas.setPointerCapture(e.pointerId); } catch {}
  const left = e.clientX < innerWidth * 0.42;
  const p = { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), kind: left ? 'move' : 'look', moved: 0 };
  pointers.set(e.pointerId, p);
  if (left) {
    stick.style.left = `${e.clientX}px`; stick.style.top = `${e.clientY}px`; stick.classList.add('is-on');
  }
});
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  p.moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY;
  if (p.kind === 'look') rg.look(dx * 0.0042, dy * 0.0042);
  else {
    const R = 52;
    let ox = e.clientX - p.sx, oy = e.clientY - p.sy; const L = Math.hypot(ox, oy);
    if (L > R) { ox *= R / L; oy *= R / L; }
    knob.style.transform = `translate(${ox}px, ${oy}px)`;
    const dead = 0.12;
    const mx = ox / R, my = -oy / R;
    rg.move.set(Math.abs(mx) < dead ? 0 : mx, Math.abs(my) < dead ? 0 : my);
  }
});
function endPointer(e) {
  const p = pointers.get(e.pointerId); if (!p) return;
  pointers.delete(e.pointerId);
  if (p.kind === 'move') { rg.move.set(0, 0); stick.classList.remove('is-on'); knob.style.transform = ''; }
  else if (p.moved < 10 && performance.now() - p.t < 350) tapWalk(e.clientX, e.clientY);
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);

// Auf einen Punkt am Boden tippen → dorthin gehen
const ray = new THREE.Raycaster();
function tapWalk(cx, cy) {
  if (!rg.running) return;
  const ndc = new THREE.Vector2(cx / innerWidth * 2 - 1, -(cy / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, rg.camera);
  const d = ray.ray.direction;
  if (d.y > -0.02) return;
  const t = -ray.ray.origin.y / d.y;
  const hit = ray.ray.origin.clone().addScaledVector(d, t);
  if (hit.distanceTo(rg.pos) > 14) return;
  // nicht in Möbel/Wände: nächster freier Punkt entlang des Strahls
  const target = hit.clone();
  for (let i = 0; i < 30 && !rg.free(target.x, target.z); i++) target.lerp(rg.pos, 0.08);
  if (rg.free(target.x, target.z)) rg.autoTarget = target;
}

// ------------------------------------------------------------------ Räume
const ROOM_INFO = {
  Wohnen: 'Wohnen & Essen · 54 m²', Küche: 'Küche · 21 m²', Diele: 'Diele · 14 m²', Flur: 'Flur',
  Schlafen: 'Schlafzimmer · 35 m²', Arbeiten: 'Arbeitszimmer · 15 m²', Balkon: 'Balkon zur Elbe · 18 m²',
};
let roomTimer;
function showRoom(r) {
  const el = $('#rg-room');
  if (!r) { el.classList.remove('is-on'); return; }
  el.textContent = ROOM_INFO[r] || r; el.classList.add('is-on');
  clearTimeout(roomTimer); roomTimer = setTimeout(() => el.classList.remove('is-on'), 3200);
  document.querySelectorAll('.rg-rooms button').forEach((b) => {
    const on = b.dataset.room === r; b.classList.toggle('is-active', on);
    on ? b.setAttribute('aria-current', 'true') : b.removeAttribute('aria-current');
  });
}

function buildRooms() {
  const nav = $('#rg-rooms');
  for (const [k, v] of Object.entries(rg.meta.ziele)) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = k; b.dataset.room = k;
    b.addEventListener('click', (e) => { e.stopPropagation(); glide(v); });
    b.setAttribute('aria-label', `Zum Raum ${k} gehen`);
    nav.append(b);
  }
}

// Sanft zu einem Raum gleiten (Kamera fährt mit, kein Sprung)
function glide([x, y, yawDeg]) {
  const from = rg.pos.clone(), to = new THREE.Vector3(x, 0, -y);
  const y0 = rg.tYaw; let y1 = yawDeg * Math.PI / 180;
  while (y1 - y0 > Math.PI) y1 -= Math.PI * 2;
  while (y1 - y0 < -Math.PI) y1 += Math.PI * 2;
  const dur = Math.min(3.2, 0.9 + from.distanceTo(to) * 0.22);
  const t0 = performance.now();
  rg.autoTarget = null; rg.gliding = true;
  const step = () => {
    const t = Math.min(1, (performance.now() - t0) / (dur * 1000));
    const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    rg.pos.lerpVectors(from, to, e);
    rg.tYaw = y0 + (y1 - y0) * e; rg.tPitch *= 0.9;
    if (t < 1) requestAnimationFrame(step); else rg.gliding = false;
  };
  step();
}

// ------------------------------------------------------------------ Grundriss
function buildPlan() {
  const svg = $('#rg-plan-svg');
  const ns = 'http://www.w3.org/2000/svg';
  const g = document.createElementNS(ns, 'g'); g.setAttribute('transform', 'scale(1,-1) translate(0,-8.2)');
  // Räume als Flächen (Blender-Koordinaten; y nach oben gespiegelt)
  for (const [k, r] of Object.entries(rg.meta.raeume)) {
    const rect = document.createElementNS(ns, 'rect');
    rect.setAttribute('x', r[0]); rect.setAttribute('y', r[2]); rect.setAttribute('width', r[1] - r[0]); rect.setAttribute('height', r[3] - r[2]);
    rect.setAttribute('class', 'rg-plan__room' + (k === 'Balkon' ? ' rg-plan__room--out' : ''));
    g.append(rect);
  }
  const me = document.createElementNS(ns, 'g'); me.setAttribute('class', 'rg-plan__me');
  const cone = document.createElementNS(ns, 'path'); cone.setAttribute('d', 'M0 0 L-1.1 2.2 A2.4 2.4 0 0 0 1.1 2.2 Z');
  const dot = document.createElementNS(ns, 'circle'); dot.setAttribute('r', 0.32);
  me.append(cone, dot); g.append(me);
  svg.append(g);
  const upd = () => {
    if (rg.running || ready) {
      const x = rg.pos.x, y = -rg.pos.z;
      me.setAttribute('transform', `translate(${x} ${y}) rotate(${rg.yaw * 180 / Math.PI})`);
    }
    requestAnimationFrame(upd);
  };
  upd();
  $('#rg-plan-btn').addEventListener('click', () => {
    const open = $('#rg-plan').classList.toggle('is-closed');
    $('#rg-plan-btn').setAttribute('aria-expanded', String(!open));
  });
  if (touch && innerWidth < 700) { $('#rg-plan').classList.add('is-closed'); $('#rg-plan-btn').setAttribute('aria-expanded', 'false'); }
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) rg.stop(); else if (ready && !$('#rg-hud').hidden) rg.start();
});
