import type { gsap as Gsap } from 'gsap';
import { Matrix4, Quaternion, Vector3, type Object3D, type PerspectiveCamera } from 'three/webgpu';
import {
  aroundStar,
  arrivalHandle,
  bezier,
  bezierTangent,
  easeFlight,
  normalize,
  orbitEntry,
  startFlight,
  type V3,
} from '../../../system/flightPath';
import type { LensUniforms } from '../../post/lens';

type Timeline = ReturnType<typeof Gsap.timeline>;

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

/** Where a flight goes, re-evaluated every frame (the destination body moves). */
interface Destination {
  /** End point, out param. */
  point: (out: Vector3) => Vector3;
  /** Direction of motion when arriving (the orbit's tangent, or towards the star). */
  arrival: (out: Vector3) => Vector3;
  /** The orientation to end with (aiming at the body, or at the star). */
  aim: (camera: PerspectiveCamera) => void;
  /** Share of the flight (eased) over which the view turns to `aim`: [start, end]. */
  aimSpan: readonly [number, number];
}

const v3 = (v: Vector3): V3 => [v.x, v.y, v.z];
const qStart = new Quaternion();
const qMotion = new Quaternion();
const qAim = new Quaternion();
const qBank = new Quaternion();
const motionMatrix = new Matrix4();
const ahead = new Vector3();
const later = new Vector3();
const sight = new Vector3();
const right = new Vector3();
const smooth = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Bank into turns: roll by the sideways change of heading (none when flying straight). */
function bankAngle(heading: Vector3, next: Vector3): number {
  right.crossVectors(heading, UP).normalize();
  return Math.max(-0.35, Math.min(0.35, -next.sub(heading).dot(right) * 6));
}

/** How far ahead on the route the pilot looks (share of the flight). */
const LOOK_AHEAD = 0.18;

/**
 * The shuttle: along the Bézier route (src/system/flightPath.ts), looking at a point a
 * little further along it (the view follows the route, not the raw velocity, which
 * points at the empty sky during the swing) and banking into the turns, then turning to
 * the destination. No zoom: the FOV stays put, only a faint streak at full speed.
 */
function flight(tl: Timeline, leg: Leg, dest: Destination, heading: Vector3) {
  const { camera, lens } = leg;
  const end = dest.point(new Vector3());
  const start = startFlight(v3(camera.position), v3(heading), v3(end));
  qStart.copy(camera.quaternion);
  const state = { t: 0 };
  const arrival = new Vector3();
  const update = () => {
    const t = easeFlight(state.t);
    const to = v3(dest.point(end));
    const p2 = arrivalHandle(start, to, v3(dest.arrival(arrival)));
    const [p1, q2] = aroundStar(start.p0, start.p1, p2, to);
    camera.position.set(...bezier(start.p0, p1, q2, to, t));
    ahead.set(...normalize(bezierTangent(start.p0, p1, q2, to, t)));
    later.set(...normalize(bezierTangent(start.p0, p1, q2, to, Math.min(1, t + 0.02))));
    sight.set(...bezier(start.p0, p1, q2, to, Math.min(1, t + LOOK_AHEAD)));
    if (sight.distanceToSquared(camera.position) < 1e-4) sight.copy(camera.position).add(ahead);
    motionMatrix.lookAt(camera.position, sight, UP);
    qMotion.setFromRotationMatrix(motionMatrix);
    const turn = 1 - smooth(dest.aimSpan[0], dest.aimSpan[1], t);
    qBank.setFromAxisAngle(ahead, bankAngle(ahead, later) * turn);
    qMotion.premultiply(qBank);
    dest.aim(camera);
    qAim.copy(camera.quaternion);
    camera.quaternion.slerpQuaternions(qStart, qMotion, smooth(0, 0.25, t));
    camera.quaternion.slerp(qAim, smooth(dest.aimSpan[0], dest.aimSpan[1], t));
  };
  tl.to(state, { t: 1, duration: start.duration, ease: 'none', onUpdate: update }, 0);
  tl.to(lens.zoomBlur, { value: 0.12, duration: start.duration * 0.5, ease: 'sine.in' }, 0);
  tl.to(
    lens.zoomBlur,
    { value: 0, duration: start.duration * 0.5, ease: 'sine.out' },
    start.duration * 0.5,
  );
}

/** prefers-reduced-motion: no flight, a short fade through white to the destination. */
function fade(tl: Timeline, leg: Leg, dest: Destination) {
  const point = new Vector3();
  tl.to(leg.lens.flash, { value: 1, duration: 0.3, ease: 'power1.in' });
  tl.call(() => {
    leg.camera.position.copy(dest.point(point));
    dest.aim(leg.camera);
  });
  tl.to(leg.lens.flash, { value: 0, duration: 0.4, ease: 'power1.out' });
}

function play(leg: Leg, dest: Destination, heading: Vector3, done: () => void) {
  return new Promise<void>((resolve) => {
    const tl = leg.gsap.timeline({
      onComplete: () => {
        done();
        resolve();
      },
    });
    if (leg.reducedMotion) fade(tl, leg, dest);
    else flight(tl, leg, dest, heading);
  });
}

const center = new Vector3();
const radial = new Vector3();

/**
 * The current motion, where the shuttle leaves along: around the orbit (its tangent,
 * slightly outwards) when leaving a body, else straight ahead.
 */
function currentHeading(leg: Leg, out: Vector3): Vector3 {
  const { travel, camera } = leg;
  if (travel.phase !== 'orbit' || !travel.target) return camera.getWorldDirection(out);
  travel.target.getWorldPosition(center);
  radial.subVectors(camera.position, center).setY(0).normalize();
  return out.set(radial.z, 0, -radial.x).addScaledVector(radial, 0.35).normalize();
}

/** The orbit angle (see orbitPoint) of the tangential entry point when arriving from `from`. */
function entryAngle(travel: Travel, home: Vector3, from: Vector3): number {
  if (!travel.target) return 0;
  travel.target.getWorldPosition(center);
  const [ex, , ez] = orbitEntry(v3(center), v3(from));
  radial.subVectors(home, center).setY(0).normalize();
  return Math.atan2(radial.z * ex - radial.x * ez, radial.x * ex + radial.z * ez);
}

/** Fly into orbit around `target`, `distance` away (from home or another orbit). */
export function flyTo(leg: Leg, target: Object3D, distance: number): Promise<void> {
  const { travel, camera, home } = leg;
  const heading = currentHeading(leg, new Vector3());
  travel.target = target;
  travel.distance = distance;
  travel.orbitAngle = entryAngle(travel, home, camera.position);
  travel.phase = 'outbound';
  const dest: Destination = {
    point: (out) => orbitPoint(travel, home, out),
    // The orbit's tangent at the entry point (direction of increasing angle).
    arrival: (out) => {
      orbitPoint(travel, home, out);
      target.getWorldPosition(center);
      radial.subVectors(out, center).setY(0).normalize();
      return out.set(radial.z, 0, -radial.x);
    },
    aim: (cam) => aimAtTarget(cam, travel, 1),
    aimSpan: [0.6, 1],
  };
  return play(leg, dest, heading, () => {
    travel.phase = 'orbit';
  });
}

/** Fly back to the arrival point; resolves once home, facing the star. */
export function flyHome(leg: Leg): Promise<void> {
  const { travel, home } = leg;
  const heading = currentHeading(leg, new Vector3());
  travel.phase = 'inbound';
  const dest: Destination = {
    point: (out) => out.copy(home),
    // Backing out to the overview, the system kept in view (arriving head-on, the route
    // would overshoot through the ring and stare at empty space).
    arrival: (out) => out.copy(home).normalize(),
    aim: (cam) => cam.lookAt(0, 0, 0),
    // Facing the system again early: going back, the view is the point.
    aimSpan: [0.05, 0.4],
  };
  return play(leg, dest, heading, () => {
    travel.phase = 'free';
    travel.target = null;
  });
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
