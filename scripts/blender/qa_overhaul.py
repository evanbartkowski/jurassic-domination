import bpy, sys, json
from mathutils import Vector
from pathlib import Path
BASE=Path(__file__).resolve().parents[2]
sys.path.insert(0,r'C:\Users\evan\.agents\skills\blender-asset-qa\scripts')
import qa_check
reports={}
for path in sorted((BASE/'assets/art-v2/creatures').glob('*/*.blend')):
 bpy.ops.wm.open_mainfile(filepath=str(path))
 bpy.context.scene.frame_set(1)
 names=[o.name for o in bpy.context.scene.objects if o.type=='MESH']
 report=qa_check.run(objects=names,max_tris=50000,eps=.0002)
 reports[path.parent.name]=report
 print(path.parent.name,'PASS',report['pass'],'ERRORS',report['errors'],flush=True)
 if '--render' in sys.argv:
  scene=bpy.context.scene
  points=[o.matrix_world@Vector(v) for o in scene.objects if o.type=='MESH' for v in o.bound_box]
  lo=Vector([min(p[i] for p in points) for i in range(3)]);hi=Vector([max(p[i] for p in points) for i in range(3)]);center=(lo+hi)/2
  camdata=bpy.data.cameras.new('ReviewCamera');cam=bpy.data.objects.new('ReviewCamera',camdata);scene.collection.objects.link(cam)
  cam.location=center+Vector((7,3,3.5));cam.rotation_euler=(center-cam.location).to_track_quat('-Z','Y').to_euler();camdata.type='ORTHO';camdata.ortho_scale=max(hi.y-lo.y,hi.z-lo.z)*1.3;scene.camera=cam
  for name,location,energy,color,size in [('Key',(4,2,7),900,(1,.85,.65),5),('Fill',(-4,1,4),650,(.6,.8,1),5),('Rim',(0,-4,6),1000,(.9,1,.85),3)]:
   light=bpy.data.lights.new(name,'AREA');light.energy=energy;light.color=color;light.shape='DISK';light.size=size
   ob=bpy.data.objects.new(name,light);scene.collection.objects.link(ob);ob.location=center+Vector(location);ob.rotation_euler=(center-ob.location).to_track_quat('-Z','Y').to_euler()
  scene.world=bpy.data.worlds.new('ReviewWorld');scene.world.color=(.18,.18,.18)
  scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=900;scene.render.resolution_y=600;scene.render.resolution_percentage=100;scene.render.film_transparent=True
  scene.render.image_settings.file_format='PNG';scene.render.filepath=str(path.with_name(path.stem+'_preview.png'))
  bpy.ops.render.render(write_still=True)
(BASE/'artifacts/visual-overhaul/creature-mesh-qa.json').write_text(json.dumps(reports,indent=2,default=str))
