import type { gsap as Gsap } from 'gsap';
import type { Object3D, PerspectiveCamera, Vector3 } from 'three/webgpu';
import { bindPanels, hidePanels, revealSystemUi, showPanel } from '../../../system/panels';
import type { LensUniforms } from '../../post/lens';
import { createTravel, flyHome, flyTo, type Travel, type TravelLeg } from './travel';

export interface NavigationSetup {
  camera: PerspectiveCamera;
  lens: LensUniforms;
  objects: ReadonlyMap<string, Object3D>;
  radii: ReadonlyMap<string, number>;
  /** The arrival point, where "back" returns. */
  home: Vector3;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const slugFromHash = () => decodeURIComponent(location.hash.slice(1));

/**
 * Click a body (or a link to it): rocket travel into its orbit, then its panel. Back,
 * Escape or the browser's back button: the panel closes and the visitor flies home. The
 * open body lives in the URL (#slug), so links are shareable (SPEC §5.7).
 */
export function createNavigation(setup: NavigationSetup) {
  const travel: Travel = createTravel();
  let gsap: typeof Gsap | null = null;
  let busy = false;
  const leg = (): TravelLeg | null =>
    gsap && {
      gsap,
      camera: setup.camera,
      travel,
      lens: setup.lens,
      home: setup.home,
      reducedMotion: reducedMotion(),
    };

  const goTo = async (slug: string) => {
    const object = setup.objects.get(slug);
    const l = leg();
    if (!object || !l || busy || travel.target === object) return;
    busy = true;
    hidePanels();
    await flyTo(l, object, setup.radii.get(slug) ?? 1);
    busy = false;
    showPanel(slug);
  };
  const goHome = async () => {
    const l = leg();
    if (!l || busy || travel.phase === 'free') return;
    busy = true;
    hidePanels();
    await flyHome(l);
    busy = false;
  };

  /** From the visitor: record it in the history, so the back button returns. */
  const open = (slug: string) => {
    if (slugFromHash() !== slug) history.pushState({ body: slug }, '', `#${slug}`);
    void goTo(slug);
  };
  const back = () => {
    if (travel.phase === 'free') return;
    if (history.state?.body) history.back();
    else {
      history.replaceState(null, '', location.pathname);
      void goHome();
    }
  };
  /** The URL is the source of truth when the history moves. */
  const sync = () => {
    const slug = slugFromHash();
    if (slug && setup.objects.has(slug)) void goTo(slug);
    else void goHome();
  };

  const start = () => {
    revealSystemUi();
    const unbind = bindPanels({ open, back });
    window.addEventListener('popstate', sync);
    import('gsap')
      .then((m) => {
        gsap = m.gsap;
        if (slugFromHash()) sync(); // a shared link: fly straight to it
      })
      .catch((error: unknown) => console.error('[system] GSAP failed to load', error));
    return () => {
      unbind();
      window.removeEventListener('popstate', sync);
    };
  };
  return { travel, open, start };
}
