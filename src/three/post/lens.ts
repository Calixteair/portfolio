import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  dot,
  emissive,
  float,
  fract,
  luminance,
  mrt,
  mx_noise_float,
  output,
  pass,
  renderOutput,
  screenUV,
  time,
  uniform,
  vec2,
  vec3,
  vec4,
} from 'three/tsl';
import {
  RenderPipeline,
  type Camera,
  type Node,
  type TextureNode,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';
import { hash21 } from '../../shaders/noise';

/** Tunable camera-look parameters (driven by leva in dev). */
export function createLensUniforms() {
  return {
    bloomStrength: uniform(0.28),
    bloomRadius: uniform(0.49),
    bloomThreshold: uniform(0.51),
    aberration: uniform(0.0035),
    vignette: uniform(2.33),
    grain: uniform(0.045),
    /** Heat haze: UV shift (screen fraction) above glowing surfaces. */
    haze: uniform(0.006),
  };
}

export type LensUniforms = ReturnType<typeof createLensUniforms>;

/** How far below a pixel (screen fraction) we look for heat: hot air rises. */
const HAZE_SAMPLES = [0.01, 0.025, 0.045, 0.07];

/**
 * Heat haze (SPEC §5.5): screen UVs shifted by drifting noise wherever something glows
 * below the pixel. The mask is the scene's own emission (second MRT output), so it follows
 * exactly what is hot, whatever the pendant's rotation; sparks (no emission) do not warp.
 */
function hazeUv(heatGlow: TextureNode, strength: Node<'float'>): Node<'vec2'> {
  let mask: Node<'float'> = float(0);
  for (const dy of HAZE_SAMPLES) {
    mask = mask.add(luminance(heatGlow.sample(screenUV.add(vec2(0, dy))).rgb));
  }
  const rising = vec3(screenUV.mul(vec2(38, 22)).add(vec2(0, time.mul(1.6))), time.mul(0.7));
  const wobble = vec2(mx_noise_float(rising), mx_noise_float(rising.add(17.3)));
  return screenUV.add(wobble.mul(strength).mul(mask.mul(0.25).clamp(0, 1)));
}

/**
 * Scene → heat haze → slight chromatic aberration (in HDR) + bloom → AgX tone mapping and
 * sRGB (renderOutput) → vignette and film grain in display space, like a real lens and
 * sensor. Depth of field is left to M8, with the quality levels.
 */
export function createLensPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  u: LensUniforms,
): RenderPipeline {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const color = scenePass.getTextureNode('output');
  const uv = hazeUv(scenePass.getTextureNode('emissive'), u.haze);
  const centred = screenUV.sub(0.5);
  const offset = centred.mul(u.aberration);
  const split = vec4(
    color.sample(uv.add(offset)).r,
    color.sample(uv).g,
    color.sample(uv.sub(offset)).b,
    1,
  );
  const glow = bloom(color, u.bloomStrength, u.bloomRadius, u.bloomThreshold);
  const display = renderOutput(split.add(glow));
  const vignette = float(1).sub(dot(centred, centred).mul(u.vignette));
  const noise = hash21(screenUV.mul(vec2(1717, 913)).add(fract(time).mul(37)));
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = vec4(display.rgb.mul(vignette).add(noise.sub(0.5).mul(u.grain)), 1);
  return pipeline;
}
