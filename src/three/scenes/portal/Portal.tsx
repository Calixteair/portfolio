import { useFrame } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { PointLight, type Node } from 'three/webgpu';
import { PALETTE_B } from '../../../shaders/nebula';
import { portalOpening } from '../../../shaders/portalOpening';
import type { Pendant } from '../../pendant/placeholder';
import { markReady, type DiveReadiness } from '../../readiness';
import { HOLE } from '../../pendant/shape';
import { useWebGPU } from '../../useWebGPU';
import type { ForgeUniforms } from '../forge/uniforms';
import type { PortalSystem } from './system';
import type { LiveQuality } from '../../quality';
import type { DiveView } from '../../stage';
import type { Tunnel } from '../wormhole/tunnel';
import {
  createPortalWindow,
  renderPortal,
  renderView,
  fitWindow,
  type PortalWindow,
} from './window';

/** Peak intensity of the blue light the open portal casts on the crust and the walls. */
const SPILL_INTENSITY = 2.5;

/** The portal's blue light spilling onto the crust and the hole walls, both faces (§5.5). */
function createSpillLights(): PointLight[] {
  return [0.12, -0.12].map((z) => {
    const light = new PointLight(PALETTE_B.filament, 0, 0.9, 2);
    light.position.set(HOLE.cx, HOLE.cy, z);
    return light;
  });
}

function setSpill(lights: PointLight[], open: number): void {
  for (const light of lights) light.intensity = open * SPILL_INTENSITY;
}

function buildPortal(pendant: Pendant, forge: ForgeUniforms) {
  const win = createPortalWindow(pendant.outline.hole, (view: Node<'vec4'>) =>
    portalOpening(view, forge.portal),
  );
  const spill = createSpillLights();
  pendant.group.add(win.surface, ...spill);
  const dispose = () => {
    pendant.group.remove(win.surface, ...spill);
    win.dispose();
  };
  return { win, spill, dispose };
}

interface PortalProps {
  pendant: Pendant;
  forge: ForgeUniforms;
  /** The other side: owned above, the wormhole lands in it full screen. */
  system: PortalSystem;
  /** Set once the dive has started: the portal camera is then driven by the arrival. */
  frozen: { value: boolean };
  onReady: (camera: PortalWindow['camera']) => void;
  readiness: DiveReadiness;
  /** While pulled in, the hole shows the tunnel's entrance (no cut, SPEC §5.6). */
  tunnel: Tunnel;
  dive: DiveView;
  /** Its resolution follows the live quality tier. */
  quality: LiveQuality;
}

/** The other side, seen through the hole once the portal opens (SPEC §5.5). */
export default function Portal(props: PortalProps) {
  const { pendant, forge, system, frozen, onReady, readiness, tunnel, dive, quality } = props;
  const { gl } = useWebGPU();
  const portal = useMemo(() => buildPortal(pendant, forge), [pendant, forge]);

  useEffect(() => {
    // Compile the other side early, so opening the portal does not stall a frame.
    gl.compileAsync(system.scene, portal.win.camera)
      .then(() => markReady(readiness, 'system'))
      .catch((e: unknown) => console.error(e));
    onReady(portal.win.camera);
    return portal.dispose;
  }, [gl, portal, system, onReady, readiness]);

  useFrame((state) => {
    setSpill(portal.spill, forge.portal.value);
    fitWindow(portal.win.target, state, quality);
    const camera = state.camera as unknown as Parameters<typeof renderPortal>[3]['camera'];
    if (dive.phase === 'pull') renderView(gl, portal.win.target, tunnel, camera);
    if (dive.phase !== 'idle' || forge.portal.value <= 0 || frozen.value) return;
    renderPortal(gl, portal.win, system, {
      camera,
      pendant: pendant.group,
      elapsed: state.clock.elapsedTime,
    });
  });
  return null;
}
