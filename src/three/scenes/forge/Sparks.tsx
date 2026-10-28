import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { InstancedMesh, PlaneGeometry } from 'three/webgpu';
import { createSparkMaterial } from '../../../shaders/sparkMaterial';
import { createSparkSimulation, createSparkUniforms, stepSparks } from '../../../shaders/sparks';
import { sampleEdge } from '../../pendant/edges';
import type { Pendant } from '../../pendant/placeholder';
import type { SpinState } from '../../pendant/spin';
import { mulberry32 } from '../../random';
import { startTier } from '../../quality';
import { useWebGPU } from '../../useWebGPU';
import { particleBudget } from './budget';
import type { SparkColliders } from './colliders';
import type { ForgeUniforms } from './uniforms';

function buildSparks(pendant: Pendant, colliders: SparkColliders, count: number) {
  const rand = mulberry32(23);
  const emitters = {
    hole: sampleEdge(pendant.outline.hole, 512, rand, true),
    outer: sampleEdge(pendant.outline.outer, 256, rand),
  };
  const uniforms = createSparkUniforms();
  const sim = createSparkSimulation(count, emitters, pendant.edgeMask, colliders, uniforms);
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
  /** The ground and rocks they bounce on. */
  colliders: SparkColliders;
}

export default function Sparks({ pendant, forge, spin, colliders }: SparksProps) {
  const { gl } = useWebGPU();
  const sparks = useMemo(
    () => buildSparks(pendant, colliders, particleBudget(startTier(gl).tier).sparks),
    [pendant, colliders, gl],
  );

  useEffect(() => {
    gl.computeAsync(sparks.sim.init).catch((error: unknown) => console.error(error));
    return sparks.dispose;
  }, [gl, sparks]);

  useFrame((_, dt) => {
    stepSparks(gl, sparks.sim, sparks.uniforms, {
      dt,
      heat: forge.heat.value,
      calm: forge.portal.value,
      model: pendant.group.matrixWorld,
      spin: spin.velocity,
      pool: sparks.pool,
    });
  });
  return <primitive object={sparks.mesh} />;
}
