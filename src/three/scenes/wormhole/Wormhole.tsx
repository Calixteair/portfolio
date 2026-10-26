import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import type { PerspectiveCamera } from 'three/webgpu';
import type { ForgeRuntime } from '../../../journey/runtime';
import { markReady, type DiveReadiness } from '../../readiness';
import { showStage, type DiveView, type StageView } from '../../stage';
import { useWebGPU } from '../../useWebGPU';
import type { PortalSystem } from '../portal/system';
import { ARRIVAL, arrivalPoint, renderView, resizeTarget } from '../portal/window';
import type { Tunnel } from './tunnel';

interface WormholeProps {
  runtime: ForgeRuntime;
  stage: StageView;
  tunnel: Tunnel;
  readiness: DiveReadiness;
  /** Seen through the tunnel's mouth at the exit, from where the visitor lands. */
  system: PortalSystem;
  eye: { current: PerspectiveCamera | null };
  dive: DiveView;
}

/** The mouth shows the system from the landing point, with the tunnel camera's lens. */
function renderMouth(
  gl: Parameters<typeof renderView>[0],
  props: WormholeProps,
  elapsed: number,
): boolean {
  const eye = props.eye.current;
  if (!eye) return false;
  arrivalPoint(ARRIVAL.from, eye.position);
  eye.lookAt(0, 0, 0);
  eye.updateMatrixWorld();
  props.system.update(elapsed);
  renderView(
    gl,
    props.tunnel.mouthTarget,
    { scene: props.system.scene, camera: eye },
    props.tunnel.camera,
  );
  return true;
}

/** The wormhole tunnel (SPEC §5.6). Dev: `Dive > previewTunnel` flies through it in a loop. */
export default function Wormhole(props: WormholeProps) {
  const { runtime, stage, tunnel, readiness, dive } = props;
  const { gl } = useWebGPU();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const previewing = useRef(false);
  const mouthWarm = useRef(false);

  useEffect(() => {
    // Compiled ahead, so the dive does not stall when it switches to the tunnel.
    gl.compileAsync(tunnel.scene, tunnel.camera)
      .then(() => markReady(readiness, 'tunnel'))
      .catch((e: unknown) => console.error(e));
  }, [gl, tunnel, readiness]);
  useEffect(
    () => resizeTarget(tunnel.mouthTarget, size.width * dpr, size.height * dpr),
    [tunnel, size, dpr],
  );

  useFrame((state) => {
    // Off screen, so rendered once early too: its shaders are built before the dive.
    if (dive.phase === 'tunnel' || !mouthWarm.current) {
      mouthWarm.current = renderMouth(gl, props, state.clock.elapsedTime);
    }
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
