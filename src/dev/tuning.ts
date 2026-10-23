import type { UniformNode } from 'three/webgpu';
import {
  FogExp2,
  Light,
  Mesh,
  MeshPhysicalNodeMaterial,
  type Scene,
  type WebGPURenderer,
} from 'three/webgpu';

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

function findLight(scene: Scene, name: string): Light | null {
  const light = scene.getObjectByName(name);
  return light instanceof Light ? light : null;
}

export function setLightIntensity(scene: Scene, name: string, intensity: number): void {
  const light = findLight(scene, name);
  if (light) light.intensity = intensity;
}

export function setLightColor(scene: Scene, name: string, color: string): void {
  findLight(scene, name)?.color.set(color);
}

export function setAnisotropy(scene: Scene, value: number): void {
  const body = scene.getObjectByName('pendant-body');
  if (body instanceof Mesh && body.material instanceof MeshPhysicalNodeMaterial) {
    body.material.anisotropy = value;
  }
}
