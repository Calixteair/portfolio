import {
  FogExp2,
  type Light,
  type MeshPhysicalNodeMaterial,
  type Scene,
  type UniformNode,
  type WebGPURenderer,
} from 'three/webgpu';
import type { JourneyRules } from '../journey/machine';
import type { ForgeRuntime } from '../journey/runtime';
import { SPARK_RATE } from '../shaders/sparks';
import type { LensUniforms } from '../three/post/lens';
import type { ForgeLights } from '../three/scenes/forge/lighting';

/** Setters used by the dev panel: mutations live here, outside React components. */

export function setUniform(u: UniformNode<'float', number>, value: number): void {
  u.value = value;
}

export function setExposure(renderer: WebGPURenderer, value: number): void {
  renderer.toneMappingExposure = value;
}

export function setEnvironmentIntensity(scene: Scene, value: number): void {
  scene.environmentIntensity = value;
}

export function setFogDensity(scene: Scene, value: number): void {
  if (scene.fog instanceof FogExp2) scene.fog.density = value;
}

export function setLightIntensity(light: Light, value: number): void {
  light.intensity = value;
}

export function setLightColor(light: Light, color: string): void {
  light.color.set(color);
}

export function setManualHeat(runtime: ForgeRuntime, change: Partial<ForgeRuntime['manual']>) {
  Object.assign(runtime.manual, change);
}

export function setRule(rules: JourneyRules, key: keyof JourneyRules, value: number): void {
  rules[key] = value;
}

export function setSparkRate(perSecond: number): void {
  SPARK_RATE.perSecond = perSecond;
}

export function setKeyRange(lights: ForgeLights, end: 'cold' | 'hot', value: number): void {
  lights.keyRange[end] = value;
}

export function setAnisotropy(material: MeshPhysicalNodeMaterial, value: number): void {
  material.anisotropy = value;
}

interface LookSources {
  gl: WebGPURenderer;
  scene: Scene;
  lights: ForgeLights;
  steel: MeshPhysicalNodeMaterial;
  lens: LensUniforms;
}

const round = (v: number) => Math.round(v * 1e4) / 1e4;

/** Exact live values of every tunable, as JSON (clipboard + console). */
export async function copyLook({ gl, scene, lights, steel, lens }: LookSources): Promise<void> {
  const look = {
    exposure: round(gl.toneMappingExposure),
    environment: round(scene.environmentIntensity),
    fog: scene.fog instanceof FogExp2 ? round(scene.fog.density) : null,
    key: { ...lights.keyRange, color: `#${lights.key.color.getHexString()}` },
    rim: round(lights.rim.intensity),
    anisotropy: round(steel.anisotropy),
    lens: Object.fromEntries(Object.entries(lens).map(([k, u]) => [k, round(u.value)])),
  };
  const json = JSON.stringify(look, null, 2);
  console.info('[dev] forge look\n' + json);
  try {
    await navigator.clipboard.writeText(json);
  } catch (error) {
    console.warn('[dev] clipboard unavailable, copy the values from the console', error);
  }
}
