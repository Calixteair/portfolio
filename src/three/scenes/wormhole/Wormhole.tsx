import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ForgeRuntime } from '../../../journey/runtime';
import { showStage, type StageView } from '../../stage';
import { useWebGPU } from '../../useWebGPU';
import { createTunnel } from './tunnel';

interface WormholeProps {
  runtime: ForgeRuntime;
  stage: StageView;
}

/** The wormhole tunnel (SPEC §5.6). Dev: `Dive > previewTunnel` flies through it in a loop. */
export default function Wormhole({ runtime, stage }: WormholeProps) {
  const { gl } = useWebGPU();
  const tunnel = useMemo(() => createTunnel(), []);
  const previewing = useRef(false);

  useEffect(() => {
    gl.compileAsync(tunnel.scene, tunnel.camera).catch((e: unknown) => console.error(e));
    return tunnel.dispose;
  }, [gl, tunnel]);

  useFrame((state) => {
    const preview = runtime.manual.previewTunnel;
    if (!preview && previewing.current) showStage(stage, null, null);
    previewing.current = preview;
    if (!preview) return;
    const t = state.clock.elapsedTime;
    tunnel.resize(state.size.width / state.size.height);
    tunnel.fly((t * 0.06) % 1, Math.sin(t * 0.7) * 0.25);
    showStage(stage, tunnel.scene, tunnel.camera);
  });
  return null;
}
