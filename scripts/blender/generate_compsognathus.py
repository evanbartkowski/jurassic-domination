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

def build_compsognathus():
    clear_scene()
    base_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\assets\models\compsognathus"
    pub_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\public\assets\models\compsognathus"
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(pub_dir, exist_ok=True)

    # Materials
    mat_body = create_material("Skin", (0.74, 0.61, 0.38, 1.0), roughness=0.52)
    mat_dorsal = create_material("Dorsal", (0.34, 0.42, 0.26, 1.0), roughness=0.62)
    mat_belly = create_material("Belly", (0.89, 0.84, 0.72, 1.0), roughness=0.58)
    mat_claw = create_material("Claw", (0.12, 0.10, 0.08, 1.0), roughness=0.32, metallic=0.12)
    mat_tooth = create_material("Tooth", (0.92, 0.90, 0.82, 1.0), roughness=0.22)
    mat_eye = create_material("Eye", (0.96, 0.74, 0.14, 1.0), roughness=0.06)
    mat_pupil = create_material("Pupil", (0.02, 0.02, 0.02, 1.0), roughness=0.04)

    # 1. Torso
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.35, location=(0, 0, 0.65))
    torso = bpy.context.active_object
    torso.name = "Torso"
    torso.scale = (0.75, 1.6, 0.85)
    torso.data.materials.append(mat_body)
    bpy.ops.object.transform_apply(scale=True)

    # 2. Pelvis / Hips
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.3, location=(0, -0.4, 0.62))
    pelvis = bpy.context.active_object
    pelvis.name = "Pelvis"
    pelvis.scale = (0.68, 1.1, 0.8)
    pelvis.data.materials.append(mat_dorsal)
    bpy.ops.object.transform_apply(scale=True)

    # 3. Belly contour
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=0.25, location=(0, -0.05, 0.54))
    belly = bpy.context.active_object
    belly.name = "Belly"
    belly.scale = (0.62, 1.3, 0.6)
    belly.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(scale=True)

    # 4. S-Curved Neck
    neck_pts = [
        (0, 0.45, 0.72, 0.14),
        (0, 0.65, 0.88, 0.12),
        (0, 0.82, 1.05, 0.10),
        (0, 0.95, 1.18, 0.09)
    ]
    for i, (nx, ny, nz, nrad) in enumerate(neck_pts):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=nrad, location=(nx, ny, nz))
        neck = bpy.context.active_object
        neck.name = f"Neck_{i}"
        neck.data.materials.append(mat_body)

    # 5. Head, Snout, and Jaw
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.13, location=(0, 1.05, 1.25))
    cranium = bpy.context.active_object
    cranium.name = "Cranium"
    cranium.scale = (0.85, 1.3, 0.9)
    cranium.data.materials.append(mat_body)
    bpy.ops.object.transform_apply(scale=True)

    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.09, radius2=0.03, depth=0.28, location=(0, 1.28, 1.23))
    snout = bpy.context.active_object
    snout.name = "Snout"
    snout.rotation_euler = (math.radians(85), 0, 0)
    snout.scale = (0.8, 1.0, 0.6)
    snout.data.materials.append(mat_body)
    bpy.ops.object.transform_apply(rotation=True, scale=True)

    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.075, radius2=0.02, depth=0.25, location=(0, 1.25, 1.16))
    jaw = bpy.context.active_object
    jaw.name = "LowerJaw"
    jaw.rotation_euler = (math.radians(92), 0, 0)
    jaw.scale = (0.75, 1.0, 0.4)
    jaw.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Eyes & Slit Pupils
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.045, location=(side * 0.088, 1.06, 1.26))
        eye = bpy.context.active_object
        eye.name = f"Eye_{'R' if side < 0 else 'L'}"
        eye.data.materials.append(mat_eye)

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.012, depth=0.02, location=(side * 0.118, 1.06, 1.26))
        pupil = bpy.context.active_object
        pupil.name = f"Pupil_{'R' if side < 0 else 'L'}"
        pupil.rotation_euler = (0, math.radians(90), 0)
        pupil.scale = (0.4, 1.8, 1.0)
        pupil.data.materials.append(mat_pupil)
        bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Needle Teeth
    for side in (-1, 1):
        for t_idx in range(5):
            ty = 1.18 + t_idx * 0.035
            tz = 1.20 - t_idx * 0.005
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.007, depth=0.022, location=(side * 0.045, ty, tz))
            tooth = bpy.context.active_object
            tooth.name = f"Tooth_{t_idx}_{'R' if side < 0 else 'L'}"
            tooth.rotation_euler = (math.radians(180), 0, side * math.radians(-10))
            tooth.data.materials.append(mat_tooth)
            bpy.ops.object.transform_apply(rotation=True)

    # 6. Hind Legs (Bipedal)
    for side in (-1, 1):
        sx = side * 0.22
        # Thigh
        bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=14, radius=0.18, location=(sx, -0.32, 0.60))
        thigh = bpy.context.active_object
        thigh.name = f"Thigh_{'R' if side < 0 else 'L'}"
        thigh.scale = (0.65, 1.1, 1.4)
        thigh.data.materials.append(mat_body)
        bpy.ops.object.transform_apply(scale=True)

        # Shin
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.045, depth=0.36, location=(sx, -0.36, 0.32))
        shin = bpy.context.active_object
        shin.name = f"Shin_{'R' if side < 0 else 'L'}"
        shin.rotation_euler = (math.radians(-15), 0, 0)
        shin.data.materials.append(mat_body)
        bpy.ops.object.transform_apply(rotation=True)

        # Metatarsal
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.032, depth=0.28, location=(sx, -0.28, 0.12))
        meta = bpy.context.active_object
        meta.name = f"Metatarsal_{'R' if side < 0 else 'L'}"
        meta.rotation_euler = (math.radians(22), 0, 0)
        meta.data.materials.append(mat_body)
        bpy.ops.object.transform_apply(rotation=True)

        # Toes & Talons
        for toe_i, toe_ang in enumerate((-18, 0, 18)):
            tx = sx + math.sin(math.radians(toe_ang)) * 0.045
            ty = -0.18 + math.cos(math.radians(toe_ang)) * 0.08
            bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.018, depth=0.12, location=(tx, ty, 0.02))
            toe = bpy.context.active_object
            toe.name = f"Toe_{toe_i}_{'R' if side < 0 else 'L'}"
            toe.rotation_euler = (math.radians(90), 0, math.radians(-toe_ang))
            toe.data.materials.append(mat_body)
            bpy.ops.object.transform_apply(rotation=True)

            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.016, depth=0.045, location=(tx, ty + 0.065, 0.02))
            talon = bpy.context.active_object
            talon.name = f"Talon_{toe_i}_{'R' if side < 0 else 'L'}"
            talon.rotation_euler = (math.radians(95), 0, math.radians(-toe_ang))
            talon.data.materials.append(mat_claw)
            bpy.ops.object.transform_apply(rotation=True)

    # 7. Forelimbs & Grasping Claws
    for side in (-1, 1):
        sx = side * 0.18
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.028, depth=0.18, location=(sx, 0.22, 0.52))
        uarm = bpy.context.active_object
        uarm.name = f"UpperArm_{'R' if side < 0 else 'L'}"
        uarm.rotation_euler = (math.radians(35), side * math.radians(-15), 0)
        uarm.data.materials.append(mat_body)
        bpy.ops.object.transform_apply(rotation=True)

        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.022, depth=0.16, location=(sx + side * 0.03, 0.30, 0.42))
        farm = bpy.context.active_object
        farm.name = f"Forearm_{'R' if side < 0 else 'L'}"
        farm.rotation_euler = (math.radians(-40), side * math.radians(-10), 0)
        farm.data.materials.append(mat_body)
        bpy.ops.object.transform_apply(rotation=True)

        for f_idx in range(3):
            fx = sx + side * (0.025 + f_idx * 0.012)
            fy = 0.38 + f_idx * 0.015
            fz = 0.36 - f_idx * 0.012
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.009, depth=0.035, location=(fx, fy, fz))
            fclaw = bpy.context.active_object
            fclaw.name = f"HandClaw_{f_idx}_{'R' if side < 0 else 'L'}"
            fclaw.rotation_euler = (math.radians(75), side * math.radians(12), 0)
            fclaw.data.materials.append(mat_claw)
            bpy.ops.object.transform_apply(rotation=True)

    # 8. Tapering Counterbalancing Tail (10 segments)
    tail_pts = [
        (0, -0.65, 0.60, 0.15, 0.24),
        (0, -0.90, 0.62, 0.13, 0.26),
        (0, -1.16, 0.64, 0.11, 0.28),
        (0, -1.44, 0.66, 0.09, 0.30),
        (0, -1.74, 0.67, 0.075, 0.32),
        (0, -2.05, 0.69, 0.06, 0.33),
        (0, -2.36, 0.72, 0.048, 0.33),
        (0, -2.66, 0.76, 0.036, 0.32),
        (0, -2.95, 0.82, 0.026, 0.30),
        (0, -3.22, 0.89, 0.016, 0.28)
    ]
    for i, (tx, ty, tz, trad, tlen) in enumerate(tail_pts):
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=trad, depth=tlen, location=(tx, ty, tz))
        tseg = bpy.context.active_object
        tseg.name = f"Tail_{i}"
        tseg.rotation_euler = (math.radians(82 + i * 1.5), 0, 0)
        tseg.data.materials.append(mat_dorsal if i % 2 == 0 else mat_body)
        bpy.ops.object.transform_apply(rotation=True)

    # Smooth shading
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            for poly in obj.data.polygons:
                poly.use_smooth = True

    # Camera & 3-Point Lighting
    bpy.ops.object.camera_add(location=(2.4, -3.4, 2.0), rotation=(math.radians(68), 0, math.radians(35)))
    cam = bpy.context.active_object
    cam.name = "Camera"
    bpy.context.scene.camera = cam

    bpy.ops.object.light_add(type='SUN', location=(4, -3, 6))
    sun = bpy.context.active_object
    sun.data.energy = 4.5
    sun.data.color = (1.0, 0.96, 0.90)

    bpy.ops.object.light_add(type='POINT', location=(-3, 2, 3))
    fill = bpy.context.active_object
    fill.data.energy = 120
    fill.data.color = (0.7, 0.85, 1.0)

    bpy.ops.object.light_add(type='POINT', location=(0, 4, 3))
    rim = bpy.context.active_object
    rim.data.energy = 220
    rim.data.color = (1.0, 0.82, 0.45)

    # Render settings
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 960
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.file_format = 'PNG'

    preview_path = os.path.join(base_dir, "compsognathus_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)

    blend_path = os.path.join(base_dir, "compsognathus.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    glb_path1 = os.path.join(base_dir, "compsognathus.glb")
    glb_path2 = os.path.join(pub_dir, "compsognathus.glb")
    bpy.ops.export_scene.gltf(filepath=glb_path1, export_format='GLB', use_selection=False)
    shutil.copyfile(glb_path1, glb_path2)
    print("FINISHED Compsognathus:", glb_path1)

if __name__ == "__main__":
    build_compsognathus()
