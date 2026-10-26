import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { PointLight, type Node } from 'three/webgpu';
import { PALETTE_B } from '../../../shaders/nebula';
import { portalOpening } from '../../../shaders/portalOpening';
import type { Pendant } from '../../pendant/placeholder';
import { HOLE } from '../../pendant/shape';
import { useWebGPU } from '../../useWebGPU';
import type { ForgeUniforms } from '../forge/uniforms';
import { createPortalSystem } from './system';
import { createPortalWindow, renderPortal, resizePortal } from './window';

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
  const system = createPortalSystem();
  const win = createPortalWindow(pendant.outline.hole, (view: Node<'vec4'>) =>
    portalOpening(view, forge.portal),
  );
  const spill = createSpillLights();
  pendant.group.add(win.surface, ...spill);
  const dispose = () => {
    pendant.group.remove(win.surface, ...spill);
    win.dispose();
    system.dispose();
  };
  return { system, win, spill, dispose };
}

/** The other side, seen through the hole once the portal opens (SPEC §5.5). */
export default function Portal({ pendant, forge }: { pendant: Pendant; forge: ForgeUniforms }) {
  const { gl } = useWebGPU();
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const portal = useMemo(() => buildPortal(pendant, forge), [pendant, forge]);

  useEffect(() => {
    // Compile the other side early, so opening the portal does not stall a frame.
    gl.compileAsync(portal.system.scene, portal.win.camera).catch((e: unknown) => console.error(e));
    return portal.dispose;
  }, [gl, portal]);
  useEffect(
    () => resizePortal(portal.win, size.width * dpr, size.height * dpr),
    [portal, size, dpr],
  );

  useFrame((state) => {
    setSpill(portal.spill, forge.portal.value);
    if (forge.portal.value <= 0) return;
    renderPortal(gl, portal.win, portal.system, {
      camera: state.camera as unknown as Parameters<typeof renderPortal>[3]['camera'],
      pendant: pendant.group,
      elapsed: state.clock.elapsedTime,
    });
  });
  return null;
}
