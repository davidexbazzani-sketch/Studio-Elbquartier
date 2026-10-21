// PMREM-Shader (Lichtumgebung für glänzende Materialien) im Hintergrund übersetzen lassen.
// three.js übersetzt sie sonst beim ersten fromEquirectangular/fromScene und wartet synchron auf das Ergebnis.
// Unter ANGLE (Windows, viele Android-Geräte) blockiert das die Seite mehrere hundert Millisekunden.
// Mit KHR_parallel_shader_compile starten wir die Übersetzung vorab und warten ohne Blockieren.
// Nutzt interne Felder des mitgelieferten three r186 (assets/vendor/three), daher bewusst defensiv.

/**
 * @param {THREE.WebGLRenderer} renderer
 * @param {THREE.PMREMGenerator} pmrem
 * @param {number} size  Würfelgröße wie in three: Equirect-Breite / 4, bei fromScene 256
 * @returns {Promise<THREE.WebGLRenderTarget|null>} vorbereitetes Ziel für fromEquirectangular(tex, ziel)
 */
export async function warmPMREM(renderer, pmrem, size, { equirect = true, timeout = 5000 } = {}) {
  try {
    if (!renderer.extensions.has('KHR_parallel_shader_compile')) return null;
    pmrem._setSize(size);
    const target = pmrem._allocateTargets();
    const mats = [pmrem._blurMaterial, pmrem._ggxMaterial].filter(Boolean);
    mats.forEach((m) => pmrem._compileMaterial(m));
    if (equirect) { pmrem.compileEquirectangularShader(); if (pmrem._equirectMaterial) mats.push(pmrem._equirectMaterial); }
    const t0 = performance.now();
    await new Promise((done) => {
      const check = () => {
        const ready = mats.every((m) => { const p = renderer.properties.get(m).currentProgram; return !p || p.isReady(); });
        if (ready || performance.now() - t0 > timeout) done(); else setTimeout(check, 16);
      };
      check();
    });
    return target;
  } catch {
    return null; // dann eben wie bisher synchron
  }
}
