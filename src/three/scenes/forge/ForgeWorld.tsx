import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { createForgeWorld } from './decor';
import { QUALITY, startTier } from '../../quality';
import { useWebGPU } from '../../useWebGPU';
import { HAZE } from './lighting';
import type { ForgeUniforms } from './uniforms';

/** Ground, layered peaks, distant chains and sky; reacts to the forge heat. */
export default function ForgeWorld({ uniforms }: { uniforms: ForgeUniforms }) {
  const { gl } = useWebGPU();
  const world = useMemo(
    () => createForgeWorld(uniforms.heat, HAZE, QUALITY[startTier(gl).tier]),
    [uniforms, gl],
  );
  useEffect(() => world.dispose, [world]);
  useFrame(() => world.update(uniforms.heat.value));
  return <primitive object={world.group} />;
}
