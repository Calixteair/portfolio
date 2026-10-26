import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { InstancedMesh, PlaneGeometry } from 'three/webgpu';
import { createSparkMaterial } from '../../../shaders/sparkMaterial';
import { createSparkSimulation, createSparkUniforms, stepSparks } from '../../../shaders/sparks';
import { sampleEdge } from '../../pendant/edges';
import type { Pendant } from '../../pendant/placeholder';
import type { SpinState } from '../../pendant/spin';
import { mulberry32 } from '../../random';
import { backendOf } from '../../renderer';
import { useWebGPU } from '../../useWebGPU';
import { particleBudget } from './budget';
import { GROUND_Y } from './decor';
import type { ForgeUniforms } from './uniforms';

function buildSparks(pendant: Pendant, count: number) {
  const rand = mulberry32(23);
  const emitters = {
    hole: sampleEdge(pendant.outline.hole, 512, rand, true),
    outer: sampleEdge(pendant.outline.outer, 256, rand),
  };
  const uniforms = createSparkUniforms();
  uniforms.groundY.value = GROUND_Y;
  const sim = createSparkSimulation(count, emitters, pendant.edgeMask, uniforms);
  const geometry = new PlaneGeometry(1, 1);
  const material = createSparkMaterial(sim.body, sim.motion);
  const mesh = new InstancedMesh(geometry, material, count);
  mesh.frustumCulled = false;
  const dispose = () => {
    geometry.dispose();
    material.dispose();
    sim.dispose();
  };
  return { sim, uniforms, mesh, dispose, pool: count };
}

/** Molten-metal sparks thrown from the hot edges of the pendant (SPEC §5.4). */
interface SparksProps {
  pendant: Pendant;
  forge: ForgeUniforms;
  spin: SpinState;
}

export default function Sparks({ pendant, forge, spin }: SparksProps) {
  const { gl } = useWebGPU();
  const sparks = useMemo(
    () => buildSparks(pendant, particleBudget(backendOf(gl)).sparks),
    [pendant, gl],
  );

  useEffect(() => {
    gl.computeAsync(sparks.sim.init).catch((error: unknown) => console.error(error));
    return sparks.dispose;
  }, [gl, sparks]);

  useFrame((_, dt) => {
    stepSparks(gl, sparks.sim, sparks.uniforms, {
      dt,
      heat: forge.heat.value,
      model: pendant.group.matrixWorld,
      spin: spin.velocity,
      pool: sparks.pool,
    });
  });
  return <primitive object={sparks.mesh} />;
}
