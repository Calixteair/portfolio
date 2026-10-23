import {
  FogExp2,
  type Light,
  type MeshPhysicalNodeMaterial,
  type Scene,
  type UniformNode,
  type WebGPURenderer,
} from 'three/webgpu';
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

export function setKeyRange(lights: ForgeLights, end: 'cold' | 'hot', value: number): void {
  lights.keyRange[end] = value;
}

export function setAnisotropy(material: MeshPhysicalNodeMaterial, value: number): void {
  material.anisotropy = value;
}
