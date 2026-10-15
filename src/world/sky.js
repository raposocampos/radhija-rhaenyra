// Céu procedural de fim de tarde: gradiente pêssego → azul, brilho do sol e nuvens suaves.
import * as THREE from 'three';

export function createSky(sunDir, { radius = 400 } = {}) {
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uSunDir: { value: sunDir.clone().normalize() },
      uTime: { value: 0 },
      uZenith: { value: new THREE.Color('#5f93cf') },
      uMid: { value: new THREE.Color('#a9c6e2') },
      uHorizon: { value: new THREE.Color('#ffcf9e') },
      uGround: { value: new THREE.Color('#d9b48e') },
      uSun: { value: new THREE.Color('#fff0d0') },
      uStars: { value: 0 }, // 0..1 (noite)
      uClouds: { value: 1 }, // quantidade de nuvens
      uGlow: { value: 1 }, // halo do sol/lua
      uDisk: { value: 1 }, // disco do sol/lua
      uCloudTint: { value: new THREE.Color().setRGB(1.0, 0.86, 0.74) }, // linear
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uSunDir, uZenith, uMid, uHorizon, uGround, uSun, uCloudTint;
      uniform float uTime, uStars, uClouds, uGlow, uDisk;
      varying vec3 vDir;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(h(i), h(i+vec2(1,0)), f.x), mix(h(i+vec2(0,1)), h(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*n(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
      void main() {
        vec3 d = normalize(vDir);
        float y = d.y;
        // gradiente: horizonte quente, zênite azul
        float t1 = smoothstep(-0.02, 0.22, y);
        float t2 = smoothstep(0.18, 0.75, y);
        vec3 col = mix(uHorizon, uMid, t1);
        col = mix(col, uZenith, t2);
        // lado do sol mais quente
        float sd = max(dot(d, uSunDir), 0.0);
        float azim = max(dot(normalize(d.xz + 1e-4), normalize(uSunDir.xz)), 0.0);
        col = mix(col, uHorizon * 1.05, (1.0 - t2) * azim * 0.45);
        // abaixo do horizonte
        col = mix(col, uGround, smoothstep(0.0, -0.12, y));
        // brilho do sol
        col += uSun * ((pow(sd, 6.0) * 0.35 + pow(sd, 64.0) * 1.2) * uGlow + pow(sd, 900.0) * 18.0 * uDisk);
        // estrelas (noite)
        if (uStars > 0.0 && y > 0.0) {
          vec3 sp = d * 260.0;
          vec3 cell = floor(sp);
          float rnd = h(cell.xy + cell.z * 17.13);
          float star = step(0.986, rnd) * smoothstep(0.32, 0.0, length(fract(sp) - 0.5));
          float tw = 0.55 + 0.45 * sin(uTime * (1.5 + rnd * 2.0) + rnd * 60.0);
          col += vec3(0.82, 0.88, 1.0) * star * tw * uStars * smoothstep(0.04, 0.3, y);
        }
        // nuvens suaves
        if (y > 0.0) {
          vec2 uv = d.xz / (y + 0.18) * 1.4 + vec2(uTime * 0.004, 0.0);
          float c = fbm(uv * 1.2);
          c = smoothstep(0.52, 0.82, c) * smoothstep(0.0, 0.18, y) * (1.0 - smoothstep(0.55, 0.95, y)) * uClouds;
          vec3 cloudCol = mix(uCloudTint, uCloudTint * 1.08 + 0.02, smoothstep(0.0, 0.4, y));
          cloudCol += uSun * pow(sd, 4.0) * 0.5;
          col = mix(col, cloudCol, c * 0.75);
        }
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide,
    depthWrite: false,
    depthTest: true,
    fog: false,
  });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 48, 24), material);
  mesh.frustumCulled = false;
  mesh.renderOrder = -10;
  mesh.userData.noShadow = true;
  return mesh;
}
