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

def build_dilophosaurus():
    clear_scene()
    base_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\assets\models\dilophosaurus"
    pub_dir = r"C:\Users\evan\Documents\Evolution dinosaur game\public\assets\models\dilophosaurus"
    os.makedirs(base_dir, exist_ok=True)
    os.makedirs(pub_dir, exist_ok=True)

    # Materials: Jungle ambush hunter palette (Olive green, tiger stripes, vibrant crests)
    mat_scales = create_material("DilophoSkin", (0.24, 0.44, 0.28, 1.0), roughness=0.52)
    mat_stripes = create_material("TigerStripes", (0.12, 0.20, 0.14, 1.0), roughness=0.60)
    mat_belly = create_material("PaleBelly", (0.78, 0.82, 0.65, 1.0), roughness=0.55)
    mat_crest = create_material("VibrantCrest", (0.88, 0.22, 0.12, 1.0), roughness=0.38)
    mat_crest_edge = create_material("CrestEdge", (0.95, 0.78, 0.16, 1.0), roughness=0.32)
    mat_claw = create_material("Claw", (0.14, 0.12, 0.10, 1.0), roughness=0.28, metallic=0.15)
    mat_tooth = create_material("NeedleTeeth", (0.92, 0.90, 0.84, 1.0), roughness=0.22)
    mat_eye = create_material("ReptileEye", (0.96, 0.65, 0.12, 1.0), roughness=0.08)
    mat_pupil = create_material("Pupil", (0.01, 0.01, 0.01, 1.0), roughness=0.04)

    # 1. Torso & Slender Ribcage
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=0.48, location=(0, 0.05, 0.95))
    torso = bpy.context.active_object
    torso.name = "Torso"
    torso.scale = (0.75, 1.55, 0.95)
    torso.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Pelvis
    bpy.ops.mesh.primitive_uv_sphere_add(segments=22, ring_count=14, radius=0.42, location=(0, -0.48, 0.92))
    pelvis = bpy.context.active_object
    pelvis.name = "Pelvis"
    pelvis.scale = (0.72, 1.25, 0.9)
    pelvis.data.materials.append(mat_stripes)
    bpy.ops.object.transform_apply(scale=True)

    # Pale Underbelly
    bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=0.36, location=(0, -0.12, 0.82))
    belly = bpy.context.active_object
    belly.name = "Belly"
    belly.scale = (0.65, 1.35, 0.65)
    belly.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(scale=True)

    # 2. Flexible S-Curved Neck (4 segments)
    neck_pts = [
        (0, 0.62, 1.08, 0.22),
        (0, 0.92, 1.30, 0.19),
        (0, 1.18, 1.55, 0.16),
        (0, 1.38, 1.76, 0.14)
    ]
    for i, (nx, ny, nz, nrad) in enumerate(neck_pts):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=18, ring_count=12, radius=nrad, location=(nx, ny, nz))
        neck = bpy.context.active_object
        neck.name = f"Neck_{i}"
        neck.scale = (0.8, 1.15, 0.95)
        neck.data.materials.append(mat_scales if i % 2 == 0 else mat_stripes)
        bpy.ops.object.transform_apply(scale=True)

    # 3. Slender Cranium & Notched Snout
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.20, location=(0, 1.54, 1.86))
    cranium = bpy.context.active_object
    cranium.name = "Cranium"
    cranium.scale = (0.75, 1.35, 0.95)
    cranium.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(scale=True)

    # Upper snout with subnarial kink
    bpy.ops.mesh.primitive_cone_add(vertices=16, radius1=0.14, radius2=0.05, depth=0.45, location=(0, 1.88, 1.83))
    snout = bpy.context.active_object
    snout.name = "Snout"
    snout.rotation_euler = (math.radians(84), 0, 0)
    snout.scale = (0.72, 1.0, 0.7)
    snout.data.materials.append(mat_scales)
    bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Lower Jaw
    bpy.ops.mesh.primitive_cone_add(vertices=14, radius1=0.11, radius2=0.035, depth=0.40, location=(0, 1.84, 1.71))
    jaw = bpy.context.active_object
    jaw.name = "LowerJaw"
    jaw.rotation_euler = (math.radians(88), 0, 0)
    jaw.scale = (0.68, 1.0, 0.45)
    jaw.data.materials.append(mat_belly)
    bpy.ops.object.transform_apply(rotation=True, scale=True)

    # 4. Iconic Double Semi-Lunate Cranial Crests (Thin parallel crests on head)
    for side in (-1, 1):
        cx = side * 0.085
        # Crest body
        bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.22, depth=0.022, location=(cx, 1.68, 2.05))
        crest = bpy.context.active_object
        crest.name = f"CranialCrest_{'R' if side < 0 else 'L'}"
        crest.rotation_euler = (math.radians(20), math.radians(90), side * math.radians(5))
        crest.scale = (1.1, 1.6, 0.4)
        crest.data.materials.append(mat_crest)
        bpy.ops.object.transform_apply(rotation=True, scale=True)

        # Highlight edge crest trim
        bpy.ops.mesh.primitive_torus_add(major_radius=0.22, minor_radius=0.015, location=(cx, 1.68, 2.06))
        edge = bpy.context.active_object
        edge.name = f"CrestEdge_{'R' if side < 0 else 'L'}"
        edge.rotation_euler = (math.radians(20), math.radians(90), side * math.radians(5))
        edge.scale = (1.1, 1.6, 0.4)
        edge.data.materials.append(mat_crest_edge)
        bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Eyes & Pupils
    for side in (-1, 1):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=12, radius=0.065, location=(side * 0.13, 1.56, 1.88))
        eye = bpy.context.active_object
        eye.name = f"Eye_{'R' if side < 0 else 'L'}"
        eye.data.materials.append(mat_eye)

        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.016, depth=0.03, location=(side * 0.17, 1.56, 1.88))
        pupil = bpy.context.active_object
        pupil.name = f"Pupil_{'R' if side < 0 else 'L'}"
        pupil.rotation_euler = (0, math.radians(90), 0)
        pupil.scale = (0.35, 1.8, 1.0)
        pupil.data.materials.append(mat_pupil)
        bpy.ops.object.transform_apply(rotation=True, scale=True)

    # Slender sharp teeth
    for side in (-1, 1):
        for t_idx in range(6):
            ty = 1.74 + t_idx * 0.05
            tz = 1.78 - t_idx * 0.007
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.011, depth=0.035, location=(side * 0.075, ty, tz))
            tooth = bpy.context.active_object
            tooth.name = f"Tooth_{t_idx}_{'R' if side < 0 else 'L'}"
            tooth.rotation_euler = (math.radians(180), 0, side * math.radians(-10))
            tooth.data.materials.append(mat_tooth)
            bpy.ops.object.transform_apply(rotation=True)

    # 5. Hind Limbs (Long-distance cursorial predator)
    for side in (-1, 1):
        sx = side * 0.32
        # Thigh
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=14, radius=0.28, location=(sx, -0.38, 0.88))
        thigh = bpy.context.active_object
        thigh.name = f"Thigh_{'R' if side < 0 else 'L'}"
        thigh.scale = (0.7, 1.1, 1.45)
        thigh.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(scale=True)

        # Shin
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.075, depth=0.55, location=(sx, -0.44, 0.48))
        shin = bpy.context.active_object
        shin.name = f"Shin_{'R' if side < 0 else 'L'}"
        shin.rotation_euler = (math.radians(-16), 0, 0)
        shin.data.materials.append(mat_stripes)
        bpy.ops.object.transform_apply(rotation=True)

        # Metatarsal
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.052, depth=0.45, location=(sx, -0.32, 0.20))
        meta = bpy.context.active_object
        meta.name = f"Metatarsal_{'R' if side < 0 else 'L'}"
        meta.rotation_euler = (math.radians(22), 0, 0)
        meta.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        # 3 Digitigrade Toes + Talons
        for toe_i, toe_ang in enumerate((-20, 0, 20)):
            tx = sx + math.sin(math.radians(toe_ang)) * 0.075
            ty = -0.20 + math.cos(math.radians(toe_ang)) * 0.13
            bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.03, depth=0.18, location=(tx, ty, 0.03))
            toe = bpy.context.active_object
            toe.name = f"Toe_{toe_i}_{'R' if side < 0 else 'L'}"
            toe.rotation_euler = (math.radians(90), 0, math.radians(-toe_ang))
            toe.data.materials.append(mat_scales)
            bpy.ops.object.transform_apply(rotation=True)

            bpy.ops.mesh.primitive_cone_add(vertices=10, radius1=0.028, depth=0.07, location=(tx, ty + 0.10, 0.03))
            talon = bpy.context.active_object
            talon.name = f"Talon_{toe_i}_{'R' if side < 0 else 'L'}"
            talon.rotation_euler = (math.radians(95), 0, math.radians(-toe_ang))
            talon.data.materials.append(mat_claw)
            bpy.ops.object.transform_apply(rotation=True)

    # 6. Grasping Forelimbs (Strong arms with 3 distinct hooked claws)
    for side in (-1, 1):
        sx = side * 0.25
        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.042, depth=0.26, location=(sx, 0.30, 0.78))
        uarm = bpy.context.active_object
        uarm.name = f"UpperArm_{'R' if side < 0 else 'L'}"
        uarm.rotation_euler = (math.radians(40), side * math.radians(-18), 0)
        uarm.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        bpy.ops.mesh.primitive_cylinder_add(vertices=10, radius=0.034, depth=0.24, location=(sx + side * 0.05, 0.42, 0.62))
        farm = bpy.context.active_object
        farm.name = f"Forearm_{'R' if side < 0 else 'L'}"
        farm.rotation_euler = (math.radians(-45), side * math.radians(-12), 0)
        farm.data.materials.append(mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

        for f_idx in range(3):
            fx = sx + side * (0.04 + f_idx * 0.018)
            fy = 0.55 + f_idx * 0.02
            fz = 0.52 - f_idx * 0.015
            bpy.ops.mesh.primitive_cone_add(vertices=8, radius1=0.014, depth=0.055, location=(fx, fy, fz))
            fclaw = bpy.context.active_object
            fclaw.name = f"HandClaw_{f_idx}_{'R' if side < 0 else 'L'}"
            fclaw.rotation_euler = (math.radians(78), side * math.radians(15), 0)
            fclaw.data.materials.append(mat_claw)
            bpy.ops.object.transform_apply(rotation=True)

    # 7. Whip Tail (8 segments)
    tail_pts = [
        (0, -0.85, 0.88, 0.22, 0.38),
        (0, -1.22, 0.90, 0.18, 0.40),
        (0, -1.61, 0.93, 0.15, 0.42),
        (0, -2.02, 0.96, 0.12, 0.42),
        (0, -2.43, 1.01, 0.09, 0.42),
        (0, -2.84, 1.08, 0.065, 0.42),
        (0, -3.24, 1.18, 0.045, 0.40),
        (0, -3.62, 1.29, 0.025, 0.38)
    ]
    for i, (tx, ty, tz, trad, tlen) in enumerate(tail_pts):
        bpy.ops.mesh.primitive_cylinder_add(vertices=14, radius=trad, depth=tlen, location=(tx, ty, tz))
        tseg = bpy.context.active_object
        tseg.name = f"Tail_{i}"
        tseg.rotation_euler = (math.radians(82 + i * 1.8), 0, 0)
        tseg.data.materials.append(mat_stripes if i % 2 == 1 else mat_scales)
        bpy.ops.object.transform_apply(rotation=True)

    # Smooth shading
    for obj in bpy.context.scene.objects:
        if obj.type == 'MESH':
            for poly in obj.data.polygons:
                poly.use_smooth = True

    # Camera & Rainforest Lighting
    bpy.ops.object.camera_add(location=(3.2, -4.2, 2.6), rotation=(math.radians(66), 0, math.radians(36)))
    cam = bpy.context.active_object
    cam.name = "Camera"
    bpy.context.scene.camera = cam

    # Sun through rainforest canopy
    bpy.ops.object.light_add(type='SUN', location=(5, -3, 7))
    sun = bpy.context.active_object
    sun.data.energy = 5.0
    sun.data.color = (0.95, 1.0, 0.90)

    # Fill: Deep emerald shadow fill
    bpy.ops.object.light_add(type='POINT', location=(-3, 2, 3))
    fill = bpy.context.active_object
    fill.data.energy = 160
    fill.data.color = (0.4, 0.8, 0.5)

    # Rim: Striking amber highlight emphasizing the twin crests
    bpy.ops.object.light_add(type='POINT', location=(0, 5, 4))
    rim = bpy.context.active_object
    rim.data.energy = 320
    rim.data.color = (1.0, 0.72, 0.25)

    # Render settings
    bpy.context.scene.render.resolution_x = 1280
    bpy.context.scene.render.resolution_y = 960
    bpy.context.scene.render.film_transparent = True
    bpy.context.scene.render.image_settings.file_format = 'PNG'

    preview_path = os.path.join(base_dir, "dilophosaurus_preview.png")
    bpy.context.scene.render.filepath = preview_path
    bpy.ops.render.render(write_still=True)

    blend_path = os.path.join(base_dir, "dilophosaurus.blend")
    bpy.ops.wm.save_as_mainfile(filepath=blend_path)

    glb_path1 = os.path.join(base_dir, "dilophosaurus.glb")
    glb_path2 = os.path.join(pub_dir, "dilophosaurus.glb")
    bpy.ops.export_scene.gltf(filepath=glb_path1, export_format='GLB', use_selection=False)
    shutil.copyfile(glb_path1, glb_path2)
    print("FINISHED Dilophosaurus:", glb_path1)

if __name__ == "__main__":
    build_dilophosaurus()
