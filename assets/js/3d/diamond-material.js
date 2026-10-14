// Diamant-Material: verfolgt jeden Lichtstrahl durch den geschliffenen Stein.
// Eintritt mit Brechung, mehrfache Totalreflexion an den Facetten,
// Austritt mit Dispersion (Feuer: Rot, Grün, Blau brechen unterschiedlich).
// Die Facetten kommen als Ebenen aus brilliant.js, die Umgebung ist das HDRI.

import * as THREE from 'three';

const vertexShader = /* glsl */ `
  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vCam;
  varying vec3 vM0;
  varying vec3 vM1;
  varying vec3 vM2;

  void main() {
    mat4 m = modelMatrix;
    #ifdef USE_INSTANCING
      m = modelMatrix * instanceMatrix;
    #endif
    vPos = position;
    vNormal = normal;
    vCam = (inverse(m) * vec4(cameraPosition, 1.0)).xyz;
    vM0 = normalize(m[0].xyz);
    vM1 = normalize(m[1].xyz);
    vM2 = normalize(m[2].xyz);
    gl_Position = projectionMatrix * viewMatrix * m * vec4(position, 1.0);
  }
`;

const fragmentShader = /* glsl */ `
  #include <common>

  uniform sampler2D uEnv;
  uniform vec4 uPlanes[NUM_PLANES];
  uniform float uGirdleR;
  uniform float uIor;
  uniform float uSpread;
  uniform float uIntensity;
  uniform float uContrast;
  uniform vec3 uBody;
  uniform float uAbsorb;
  uniform vec2 uEnvRot; // cos/sin der Umgebungsdrehung

  varying vec3 vPos;
  varying vec3 vNormal;
  varying vec3 vCam;
  varying vec3 vM0;
  varying vec3 vM1;
  varying vec3 vM2;

  vec3 env(vec3 d) {
    vec3 w = normalize(vM0 * d.x + vM1 * d.y + vM2 * d.z);
    w = vec3(uEnvRot.x * w.x + uEnvRot.y * w.z, w.y, -uEnvRot.y * w.x + uEnvRot.x * w.z);
    vec2 uv = vec2(atan(w.z, w.x) * RECIPROCAL_PI2 + 0.5, asin(clamp(w.y, -1.0, 1.0)) * RECIPROCAL_PI + 0.5);
    vec3 c = textureLod(uEnv, uv, 0.0).rgb;
    // etwas mehr Kontrast: dunkle Bereiche dunkler, Lichter heller (wie im Schmuckstudio)
    return pow(c, vec3(uContrast));
  }

  vec3 refr(vec3 i, vec3 n, float eta, vec3 fallback) {
    vec3 r = refract(i, n, eta);
    return dot(r, r) > 0.5 ? r : fallback;
  }

  float schlick(float c, float f0) {
    return f0 + (1.0 - f0) * pow(1.0 - clamp(c, 0.0, 1.0), 5.0);
  }

  void main() {
    vec3 n = normalize(vNormal);
    vec3 v = normalize(vPos - vCam);
    if (dot(v, n) > 0.0) n = -n;

    float f0 = pow((uIor - 1.0) / (uIor + 1.0), 2.0);
    float fr = schlick(dot(-v, n), f0);
    vec3 color = env(reflect(v, n)) * fr;

    vec3 dir = refract(v, n, 1.0 / uIor);
    vec3 p = vPos;
    vec3 thr = vec3(1.0 - fr);

    for (int i = 0; i < MAX_BOUNCES; i++) {
      float tMin = 1e5;
      vec3 nE = vec3(0.0, 1.0, 0.0);
      for (int j = 0; j < NUM_PLANES; j++) {
        vec4 pl = uPlanes[j];
        float dn = dot(pl.xyz, dir);
        if (dn > 1e-5) {
          float t = (pl.w - dot(pl.xyz, p)) / dn;
          if (t > 1e-5 && t < tMin) { tMin = t; nE = pl.xyz; }
        }
      }
      // Rundiste als Zylinder
      float a = dot(dir.xz, dir.xz);
      if (a > 1e-6) {
        float b = dot(p.xz, dir.xz);
        float c = dot(p.xz, p.xz) - uGirdleR * uGirdleR;
        float t = (-b + sqrt(max(b * b - a * c, 0.0))) / a;
        if (t > 1e-5 && t < tMin) {
          tMin = t;
          vec3 q = p + dir * t;
          nE = normalize(vec3(q.x, 0.0, q.z));
        }
      }

      p += dir * tMin;
      thr *= exp(-uAbsorb * tMin * (vec3(1.0) - uBody));

      float cosIn = dot(dir, nE);
      float k = 1.0 - uIor * uIor * (1.0 - cosIn * cosIn);
      if (k > 0.0) {
        // Teil des Lichts verlässt den Stein – mit Dispersion
        float fe = schlick(sqrt(k), f0);
        vec3 g = refract(dir, -nE, uIor);
        vec3 tr = vec3(
          env(refr(dir, -nE, uIor - uSpread, g)).r,
          env(g).g,
          env(refr(dir, -nE, uIor + uSpread, g)).b
        );
        color += thr * (1.0 - fe) * tr;
        thr *= fe;
      }
      dir = reflect(dir, nE); // Totalreflexion bzw. reflektierter Anteil
    }
    color += thr * env(dir) * 0.6;

    gl_FragColor = vec4(color * uIntensity, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

/**
 * @param {object} o
 * @param {THREE.Texture} o.envMap   Equirect-HDR (nicht PMREM)
 * @param {object} o.cut             Ergebnis von createBrilliant()
 */
export function createDiamondMaterial({
  envMap, cut, ior = 2.42, spread = 0.03, intensity = 1.0, contrast = 1.15,
  body = [1, 1, 1], absorb = 0, bounces = 5,
}) {
  return new THREE.ShaderMaterial({
    name: 'Diamant',
    defines: { NUM_PLANES: cut.planeCount, MAX_BOUNCES: bounces },
    uniforms: {
      uEnv: { value: envMap },
      uPlanes: { value: cut.planes },
      uGirdleR: { value: cut.girdleRadius },
      uIor: { value: ior },
      uSpread: { value: spread },
      uIntensity: { value: intensity },
      uContrast: { value: contrast },
      uBody: { value: new THREE.Color().setRGB(...body, THREE.LinearSRGBColorSpace) },
      uAbsorb: { value: absorb },
      uEnvRot: { value: new THREE.Vector2(1, 0) },
    },
    vertexShader,
    fragmentShader,
  });
}
