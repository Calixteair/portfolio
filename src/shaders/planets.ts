import {
  abs,
  dot,
  float,
  mix,
  mx_fractal_noise_float,
  normalView,
  normalize,
  positionViewDirection,
  positionLocal,
  pow,
  smoothstep,
  time,
  vec3,
} from 'three/tsl';
import { Color, MeshStandardNodeMaterial, type Node, type UniformNode } from 'three/webgpu';
import type { PlanetType } from '../system/layout';

/** HSL hue (0-360) to a linear colour node. */
function hsl(hue: number, s: number, l: number): Node<'vec3'> {
  const c = new Color().setHSL(hue / 360, s, l);
  return vec3(c.r, c.g, c.b);
}

function fbm(p: Node<'vec3'>, octaves = 5): Node<'float'> {
  return mx_fractal_noise_float(p, octaves, 2.1, 0.5).mul(0.5).add(0.5);
}

interface Surface {
  color: Node<'vec3'>;
  roughness: Node<'float'>;
  emissive?: Node<'vec3'>;
}

/** Cratered, mottled ground. */
function rocky(p: Node<'vec3'>, hue: number): Surface {
  const ground = fbm(p.mul(3));
  const craters = smoothstep(0.62, 0.7, fbm(p.mul(9), 3));
  return {
    color: mix(hsl(hue, 0.25, 0.14), hsl(hue, 0.3, 0.42), ground).mul(
      float(1).sub(craters.mul(0.35)),
    ),
    roughness: float(0.9),
  };
}

/** Banded gas giant, bands warped by turbulence and slowly drifting. */
function gas(p: Node<'vec3'>, hue: number): Surface {
  const turb = fbm(p.mul(2.5).add(vec3(time.mul(0.01), 0, 0)), 4);
  const band = fbm(vec3(p.y.mul(7).add(turb.mul(1.6)), 0, 0), 3);
  return {
    color: mix(hsl(hue, 0.5, 0.22), hsl(hue + 25, 0.55, 0.58), band),
    roughness: float(0.75),
  };
}

/** Pale ice with fine dark fractures. */
function ice(p: Node<'vec3'>, hue: number): Surface {
  const cracks = pow(float(1).sub(abs(mx_fractal_noise_float(p.mul(5), 4, 2.2, 0.5))), 18);
  return {
    color: mix(hsl(hue, 0.35, 0.72), hsl(hue, 0.5, 0.28), cracks),
    roughness: float(0.35),
  };
}

/** Dark cooled crust over glowing magma veins. */
function lava(p: Node<'vec3'>, hue: number): Surface {
  const veins = pow(float(1).sub(abs(mx_fractal_noise_float(p.mul(3.2), 4, 2.1, 0.5))), 10);
  const pulse = time.mul(0.6).sin().mul(0.15).add(0.85);
  return {
    color: hsl(hue, 0.3, 0.05),
    roughness: float(0.85),
    emissive: hsl(hue, 0.9, 0.5).mul(veins.mul(3).mul(pulse)),
  };
}

/** Oceans and continents. */
function ocean(p: Node<'vec3'>, hue: number): Surface {
  const land = smoothstep(0.52, 0.56, fbm(p.mul(2.2)));
  return {
    color: mix(hsl(hue, 0.6, 0.22), hsl(hue - 90, 0.3, 0.32), land),
    roughness: mix(float(0.25), float(0.85), land),
  };
}

const SURFACES: Record<PlanetType, (p: Node<'vec3'>, hue: number) => Surface> = {
  rocky,
  gas,
  ice,
  lava,
  ocean,
};

/** Procedural planet (SPEC §5.7): its look comes from the content (type, hue). */
export function createPlanetMaterial(type: PlanetType, hue: number): MeshStandardNodeMaterial {
  const surface = SURFACES[type](normalize(positionLocal), hue);
  const material = new MeshStandardNodeMaterial({ metalness: 0 });
  material.colorNode = surface.color;
  material.roughnessNode = surface.roughness;
  if (surface.emissive) material.emissiveNode = surface.emissive;
  return material;
}

/**
 * Moons: technical skills grey-blue rock, soft skills a warm, faintly glowing stone.
 * `highlight` (0-1) adds a soft rim glow, raised while visiting their planet: a hint that
 * they can be clicked.
 */
export function createMoonMaterial(
  soft: boolean,
  hue: number,
  highlight?: UniformNode<'float', number>,
): MeshStandardNodeMaterial {
  const p = normalize(positionLocal);
  const n = fbm(p.mul(4), 4);
  const material = new MeshStandardNodeMaterial({ metalness: 0, roughness: 0.9 });
  material.colorNode = soft
    ? mix(hsl(30, 0.5, 0.25), hsl(38, 0.6, 0.55), n)
    : mix(hsl(hue, 0.12, 0.2), hsl(hue, 0.15, 0.5), n);
  const base = soft ? hsl(32, 0.8, 0.3).mul(n.mul(0.25)) : vec3(0);
  if (!highlight) {
    if (soft) material.emissiveNode = base;
    return material;
  }
  const rim = pow(float(1).sub(abs(dot(normalView, positionViewDirection))), 2.5);
  const glow = (soft ? hsl(35, 0.9, 0.6) : hsl(210, 0.9, 0.7)).mul(rim.mul(highlight).mul(0.8));
  material.emissiveNode = base.add(glow);
  return material;
}
