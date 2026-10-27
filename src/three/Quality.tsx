// Deep import: drei's barrel pulls modules importing WebGL-only classes from 'three',
// which resolves to three/webgpu here (vite alias).
import {
  PerformanceMonitor,
  type PerformanceMonitorApi,
} from '@react-three/drei/core/PerformanceMonitor';
import { useCallback, useEffect } from 'react';
import {
  dprFor,
  setTier,
  shiftTier,
  startTier,
  type LiveQuality,
  type QualityTier,
} from './quality';
import { useWebGPU } from './useWebGPU';

/** Set the live tier, mirrored on <html data-quality> for e2e tests and debugging. */
function applyTier(live: LiveQuality, tier: QualityTier, ceiling = live.ceiling): void {
  setTier(live, tier, ceiling);
  document.documentElement.dataset.quality = tier;
}

/**
 * Quality levels (SPEC §7): starts from the device hints, then PerformanceMonitor watches
 * the real frame rate. Its factor scales the pixel ratio smoothly; sustained drops or
 * headroom move the tier, which the effects and the portal resolution follow.
 */
interface QualityProps {
  live: LiveQuality;
  /**
   * The Canvas's `dpr` prop setter: R3F re-applies that prop on every render of the
   * Canvas, so a `setDpr` from inside would be undone by the next one.
   */
  setDpr: (dpr: number) => void;
}

export default function Quality({ live, setDpr }: QualityProps) {
  const { gl } = useWebGPU();

  useEffect(() => {
    const start = startTier(gl);
    applyTier(live, start.tier, start.ceiling);
    setDpr(dprFor(live.tier, 1, devicePixelRatio));
  }, [gl, live, setDpr]);

  const onChange = useCallback(
    ({ factor }: PerformanceMonitorApi) => setDpr(dprFor(live.tier, factor, devicePixelRatio)),
    [live, setDpr],
  );
  const onDecline = useCallback(() => applyTier(live, shiftTier(live.tier, -1)), [live]);
  const onIncline = useCallback(
    () => applyTier(live, shiftTier(live.tier, 1, live.ceiling)),
    [live],
  );
  return (
    <PerformanceMonitor
      factor={1}
      onChange={onChange}
      onDecline={onDecline}
      onIncline={onIncline}
    />
  );
}
