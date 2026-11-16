"""Original closed botanical growth meshes with full crowns and coherent LOD silhouettes."""
import bpy,bmesh,math,json,random,base64,struct,sys
from pathlib import Path
from mathutils import Vector
BASE=Path(__file__).resolve().parents[2];OUT=BASE/'assets/art-v4/botany';OUT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,r'C:/Users/evan/.agents/skills/blender-asset-qa/scripts');import qa_check
class Growth:
 def __init__(self):self.v=[];self.f=[];self.c=[];self.custom_uv={};self.hard_faces=set();self.random=random.Random(918)
 def vertex(self,p,c):self.v.append(tuple(p));self.c.append(c);return len(self.v)-1
 def tube(self,points,radii,color,sides=6):
  rows=[]
  for i,p in enumerate(points):
   p=Vector(p);d=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized();u=d.cross(Vector((0,1,0)))
   if u.length<.01:u=d.cross(Vector((1,0,0)))
   u.normalize();v=d.cross(u);rows.append([self.vertex(p+(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))*radii[i],color)for j in range(sides)])
  for a,b in zip(rows,rows[1:]):
   for j in range(sides):k=(j+1)%sides;self.f.extend([(a[j],a[k],b[k]),(a[j],b[k],b[j])])
  self.f.extend([tuple(reversed(rows[0])),tuple(rows[-1])])
 def card(self,start,direction,width,rect,broadleaf=False,roll=0):
  first_face=len(self.f)
  a=Vector(start);d=Vector(direction);u=d.cross(Vector((0,0,1))).normalized();u=u*math.cos(roll)+d.normalized().cross(u)*math.sin(roll);normal=d.normalized().cross(u).normalized();rows=[]
  for side in [-1,1]:
   row=[]
   for j in range(3):
    for k in [-1,1]:
     p=a+d*(j/2)+u*k*width*.5+Vector((0,0,math.sin(j/2*math.pi)*.10))+normal*side*.003;idx=self.vertex(p,(1,1,1));row.append(idx)
     U0,V0,U1,V1=rect;self.custom_uv[idx]=(U0+(U1-U0)*(j/2 if broadleaf else (k+1)/2),V0+(V1-V0)*((k+1)/2 if broadleaf else j/2))
   rows.append(row)
  for j in range(2):i=j*2;self.f.extend([(rows[0][i],rows[0][i+1],rows[0][i+3],rows[0][i+2]),(rows[1][i+2],rows[1][i+3],rows[1][i+1],rows[1][i])])
  boundary=[0,1,3,5,4,2]
  for i,j in zip(boundary,boundary[1:]+boundary[:1]):self.f.append((rows[0][i],rows[1][i],rows[1][j],rows[0][j]))
  self.hard_faces.update(range(first_face,len(self.f)))
 def leaf(self,start,end,width,color,fan=False):
  a,b=Vector(start),Vector(end);d=b-a;u=d.cross(Vector((0,0,1)))
  if u.length<.01:u=Vector((1,0,0))
  u.normalize();twist=math.sin(b.x*17+b.y*23+b.z*31)*.19;u=u*math.cos(twist)+d.normalized().cross(u)*math.sin(twist);positions=[a,a+d*.30+u*width*.65,a+d*.70+u*width,b,a+d*.70-u*width,a+d*.30-u*width*.65]
  if fan:positions=[a,a+d*.65+u*width*.9,a+d*.94+u*width,a+d*1.04+u*width*.35,a+d*.95,a+d*1.04-u*width*.35,a+d*.94-u*width,a+d*.65-u*width*.9]
  edge=[self.vertex(p,color)for p in positions];ridge=a+d*.56+Vector((0,0,width*.16));top=self.vertex(ridge,tuple(v*1.10 for v in color));bottom=self.vertex(ridge-Vector((0,0,.008)),tuple(v*.70 for v in color))
  for j in range(len(edge)):k=(j+1)%len(edge);self.f.extend([(edge[j],edge[k],top),(edge[k],edge[j],bottom)])
 def object(self,name,material):
  mesh=bpy.data.meshes.new(name);mesh.from_pydata(self.v,[],self.f);mesh.update();ob=bpy.data.objects.new(name,mesh);bpy.context.scene.collection.objects.link(ob);mesh.materials.append(material)
  pigment=mesh.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
  for i,col in enumerate(self.c):pigment.data[i].color=(*col,1)
  uv=mesh.uv_layers.new(name='UVMap')
  for poly in mesh.polygons:
   poly.use_smooth=poly.index not in self.hard_faces;axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3)if i!=axis]
   for li in poly.loop_indices:
    index=mesh.loops[li].vertex_index;p=mesh.vertices[index].co;uv.data[li].uv=self.custom_uv.get(index,(p[axes[0]]*.7+.5,p[axes[1]]*.7+.5))
  bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(mesh);bm.free();mesh.update();return ob

def build(kind,lod):
 p=Growth();wood=(.85,.80,.72) if kind=='log' else (.105,.061,.028);leaf=(.085,.205,.062);light=(.15,.285,.09);sage=(.20,.30,.125)
 if kind in ['conifer','ginkgo']:
  broad=kind=='ginkgo';h=2.6;tiers=max(4,7-lod);branches=max(4,7-lod);copies=2 if lod<2 else 1
  p.tube([(0,0,0),(.035,0,.55),(-.018,.025,1.3),(.02,.035,2.0),(0,0,h)],[.125,.105,.075,.041,.008],(1,1,1),max(5,9-lod))
  for i,(x,y,z) in enumerate(p.v):p.custom_uv[i]=(.77+(math.atan2(y,x)/math.tau+.5)*.215,z/h)
  rectangles=[(.14,.60,.36,.96),(.48,.62,.70,.96),(.14,.21,.37,.60),(.48,.20,.70,.59)] if not broad else [(.125,.54,.735,.98),(.005,.30,.34,.67),(.35,.02,.73,.45)]
  for j in range(tiers):
   z=h*(.24+j*.68/(tiers-1));r=(.18+(1-j/(tiers+.2))*.95) if not broad else math.sin((j+1)/(tiers+1)*math.pi)*1.12
   for k in range(branches):
    angle=k*math.tau/branches+j*2.399;d=Vector((math.cos(angle),math.sin(angle),0));a=Vector((.01,.02,z));tip=a+d*r+Vector((0,0,.12));start=len(p.v);p.tube([a,a.lerp(tip,.48),tip],[.025,.016,.004],(1,1,1),4)
    for i in range(start,len(p.v)):x,y,Z=p.v[i];p.custom_uv[i]=(.78+((x+y)*3%1)*.20,Z/h)
    for copy in range(copies):p.card(a+d*r*.25,d*r*(1.15+lod*.10)+Vector((0,0,.17)),r*(.85 if not broad else 1.00)*(1+lod*.13),rectangles[(j+k)%len(rectangles)],broad,(-.44+copy*.85))
  return p
 if kind in ['conifer','ginkgo','shrub']:
  shrub=kind=='shrub';h=1.12 if shrub else 2.6;tiers=max(2,(3 if shrub else 5)-lod);branches=max(3,(4 if shrub else 5)-lod);pins=max(1,(2 if shrub else 3)-lod)
  trunk=[(math.sin(i*.7)*.025,math.cos(i*.6)*.018,h*i/5)for i in range(6)];p.tube(trunk,[.13,.12,.095,.07,.04,.006],wood,max(5,9-lod))
  for j in range(tiers):
   z=h*(.28+j*.62/max(1,tiers-1));radius=(1-j/(tiers+.5))*.95 if kind=='conifer' else math.sin((j+1)/(tiers+1)*math.pi)*(1.12 if not shrub else .75)
   for k in range(branches):
    a=k*math.tau/branches+j*2.4;d=Vector((math.cos(a),math.sin(a),0));side=Vector((-d.y,d.x,0));start=Vector((0,0,z));end=start+d*radius+Vector((0,0,.16 if kind!='conifer' else -.05))
    p.tube([start,start.lerp(end,.45)+Vector((0,0,.03)),end],[.035,.020,.005],wood,4)
    for n in range(1,pins+1):
     t=n/(pins+1);c=start.lerp(end,t)
     for sign in [-1,1]:
      tip=c+d*(.33+lod*.05)+side*sign*(.25+lod*.045)+Vector((0,0,.10+n*.045+sign*.025));width=(.20 if kind=='ginkgo' else .17 if shrub else .14)*(1+lod*.18)
      p.leaf(c,tip,width,light if (j+k+n)%5==0 else leaf,kind=='ginkgo')
    p.leaf(end-d*.10,end+d*(.32+lod*.07)+Vector((0,0,.08)),.13*(1+lod*.25),leaf,kind=='ginkgo')
 elif kind in ['fern','cycad']:
  stiff=kind=='cycad';fronds=max(3,8-lod*2);pins=max(3,7-lod*2)
  if stiff:p.tube([(0,0,0),(0,0,.30),(0,0,.46)],[.17,.13,.10],wood,8)
  for n in range(fronds):
   a=n*math.tau/fronds;d=Vector((math.cos(a),math.sin(a),0));side=Vector((-d.y,d.x,0))
   def rachis(t):return d*(t*1.3)+Vector((0,0,(.4 if stiff else .04)+n*.009+math.sin(t*2.7)*(.58 if stiff else .80)))
   p.tube([rachis(i/5)for i in range(6)],[.025,.022,.018,.013,.008,.003],leaf,4)
   for j in range(1,pins+1):
    t=j/(pins+1);c=rachis(t);length=math.sin(t*math.pi)*(.40 if stiff else .38)
    for sign in [-1,1]:p.leaf(c,c+side*sign*length+d*.16+Vector((0,0,.03)),.050 if stiff else .075,light if j%4==0 else leaf)
 elif kind=='horsetail':
  for n in range(max(3,6-lod)):
   a=n*2.4;r=.13*math.sqrt(n);x,y=math.cos(a)*r,math.sin(a)*r;h=.85+n*.105;p.tube([(x,y,0),(x+.015,y,h*.5),(x+.03,y,h)],[.027,.023,.008],sage,5)
   for j in range(2,max(3,5-lod)):
    for k in range(4):
     angle=k*math.tau/4+j*.4;c=Vector((x,y,h*j/5));p.leaf(c,c+Vector((math.cos(angle)*.18,math.sin(angle)*.18,.10)),.012,leaf)
 elif kind=='flower':
  for n in range(3 if lod<2 else 2):
   a=n*2.4;x,y=math.cos(a)*.15,math.sin(a)*.15;h=.46+n*.09;p.tube([(x,y,0),(x+.04,y,h*.6),(x+.07,y,h)],[.018,.013,.006],leaf,5)
   for sign in [-1,1]:p.leaf((x,y,h*.35),(x+sign*.24,y+.06,h*.55),.075,leaf)
   for k in range(5):
    angle=k*math.tau/5;c=Vector((x+.07,y,h));p.leaf(c,c+Vector((math.cos(angle)*.14,math.sin(angle)*.14,.05)),.070,(.47,.20,.12),True)
 elif kind=='mushroom':
  p.tube([(0,0,0),(.02,0,.25),(.03,0,.48)],[.06,.048,.044],(.31,.26,.17),8);sides=max(8,18-lod*3);rings=[]
  for z,r in [(.47,.03),(.43,.24),(.46,.34),(.53,.32),(.63,.22),(.67,.02)]:
   rings.append([p.vertex((.03+math.cos(k*math.tau/sides)*r,math.sin(k*math.tau/sides)*r,z),(.32,.17,.085))for k in range(sides)])
  for a,b in zip(rings,rings[1:]):
   for k in range(sides):q=(k+1)%sides;p.f.append((a[k],a[q],b[q],b[k]))
  p.f.extend([tuple(reversed(rings[0])),tuple(rings[-1])])
 elif kind=='log':
  p.tube([(-1.2,0,.22),(-.65,.04,.25),(0,.02,.27),(.6,-.02,.23),(1.15,-.06,.19)],[.20,.24,.26,.22,.15],wood,max(6,12-lod*2));p.tube([(-.15,.06,.34),(-.26,.32,.53),(-.31,.42,.61)],[.14,.09,.035],wood,6)
 elif kind=='rock':
  sides=max(6,12-lod*2);rings=[]
  for j,(z,r)in enumerate([(-.015,.91),(.10,1.0),(.35,.93),(.62,.75),(.84,.54),(1.02,.28),(1.10,.028)]):
   rings.append([p.vertex((math.cos(k*math.tau/sides)*r*(.93+math.sin(k*9+j*.55)*.14)+j*.025,math.sin(k*math.tau/sides)*r*.76,z+math.sin(k*11+j)*(.025 if j else 0)),(.75+j*.018,.77+j*.018,.70+j*.018))for k in range(sides)])
  for a,b in zip(rings,rings[1:]):
   for k in range(sides):q=(k+1)%sides;p.f.append((a[k],a[q],b[q],b[k]))
  p.f.extend([tuple(reversed(rings[0])),tuple(rings[-1])])
 return p

def produce():
 scene=bpy.data.scenes.new('Primeval_botanical_library');bpy.context.window.scene=scene;material=bpy.data.materials.new('Living_botany');bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Pigment';material.node_tree.links.new(attr.outputs[0],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.80
 data={};reports=[]
 for index,kind in enumerate(['fern','cycad','conifer','ginkgo','shrub','horsetail','rock','flower','mushroom','log']):
  data[kind]=[]
  for lod in range(4):
   plant=build(kind,lod);tree=kind in ['conifer','ginkgo'];asset_material=material
   if tree or kind in ['rock','log']:
    asset_material=bpy.data.materials.new(kind+'_PBR');p=next(n for n in asset_material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');nodes=asset_material.node_tree.nodes;links=asset_material.node_tree.links
    texture_kind=kind if kind=='conifer' else 'broadleaf' if tree else 'stone' if kind=='rock' else 'wood'
    for map,socket in [('color','Base Color'),('normal','Normal'),('roughness','Roughness')]:
     image=bpy.data.images.load(str(BASE/'public/assets/surfaces-v4'/(texture_kind+'-'+map+'.png')),check_existing=True);image.colorspace_settings.name='sRGB' if map=='color' else 'Non-Color';image.pack();node=nodes.new('ShaderNodeTexImage');node.image=image
     if map=='normal':normal=nodes.new('ShaderNodeNormalMap');links.new(node.outputs[0],normal.inputs['Color']);links.new(normal.outputs[0],p.inputs[socket])
     else:links.new(node.outputs[0],p.inputs[socket])
     if map=='color' and tree:links.new(node.outputs['Alpha'],p.inputs['Alpha'])
    p.inputs['Metallic'].default_value=0
    if tree:asset_material.surface_render_method='DITHERED';asset_material.use_backface_culling=True
   ob=plant.object(kind+'_LOD'+str(lod),asset_material);mesh=ob.data;mesh.calc_loop_triangles();pos=[];norm=[];color=[];uv=[]
   for tri in mesh.loop_triangles:
    for li in tri.loops:
     idx=mesh.loops[li].vertex_index;v=mesh.vertices[idx];normal=mesh.corner_normals[li].vector;pos.extend([v.co.x,v.co.z,-v.co.y]);norm.extend([normal.x,normal.z,-normal.y]);color.extend(plant.c[idx]);uv.extend(mesh.uv_layers.active.data[li].uv)
   encode=lambda fmt,values:base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
   data[kind].append({'position':encode('h',[round(v*5000)for v in pos]),'normal':encode('b',[round(max(-1,min(1,v))*127)for v in norm]),'color':encode('B',[round(max(0,min(1,v))*255)for v in color]),'uv':encode('f',uv)})
   qa=qa_check.run(objects=[ob.name],profile='game',eps=.0001,tol=.025,max_tris=10000,uv=False);reports.append({'kind':kind,'lod':lod,'triangles':len(mesh.loop_triangles),'qa':qa});print('PRIMEVAL_PLANT',kind,lod,len(mesh.loop_triangles),'QA',qa['pass'],flush=True)
   ob.location.x=index*3
   if lod:ob.hide_render=True;ob.hide_set(True)
 runtime=BASE/'src/botany-meshes-v4.json';serialized=json.dumps(data,separators=(',',':'))
 if not runtime.exists() or runtime.read_text()!=serialized:runtime.write_text(serialized)
 (OUT/'report.json').write_text(json.dumps(reports,indent=2));bpy.data.libraries.write(str(OUT/'primeval-botany.blend'),{scene},fake_user=True,compress=True)
 if any(not r['qa']['pass'] for r in reports):raise RuntimeError('Botany mesh QA needs repair')
if __name__=='__main__':produce()
