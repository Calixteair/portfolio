import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Sprite } from 'three/webgpu';
import {
  createSwarmMaterial,
  createSwarmSimulation,
  createSwarmUniforms,
  stepSwarm,
} from '../../../shaders/protomolecule';
import { sampleEdge } from '../../pendant/edges';
import type { Pendant } from '../../pendant/placeholder';
import { mulberry32 } from '../../random';
import { backendOf } from '../../renderer';
import { useWebGPU } from '../../useWebGPU';
import { particleBudget } from './budget';
import type { ForgeUniforms } from './uniforms';

function buildSwarm(pendant: Pendant, count: number) {
  const hole = sampleEdge(pendant.outline.hole, 512, mulberry32(31), true);
  const uniforms = createSwarmUniforms();
  const sim = createSwarmSimulation(count, hole, pendant.edgeMask, uniforms);
  const material = createSwarmMaterial(sim, uniforms);
  const sprite = new Sprite(material);
  sprite.count = count;
  sprite.frustumCulled = false;
  // Child of the pendant: simulated in pendant space, the swarm turns with it.
  pendant.group.add(sprite);
  const dispose = () => {
    pendant.group.remove(sprite);
    material.dispose();
    sim.dispose();
  };
  return { sim, uniforms, dispose };
}

/** Blue protomolecule particles crawling out of the crust once the pendant overheats. */
export default function Swarm({ pendant, forge }: { pendant: Pendant; forge: ForgeUniforms }) {
  const { gl } = useWebGPU();
  const swarm = useMemo(
    () => buildSwarm(pendant, particleBudget(backendOf(gl)).swarm),
    [pendant, gl],
  );

  useEffect(() => {
    gl.computeAsync(swarm.sim.init).catch((error: unknown) => console.error(error));
    return swarm.dispose;
  }, [gl, swarm]);

  useFrame((_, dt) => stepSwarm(gl, swarm.sim, swarm.uniforms, { dt, level: forge.swarm.value }));
  return null;
}
