import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

/** Post-processing: bloom, then chromatic aberration, vignette and film grain. */
export function createPost(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));

  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.62);
  composer.addPass(bloom);

  const lens = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      uTime: { value: 0 },
      uPulse: { value: 0 },
      uRes: { value: new THREE.Vector2(1, 1) },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */ `
      uniform sampler2D tDiffuse;
      uniform float uTime;
      uniform float uPulse;
      uniform vec2 uRes;
      varying vec2 vUv;

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
      }

      void main() {
        vec2 c = vUv - 0.5;
        float r = dot(c, c);
        float ca = 0.003 + r * 0.025 + uPulse * 0.03;
        vec3 col;
        col.r = texture2D(tDiffuse, vUv - c * ca).r;
        col.g = texture2D(tDiffuse, vUv).g;
        col.b = texture2D(tDiffuse, vUv + c * ca).b;
        col *= 1.0 - smoothstep(0.15, 0.75, r) * 0.65;
        col += (hash(vUv * uRes + fract(uTime) * 100.0) - 0.5) * 0.03;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  composer.addPass(lens);
  composer.addPass(new OutputPass());

  return {
    composer,
    lens,
    bloom,
    setSize(width: number, height: number, pixelRatio: number) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
      lens.uniforms.uRes.value.set(width * pixelRatio, height * pixelRatio);
    },
  };
}
