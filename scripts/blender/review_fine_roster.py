"""Read-only native geometry review through the installed Blender QA gate."""
import bpy,sys,json
from pathlib import Path
base=Path(__file__).resolve().parents[2]
sys.path.insert(0,r'C:/Users/evan/.agents/skills/blender-asset-qa/scripts')
import review_shots
args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
ids=args or [e['species']['id'] for e in json.loads((base/'assets/art-v3/anatomy.json').read_text())]
out=base/'artifacts/creature-detail/native';out.mkdir(parents=True,exist_ok=True)
def readable_wire(scene):
 # The stock review helper's 0.6%-of-bounds wire is thick enough to cover a
 # fine organic mesh completely. Keep the diagnostic lines below a millimetre.
 scene.display.shading.background_type='VIEWPORT';scene.display.shading.background_color=(.12,.15,.13)
 for ob in scene.objects:
  for modifier in ob.modifiers:
   if modifier.name=='QA_Wire':modifier.thickness=.0007
for sid in ids:
 bpy.ops.wm.open_mainfile(filepath=str(base/'assets/art-v5/creatures'/sid/(sid+'.blend')),load_ui=False)
 bpy.app.handlers.render_pre.append(readable_wire)
 for ob in bpy.context.scene.objects:
  if ob.type=='ARMATURE':ob.data.pose_position='REST'
 subject=next(ob for ob in bpy.context.scene.objects if ob.name.startswith('Surface_LOD0'))
 for mode in ['material','wire']:
  result=review_shots.run(objects=[subject.name],out=str(out/(sid+'-'+mode+'.png')),views=['front','right','top','three_quarter'],mode=mode,res=256)
  if not result.get('ok'):raise RuntimeError(sid+' '+mode+' review failed')
 print('DETAIL_REVIEW',sid,flush=True)
