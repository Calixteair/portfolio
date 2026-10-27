"""
The pendant model (M9), built from the site's own outlines (npm run model:outline), so
the plate and its hole match the loader wire, edge fields, sparks and portal exactly.

Run headless (no window):
  blender -b --factory-startup -P tools/blender/pendant.py -- [--preview] [--export]

--preview renders the two reference angles to tools/blender/build/preview-*.png;
--save writes tools/blender/build/pendant.blend, to open in Blender;
--export writes tools/blender/build/pendant.glb (then: npm run optimize:assets).
Units are the site's scene units (18 mm = 0.62).
"""

import json
import math
import random
import sys
from pathlib import Path

import bmesh
import bpy
from mathutils import Matrix, Vector

ROOT = Path(__file__).resolve().parent
BUILD = ROOT / "build"
DATA = json.loads((BUILD / "outline.json").read_text())
PLATE = DATA["plate"]
# Cap planes at ±HALF: the full 4 mm. (In the site the bevel adds to the depth; Blender's
# bevel cuts into the volume, so the plate is extruded to the full thickness.)
HALF = PLATE["depth"] / 2 + PLATE["bevel"]
MM = 0.62 / 18
RNG = random.Random(7)


def reset() -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)


def link(name: str, mesh: bpy.types.Mesh) -> bpy.types.Object:
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


# --- Plate -------------------------------------------------------------------------


def loop(bm: bmesh.types.BMesh, points: list[dict]) -> list[bmesh.types.BMEdge]:
    verts = [bm.verts.new((p["x"], p["y"], -HALF)) for p in points]
    return [bm.edges.new((verts[i], verts[(i + 1) % len(verts)])) for i in range(len(verts))]


def plate() -> bpy.types.Object:
    """The outline with its hole, filled, extruded to the plate's thickness, bevelled."""
    bm = bmesh.new()
    edges = loop(bm, DATA["outer"]) + loop(bm, DATA["holeOutline"])
    bmesh.ops.triangle_fill(bm, use_beauty=True, use_dissolve=True, edges=edges)
    cap = list(bm.faces)
    region = bmesh.ops.extrude_face_region(bm, geom=cap)
    top = [g for g in region["geom"] if isinstance(g, bmesh.types.BMVert)]
    bmesh.ops.translate(bm, vec=(0, 0, 2 * HALF), verts=top)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("body")
    bm.to_mesh(mesh)
    bm.free()
    obj = link("body", mesh)
    bevel = obj.modifiers.new("bevel", "BEVEL")
    bevel.width = PLATE["bevel"]
    bevel.segments = 3
    bevel.limit_method = "ANGLE"
    bevel.angle_limit = math.radians(40)  # the hole's 180-point outline stays smooth
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier="bevel")
    for poly in obj.data.polygons:
        poly.use_smooth = abs(poly.normal.z) < 0.9  # caps flat, rims and walls smooth
    return obj


# --- Crust ---------------------------------------------------------------------------


def hole_point(t: float) -> tuple[Vector, Vector]:
    """
    Point on the hole outline at t (0-1) and the outward normal there (into the metal). The
    normal comes from a wide chord (±4 points), not the local segment: offsets stay
    parallel in the tight corners instead of crossing and folding the crust over.
    """
    pts = DATA["holeOutline"]
    n = len(pts)
    i = int(t * n) % n
    a, b = pts[i], pts[(i + 1) % n]
    f = t * n - int(t * n)
    p = Vector((a["x"] + (b["x"] - a["x"]) * f, a["y"] + (b["y"] - a["y"]) * f, 0))
    before, after = pts[(i - 4) % n], pts[(i + 5) % n]
    tangent = Vector((after["x"] - before["x"], after["y"] - before["y"], 0)).normalized()
    # The metal is on the side pointing away from the hole's centre.
    centre = Vector((DATA["hole"]["cx"], DATA["hole"]["cy"], 0))
    normal = Vector((tangent.y, -tangent.x, 0))
    if normal.dot(p - centre) < 0:
        normal = -normal
    return p, normal


def on_metal(p: Vector, margin: float) -> bool:
    """Inside the plate's outline, at least `margin` from its edge (no grain in the air)."""
    pts = [Vector((q["x"], q["y"], 0)) for q in DATA["outer"]]
    inside = False
    for a, b in zip(pts, pts[1:] + pts[:1]):
        if (a.y > p.y) != (b.y > p.y) and p.x < a.x + (p.y - a.y) * (b.x - a.x) / (b.y - a.y):
            inside = not inside
    if not inside:
        return False
    for a, b in zip(pts, pts[1:] + pts[:1]):
        ab = b - a
        t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
        if ((a + ab * t) - Vector((p.x, p.y, 0))).length < margin:
            return False
    return True


def grain(bm: bmesh.types.BMesh, at: Vector, size: float, flat: Vector | None) -> None:
    """One lumpy black grain: a jittered icosphere, flattened against the surface."""
    geom = bmesh.ops.create_icosphere(bm, subdivisions=1, radius=size)
    verts = geom["verts"]
    for v in verts:
        v.co *= 0.7 + 0.6 * RNG.random()
    if flat is not None:
        # Squash along the surface normal: a crust, not marbles.
        squash = Matrix.Scale(0.45, 3, flat)
        for v in verts:
            v.co = squash @ v.co
    for v in verts:
        v.co += at


# Band width around the hole (mm): smooth waves with integer frequencies (the loop closes)
# plus rare spikes, for a torn, irregular edge like the photo's.
BAND_WAVES = [(f, RNG.uniform(0.15, 0.4) / f**0.5, RNG.uniform(0, 6.28)) for f in (3, 5, 9, 17, 31)]
SPIKES = [(RNG.random(), RNG.uniform(0.6, 1.6), RNG.uniform(0.006, 0.02)) for _ in range(14)]


def band_width(t: float) -> float:
    w = 0.9 + sum(a * math.sin(2 * math.pi * f * t + ph) for f, a, ph in BAND_WAVES)
    for at, height, width in SPIKES:
        d = min(abs(t - at), 1 - abs(t - at))
        w += height * max(0.0, 1 - d / width)
    return max(0.35, w) * MM


SAMPLES = 540


def band(bm: bmesh.types.BMesh, side: int) -> None:
    """The crust's solid black skin on a face: a ring around the hole, its outer edge torn."""
    inner, outer = [], []
    z = side * (HALF + 0.02 * MM)
    for k in range(SAMPLES):
        t = k / SAMPLES
        p, n = hole_point(t)
        w = band_width(t)
        while w > 0.3 * MM and not on_metal(p + n * w, 0.5 * MM):
            w *= 0.85
        inner.append(bm.verts.new((*(p - n * 0.05 * MM).xy, z)))
        outer.append(bm.verts.new((*(p + n * w).xy, z)))
    for k in range(SAMPLES):
        j = (k + 1) % SAMPLES
        face = (inner[k], outer[k], outer[j], inner[j])
        bm.faces.new(face if side > 0 else face[::-1])


def wall(bm: bmesh.types.BMesh) -> None:
    """The crust lining the hole's walls, from face to face."""
    rows = 6
    grid = []
    for k in range(SAMPLES):
        p, n = hole_point(k / SAMPLES)
        q = p - n * 0.03 * MM
        grid.append([bm.verts.new((q.x, q.y, -HALF + 2 * HALF * r / (rows - 1))) for r in range(rows)])
    for k in range(SAMPLES):
        j = (k + 1) % SAMPLES
        for r in range(rows - 1):
            bm.faces.new((grid[k][r], grid[j][r], grid[j][r + 1], grid[k][r + 1]))


def crust() -> bpy.types.Object:
    """
    Black granular erosion, as on the photos: a solid black skin lining the hole's walls and
    a ring on both faces with a torn edge, fine grains (0.12-0.4 mm) clustered along that
    edge and on the walls for relief, and a few islands beyond. Everything stays on the metal.
    """
    bm = bmesh.new()
    wall(bm)
    for _ in range(2200):
        p, n = hole_point(RNG.random())
        at = p - n * 0.05 * MM + Vector((0, 0, RNG.uniform(-HALF, HALF)))
        grain(bm, at, RNG.uniform(0.15, 0.4) * MM, n)
    for side in (1, -1):
        band(bm, side)
        placed = 0
        while placed < 1600:
            t = RNG.random()
            p, n = hole_point(t)
            reach = band_width(t) * RNG.uniform(0.3, 1.15)
            if RNG.random() < 0.06:
                reach += RNG.uniform(0.6, 2.2) * MM  # an island further out
            at = p + n * reach
            if not on_metal(at, 0.5 * MM):
                continue
            at.z = side * (HALF + 0.03 * MM)
            grain(bm, at, RNG.uniform(0.12, 0.32) * MM, Vector((0, 0, 1)))
            placed += 1
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("crust")
    bm.to_mesh(mesh)
    bm.free()
    return link("crust", mesh)


# --- Diamonds ------------------------------------------------------------------------


def brilliant(radius: float) -> bpy.types.Mesh:
    """Simplified round brilliant: a flat table, a crown and a pointed pavilion (8 sides)."""
    bm = bmesh.new()
    sides = 8
    table = [bm.verts.new((0.55 * radius * math.cos(a), 0.55 * radius * math.sin(a), 0.32 * radius))
             for a in (2 * math.pi * k / sides + math.pi / sides for k in range(sides))]
    girdle = [bm.verts.new((radius * math.cos(a), radius * math.sin(a), 0))
              for a in (2 * math.pi * k / sides for k in range(sides))]
    culet = bm.verts.new((0, 0, -0.85 * radius))
    bm.faces.new(table)
    for k in range(sides):
        j = (k + 1) % sides
        bm.faces.new((girdle[k], girdle[j], table[k]))
        bm.faces.new((girdle[j], table[j], table[k]))
        bm.faces.new((girdle[j], girdle[k], culet))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh = bpy.data.meshes.new("diamond")
    bm.to_mesh(mesh)
    bm.free()
    return mesh


def diamonds(count: int = 26) -> list[bpy.types.Object]:
    """Small black diamonds set in the crust, table facing out, mostly on the front fringe."""
    out = []
    mesh = brilliant(1)
    for k in range(count):
        p, n = hole_point(RNG.random())
        side = 1 if RNG.random() < 0.75 else -1
        r = RNG.uniform(0.35, 0.6) * MM
        at = p + n * RNG.uniform(0.3, 1.2) * MM + Vector((0, 0, side * HALF))
        obj = link(f"diamond.{k:02}", mesh)
        obj.scale = (r, r, r)
        obj.rotation_euler = (0 if side > 0 else math.pi, RNG.uniform(-0.3, 0.3), RNG.uniform(0, 6.28))
        obj.location = at
        out.append(obj)
    return out


# --- Preview materials and renders ---------------------------------------------------


def material(name: str, base, metallic: float, roughness: float, aniso: float = 0) -> bpy.types.Material:
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = (*base, 1)
    bsdf.inputs["Metallic"].default_value = metallic
    bsdf.inputs["Roughness"].default_value = roughness
    if aniso:
        bsdf.inputs["Anisotropic"].default_value = aniso
    return mat


def dress(body, crust_obj, gems) -> None:
    body.data.materials.append(material("silver", (0.95, 0.93, 0.88), 1, 0.32, 0.6))
    crust = material("crust", (0.004, 0.004, 0.0045), 0, 0.6)
    crust.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.2
    crust_obj.data.materials.append(crust)
    gem = material("black-diamond", (0.01, 0.01, 0.012), 0, 0.03)
    for g in gems:
        g.data.materials.append(gem) if not g.data.materials else None


def look_at(eye: Vector, target: Vector) -> Matrix:
    """Rotation looking from eye to target with +Y up (the site's up axis, not Blender's Z)."""
    forward = (target - eye).normalized()
    right = forward.cross(Vector((0, 1, 0))).normalized()
    up = right.cross(forward)
    return Matrix((right, up, -forward)).transposed()


def studio(background) -> None:
    scene = bpy.context.scene
    world = bpy.data.worlds.new("studio")
    world.use_nodes = True
    world.node_tree.nodes["Background"].inputs["Color"].default_value = (*background, 1)
    world.node_tree.nodes["Background"].inputs["Strength"].default_value = 1
    scene.world = world
    for name, loc, energy, size in (("key", (-1.4, 1.8, 2.4), 260, 1.6), ("fill", (1.9, -0.3, 1.8), 90, 2.4),
                                    ("rim", (0.5, 2.0, -1.6), 140, 1.2)):
        light = bpy.data.lights.new(name, "AREA")
        light.energy = energy
        light.size = size
        obj = bpy.data.objects.new(name, light)
        obj.location = loc
        obj.rotation_euler = look_at(Vector(loc), Vector((0, 0, 0))).to_euler()
        scene.collection.objects.link(obj)


def render(name: str, yaw: float, background) -> None:
    scene = bpy.context.scene
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 64
    scene.cycles.use_denoising = True
    scene.render.resolution_x, scene.render.resolution_y = 640, 800
    scene.render.film_transparent = False
    for obj in [o for o in scene.objects if o.type == "LIGHT"]:
        bpy.data.objects.remove(obj)
    studio(background)
    cam_data = bpy.data.cameras.new("cam")
    cam_data.lens = 85
    cam = bpy.data.objects.new("cam", cam_data)
    scene.collection.objects.link(cam)
    distance = 3.4
    # The site's frame: +Y up, the plate facing +Z; orbit around Y, a little from above.
    cam.location = Vector((math.sin(yaw) * distance, 0.35, math.cos(yaw) * distance))
    cam.rotation_euler = look_at(cam.location, Vector((0, 0, 0))).to_euler()
    scene.camera = cam
    scene.render.filepath = str(BUILD / f"preview-{name}.png")
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam)


def main() -> None:
    args = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
    reset()
    body = plate()
    crust_obj = crust()
    gems = [] if "--no-gems" in args else diamonds()
    if "--preview" in args:
        dress(body, crust_obj, gems)
        render("front", 0.0, (0.16, 0.16, 0.165))
        render("angle", math.radians(32), (0.005, 0.005, 0.005))
    if "--save" in args:
        # A scene to open in Blender's window: materials and studio lights as in the previews.
        if "--preview" not in args:
            dress(body, crust_obj, gems)
            studio((0.16, 0.16, 0.165))
        bpy.ops.wm.save_as_mainfile(filepath=str(BUILD / "pendant.blend"))
    if "--export" in args:
        bpy.ops.export_scene.gltf(filepath=str(BUILD / "pendant.glb"), export_format="GLB",
                                  export_apply=True, export_materials="NONE",
                                  # Keep the site's axes (Y up, plate facing +Z) as they are.
                                  export_yup=False)
    print("pendant: done", len(body.data.polygons), "plate faces,", len(crust_obj.data.polygons), "crust faces")


main()
