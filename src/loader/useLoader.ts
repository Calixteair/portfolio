import { useCallback, useEffect, useRef, useState } from 'react';
import { createLoaderController, type LoaderController } from './controller';
import type { LoaderPhase, Stage } from './progress';

/**
 * The island's handle on the static loader: current phase (and whether it was entered by
 * "Passer l'intro"), milestones, failure.
 */
export function useLoader() {
  const [phase, setPhase] = useState<LoaderPhase>('loading');
  const [skipped, setSkipped] = useState(false);
  const controller = useRef<LoaderController | null>(null);

  useEffect(() => {
    const c = createLoaderController(document.getElementById('loader'));
    controller.current = c;
    c.onPhase((p) => {
      setSkipped(c.skipped());
      setPhase(p);
    });
    c.reach('hydrated');
    return c.dispose;
  }, []);

  const reach = useCallback((stage: Stage) => controller.current?.reach(stage), []);
  const fail = useCallback((error: unknown) => {
    console.error('[3D] falling back to the classic version:', error);
    controller.current?.fail();
  }, []);
  return { phase, skipped, reach, fail };
}
