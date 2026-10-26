import { button, folder, useControls } from 'leva';
import type { MeshPhysicalNodeMaterial } from 'three/webgpu';
import type { LensUniforms } from '../three/post/lens';
import { FORGE_LOOK, type ForgeLights } from '../three/scenes/forge/lighting';
import type { ForgeRuntime } from '../journey/runtime';
import { SPARK_RATE } from '../shaders/sparks';
import type { JourneyRules } from '../journey/machine';
import { useWebGPU } from '../three/useWebGPU';
import {
  copyLook,
  setAnisotropy,
  setEnvironmentIntensity,
  setExposure,
  setFogDensity,
  setKeyRange,
  setLightColor,
  setLightIntensity,
  setManualHeat,
  setRule,
  setSparkRate,
  setUniform,
} from './tuning';

export interface DevControlsProps {
  runtime: ForgeRuntime;
  lens: LensUniforms;
  lights: ForgeLights;
  steel: MeshPhysicalNodeMaterial;
}

type Range = [min: number, max: number, step: number];

/** Slider starting from the live value; changes go straight to the scene (no re-render). */
function slider(value: number, [min, max, step]: Range, apply: (v: number) => void) {
  return { value, min, max, step, onChange: apply, transient: true as const };
}

function uniformSlider(u: LensUniforms['grain'], range: Range) {
  return slider(u.value, range, (v) => setUniform(u, v));
}

/** Journey thresholds (SPEC §2), applied live. */
function rulesFolder(rules: JourneyRules) {
  const rule = (key: keyof JourneyRules, range: Range) =>
    slider(rules[key], range, (v) => setRule(rules, key, v));
  return folder({
    heatPerStrike: rule('heatPerStrike', [0, 0.5, 0.01]),
    coolPerSecond: rule('coolPerSecond', [0, 0.5, 0.01]),
    threshold: rule('threshold', [0.1, 1, 0.01]),
    turnsNeeded: rule('turnsNeeded', [0, 10, 0.5]),
    overheatSeconds: rule('overheatSeconds', [0, 5, 0.1]),
  });
}

/** Dev-only leva panel (lazy-loaded behind import.meta.env.DEV, absent from the prod bundle). */
export default function DevControls({ runtime, lens, lights, steel }: DevControlsProps) {
  const { gl, scene } = useWebGPU();
  const { key, rim } = lights;
  useControls({
    Forge: folder({
      manualHeat: {
        value: runtime.manual.enabled,
        onChange: (on: boolean) => setManualHeat(runtime, { enabled: on }),
        transient: true as const,
      },
      heat: slider(runtime.manual.heat, [0, 1, 0.01], (v) => setManualHeat(runtime, { heat: v })),
    }),
    Journey: rulesFolder(runtime.rules),
    Portal: folder({
      scrub: {
        value: runtime.manual.scrubPortal,
        onChange: (on: boolean) => setManualHeat(runtime, { scrubPortal: on }),
        transient: true as const,
      },
      open: slider(runtime.manual.portal, [0, 1, 0.01], (v) =>
        setManualHeat(runtime, { portal: v }),
      ),
    }),
    Sparks: folder({
      perSecond: slider(SPARK_RATE.perSecond, [0, 3000, 10], (v) => setSparkRate(v)),
    }),
    Lights: folder({
      exposure: slider(FORGE_LOOK.exposure, [0.3, 2.5, 0.01], (v) => setExposure(gl, v)),
      environment: slider(FORGE_LOOK.environmentIntensity, [0, 3, 0.01], (v) =>
        setEnvironmentIntensity(scene, v),
      ),
      keyCold: slider(lights.keyRange.cold, [0, 20, 0.1], (v) => setKeyRange(lights, 'cold', v)),
      keyHot: slider(lights.keyRange.hot, [0, 40, 0.1], (v) => setKeyRange(lights, 'hot', v)),
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
      haze: uniformSlider(lens.haze, [0, 0.03, 0.0005]),
    }),
    // leva rounds the displayed numbers: this copies the exact live values.
    'Copier les valeurs': button(() => {
      void copyLook({ gl, scene, lights, steel, lens });
    }),
  });
  return null;
}
