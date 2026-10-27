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
from mathutils import Matrix, Vector, noise

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
    bevel.profile = 0.5  # round, barely: every edge of the real pendant is softened
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


# --- Erosion: carved into the volume -----------------------------------------------------


def blob(bm: bmesh.types.BMesh, at: Vector, r: float) -> None:
    """One irregular bite: an icosphere roughened by noise (a pit, not a ball)."""
    geom = bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
    seed = Vector((RNG.uniform(0, 100), RNG.uniform(0, 100), RNG.uniform(0, 100)))
    for v in geom["verts"]:
        bump = noise.noise(v.co * (2.2 / r) + seed)
        v.co = v.co * (1 + 0.35 * bump) + at


def erosion_volume() -> tuple[bpy.types.Object, list[tuple[Vector, float, int]]]:
    """
    The metal the erosion ate: bites chipping the hole's rim on both faces, pits on the
    faces thinning out away from the hole (a few islands further), small nicks in the
    walls. Bites stay shallow at mid-thickness, so the hole's outline (the site's portal,
    sparks and edge fields) still holds. Returns the volume and the pits (for diamonds).
    """
    bm = bmesh.new()
    pits: list[tuple[Vector, float, int]] = []
    for _ in range(520):  # the rim, chipped on both faces
        p, n = hole_point(RNG.random())
        side = RNG.choice((1, -1))
        r = RNG.uniform(0.4, 1.1) * MM
        z = side * (HALF - RNG.uniform(-0.15, 0.45) * MM)
        blob(bm, p + n * RNG.uniform(-0.2, 0.7) * MM + Vector((0, 0, z)), r)
    for side in (1, -1):  # pits on each face, fewer and smaller away from the hole
        placed = 0
        while placed < 380:
            p, n = hole_point(RNG.random())
            reach = RNG.expovariate(1 / (1.0 * MM))
            if RNG.random() < 0.07:
                reach += RNG.uniform(1.0, 3.0) * MM  # an island further out
            at = p + n * reach
            if not on_metal(at, 0.7 * MM):
                continue
            r = RNG.uniform(0.15, 0.6) * MM * max(0.45, 1 - reach / (4 * MM))
            depth = r * RNG.uniform(0.35, 0.8)
            at.z = side * (HALF + r - depth)
            blob(bm, at, r)
            pits.append((Vector((at.x, at.y, side * (HALF - depth))), r, side))
            placed += 1
    for _ in range(650):  # nicks all over the walls: no smooth original wall left
        p, n = hole_point(RNG.random())
        blob(bm, p + n * RNG.uniform(0, 0.25) * MM + Vector((0, 0, RNG.uniform(-0.9, 0.9) * HALF)),
             RNG.uniform(0.2, 0.45) * MM)
    mesh = bpy.data.meshes.new("erosion")
    bm.to_mesh(mesh)
    bm.free()
    cutter = link("erosion", mesh)
    # One clean, closed volume out of hundreds of overlapping bites (0.08 mm voxels).
    remesh = cutter.modifiers.new("union", "REMESH")
    remesh.mode = "VOXEL"
    remesh.voxel_size = 0.08 * MM
    apply(cutter, "union")
    return cutter, pits


def apply(obj: bpy.types.Object, modifier: str) -> None:
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.modifier_apply(modifier=modifier)


def erode(body: bpy.types.Object, cutter: bpy.types.Object) -> None:
    """Carve the erosion out of the plate; every carved face gets the crust material (1)."""
    boolean = body.modifiers.new("erode", "BOOLEAN")
    boolean.operation = "DIFFERENCE"
    boolean.solver = "MANIFOLD"
    boolean.object = cutter
    apply(body, "erode")
    bpy.data.objects.remove(cutter)
    for poly in body.data.polygons:
        poly.material_index = 1 if carved(poly) else 0


def carved(poly) -> bool:
    """A face not on the plate's original caps nor its outer rim was cut by the erosion."""
    c = poly.center
    on_cap = abs(poly.normal.z) > 0.98 and abs(abs(c.z) - HALF) < 0.02 * MM
    near_rim = not on_metal(Vector((c.x, c.y, 0)), 1.0 * PLATE["bevel"])
    return not on_cap and not near_rim


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


def seat(body: bpy.types.Object, x: float, y: float, side: int) -> tuple[Vector, Vector] | None:
    """
    Where a diamond can sit at (x, y): cast a ray into the finished plate from outside the
    face; keep the hit only if it lands on a carved (black) face clearly below the silver
    surface. Returns the hit point and its normal, else None.
    """
    origin = Vector((x, y, side * (HALF + 1.0 * MM)))
    hit, at, normal, index = body.ray_cast(origin, Vector((0, 0, -side)))
    if not hit or body.data.polygons[index].material_index != 1:
        return None
    if side * at.z > HALF - 0.15 * MM:  # too shallow: it would stick out
        return None
    return at, normal


def diamonds(body: bpy.types.Object, pits: list[tuple[Vector, float, int]], count: int = 9) -> list[bpy.types.Object]:
    """Black diamonds seated on the actual floor of the largest cavities (ray cast)."""
    mesh = brilliant(1)
    out = []
    for floor, r, side in sorted(pits, key=lambda p: (p[2] < 0, -p[1])):
        if len(out) >= count or (side < 0 and sum(1 for g in out if g.location.z < 0) >= 2):
            continue
        found = seat(body, floor.x, floor.y, side)
        if not found:
            continue
        at, normal = found
        size = min(0.42 * MM, r * 0.7)
        obj = link(f"diamond.{len(out):02}", mesh)
        obj.scale = (size, size, size)
        # Table facing out along the cavity floor's normal, sunk to its girdle.
        obj.rotation_euler = normal.to_track_quat("Z", "Y").to_euler()
        obj.rotation_euler.rotate_axis("Z", RNG.uniform(0, 6.28))
        obj.location = at - normal * size * 0.25
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


def body_materials(body) -> None:
    """Slot 0: silver; slot 1: the black crust lining the eroded cavities."""
    body.data.materials.append(material("silver", (0.95, 0.93, 0.88), 1, 0.32, 0.6))
    crust = material("crust", (0.004, 0.004, 0.0045), 0, 0.85)
    crust.node_tree.nodes["Principled BSDF"].inputs["Specular IOR Level"].default_value = 0.15
    body.data.materials.append(crust)


def dress(gems) -> None:
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
    body_materials(body)
    cutter, pits = erosion_volume()
    erode(body, cutter)
    gems = [] if "--no-gems" in args else diamonds(body, pits)
    if "--preview" in args:
        dress(gems)
        render("front", 0.0, (0.16, 0.16, 0.165))
        render("angle", math.radians(32), (0.005, 0.005, 0.005))
    if "--save" in args:
        # A scene to open in Blender's window: materials and studio lights as in the previews.
        if "--preview" not in args:
            dress(gems)
            studio((0.16, 0.16, 0.165))
        bpy.ops.wm.save_as_mainfile(filepath=str(BUILD / "pendant.blend"))
    if "--export" in args:
        bpy.ops.export_scene.gltf(filepath=str(BUILD / "pendant.glb"), export_format="GLB",
                                  export_apply=True, export_materials="NONE",
                                  # Keep the site's axes (Y up, plate facing +Z) as they are.
                                  export_yup=False)
    print("pendant: done", len(body.data.polygons), "faces")


main()
