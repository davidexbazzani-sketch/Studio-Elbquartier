// Gezeichneter Strauß (SVG): Ersatzansicht ohne 3D und Symbole für die Blumenliste.
// Nutzt dieselbe Anordnung wie der 3D-Strauß (bouquet-layout.js).

import { layoutBouquet } from '../../assets/js/bouquet-layout.js';

const NS = 'http://www.w3.org/2000/svg';

function mix(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
  const c = [16, 8, 0].map((s) => Math.round(((pa >> s) & 255) * (1 - t) + ((pb >> s) & 255) * t));
  return `#${c.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// ---------- Blüten-Symbole (Mittelpunkt 0,0, Radius ca. 24) ----------

export const GLYPHS = {
  rose: ({ base, tip }) => {
    const mid = mix(tip, base, 0.4);
    return `<circle r="21" fill="${tip}"/>
      ${[0, 72, 144, 216, 288].map((a) => `<ellipse rx="12.5" ry="8.5" transform="rotate(${a + 18}) translate(0 -11)" fill="${mid}"/>`).join('')}
      <circle r="11.5" fill="${base}"/>
      <path d="M-4 2a4.5 4.5 0 1 1 6 3.4M-8.5-1a8.5 8.5 0 0 1 15.5-3.5" fill="none" stroke="${tip}" stroke-width="1.7" stroke-linecap="round"/>`;
  },
  peony: ({ base, tip }) => {
    const outer = Array.from({ length: 13 }, (_, i) => {
      const a = (i / 13) * Math.PI * 2;
      return `<circle cx="${(Math.cos(a) * 16).toFixed(1)}" cy="${(Math.sin(a) * 16).toFixed(1)}" r="9" fill="${tip}"/>`;
    }).join('');
    const inner = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.3;
      return `<circle cx="${(Math.cos(a) * 8).toFixed(1)}" cy="${(Math.sin(a) * 8).toFixed(1)}" r="7" fill="${mix(tip, base, 0.45)}"/>`;
    }).join('');
    return `${outer}<circle r="17" fill="${tip}"/>${inner}<circle r="6" fill="${base}"/>`;
  },
  tulip: ({ base, tip }) => `
      <path d="M-13 -2C-16-14-10-22-3-23C-6-14-6-6-2 6C-8 6-12 4-13-2Z" fill="${mix(base, tip, 0.25)}"/>
      <path d="M13 -2C16-14 10-22 3-23C6-14 6-6 2 6C8 6 12 4 13-2Z" fill="${mix(base, tip, 0.25)}"/>
      <path d="M-9 4C-12-8-6-21 0-25C6-21 12-8 9 4C5 9-5 9-9 4Z" fill="${base}"/>
      <path d="M-3-14C-2-19 1-21 2-21" fill="none" stroke="${tip}" stroke-width="1.6" stroke-linecap="round"/>`,
  eucalyptus: () => {
    const tints = ['#8ea89a', '#7f9b8d', '#9db3a6', '#86a093'];
    const leaves = Array.from({ length: 8 }, (_, i) => {
      const y = 14 - i * 5.2, side = i % 2 ? 1 : -1, r = 6.2 - i * 0.35;
      return `<circle cx="${side * (r + 0.6)}" cy="${y}" r="${r.toFixed(1)}" fill="${tints[i % 4]}"/>`;
    }).join('');
    return `<path d="M0 22C1 6-1-10 2-26" fill="none" stroke="#6f7f62" stroke-width="1.4"/>${leaves}`;
  },
  gypsophila: () => {
    const dots = [[-12, -8], [-8, -14], [-2, -18], [5, -16], [11, -10], [14, -3], [-15, -1], [-6, -6], [3, -9], [8, -4], [-1, -2], [-10, 2], [12, 4], [4, 0]]
      .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 2.6 : 3.2}" fill="${i % 4 ? '#fbfaf5' : '#ece5d6'}"/>`).join('');
    return `<path d="M0 22L0 4M0 4L-9-6M0 4L8-5M0 4L2-12" fill="none" stroke="#7d9566" stroke-width="1"/>${dots}`;
  },
  lavender: () => {
    const buds = Array.from({ length: 10 }, (_, i) => {
      const y = -2 - i * 2.6, w = 3.6 - i * 0.18;
      return `<ellipse cx="${i % 2 ? 1.6 : -1.6}" cy="${y}" rx="${w.toFixed(1)}" ry="2.4" fill="${['#8d7bc4', '#7b68b3', '#9a8ace'][i % 3]}"/>`;
    }).join('');
    return `<path d="M0 24L0 0" stroke="#7f9070" stroke-width="1.3"/>${buds}`;
  },
};

export function icon(type, palette) {
  return `<svg viewBox="-28 -28 56 56" aria-hidden="true">${GLYPHS[type](palette)}</svg>`;
}

// ---------- ganzer Strauß ----------

const SIZE = { peony: 1.8, rose: 1.45, tulip: 1.45, eucalyptus: 1.5, gypsophila: 1.45, lavender: 1.45 };
const ROTATES = new Set(['eucalyptus', 'gypsophila', 'lavender', 'tulip']);
const PAPER = { kraft: ['#cfa67c', '#b88c62'], creme: ['#f5ede1', '#e5dccd'], rose: ['#f1d6cf', '#e1bfb6'] };
const RIBBON = { salbei: '#8fa387', rose: '#dca59d', creme: '#e9dcc7', bordeaux: '#7c2a3a' };

export function createFlatBouquet(host, { reducedMotion = false } = {}) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 400 440');
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  svg.innerHTML = `
    <defs>
      <linearGradient id="bk-paper-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfa67c"/><stop offset="1" stop-color="#b88c62"/></linearGradient>
      <linearGradient id="bk-paper-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#d8b28a"/><stop offset="1" stop-color="#bf9469"/></linearGradient>
    </defs>
    <ellipse cx="200" cy="420" rx="110" ry="10" fill="#3c3223" opacity=".08"/>
    <g class="stems-low" stroke="#6f8a58" stroke-width="2.4" stroke-linecap="round"></g>
    <path class="paper-back" fill="url(#bk-paper-back)"/>
    <g class="stems-high" stroke="#6f8a58" stroke-width="2" stroke-linecap="round" opacity=".9"></g>
    <g class="heads"></g>
    <path class="paper-front" fill="url(#bk-paper-front)"/>
    <g class="ribbon"></g>`;
  host.appendChild(svg);
  const $ = (s) => svg.querySelector(s);
  const nodes = new Map();
  const S = 170, OX = 200, OY = 318, PITCH = 0.34;
  const cp = Math.cos(PITCH), sp = Math.sin(PITCH);
  const tr = reducedMotion ? 'none' : 'transform 700ms cubic-bezier(.22,1,.36,1), opacity 500ms';

  function set({ stems, paperStyle = 'kraft', ribbonColor = 'salbei' }) {
    const { slots, cap } = layoutBouquet(stems);
    const w = 0.72 + (cap - 0.4) * 0.6;

    // Papier
    const [c1, c2] = PAPER[paperStyle] || PAPER.kraft;
    svg.querySelector('#bk-paper-back').innerHTML = `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>`;
    svg.querySelector('#bk-paper-front').innerHTML = `<stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/>`;
    const bw = 150 * w, fw = 120 * w;
    $('.paper-back').setAttribute('d', `M${OX - bw} 196 Q${OX - bw * 0.4} 160 ${OX} 174 Q${OX + bw * 0.45} 156 ${OX + bw} 192 L${OX + 24} 352 L${OX - 24} 352 Z`);
    $('.paper-front').setAttribute('d', `M${OX - fw} 274 Q${OX - fw * 0.3} 256 ${OX} 268 Q${OX + fw * 0.4} 254 ${OX + fw} 272 L${OX + 26} 356 L${OX - 26} 356 Z`);
    const rc = RIBBON[ribbonColor] || RIBBON.salbei;
    $('.ribbon').innerHTML = `
      <rect x="${OX - 30}" y="326" width="60" height="9" rx="3" fill="${rc}"/>
      <ellipse cx="${OX - 17}" cy="324" rx="16" ry="8" transform="rotate(-18 ${OX - 17} 324)" fill="none" stroke="${rc}" stroke-width="5"/>
      <ellipse cx="${OX + 17}" cy="324" rx="16" ry="8" transform="rotate(18 ${OX + 17} 324)" fill="none" stroke="${rc}" stroke-width="5"/>
      <path d="M${OX - 2} 332 q-8 26-2 52 M${OX + 2} 332 q10 24 6 50" fill="none" stroke="${rc}" stroke-width="5" stroke-linecap="round"/>
      <circle cx="${OX}" cy="330" r="5" fill="${rc}"/>`;

    // Stiele unterhalb der Bindung
    $('.stems-low').innerHTML = Array.from({ length: Math.min(stems.length, 14) }, (_, i) => {
      const t = stems.length > 1 ? i / (Math.min(stems.length, 14) - 1) - 0.5 : 0;
      return `<line x1="${OX + t * 26}" y1="350" x2="${OX + t * 70}" y2="${408 - Math.abs(t) * 20}"/>`;
    }).join('');

    // Köpfe
    const placed = stems.map((s) => {
      const sl = slots.get(s.id);
      const [dx, dy, dz] = sl.dir;
      const x = dx * sl.reach, y = dy * sl.reach, z = dz * sl.reach;
      return {
        s, sx: OX + x * S, sy: OY - (y * cp - z * sp) * S, depth: z * cp + y * sp,
        rot: (Math.atan2(dx, dy) * 180) / Math.PI,
      };
    }).sort((a, b) => a.depth - b.depth);

    const high = [];
    const alive = new Set();
    for (const p of placed) {
      alive.add(p.s.id);
      let g = nodes.get(p.s.id);
      if (!g || g.dataset.key !== p.s.key) {
        g?.remove();
        g = document.createElementNS(NS, 'g');
        g.dataset.key = p.s.key;
        g.innerHTML = GLYPHS[p.s.type](p.s.palette || {});
        g.style.transition = tr;
        g.style.transform = `translate(${OX}px, ${OY}px) scale(0.01)`;
        nodes.set(p.s.id, g);
      }
      $('.heads').appendChild(g); // Reihenfolge = Tiefe
      const sc = SIZE[p.s.type] * (0.9 + p.depth * 0.2);
      const rot = ROTATES.has(p.s.type) ? p.rot : 0;
      requestAnimationFrame(() => { g.style.transform = `translate(${p.sx}px, ${p.sy}px) rotate(${rot}deg) scale(${sc})`; g.style.opacity = '1'; });
      high.push(`<line x1="${OX}" y1="${OY + 40}" x2="${p.sx}" y2="${p.sy + 10}"/>`);
    }
    for (const [id, g] of nodes) {
      if (alive.has(id)) continue;
      nodes.delete(id);
      g.style.transform = `translate(${OX}px, ${OY}px) scale(0.01)`;
      g.style.opacity = '0';
      setTimeout(() => g.remove(), reducedMotion ? 0 : 600);
    }
    $('.stems-high').innerHTML = high.join('');
  }

  return { set, svg };
}
