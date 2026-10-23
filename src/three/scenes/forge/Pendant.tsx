import { useEffect, useMemo } from 'react';
import { createPendant } from '../../pendant/placeholder';

/** Mounts the procedural placeholder; the final GLB will replace createPendant() only. */
export default function Pendant() {
  const pendant = useMemo(() => createPendant(), []);
  useEffect(() => pendant.dispose, [pendant]);
  return <primitive object={pendant.group} rotation={[0.06, 0.35, 0]} />;
}
