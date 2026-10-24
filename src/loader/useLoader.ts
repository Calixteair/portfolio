import { useCallback, useEffect, useRef, useState } from 'react';
import { createLoaderController, type LoaderController } from './controller';
import type { LoaderPhase, Stage } from './progress';

/** The island's handle on the static loader: current phase, milestones, failure. */
export function useLoader() {
  const [phase, setPhase] = useState<LoaderPhase>('loading');
  const controller = useRef<LoaderController | null>(null);

  useEffect(() => {
    const c = createLoaderController(document.getElementById('loader'));
    controller.current = c;
    c.onPhase(setPhase);
    c.reach('hydrated');
    return c.dispose;
  }, []);

  const reach = useCallback((stage: Stage) => controller.current?.reach(stage), []);
  const fail = useCallback((error: unknown) => {
    console.error('[3D] falling back to the classic version:', error);
    controller.current?.fail();
  }, []);
  return { phase, reach, fail };
}
