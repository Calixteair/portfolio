import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo } from 'react';
import { Vector3, type PerspectiveCamera } from 'three/webgpu';
import {
  createLook,
  lookTowards,
  stepLook,
  viewDirection,
  type LookState,
} from '../../../system/look';
import { bindLook } from '../../../system/lookInput';
import { bindMap } from '../../../system/map';
import { bindTitles, type Titles } from '../../../system/titles';
import type { PortalSystem } from './system';
import type { LensUniforms } from '../../post/lens';
import { hideLabel, placeTitles, showLabel, type LabelText } from './label';
import { createNavigation } from './navigation';
import { pickBody, screenPoint } from './picking';
import { holdOrbit, type Travel } from './travel';
import { ARRIVAL, arrivalPoint } from './window';

const MAX_FRAME_DT = 0.05;

/** The arrival view looks at the star: its yaw and pitch, the base of the 360° look. */
const ARRIVAL_POINT = arrivalPoint(ARRIVAL.to);
const BASE = { yaw: 0, pitch: Math.atan2(-ARRIVAL_POINT.y, ARRIVAL_POINT.z) };

type LookBinding = ReturnType<typeof bindLook>;

type Navigation = ReturnType<typeof createNavigation>;

interface Holder {
  binding: LookBinding | null;
  nav: Navigation | null;
  hovered: string | null;
  /** A body pointed at in the map's list (takes over from the pointer in 3D). */
  listed: string | null;
  titles: Titles | null;
}

/**
 * Wires the look input and the navigation in an effect, exposing them to the frame loop
 * through a holder (nothing is created during render).
 */
function attachExplore(
  holder: Holder,
  setup: { canvas: HTMLElement; look: LookState; camera: PerspectiveCamera | null },
  deps: { lens: LensUniforms; system: PortalSystem },
) {
  if (!setup.camera) return undefined;
  const nav = createNavigation({
    camera: setup.camera,
    lens: deps.lens,
    objects: deps.system.bodies.objects,
    reach: deps.system.bodies.reach,
    home: ARRIVAL_POINT,
    focus: deps.system.bodies.focus,
  });
  const stopNav = nav.start();
  const stopMap = bindMap({
    mark: deps.system.bodies.mark,
    hover: (slug) => void (holder.listed = slug),
    open: nav.open,
  });
  const titles = bindTitles((slug) => void (holder.listed = slug));
  const binding = bindLook(setup.canvas, setup.look, () => {
    if (holder.hovered) nav.open(holder.hovered);
  });
  Object.assign(holder, { binding, nav, titles });
  return () => {
    binding.dispose();
    titles?.dispose();
    stopMap();
    stopNav();
    Object.assign(holder, { binding: null, nav: null, titles: null });
  };
}

const forward = new Vector3();

/**
 * One frame: orbits advance; at home the look coasts (unless dragged) and turns the eye;
 * in orbit the eye circles the body; during a flight GSAP drives it.
 */
function exploreFrame(
  frame: { elapsed: number; dt: number; aspect: number },
  system: PortalSystem,
  camera: PerspectiveCamera,
  view: { look: LookState; binding: LookBinding; travel: Travel; wasFree: { value: boolean } },
): void {
  const { look, binding, travel, wasFree } = view;
  const dt = Math.min(frame.dt, MAX_FRAME_DT);
  system.update(frame.elapsed);
  const free = travel.phase === 'free';
  if (free && !wasFree.value) {
    // Back home: continue from where the camera looks, no jump.
    camera.getWorldDirection(forward);
    lookTowards(look, [forward.x, forward.y, forward.z], BASE);
  }
  wasFree.value = free;
  if (travel.phase === 'orbit') holdOrbit(camera, travel, ARRIVAL_POINT, dt);
  if (free) {
    if (!binding.isDragging()) stepLook(look, dt, binding.keys);
    const [x, y, z] = viewDirection(look, BASE);
    camera.lookAt(camera.position.x + x, camera.position.y + y, camera.position.z + z);
  }
  if (Math.abs(camera.aspect - frame.aspect) > 1e-3) {
    camera.aspect = frame.aspect;
    camera.updateProjectionMatrix();
  }
}

/** Hover: pick the body under the pointer, light it up, label it, show a pointer cursor. */
function hoverFrame(
  holder: Holder,
  scene: {
    system: PortalSystem;
    camera: PerspectiveCamera;
    size: { width: number; height: number };
  },
  ui: { label: HTMLElement | null; canvas: HTMLElement; texts: ReadonlyMap<string, LabelText> },
): void {
  // Only while exploring freely: in orbit the panel speaks, in flight nothing is aimed.
  const exploring =
    holder.nav?.travel.phase !== 'outbound' && holder.nav?.travel.phase !== 'inbound';
  const dragging = holder.binding?.isDragging() ?? false;
  const pointer = exploring && !dragging ? holder.binding?.hover.pointer : null;
  const objects = scene.system.bodies.objects;
  const picked = pointer ? pickBody(pointer, scene.camera, objects.values()) : null;
  const slug = holder.listed ?? picked;
  holder.hovered = slug;
  scene.system.bodies.hover(slug);
  ui.canvas.style.cursor = slug ? 'pointer' : 'grab';
  const object = slug ? objects.get(slug) : undefined;
  const text = slug ? ui.texts.get(slug) : undefined;
  const at = object ? screenPoint(object, scene.camera, scene.size) : null;
  if (!ui.label) return;
  const inOrbit = holder.nav?.travel.phase === 'orbit';
  if (slug && text && at && !inOrbit) showLabel(ui.label, slug, text, at);
  else hideLabel(ui.label);
}

interface ExploreProps {
  system: PortalSystem;
  /** Titles and summaries by slug, for the hover label. */
  texts: ReadonlyMap<string, LabelText>;
  label: { current: HTMLElement | null };
  lens: LensUniforms;
  /** The portal camera, now the visitor's eye in the system. */
  eye: { current: PerspectiveCamera | null };
}

/** Once arrived: the system keeps orbiting, and the visitor looks around 360° (SPEC §5.7). */
export default function Explore({ system, eye, texts, label, lens }: ExploreProps) {
  const canvas = useThree((s) => s.gl.domElement);
  const look = useMemo(() => createLook(), []);
  const input = useMemo<Holder>(
    () => ({ binding: null, nav: null, hovered: null, listed: null, titles: null }),
    [],
  );
  const wasFree = useMemo(() => ({ value: true }), []);
  useEffect(
    () => attachExplore(input, { canvas, look, camera: eye.current }, { lens, system }),
    [input, canvas, look, eye, lens, system],
  );

  useFrame((state, dt) => {
    const { binding, nav } = input;
    if (!eye.current || !binding || !nav) return;
    const frame = {
      elapsed: state.clock.elapsedTime,
      dt,
      aspect: state.size.width / state.size.height,
    };
    exploreFrame(frame, system, eye.current, { look, binding, travel: nav.travel, wasFree });
    if (input.titles?.shown()) {
      const camera = eye.current;
      const objects = system.bodies.objects;
      placeTitles(
        input.titles.cards,
        (slug) => {
          const object = objects.get(slug);
          return object ? screenPoint(object, camera, state.size) : null;
        },
        state.size,
      );
    }
    hoverFrame(
      input,
      { system, camera: eye.current, size: state.size },
      { label: label.current, canvas, texts },
    );
  });
  return null;
}
