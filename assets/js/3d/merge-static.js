// Fasst ruhende Teile einer Szene zusammen, damit Handys weniger Zeichenbefehle abarbeiten müssen.
// Kinder einer Gruppe mit gleichem Material (und gleichen Schatten-Einstellungen) werden zu einem Mesh
// verschmolzen. Untergruppen ohne eigene Rolle werden vorher in ihre Elterngruppe eingerechnet.
// Unangetastet bleiben alles, was in userData einer Gruppe referenziert ist (wird animiert oder
// abgefragt), Objekte mit eigenem userData und die Wurzel selbst (Position, Drehung, Raycast bleiben gleich).

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

function referenced(root) {
  const set = new Set();
  root.traverse((o) => {
    for (const v of Object.values(o.userData)) {
      if (v?.isObject3D) set.add(v);
      else if (Array.isArray(v)) v.forEach((x) => x?.isObject3D && set.add(x));
    }
  });
  return set;
}

const keep = (o, refs) => refs.has(o) || Object.keys(o.userData).length > 0;

/** Gleiche Materialien (z. B. mehrfach angelegtes Weiß mit gleicher Rauheit) zu einem Objekt machen. */
const PROPS = ['roughness', 'metalness', 'emissiveIntensity', 'opacity', 'transparent', 'side', 'depthWrite', 'flatShading',
  'vertexColors', 'envMapIntensity', 'clearcoat', 'clearcoatRoughness', 'transmission', 'thickness', 'ior', 'sheen',
  'sheenRoughness', 'specularIntensity', 'iridescence', 'alphaTest', 'toneMapped', 'fog', 'wireframe'];
const COLORS = ['color', 'emissive', 'sheenColor', 'specularColor', 'attenuationColor'];
const MAPS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'alphaMap', 'aoMap', 'bumpMap', 'envMap', 'lightMap'];
const SHAREABLE = new Set(['MeshStandardMaterial', 'MeshPhysicalMaterial', 'MeshBasicMaterial', 'MeshLambertMaterial']);

function materialKey(m) {
  // nur bekannte, einfache Materialtypen zusammenlegen; alles andere bleibt für sich
  if (!SHAREABLE.has(m.type) || m.onBeforeCompile !== THREE.Material.prototype.onBeforeCompile || m.userData && Object.keys(m.userData).length) return m.uuid;
  const parts = [m.type];
  for (const p of PROPS) if (p in m) parts.push(m[p]);
  for (const c of COLORS) if (m[c]?.isColor) parts.push(m[c].getHexString());
  for (const t of MAPS) parts.push(m[t]?.uuid ?? '');
  return parts.join('|');
}

/** Untergruppen ohne Rolle in die Elterngruppe einrechnen (Matrizen einbacken). */
function flatten(group, refs) {
  for (const child of [...group.children]) {
    if (!child.isGroup || keep(child, refs)) continue;
    flatten(child, refs);
    child.updateMatrix();
    for (const g of [...child.children]) {
      g.updateMatrix();
      g.matrix.premultiply(child.matrix);
      g.matrix.decompose(g.position, g.quaternion, g.scale);
      group.add(g);
    }
    group.remove(child);
  }
}

export function mergeStatic(root, { shareMaterials = new Map() } = {}) {
  const refs = referenced(root);
  let before = 0, after = 0;

  const visit = (group) => {
    flatten(group, refs);
    const buckets = new Map();
    for (const child of group.children) {
      if (child.isGroup || child.children.length) { visit(child); continue; }
      if (!child.isMesh || keep(child, refs) || Array.isArray(child.material)) continue;
      const key = materialKey(child.material);
      if (!shareMaterials.has(key)) shareMaterials.set(key, child.material);
      child.material = shareMaterials.get(key);
      const g = child.geometry;
      const sig = [key, child.castShadow, child.receiveShadow, g.index ? 'i' : 'n', Object.keys(g.attributes).sort().join()].join('|');
      if (!buckets.has(sig)) buckets.set(sig, []);
      buckets.get(sig).push(child);
    }
    for (const list of buckets.values()) {
      before += list.length;
      if (list.length < 2) { after += 1; continue; }
      const geos = list.map((m) => { m.updateMatrix(); return m.geometry.clone().applyMatrix4(m.matrix); });
      const merged = mergeGeometries(geos, false);
      geos.forEach((g) => g.dispose());
      if (!merged) { after += list.length; continue; }
      const first = list[0];
      const mesh = new THREE.Mesh(merged, first.material);
      mesh.castShadow = first.castShadow;
      mesh.receiveShadow = first.receiveShadow;
      list.forEach((m) => group.remove(m));
      group.add(mesh);
      after += 1;
    }
  };
  visit(root);
  return { before, after };
}
