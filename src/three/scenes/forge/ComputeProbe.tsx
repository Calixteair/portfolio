import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import type { WebGPURenderer } from 'three/webgpu';
import { createProbeParticles } from '../../../shaders/probeParticles';

/** M0 probe: TSL compute particles, stepped once per frame on the GPU. */
export default function ComputeProbe({ count = 4096 }: { count?: number }) {
  const gl = useThree((state) => state.gl) as unknown as WebGPURenderer;
  const probe = useMemo(() => createProbeParticles(count), [count]);

  useEffect(() => {
    probe.init(gl).catch((error: unknown) => {
      console.error('[ComputeProbe] init compute failed', error);
    });
    return () => probe.dispose();
  }, [gl, probe]);

  useFrame((_, delta) => probe.step(gl, delta));

  return <primitive object={probe.object} />;
}
