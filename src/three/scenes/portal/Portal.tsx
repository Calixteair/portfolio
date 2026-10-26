import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { step } from 'three/tsl';
import type { Node } from 'three/webgpu';
import type { Pendant } from '../../pendant/placeholder';
import { useWebGPU } from '../../useWebGPU';
import type { ForgeUniforms } from '../forge/uniforms';
import { createPortalSystem } from './system';
import { createPortalWindow, renderPortal, resizePortal } from './window';

function buildPortal(pendant: Pendant, forge: ForgeUniforms) {
  const system = createPortalSystem();
  const win = createPortalWindow(pendant.outline.hole, (view: Node<'vec4'>) => ({
    color: view.rgb,
    alpha: step(0.001, forge.portal),
  }));
  pendant.group.add(win.surface);
  const dispose = () => {
    pendant.group.remove(win.surface);
    win.dispose();
    system.dispose();
  };
  return { system, win, dispose };
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
    if (forge.portal.value <= 0) return;
    renderPortal(gl, portal.win, portal.system, {
      camera: state.camera as unknown as Parameters<typeof renderPortal>[3]['camera'],
      pendant: pendant.group,
      elapsed: state.clock.elapsedTime,
    });
  });
  return null;
}
