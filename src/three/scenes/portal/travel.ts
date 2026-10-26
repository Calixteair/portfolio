import type { gsap as Gsap } from 'gsap';
import { Vector3, type Object3D, type PerspectiveCamera } from 'three/webgpu';
import type { LensUniforms } from '../../post/lens';

type Timeline = ReturnType<typeof Gsap.timeline>;

/** Rocket travel beats, in seconds (SPEC §5.7: about 2.5 s). */
const BEATS = { ignition: 0.45, cruise: 1.5, brake: 0.6 } as const;
const TOTAL = BEATS.ignition + BEATS.cruise + BEATS.brake;

export type TravelPhase = 'free' | 'outbound' | 'orbit' | 'inbound';

/** Camera travel between the arrival point and an orbit around a body. */
export interface Travel {
  phase: TravelPhase;
  target: Object3D | null;
  /** Orbit distance from the target's centre. */
  distance: number;
  /** Angle around the target while in orbit (slow drift). */
  orbitAngle: number;
}

export function createTravel(): Travel {
  return { phase: 'free', target: null, distance: 3, orbitAngle: 0 };
}

const tmp = new Vector3();
const toCamera = new Vector3();

/**
 * Where the camera sits in orbit: on the side facing the arrival point, a little above,
 * at `distance`; the body is then framed left of centre, leaving room for the panel.
 */
export function orbitPoint(travel: Travel, home: Vector3, out: Vector3): Vector3 {
  const target = travel.target;
  if (!target) return out.copy(home);
  target.getWorldPosition(tmp);
  toCamera.subVectors(home, tmp).setY(0).normalize();
  toCamera.applyAxisAngle(UP, travel.orbitAngle);
  return out
    .copy(tmp)
    .addScaledVector(toCamera, travel.distance)
    .add(LIFT.clone().multiplyScalar(travel.distance));
}

const UP = new Vector3(0, 1, 0);
const LIFT = new Vector3(0, 0.25, 0);
const look = new Vector3();
const side = new Vector3();

/** Aim at the target, offset so the body sits left of centre (panel on the right). */
export function aimAtTarget(camera: PerspectiveCamera, travel: Travel, amount: number): void {
  if (!travel.target) return;
  travel.target.getWorldPosition(look);
  side.subVectors(look, camera.position).cross(UP).normalize();
  camera.lookAt(look.addScaledVector(side, travel.distance * 0.35 * amount));
}

interface Leg {
  gsap: typeof Gsap;
  camera: PerspectiveCamera;
  travel: Travel;
  lens: LensUniforms;
  home: Vector3;
  reducedMotion: boolean;
}

/**
 * Ignition, cruise, braking: from wherever the camera is (home or another orbit) to a
 * destination that may move (a body in orbit), aiming more and more at the target.
 */
function flight(
  tl: Timeline,
  leg: Leg,
  dest: (out: Vector3) => Vector3,
  aim: (t: number) => number,
) {
  const { camera, travel, lens } = leg;
  const from = camera.position.clone();
  const state = { t: 0 };
  const point = new Vector3();
  const update = () => {
    camera.position.lerpVectors(from, dest(point), state.t);
    aimAtTarget(camera, travel, aim(state.t));
  };
  const fov = (value: number, duration: number, at: number) =>
    tl.to(
      camera,
      { fov: value, duration, ease: 'power2.out', onUpdate: () => camera.updateProjectionMatrix() },
      at,
    );
  tl.to(state, { t: 1, duration: TOTAL, ease: 'power2.inOut', onUpdate: update }, 0);
  // Ignition narrows the FOV; the cruise streaks (zoom blur); braking eases back.
  fov(38, BEATS.ignition, 0);
  tl.to(
    lens.zoomBlur,
    { value: 0.55, duration: BEATS.cruise * 0.5, ease: 'power2.in' },
    BEATS.ignition,
  );
  tl.to(
    lens.zoomBlur,
    { value: 0, duration: BEATS.cruise * 0.5 + BEATS.brake, ease: 'power2.out' },
    BEATS.ignition + BEATS.cruise * 0.5,
  );
  fov(50, BEATS.brake + BEATS.cruise * 0.5, BEATS.ignition + BEATS.cruise * 0.5);
}

/** prefers-reduced-motion: no flight, a short fade through white to the destination. */
function fade(tl: Timeline, leg: Leg, dest: (out: Vector3) => Vector3, aim: (t: number) => number) {
  const point = new Vector3();
  tl.to(leg.lens.flash, { value: 1, duration: 0.3, ease: 'power1.in' });
  tl.call(() => {
    leg.camera.position.copy(dest(point));
    aimAtTarget(leg.camera, leg.travel, aim(1));
  });
  tl.to(leg.lens.flash, { value: 0, duration: 0.4, ease: 'power1.out' });
}

function play(
  leg: Leg,
  dest: (out: Vector3) => Vector3,
  aim: (t: number) => number,
  done: () => void,
) {
  return new Promise<void>((resolve) => {
    const tl = leg.gsap.timeline({
      onComplete: () => {
        done();
        resolve();
      },
    });
    (leg.reducedMotion ? fade : flight)(tl, leg, dest, aim);
  });
}

/** Fly into orbit around `target` (from home or another orbit); resolves once in orbit. */
export function flyTo(leg: Leg, target: Object3D, radius: number): Promise<void> {
  const { travel } = leg;
  travel.target = target;
  travel.distance = Math.max(2.2, radius * 4.5);
  travel.orbitAngle = 0;
  travel.phase = 'outbound';
  return play(
    leg,
    (out) => orbitPoint(travel, leg.home, out),
    () => 1,
    () => {
      travel.phase = 'orbit';
    },
  );
}

/** Fly back to the arrival point; resolves once home. */
export function flyHome(leg: Leg): Promise<void> {
  const { travel } = leg;
  travel.phase = 'inbound';
  return play(
    leg,
    (out) => out.copy(leg.home),
    (t) => 1 - t,
    () => {
      travel.phase = 'free';
      travel.target = null;
    },
  );
}

/** While in orbit: drift slowly around the body, keep it framed. */
export function holdOrbit(
  camera: PerspectiveCamera,
  travel: Travel,
  home: Vector3,
  dt: number,
): void {
  travel.orbitAngle += dt * 0.06;
  orbitPoint(travel, home, camera.position);
  aimAtTarget(camera, travel, 1);
}

export type { Leg as TravelLeg };
