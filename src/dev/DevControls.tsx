import { folder, useControls } from 'leva';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { LensUniforms } from '../three/post/lens';
import { FORGE_LOOK, type ForgeLights } from '../three/scenes/forge/lighting';
import type { ForgeUniforms } from '../three/scenes/forge/uniforms';
import { useWebGPU } from '../three/useWebGPU';
import {
  setAnisotropy,
  setEnvironmentIntensity,
  setExposure,
  setFogDensity,
  setLightColor,
  setLightIntensity,
  setUniform,
} from './tuning';

export interface DevControlsProps {
  forge: ForgeUniforms;
  lens: LensUniforms;
  lights: ForgeLights;
  steel: MeshPhysicalNodeMaterial;
}

type Range = [min: number, max: number, step: number];

/** Slider starting from the live value; changes go straight to the scene (no re-render). */
function slider(value: number, [min, max, step]: Range, apply: (v: number) => void) {
  return { value, min, max, step, onChange: apply, transient: true as const };
}

function uniformSlider(u: ForgeUniforms['heat'], range: Range) {
  return slider(u.value, range, (v) => setUniform(u, v));
}

/** Dev-only leva panel (lazy-loaded behind import.meta.env.DEV, absent from the prod bundle). */
export default function DevControls({ forge, lens, lights, steel }: DevControlsProps) {
  const { gl, scene } = useWebGPU();
  const { key, rim } = lights;
  useControls({
    Forge: folder({ heat: uniformSlider(forge.heat, [0, 1, 0.01]) }),
    Lights: folder({
      exposure: slider(FORGE_LOOK.exposure, [0.3, 2.5, 0.01], (v) => setExposure(gl, v)),
      environment: slider(scene.environmentIntensity, [0, 3, 0.01], (v) =>
        setEnvironmentIntensity(scene, v),
      ),
      key: slider(key.intensity, [0, 40, 0.1], (v) => setLightIntensity(key, v)),
      keyColor: {
        value: `#${key.color.getHexString()}`,
        onChange: (c: string) => setLightColor(key, c),
        transient: true as const,
      },
      rim: slider(rim.intensity, [0, 4, 0.01], (v) => setLightIntensity(rim, v)),
      fog: slider(FORGE_LOOK.fogDensity, [0, 0.08, 0.001], (v) => setFogDensity(scene, v)),
    }),
    Steel: folder({
      anisotropy: slider(steel.anisotropy, [0, 1, 0.01], (v) => setAnisotropy(steel, v)),
    }),
    Lens: folder({
      bloom: uniformSlider(lens.bloomStrength, [0, 2, 0.01]),
      bloomRadius: uniformSlider(lens.bloomRadius, [0, 1, 0.01]),
      bloomThreshold: uniformSlider(lens.bloomThreshold, [0, 3, 0.01]),
      aberration: uniformSlider(lens.aberration, [0, 0.015, 0.0005]),
      vignette: uniformSlider(lens.vignette, [0, 3, 0.01]),
      grain: uniformSlider(lens.grain, [0, 0.15, 0.001]),
    }),
  });
  return null;
}
