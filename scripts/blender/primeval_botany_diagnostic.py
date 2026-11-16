import sys,bpy
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parent))
import primeval_botany as bot
records=[]
for method in ['tube','leaf']:
 original=getattr(bot.Growth,method)
 def wrap(self,*args,_original=original,_method=method,**kwargs):
  start=len(self.v);_original(self,*args,**kwargs);records.append((start,len(self.v),_method))
 setattr(bot.Growth,method,wrap)
p=bot.build('shrub',0);material=bpy.data.materials.new('Diagnostic');objects=[]
for i,(start,end,kind)in enumerate(records):
 faces=[tuple(v-start for v in face)for face in p.f if all(start<=v<end for v in face)]
 mesh=bpy.data.meshes.new(kind+str(i));mesh.from_pydata(p.v[start:end],[],faces);mesh.update();ob=bpy.data.objects.new(mesh.name,mesh);bpy.context.scene.collection.objects.link(ob);mesh.materials.append(material);objects.append(ob.name)
import qa_check
r=qa_check.run(objects=objects,profile='game',eps=.0001,tol=.025,max_tris=10000,uv=False)
print('DIAGNOSTIC',r['errors'],flush=True)
