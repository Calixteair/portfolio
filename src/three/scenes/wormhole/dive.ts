import type { gsap as Gsap } from 'gsap';

type Timeline = ReturnType<typeof Gsap.timeline>;
import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import { arrive, enterPortal } from '../../../journey/machine';
import type { ForgeRuntime } from '../../../journey/runtime';
import type { Pendant } from '../../pendant/placeholder';
import { REST_ANGLE, type SpinState } from '../../pendant/spin';
import { HOLE } from '../../pendant/shape';
import type { DiveReadiness } from '../../readiness';
import type { PortalSystem } from '../portal/system';
import { ARRIVAL, poseArrival } from '../portal/window';
import type { LensUniforms } from '../../post/lens';
import { showStage, type StageView } from '../../stage';
import type { Tunnel } from './tunnel';

/** Timeline beats, in seconds (SPEC §5.6: about 3 s). */
const BEATS = { pull: 0.8, tunnel: 2.4, flash: 2.45, end: 3 } as const;

/** What the dive moves: forge camera, lens, tunnel, and where to land. */
export interface DiveCast {
  forgeCamera: PerspectiveCamera;
  /** The pendant swings back to its resting yaw, so the hole faces the camera. */
  spin: SpinState;
  /** World point the camera is pulled towards (the centre of the hole). */
  portalCentre: Vector3;
  lens: LensUniforms;
  tunnel: Tunnel;
  stage: StageView;
  /** Shows the planetary system full screen, from the portal camera (seamless arrival). */
  land: () => void;
  /** That camera: after the flash it glides out through the ring. */
  arrival: PerspectiveCamera;
}

/** 0 → 1 → back, for the camera pull: lerps the camera position towards the portal. */
function pullTowards(camera: PerspectiveCamera, target: Vector3) {
  const from = camera.position.clone();
  const state = { t: 0 };
  return {
    state,
    apply: () => camera.position.lerpVectors(from, target, state.t * 0.85),
  };
}

/** Nearest angle to `from` that shows the pendant at its resting yaw (frames the star). */
function restingYaw(from: number): number {
  const turn = Math.PI * 2;
  return REST_ANGLE + Math.round((from - REST_ANGLE) / turn) * turn;
}

/** Stage 1 (0-0.8 s): pulled towards the portal, the FOV widens abruptly (vertigo). */
function addPull(tl: Timeline, cast: DiveCast) {
  cast.spin.velocity = 0;
  tl.to(
    cast.spin,
    { angle: restingYaw(cast.spin.angle), duration: BEATS.pull * 0.6, ease: 'power2.out' },
    0,
  );
  const pull = pullTowards(cast.forgeCamera, cast.portalCentre);
  tl.to(pull.state, { t: 1, duration: BEATS.pull, ease: 'power3.in', onUpdate: pull.apply }, 0);
  tl.to(
    cast.forgeCamera,
    {
      fov: 95,
      duration: BEATS.pull,
      ease: 'expo.in',
      onUpdate: () => cast.forgeCamera.updateProjectionMatrix(),
    },
    0,
  );
  tl.to(cast.lens.zoomBlur, { value: 0.35, duration: BEATS.pull, ease: 'power2.in' }, 0);
  tl.to(cast.lens.aberration, { value: 0.012, duration: BEATS.pull, ease: 'power2.in' }, 0);
}

/** Stage 2 (0.8-2.4 s): through the tunnel, rising blur and aberration, slight roll. */
function addTunnel(tl: Timeline, cast: DiveCast) {
  const flight = { t: 0, roll: 0 };
  tl.call(() => showStage(cast.stage, cast.tunnel.scene, cast.tunnel.camera), [], BEATS.pull);
  tl.to(
    flight,
    {
      t: 1,
      roll: 0.6,
      duration: BEATS.tunnel - BEATS.pull,
      ease: 'power1.inOut',
      onUpdate: () => cast.tunnel.fly(flight.t, flight.roll),
    },
    BEATS.pull,
  );
  tl.fromTo(
    cast.tunnel.rush,
    { value: 2 },
    { value: 9, duration: BEATS.tunnel - BEATS.pull, ease: 'power2.in' },
    BEATS.pull,
  );
  tl.to(
    cast.lens.zoomBlur,
    { value: 0.9, duration: BEATS.tunnel - BEATS.pull, ease: 'power2.in' },
    BEATS.pull,
  );
  tl.to(cast.lens.aberration, { value: 0.025, duration: BEATS.tunnel - BEATS.pull }, BEATS.pull);
}

/** Stage 3 (2.4-3 s): flash, then out through the ring into the planetary system. */
function addArrival(tl: Timeline, cast: DiveCast, rest: { aberration: number }) {
  tl.to(
    cast.lens.flash,
    { value: 1, duration: BEATS.flash - BEATS.tunnel, ease: 'power4.in' },
    BEATS.tunnel,
  );
  tl.call(cast.land, [], BEATS.flash);
  const glide = { z: ARRIVAL.fromZ };
  tl.to(
    glide,
    {
      z: ARRIVAL.toZ,
      duration: 1.6,
      ease: 'power2.out',
      onUpdate: () => poseArrival(cast.arrival, cast.arrival.aspect, glide.z),
    },
    BEATS.flash,
  );
  tl.to(
    cast.lens.flash,
    { value: 0, duration: BEATS.end - BEATS.flash, ease: 'power2.out' },
    BEATS.flash,
  );
  tl.to(
    cast.lens.zoomBlur,
    { value: 0, duration: BEATS.end - BEATS.flash, ease: 'power2.out' },
    BEATS.flash,
  );
  tl.to(
    cast.lens.aberration,
    { value: rest.aberration, duration: BEATS.end - BEATS.flash },
    BEATS.flash,
  );
}

/**
 * The wormhole dive (SPEC §5.6) as a GSAP timeline: vertigo pull, tunnel, flash, arrival.
 * Resolves when the visitor is in the planetary system.
 */
export function playDive(gsap: typeof Gsap, cast: DiveCast): Promise<void> {
  const rest = { aberration: cast.lens.aberration.value };
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    addPull(tl, cast);
    addTunnel(tl, cast);
    addArrival(tl, cast, rest);
  });
}

/** prefers-reduced-motion: no flight, a short fade through white (SPEC §2). */
export function playFade(gsap: typeof Gsap, cast: DiveCast): Promise<void> {
  return new Promise((resolve) => {
    const tl = gsap.timeline({ onComplete: resolve });
    tl.to(cast.lens.flash, { value: 1, duration: 0.4, ease: 'power1.in' });
    tl.call(cast.land);
    // No glide: straight to the arrival point, in front of the ring.
    tl.call(() => poseArrival(cast.arrival, cast.arrival.aspect, ARRIVAL.toZ));
    tl.to(cast.lens.flash, { value: 0, duration: 0.5, ease: 'power1.out' });
  });
}

/** Everything the dive needs, known when the scene is built. */
export interface DiveSetup {
  runtime: ForgeRuntime;
  /** Shaders of the other side compiled: no stall (or blank frame) after the flash. */
  readiness: DiveReadiness;
  /** Portal opening, 0-1: no diving through a half-open portal. */
  portalOpen: { value: number };
  pendant: Pendant;
  lens: LensUniforms;
  tunnel: Tunnel;
  stage: StageView;
  system: PortalSystem;
  portalCamera: { current: PerspectiveCamera | null };
  /** Set on arrival: the portal stops re-posing its camera. */
  frozen: { value: boolean };
  onArrived: () => void;
}

/** Hole centre in world space at the resting yaw (where the pendant swings to). */
function holeCentre(pendant: Pendant): Vector3 {
  const group = pendant.group;
  const yaw = group.rotation.y;
  group.rotation.y = REST_ANGLE;
  group.updateMatrixWorld();
  const centre = group.localToWorld(new Vector3(HOLE.cx, HOLE.cy, 0));
  group.rotation.y = yaw;
  group.updateMatrixWorld();
  return centre;
}

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

function mirrorState(state: string): void {
  document.documentElement.dataset.state = state;
}

/**
 * Starts the dive once, from the open portal, when GSAP and the portal camera are ready.
 * Kept outside React: it mutates the scene and the journey.
 */
export function createDiveController(setup: DiveSetup, camera: PerspectiveCamera) {
  let gsap: typeof Gsap | null = null;
  let started = false;
  const start = () => {
    const eye = setup.portalCamera.current;
    const { system, tunnel } = setup.readiness;
    const ready = system && tunnel && setup.portalOpen.value >= 1;
    if (!ready || !gsap || !eye || started || !enterPortal(setup.runtime.journey)) return;
    started = true;
    mirrorState('wormhole');
    const cast: DiveCast = {
      forgeCamera: camera,
      spin: setup.runtime.spin,
      portalCentre: holeCentre(setup.pendant),
      lens: setup.lens,
      tunnel: setup.tunnel,
      stage: setup.stage,
      arrival: eye,
      land: () => {
        // From here the portal camera is the visitor's: the portal stops re-posing it.
        setup.frozen.value = true;
        poseArrival(eye, camera.aspect, ARRIVAL.fromZ);
        showStage(setup.stage, setup.system.scene, eye);
      },
    };
    void (reducedMotion() ? playFade : playDive)(gsap, cast).then(() => {
      arrive(setup.runtime.journey);
      mirrorState('portfolio');
      setup.onArrived();
    });
  };
  return {
    start,
    setGsap: (g: typeof Gsap) => {
      gsap = g;
    },
  };
}
