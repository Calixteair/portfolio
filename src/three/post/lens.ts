import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import {
  dot,
  float,
  fract,
  pass,
  renderOutput,
  screenUV,
  time,
  uniform,
  vec2,
  vec4,
} from 'three/tsl';
import { hash21 } from '../../shaders/noise';
import { RenderPipeline, type Camera, type Scene, type WebGPURenderer } from 'three/webgpu';

/** Tunable camera-look parameters (driven by leva in dev). */
export function createLensUniforms() {
  return {
    bloomStrength: uniform(0.45),
    bloomRadius: uniform(0.4),
    bloomThreshold: uniform(1),
    aberration: uniform(0.0035),
    vignette: uniform(1.3),
    grain: uniform(0.045),
  };
}

export type LensUniforms = ReturnType<typeof createLensUniforms>;

/**
 * Scene → slight chromatic aberration (in HDR) + bloom → AgX tone mapping and sRGB
 * (renderOutput) → vignette and film grain in display space, like a real lens and sensor.
 * Depth of field is left to M8, with the quality levels.
 */
export function createLensPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  u: LensUniforms,
): RenderPipeline {
  const scenePass = pass(scene, camera);
  const color = scenePass.getTextureNode('output');
  const centred = screenUV.sub(0.5);
  const offset = centred.mul(u.aberration);
  const split = vec4(
    color.sample(screenUV.add(offset)).r,
    color.g,
    color.sample(screenUV.sub(offset)).b,
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
