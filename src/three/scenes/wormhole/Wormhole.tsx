import { useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { ForgeRuntime } from '../../../journey/runtime';
import { showStage, type StageView } from '../../stage';
import { useWebGPU } from '../../useWebGPU';
import type { Tunnel } from './tunnel';

interface WormholeProps {
  runtime: ForgeRuntime;
  stage: StageView;
  tunnel: Tunnel;
}

/** The wormhole tunnel (SPEC §5.6). Dev: `Dive > previewTunnel` flies through it in a loop. */
export default function Wormhole({ runtime, stage, tunnel }: WormholeProps) {
  const { gl } = useWebGPU();
  const previewing = useRef(false);

  useEffect(() => {
    // Compiled ahead, so the dive does not stall when it switches to the tunnel.
    gl.compileAsync(tunnel.scene, tunnel.camera).catch((e: unknown) => console.error(e));
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
