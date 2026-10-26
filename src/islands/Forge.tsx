import ForgeDirector from '../three/scenes/forge/ForgeDirector';
import ForgeLighting from '../three/scenes/forge/ForgeLighting';
import ForgeWorld from '../three/scenes/forge/ForgeWorld';
import Pendant from '../three/scenes/forge/Pendant';
import Sparks from '../three/scenes/forge/Sparks';
import Swarm from '../three/scenes/forge/Swarm';
import Portal from '../three/scenes/portal/Portal';
import type { useWorld } from './useWorld';

interface ForgeProps {
  world: ReturnType<typeof useWorld>;
  /** The visitor pressed Entrer: the journey runs and the pendant takes input. */
  entered: boolean;
}

/** Everything on the forge side of the portal; unmounted (and disposed) once past it. */
export default function Forge({ world, entered }: ForgeProps) {
  const { forge, lights, pendant, runtime, system } = world;
  return (
    <>
      <ForgeLighting lights={lights} uniforms={forge} />
      <ForgeWorld uniforms={forge} />
      <ForgeDirector runtime={runtime} uniforms={forge} active={entered} />
      <Pendant
        pendant={pendant}
        spin={runtime.spin}
        journey={runtime.journey}
        interactive={entered}
        onStrike={world.onStrike}
      />
      <Sparks pendant={pendant} forge={forge} spin={runtime.spin} />
      <Swarm pendant={pendant} forge={forge} />
      <Portal
        pendant={pendant}
        forge={forge}
        system={system}
        frozen={world.frozen}
        onReady={world.setPortalCamera}
        readiness={world.readiness}
      />
    </>
  );
}
