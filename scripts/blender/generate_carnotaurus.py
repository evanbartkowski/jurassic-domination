import bpy
import bmesh
import math
import os
import shutil

def clear_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)

def create_material(name, base_color, roughness=0.55, metallic=0.04):
    mat = bpy.data.materials.new(name=name)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    if bsdf:
        bsdf.inputs["Base Color"].default_value = base_color
        bsdf.inputs["Roughness"].default_value = roughness
        if "Metallic" in bsdf.inputs:
            bsdf.inputs["Metallic"].default_value = metallic
    return mat

def build_carnotaurus():
    clear_scene()
    base_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\assets\models\carnotaurus"
    pub_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\public\assets\models\carnotaurus"
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(pub_dir, exist_ok=True)

    # Materials: Crimson / Burnt Ember apex predator palette
    mat_scales = create_material("CarnotaurusSkin", (0.58, 0.22, 0.14, 1.0), roughness=0.58)
    mat_dorsal = create_material("DorsalRidge", (0.28, 0.12, 0.08, 1.0), roughness=0.65)
    mat_belly = create_material("BellyPlates", (0.82, 0.68, 0.52, 1.0), roughness=0.52)
    mat_horn = create_material("BullHorns", (0.16, 0.14, 0.12, 1.0), roughness=0.35, metallic=0.15)
    mat_claw = create_material("Talons", (0.10, 0.08, 0.07, 1.0), roughness=0.30, metallic=0.18)
    mat_tooth = create_material("SerratedTeeth", (0.94, 0.92, 0.86, 1.0), roughness=0.20)
    mat_eye = create_material("PredatorEye", (1.0, 0.55, 0.05, 1.0), roughness=0.08)
    mat_pupil = create_material("SlitPupil", (0.01, 0.01, 0.01, 1.0), roughness=0.04)

    # 1. Torso & Muscular Chest
    bpy.ops.mesh.primitive_uv_sphere_add(segments=26, ring_count=18, radius=0.68, location=(0, 0.1, 1.25))
    torso = bpy.context.active_object
    torso.name = "Torso"
    torso.scale = (0.85, 1.5, 1.1)
    torso.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Pelvis
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.62, location=(0, -0.65, 1.20))
    pelvis = bpy.context.active_object
    pelvis.name = "Pelvis"
    pelvis.scale = (0.82, 1.25, 1.05)
    pelvis.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Belly
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.52, location=(0, -0.15, 1.05))
    belly = bpy.context.active_object
    belly.name = "Belly"
    belly.scale = (0.75, 1.4, 0.75)
    belly.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(scale=True)

    # 2. Muscular Bull Neck
    neck_segs = [
        (0, 0.85, 1.42, 0.42, 1.0),
        (0, 1.25, 1.68, 0.38, 0.95),
        (0, 1.58, 1.95, 0.32, 0.90)
    ]
    for idx, (nx, ny, nz, nrad, nscale) in enumerate(neck_segs):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=nrad, location=(nx, ny, nz))
        neck = bpy.context.active_object
        neck.name = f"Neck_{idx}"
        neck.scale = (0.78 * nscale, 1.1 * nscale, 1.0 * nscale)
        neck.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(scale=True)

    # 3. Deep Bull Skull & Heavy Snout
    bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=16, radius=0.34, location=(0, 1.92, 2.12))
    skull = bpy.context.active_object
    skull.name = "Cranium"
    skull.scale = (0.85, 1.2, 1.15)
    skull.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Boxy, deep abelisaurid snout
    bpy.ops.mesh.primitive_cube_add(size=0.45, location=(0, 2.32, 2.06))
    snout = bpy.context.active_object
    snout.name = "Snout"
    snout.scale = (0.68, 1.15, 0.85)
    snout.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Lower Jaw
    bpy.ops.mesh.primitive_cube_add(size=0.38, location=(0, 2.28, 1.86))
    jaw = bpy.context.active_object
    jaw.name = "LowerJaw"
    jaw.scale = (0.64, 1.1, 0.45)
    jaw.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(scale=True)

    # 4. Iconic Carnotaurus Bull Horns (Thick curved conical brow horns)
    for side in (-1, 1):
        hx = side * 0.28
        hy = 2.05
        hz = 2.32
        bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.11, depth=0.38, location=(hx, hy, hz))
        horn = bpy.context.active_object
        horn.name = f"BullHorn_{'R' if side < 0 else 'L'}"
        horn.rotation_euler = (math.radians(-25), side * math.radians(52), side * math.radians(-15))
        horn.data.materials.append(mat_horn)
        bpy.ops.object.transform_apply(rotation=True)

        # Horn base ring/crest
        bpy.ops.mesh.primitive_uv_sphere_add(segments=14, ring_count=10, radius=0.12, location=(side * 0.24, hy - 0.05, hz - 0.08))
        hb = bpy.context.active_object
        hb.name = f"HornBase_{'R' if side < 0 else 'L'}"
        hb.scale = (0.9, 0.9, 0.6)
        hb.data.materials.append(mat_horn)
        bpy.ops.object.transform_apply(scale=True)

    # Eyes
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.08, location=(side * 0.25, 2.02, 2.15))
        eye = bpy.context.active_object
        eye.name = f"Eye_{'R' if side < 0 else 'L'}"
        eye.data.materials.append(mat_eye)

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.02, depth=0.04, location=(side * 0.31, 2.02, 2.15))
        pupil = bpy.context.active_object
        pupil.name = f"Pupil_{'R' if side < 0 else 'L'}"
        pupil.rotation_euler = (0, math.radians(90), 0)
        pupil.scale = (0.35, 1.8, 1.0)
        pupil.data.materials.append(mat_pupil)
        bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Serrated predatory teeth
    for side in (-1, 1):
        for t_idx in range(7):
            ty = 2.15 + t_idx * 0.055
            tz = 1.96 - t_idx * 0.008
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.016, depth=0.05, location=(side * 0.14, ty, tz))
            tooth = bpy.context.active_object
            tooth.name = f"Tooth_{t_idx}_{'R' if side < 0 else 'L'}"
            tooth.rotation_euler = (math.radians(180), 0, side * math.radians(-12))
            tooth.data.materials.append(mat_tooth)
            bpy.ops.object.transform_apply(rotation=True)

    # 5. Dorsal Spiked Osteoderm Ridges (running from neck to tail)
    for o_idx in range(16):
        oy = 1.6 - o_idx * 0.28
        oz = 1.75 - math.sin(o_idx * 0.18) * 0.35 if o_idx < 8 else 1.35 - (o_idx - 8) * 0.04
        for side in (-0.08, 0.08):
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.04, depth=0.09, location=(side, oy, oz))
            osteo = bpy.context.active_object
            osteo.name = f"Osteoderm_{o_idx}_{'L' if side > 0 else 'R'}"
            osteo.rotation_euler = (math.radians(15), 0, 0)
            osteo.data.materials.append(mat_dorsal)
            bpy.ops.object.transform_apply(rotation=True)

    # 6. Powerful Hind Legs
    for side in (-1, 1):
        sx = side * 0.48
        # Massive muscular thigh
        bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=16, radius=0.42, location=(sx, -0.48, 1.15))
        thigh = bpy.context.active_object
        thigh.name = f"Thigh_{'R' if side < 0 else 'L'}"
        thigh.scale = (0.75, 1.15, 1.5)
        thigh.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(scale=True)

        # Shin
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=0.12, depth=0.72, location=(sx, -0.55, 0.65))
        shin = bpy.context.active_object
        shin.name = f"Shin_{'R' if side < 0 else 'L'}"
        shin.rotation_euler = (math.radians(-18), 0, 0)
        shin.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        # Metatarsal
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.085, depth=0.58, location=(sx, -0.38, 0.28))
        meta = bpy.context.active_object
        meta.name = f"Metatarsal_{'R' if side < 0 else 'L'}"
        meta.rotation_euler = (math.radians(24), 0, 0)
        meta.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        # Toes & heavy talons
        for toe_i, toe_ang in enumerate((-22, 0, 22)):
            tx = sx + math.sin(math.radians(toe_ang)) * 0.11
            ty = -0.22 + math.cos(math.radians(toe_ang)) * 0.18
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.045, depth=0.24, location=(tx, ty, 0.05))
            toe = bpy.context.active_object
            toe.name = f"Toe_{toe_i}_{'R' if side < 0 else 'L'}"
            toe.rotation_euler = (math.radians(90), 0, math.radians(-toe_ang))
            toe.data.materials.append(mat_scales)
            bpy.ops.object.transform_apply(rotation=True)

            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.042, depth=0.11, location=(tx, ty + 0.14, 0.05))
            talon = bpy.context.active_object
            talon.name = f"Talon_{toe_i}_{'R' if side < 0 else 'L'}"
            talon.rotation_euler = (math.radians(95), 0, math.radians(-toe_ang))
            talon.data.materials.append(mat_claw)
            bpy.ops.object.transform_apply(rotation=True)

    # 7. Vestigial Tiny Arms (Classic Carnotaurus extreme reduction)
    for side in (-1, 1):
        sx = side * 0.38
        bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.038, depth=0.14, location=(sx, 0.42, 1.05))
        uarm = bpy.context.active_object
        uarm.name = f"TinyArm_{'R' if side < 0 else 'L'}"
        uarm.rotation_euler = (math.radians(45), side * math.radians(-25), 0)
        uarm.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        for c_idx in range(4):
            cx = sx + side * (0.015 + c_idx * 0.01)
            cy = 0.48 + c_idx * 0.008
            cz = 0.98 - c_idx * 0.008
            bpy.ops.mesh.primitive_cone_add(vertices=6, radius1=0.008, depth=0.03, location=(cx, cy, cz))
            fclaw = bpy.context.active_object
            fclaw.name = f"TinyClaw_{c_idx}_{'R' if side < 0 else 'L'}"
            fclaw.data.materials.append(mat_claw)

    # 8. Caudofemoralis-Rich Tail (Broad, tapering apex tail)
    tail_pts = [
        (0, -1.15, 1.18, 0.35, 0.52),
        (0, -1.65, 1.19, 0.30, 0.54),
        (0, -2.18, 1.22, 0.25, 0.55),
        (0, -2.72, 1.26, 0.20, 0.56),
        (0, -3.26, 1.32, 0.15, 0.55),
        (0, -3.78, 1.40, 0.11, 0.52),
        (0, -4.26, 1.50, 0.07, 0.48)
    ]
    for i, (tx, ty, tz, trad, tlen) in enumerate(tail_pts):
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=trad, depth=tlen, location=(tx, ty, tz))
        tseg = bpy.context.active_object
        tseg.name = f"Tail_{i}"
        tseg.rotation_euler = (math.radians(85 + i * 2), 0, 0)
        tseg.data.materials.append(mat_dorsal if i % 2 == 0 else mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

    # Smooth shading
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            for poly in obj.data.polygons:
                poly.use_smooth = True

    # Camera & Dramatic Cinematic Lighting
    bpy.ops.object.camera_add(location=(3.6, -4.8, 3.2), rotation=(math.radians(65), 0, math.radians(38)))
    cam = bpy.context.active_object
    cam.name = "Camera"
    bpy.context.scene.camera = cam

    # Key light: Warm sunset predator sun
    bpy.ops.object.light_add(type='SUN', location=(6, -4, 8))
    sun = bpy.context.active_object
    sun.data.energy = 5.5
    sun.data.color = (1.0, 0.88, 0.72)

    # Fill: Deep volcanic blue/teal ambient fill
    bpy.ops.object.light_add(type='POINT', location=(-4, 3, 4))
    fill = bpy.context.active_object
    fill.data.energy = 260
    fill.data.color = (0.5, 0.75, 1.0)

    # Rim: Intense fiery crimson backlight
    bpy.ops.object.light_add(type='POINT', location=(0, 6, 4))
    rim = bpy.context.active_object
    rim.data.energy = 450
    rim.data.color = (1.0, 0.45, 0.15)

    # Render settings
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 960
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.file_format = 'PNG'

    preview_path = os.path.join(base_dir, "carnotaurus_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)

    blend_path = os.path.join(base_dir, "carnotaurus.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    glb_path1 = os.path.join(base_dir, "carnotaurus.glb")
    glb_path2 = os.path.join(pub_dir, "carnotaurus.glb")
    bpy.ops.export_scene.gltf(filepath=glb_path1, export_format='GLB', use_selection=False)
    shutil.copyfile(glb_path1, glb_path2)
    print("FINISHED Carnotaurus:", glb_path1)

if __name__ == "__main__":
    build_carnotaurus()
