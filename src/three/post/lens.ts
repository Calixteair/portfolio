import { bloom } from 'three/addons/tsl/display/BloomNode.js';
import { dof } from 'three/addons/tsl/display/DepthOfFieldNode.js';
import {
  dot,
  emissive,
  float,
  fract,
  luminance,
  mix,
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
import type { PerspectiveCamera } from 'three/webgpu';
import {
  Box3,
  RenderPipeline,
  Sphere,
  Vector3,
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
    /** Wormhole dive (SPEC §5.6): radial zoom blur (0-1) and white flash (0-1). */
    zoomBlur: uniform(0),
    flash: uniform(0),
    /**
     * Depth of field (high tier, forge only): focus distance in metres (kept on the
     * pendant), how far from it things are fully blurred, and the bokeh size.
     */
    dofFocus: uniform(3.3),
    dofRange: uniform(6),
    dofBokeh: uniform(1.5),
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

const ZOOM_TAPS = 8;

/** Radial zoom blur: average of taps pulled towards the screen centre (0 = sharp). */
function zoomBlur(color: TextureNode, uv: Node<'vec2'>, strength: Node<'float'>): Node<'vec3'> {
  // Per-pixel jitter of the taps: smooth streaks instead of 8 stacked ghost copies.
  const jitter = hash21(screenUV.mul(vec2(911, 577)).add(fract(time)));
  let sum: Node<'vec3'> = vec3(0);
  for (let i = 0; i < ZOOM_TAPS; i++) {
    const pull = strength.mul(jitter.add(i).div(ZOOM_TAPS).mul(0.25));
    sum = sum.add(color.sample(mix(uv, vec2(0.5), pull)).rgb);
  }
  return sum.div(ZOOM_TAPS);
}

/** Display-space finish: vignette, film grain, dive flash. */
function filmFinish(display: Node<'vec4'>, u: LensUniforms): Node<'vec4'> {
  const centred = screenUV.sub(0.5);
  const vignette = float(1).sub(dot(centred, centred).mul(u.vignette));
  const noise = hash21(screenUV.mul(vec2(1717, 913)).add(fract(time).mul(37)));
  const film = display.rgb.mul(vignette).add(noise.sub(0.5).mul(u.grain));
  return vec4(mix(film, vec3(1), u.flash.clamp(0, 1)), 1);
}

/**
 * Scene → heat haze → slight chromatic aberration and dive zoom blur (in HDR) + bloom → AgX
 * tone mapping and sRGB (renderOutput) → [depth of field] → vignette, film grain and dive
 * flash in display space, like a real lens and sensor. Two outputs share the scene pass:
 * with depth of field (high tier, in the forge) and without, switched per frame.
 */
export function createLensPipeline(
  renderer: WebGPURenderer,
  scene: Scene,
  camera: Camera,
  u: LensUniforms,
) {
  const scenePass = pass(scene, camera);
  scenePass.setMRT(mrt({ output, emissive }));
  const color = scenePass.getTextureNode('output');
  const uv = hazeUv(scenePass.getTextureNode('emissive'), u.haze);
  const offset = screenUV.sub(0.5).mul(u.aberration);
  const split = vec4(
    color.sample(uv.add(offset)).r,
    color.sample(uv).g,
    color.sample(uv.sub(offset)).b,
    1,
  );
  const sharp = mix(split.rgb, zoomBlur(color, uv, u.zoomBlur), u.zoomBlur.clamp(0, 1));
  const glow = bloom(color, u.bloomStrength, u.bloomRadius, u.bloomThreshold);
  const display = renderOutput(vec4(sharp, 1).add(glow));
  // The node itself (not its texture), so its blur passes run; @types/three leaves its
  // output untyped, it is the blurred colour (vec4).
  const blurred = dof(
    display,
    scenePass.getViewZNode(),
    u.dofFocus,
    u.dofRange,
    u.dofBokeh,
  ) as unknown as Node<'vec4'>;
  const outputs = { plain: filmFinish(display, u), focused: filmFinish(blurred, u) };
  const pipeline = new RenderPipeline(renderer);
  pipeline.outputColorTransform = false;
  pipeline.outputNode = outputs.plain;
  return { pipeline, scenePass, outputs };
}

/** Keep the pendant (at the origin) in focus, wherever the camera is (it moves in the dive). */
export function focusOnPendant(u: LensUniforms, camera: Camera): void {
  u.dofFocus.value = camera.position.length();
}

/**
 * Renders the stage's scene and camera, or the defaults (R3F's forge) when it has none,
 * with or without depth of field. Switching rebuilds the output shader once per graph.
 */
export function renderLens(
  lens: ReturnType<typeof createLensPipeline>,
  stage: { scene: Scene | null; camera: Camera | null },
  fallback: { scene: Scene; camera: Camera },
  focus = false,
): void {
  const wanted = focus ? lens.outputs.focused : lens.outputs.plain;
  if (lens.pipeline.outputNode !== wanted) {
    lens.pipeline.outputNode = wanted;
    lens.pipeline.needsUpdate = true;
  }
  lens.scenePass.scene = stage.scene ?? fallback.scene;
  lens.scenePass.camera = stage.camera ?? fallback.camera;
  lens.pipeline.render();
}

/**
 * Pose `camera` to see the whole scene from outside (nothing culled while warming up);
 * returns the restore.
 */
function overview(scene: Scene, camera: PerspectiveCamera): () => void {
  const saved = camera.clone();
  const bounds = new Box3().setFromObject(scene).getBoundingSphere(new Sphere());
  const r = Math.max(bounds.radius, 1);
  Object.assign(camera, { fov: 60, near: r * 0.01, far: r * 6 });
  camera.position.copy(bounds.center).add(new Vector3(0, 1, 2).setLength(r * 2.5));
  camera.lookAt(bounds.center);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
  return () => {
    camera.copy(saved);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
  };
}

/**
 * One hidden frame (under the loader) that renders `view` through the lens pipeline, with
 * its camera posed to see everything. Only this exact path builds what the dive will need
 * full screen: three.js keys shaders and render objects by camera, render target, MRT,
 * tone mapping and even the nesting of the render call (the pass renders inside the
 * pipeline's own), so a separate compile or render still left a stall on the first frame.
 */
export function warmFrame(
  lens: ReturnType<typeof createLensPipeline>,
  view: { scene: Scene; camera: PerspectiveCamera },
): void {
  const restore = overview(view.scene, view.camera);
  try {
    renderLens(lens, view, view);
  } finally {
    restore();
  }
}
