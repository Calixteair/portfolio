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
import { showStage, type DiveView, type StageView } from '../../stage';
import type { Tunnel } from './tunnel';

/**
 * Timeline beats, in seconds (SPEC §5.6): pulled through the hole until 0.8 s, through the
 * tunnel until 2.5 s, out of its mouth into the system, then a 1.6 s glide through the ring.
 */
const BEATS = { pull: 0.8, land: 2.5, glide: 1.6 } as const;

/** How close the camera gets to the hole: it then fills the screen, and the cut is unseen. */
const THROUGH = 0.025;
/** The tunnel's field of view, eased to from the pull's vertigo FOV. */
const TUNNEL_FOV = 60;
/** Where along the tunnel (0-1) the mouth fills the screen: the cut to the system. */
const MOUTH_FILLS = 0.99;

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
  /** What the hole and the tunnel's mouth show. */
  view: DiveView;
  /** Shows the planetary system full screen, from the portal camera (seamless arrival). */
  land: () => void;
  /** That camera: after the cut it glides out through the ring. */
  arrival: PerspectiveCamera;
}

/** 0 → 1: the camera moves towards the portal, stopping just short of the hole's plane. */
function pullTowards(camera: PerspectiveCamera, target: Vector3) {
  const from = camera.position.clone();
  const reach = 1 - THROUGH / from.distanceTo(target);
  const state = { t: 0 };
  return {
    state,
    apply: () => camera.position.lerpVectors(from, target, state.t * reach),
  };
}

/** Nearest angle to `from` that shows the pendant at its resting yaw (frames the star). */
function restingYaw(from: number): number {
  const turn = Math.PI * 2;
  return REST_ANGLE + Math.round((from - REST_ANGLE) / turn) * turn;
}

const updateProjection = (camera: PerspectiveCamera) => () => camera.updateProjectionMatrix();

/**
 * Stage 1 (0-0.8 s): pulled into the portal, the FOV widens abruptly (vertigo). The hole
 * already shows the tunnel's entrance, and ends up filling the screen.
 */
function addPull(tl: Timeline, cast: DiveCast) {
  cast.spin.velocity = 0;
  cast.view.phase = 'pull';
  cast.tunnel.fly(0, 0);
  // The camera gets closer to the hole than the default near plane.
  cast.forgeCamera.near = THROUGH / 5;
  tl.to(
    cast.spin,
    { angle: restingYaw(cast.spin.angle), duration: BEATS.pull * 0.6, ease: 'power2.out' },
    0,
  );
  const pull = pullTowards(cast.forgeCamera, cast.portalCentre);
  tl.to(pull.state, { t: 1, duration: BEATS.pull, ease: 'power3.in', onUpdate: pull.apply }, 0);
  const onUpdate = updateProjection(cast.forgeCamera);
  tl.to(cast.forgeCamera, { fov: 95, duration: BEATS.pull, ease: 'expo.in', onUpdate }, 0);
  tl.to(cast.lens.zoomBlur, { value: 0.35, duration: BEATS.pull, ease: 'power2.in' }, 0);
  tl.to(cast.lens.aberration, { value: 0.012, duration: BEATS.pull, ease: 'power2.in' }, 0);
}

/** The hole fills the screen: the tunnel takes over, with the same lens (same image). */
function enterTunnel(cast: DiveCast) {
  const { camera } = cast.tunnel;
  camera.fov = cast.forgeCamera.fov;
  camera.updateProjectionMatrix();
  cast.view.phase = 'tunnel';
  showStage(cast.stage, cast.tunnel.scene, camera);
}

/**
 * Stage 2 (0.8-2.5 s): through the tunnel. It slows down before the exit and the roll
 * settles back to level, so the mouth (the system, upright) can take over.
 */
function addTunnel(tl: Timeline, cast: DiveCast) {
  const span = BEATS.land - BEATS.pull;
  const flight = { p: 0 };
  tl.call(enterTunnel, [cast], BEATS.pull);
  tl.to(
    flight,
    {
      p: 1,
      duration: span,
      ease: 'sine.inOut',
      onUpdate: () => cast.tunnel.fly(flight.p * MOUTH_FILLS, 0.5 * Math.sin(Math.PI * flight.p)),
    },
    BEATS.pull,
  );
  const onUpdate = updateProjection(cast.tunnel.camera);
  tl.to(
    cast.tunnel.camera,
    { fov: TUNNEL_FOV, duration: span * 0.6, ease: 'power2.out', onUpdate },
    BEATS.pull,
  );
  tl.fromTo(
    cast.tunnel.rush,
    { value: 2 },
    { value: 7, duration: span, ease: 'power1.inOut' },
    BEATS.pull,
  );
  tl.to(cast.lens.zoomBlur, { value: 0.7, duration: span * 0.5, ease: 'power2.in' }, BEATS.pull);
  tl.to(cast.lens.zoomBlur, { value: 0.25, duration: span * 0.5 }, BEATS.pull + span * 0.5);
  tl.to(cast.lens.aberration, { value: 0.02, duration: span * 0.5 }, BEATS.pull);
}

/**
 * Stage 3 (2.5 s →): the mouth fills the screen, the system takes over with a faint glint
 * and its bloom fading in, then the camera glides out through the ring as the FOV settles.
 */
function addArrival(tl: Timeline, cast: DiveCast, rest: { aberration: number; bloom: number }) {
  tl.to(cast.lens.flash, { value: 0.06, duration: 0.15, ease: 'power2.in' }, BEATS.land - 0.15);
  tl.call(cast.land, [], BEATS.land);
  // The mouth showed the system without bloom: it comes back gradually, no pop at the cut.
  tl.fromTo(
    cast.lens.bloomStrength,
    { value: 0 },
    { value: rest.bloom, duration: 1.2, ease: 'power1.inOut' },
    BEATS.land,
  );
  const glide = { d: ARRIVAL.from, fov: TUNNEL_FOV };
  tl.to(
    glide,
    {
      d: ARRIVAL.to,
      fov: ARRIVAL.fov,
      duration: BEATS.glide,
      ease: 'power2.out',
      onUpdate: () => poseArrival(cast.arrival, cast.arrival.aspect, glide.d, glide.fov),
    },
    BEATS.land,
  );
  tl.to(cast.lens.flash, { value: 0, duration: 0.5, ease: 'power2.out' }, BEATS.land);
  tl.to(cast.lens.zoomBlur, { value: 0, duration: 0.8, ease: 'power2.out' }, BEATS.land);
  tl.to(cast.lens.aberration, { value: rest.aberration, duration: 0.8 }, BEATS.land);
}

/**
 * The wormhole dive (SPEC §5.6) as a GSAP timeline: vertigo pull, tunnel, arrival. No cut
 * is visible: each scene is first seen through a window (the hole, then the tunnel's mouth).
 * Resolves when the visitor is in the planetary system.
 */
export function playDive(gsap: typeof Gsap, cast: DiveCast): Promise<void> {
  const rest = { aberration: cast.lens.aberration.value, bloom: cast.lens.bloomStrength.value };
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
    tl.call(() => poseArrival(cast.arrival, cast.arrival.aspect, ARRIVAL.to));
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
  view: DiveView;
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
    const { system, tunnel, lens } = setup.readiness;
    const ready = system && tunnel && lens && setup.portalOpen.value >= 1;
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
      view: setup.view,
      arrival: eye,
      land: () => {
        // From here the portal camera is the visitor's: the portal stops re-posing it.
        setup.frozen.value = true;
        setup.view.phase = 'done';
        // Same lens as the tunnel camera, which the mouth was showing the system through.
        poseArrival(eye, camera.aspect, ARRIVAL.from, setup.tunnel.camera.fov);
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
