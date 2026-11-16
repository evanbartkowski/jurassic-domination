"""Neutral PBR studio review, +X-facing creature: side/front/top/three-quarter.
Run after opening a generated source. Writes images only, never edits the source.
"""
import bpy,math,sys,json
from pathlib import Path
from mathutils import Vector
args=sys.argv[sys.argv.index('--')+1:];out=Path(args[0]);out=out if out.is_absolute() else Path(__file__).resolve().parents[2]/out;out.mkdir(parents=True,exist_ok=True)
scene=bpy.context.scene
for ob in scene.objects:
    if ob.type=='ARMATURE':ob.data.pose_position='REST'
    if 'LOD1' in ob.name:ob.hide_render=True
surface=next(o for o in scene.objects if o.name.startswith('Surface_LOD0'))
bpy.context.view_layer.update();bounds=[surface.matrix_world@Vector(p) for p in surface.bound_box]
lo=Vector([min(p[i] for p in bounds) for i in range(3)]);hi=Vector([max(p[i] for p in bounds) for i in range(3)]);center=(lo+hi)/2;span=max(hi-lo)
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=1000;scene.render.resolution_y=700;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG';scene.world=bpy.data.worlds.new('Review_world');scene.world.use_nodes=True;scene.world.node_tree.nodes.get('Background').inputs[0].default_value=(.14,.17,.20,1);scene.world.node_tree.nodes.get('Background').inputs[1].default_value=.5
scene.view_settings.view_transform='AgX'
for name,pos,power,size,color in [('Key',(3,-4,7),1500,5,(1,.91,.80)),('Fill',(1,5,4),1100,5,(.79,.87,1)),('Rim',(-4,1,5),1400,4,(1,.93,.84))]:
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=color;ob=bpy.data.objects.new(name,data);scene.collection.objects.link(ob);ob.location=pos;ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
data=bpy.data.cameras.new('Review_camera');camera=bpy.data.objects.new('Review_camera',data);scene.collection.objects.link(camera);scene.camera=camera;data.type='ORTHO';data.ortho_scale=span*1.25
for name,direction in [('side',(0,-1,.05)),('front',(1,0,.12)),('top',(0,.001,1)),('three-quarter',(1,-1,.55))]:
    camera.location=center+Vector(direction).normalized()*span*2;camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=str(out/(name+'.png'));bpy.ops.render.render(write_still=True)
print('REFERENCE_REVIEW',json.dumps({'directory':str(out),'views':4,'dimensions':list(hi-lo)}),flush=True)
