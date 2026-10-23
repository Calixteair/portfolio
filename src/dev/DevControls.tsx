import { useThree } from '@react-three/fiber';
import { folder, useControls } from 'leva';
import type { Scene, WebGPURenderer } from 'three/webgpu';
import type { LensUniforms } from '../three/post/lens';
import type { ForgeUniforms } from '../three/scenes/forge/uniforms';
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
}

type Range = [value: number, min: number, max: number, step: number];

/** Number slider whose changes go straight to the scene (transient: no React re-render). */
function slider([value, min, max, step]: Range, apply: (v: number) => void) {
  return { value, min, max, step, onChange: apply, transient: true as const };
}

/** Dev-only leva panel (lazy-loaded behind import.meta.env.DEV, absent from the prod bundle). */
export default function DevControls({ forge, lens }: DevControlsProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene) as unknown as Scene;
  useControls({
    Forge: folder({ heat: slider([0, 0, 1, 0.01], (v) => setUniform(forge.heat, v)) }),
    Lights: folder({
      exposure: slider([1.05, 0.3, 2.5, 0.01], (v) => setExposure(gl, v)),
      environment: slider([1, 0, 3, 0.01], (v) => setEnvironmentIntensity(scene, v)),
      key: slider([11, 0, 40, 0.1], (v) => setLightIntensity(scene, 'forge-key', v)),
      keyColor: {
        value: '#ff5a1f',
        onChange: (c: string) => setLightColor(scene, 'forge-key', c),
        transient: true as const,
      },
      rim: slider([0.5, 0, 4, 0.01], (v) => setLightIntensity(scene, 'forge-rim', v)),
      fog: slider([0.022, 0, 0.08, 0.001], (v) => setFogDensity(scene, v)),
    }),
    Steel: folder({ anisotropy: slider([0.55, 0, 1, 0.01], (v) => setAnisotropy(scene, v)) }),
    Lens: folder({
      bloom: slider([0.45, 0, 2, 0.01], (v) => setUniform(lens.bloomStrength, v)),
      bloomRadius: slider([0.4, 0, 1, 0.01], (v) => setUniform(lens.bloomRadius, v)),
      bloomThreshold: slider([1, 0, 3, 0.01], (v) => setUniform(lens.bloomThreshold, v)),
      aberration: slider([0.0035, 0, 0.015, 0.0005], (v) => setUniform(lens.aberration, v)),
      vignette: slider([1.3, 0, 3, 0.01], (v) => setUniform(lens.vignette, v)),
      grain: slider([0.045, 0, 0.15, 0.001], (v) => setUniform(lens.grain, v)),
    }),
  });
  return null;
}
