"""Author a small botanical mesh library in Blender, with runtime LOD buffers.
All shapes are authored growth structures, not sphere/cone canopy stand-ins.
Run through Blender MCP or the Blender CLI. Outputs are deterministic.
"""
import bpy, math, json, random, base64, struct
from pathlib import Path
from mathutils import Vector
BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'assets/art-v2/botany'

class Plant:
 def __init__(self,seed):self.v=[];self.f=[];self.colors=[];self.r=random.Random(seed)
 def vertex(self,p,c):
  self.v.append(tuple(p));self.colors.append(c);return len(self.v)-1
 def tube(self,points,radii,color,sides=5):
  rows=[]
  for i,p in enumerate(points):
   p=Vector(p);d=Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])
   d.normalize();u=d.cross(Vector((0,1,0)))
   if u.length<.01:u=d.cross(Vector((1,0,0)))
   u.normalize();v=d.cross(u)
   rows.append([self.vertex(p+(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))*radii[i],color) for j in range(sides)])
  for a,b in zip(rows,rows[1:]):
   for j in range(sides):k=(j+1)%sides;self.f.extend([(a[j],a[k],b[k]),(a[j],b[k],b[j])])
  self.f.append(tuple(reversed(rows[0])));self.f.append(tuple(rows[-1]))
 def leaf(self,start,end,width,color,fan=False):
  a,b=Vector(start),Vector(end);d=b-a;u=d.cross(Vector((0,0,1)))
  if u.length<.01:u=Vector((1,0,0))
  u.normalize()
  # A folded lamina with a raised midrib, tapered tip and closed underside.
  pts=[a,a+d*.42+u*width,b,a+d*.42-u*width,a+d*.45+Vector((0,0,width*.22)),a+d*.45-Vector((0,0,.008))]
  if fan:pts[1]=a+d*.82+u*width;pts[3]=a+d*.82-u*width
  ids=[self.vertex(p,tuple(c*(1.08 if i==4 else .82 if i==5 else 1) for c in color)) for i,p in enumerate(pts)]
  for j in range(4):self.f.extend([(ids[j],ids[(j+1)%4],ids[4]),(ids[(j+1)%4],ids[j],ids[5])])
 def mesh(self,name):
  m=bpy.data.meshes.new(name);m.from_pydata(self.v,[],self.f);m.update()
  c=m.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
  for i,col in enumerate(self.colors):c.data[i].color=(*col,1)
  # Spherical/cylindrical UVs retained for future texture paint; pigment is baked.
  uv=m.uv_layers.new(name='UVMap')
  for poly in m.polygons:
   axis=max(range(3),key=lambda i:abs(poly.normal[i]));axes=[i for i in range(3) if i!=axis]
   for li in poly.loop_indices:
    p=m.vertices[m.loops[li].vertex_index].co;uv.data[li].uv=(p[axes[0]]*.3,p[axes[1]]*.3)
  return m

def build(kind,lod):
 p=Plant(401);brown=(.15,.085,.038);green=(.10,.25,.085);sage=(.23,.36,.13)
 if kind in ('fern','cycad'):
  fronds=max(3,7-lod*2);pins=max(1,5-lod);stiff=kind=='cycad'
  if stiff:p.tube([(0,0,0),(0,0,.35)],[.16,.11],brown,7)
  for n in range(fronds):
   a=n*math.tau/fronds+.15*math.sin(n*4);d=Vector((math.cos(a),math.sin(a),0));side=Vector((-d.y,d.x,0))
   def rachis(t):return d*(t*1.35)+Vector((0,0,(.3 if stiff else .04)+math.sin(t*2.3)*(.55 if stiff else .85)))
   p.tube([rachis(t/4) for t in range(5)],[.022,.018,.014,.009,.003],green,3)
   for j in range(1,pins+1):
    t=j/(pins+1);c=rachis(t);w=math.sin(t*math.pi)*(.28 if stiff else .26)
    for s in [-1,1]:p.leaf(c,c+side*s*w+d*(.19 if stiff else .12),.025 if stiff else .055,sage if j%3==0 else green)
 elif kind in ('conifer','ginkgo','shrub'):
  shrub=kind=='shrub';height=1.2 if shrub else 2.6
  p.tube([(0,0,0),(.02,0,height*.5),(0,.03,height)],[.11,.07,.018],brown,6)
  levels=max(2,5-lod)
  for j in range(levels):
   z=height*(.22+.7*j/levels)
   radius=(1-j/(levels+1))*1.05 if kind=='conifer' else math.sin((j+1)/(levels+1)*math.pi)*(.9 if shrub else 1.45)
   for k in range(max(3,4-lod//2)):
    a=k*math.tau/(max(3,4-lod//2))+j*2.399;d=Vector((math.cos(a),math.sin(a),0))
    start=Vector((0,0,z));end=start+d*radius+Vector((0,0,.12))
    p.tube([start,start+d*radius*.5+Vector((0,0,.07)),end],[.025,.014,.003],brown,3)
    for n in range(1,max(2,4-lod)):
     t=n/max(2,4-lod);c=start.lerp(end,t)
     for s in [-1,1]:
      side=Vector((-d.y,d.x,0))*s
      tip=c+side*(.23 if kind=='ginkgo' else .30)*(1-t*.5)+d*.15+Vector((0,0,.025))
      p.leaf(c,tip,.12 if kind=='ginkgo' else .09 if shrub else .07,sage if (k+n)%4==0 else green,kind=='ginkgo')
 elif kind=='horsetail':
  for n in range(max(3,6-lod)):
   a=n*2.4;r=.18*math.sqrt(n);x=math.cos(a)*r;y=math.sin(a)*r;h=.8+n*.16
   p.tube([(x,y,0),(x,y,h)],[.027,.016],sage,5)
   for j in range(2,7-lod):
    for k in range(5):
     a=k*math.tau/5+j*.4;c=Vector((x,y,h*j/7))
     p.leaf(c,c+Vector((math.cos(a)*.19,math.sin(a)*.19,.1)),.014,green)
 elif kind=='flower':
  for n in range(3 if lod<2 else 2):
   a=n*2.4;x=math.cos(a)*.12;y=math.sin(a)*.12;h=.5+n*.1
   p.tube([(x,y,0),(x+.06,y,h)],[.018,.009],green,4)
   for side in [-1,1]:p.leaf((x,y,h*.4),(x+side*.22,y+.1,h*.6),.06,green)
   for k in range(5):
    angle=k*math.tau/5;c=Vector((x+.06,y,h));p.leaf(c,c+Vector((math.cos(angle)*.17,math.sin(angle)*.17,.04)),.07,(.64,.36,.24),True)
 elif kind=='mushroom':
  p.tube([(0,0,0),(.025,0,.55)],[.055,.035],(.43,.34,.22),7)
  rings=[];sides=max(6,14-lod*2)
  for z,r in [(.5,.05),(.43,.28),(.48,.35),(.58,.26),(.66,.025)]:
   ring=[]
   for k in range(sides):
    a=k*math.tau/sides;ring.append(p.vertex((.025+math.cos(a)*r,math.sin(a)*r,z),(.38+z*.22,.18+z*.14,.09+z*.12)))
   rings.append(ring)
  for a,b in zip(rings,rings[1:]):
   for k in range(sides):q=(k+1)%sides;p.f.extend([(a[k],a[q],b[q]),(a[k],b[q],b[k])])
  p.f.extend([tuple(reversed(rings[0])),tuple(rings[-1])])
 elif kind=='log':
  sides=max(8,16-lod*2);rings=[]
  for j in range(9):
   x=(j/8-.5)*7;ring=[]
   for k in range(sides):
    a=k*math.tau/sides;r=(.72+.055*math.sin(k*7.1+j*.2))*(.95+.05*math.sin(j*2))
    ring.append(p.vertex((x,math.cos(a)*r,.75+math.sin(a)*r),(.17+.025*math.sin(k*4),.095+.015*math.sin(k*4),.042)))
   rings.append(ring)
  for a,b in zip(rings,rings[1:]):
   for k in range(sides):q=(k+1)%sides;p.f.extend([(a[k],a[q],b[q]),(a[k],b[q],b[k])])
  for end,ring in enumerate([rings[0],rings[-1]]):
   center=p.vertex(((-3.5 if end==0 else 3.5),0,.75),(.46,.29,.13))
   for k in range(sides):p.f.append((center,ring[(k+1)%sides],ring[k]) if end==0 else (center,ring[k],ring[(k+1)%sides]))
 elif kind=='rock':
  # Eroded angular outcrop with horizontal bedding, not a uniform regular solid.
  rings=[];sides=max(5,10-lod*2)
  for j,(z,r) in enumerate([(-.05,.72),(.18,1),(.58,.83),(.9,.45)]):
   ring=[]
   for k in range(sides):
    a=k*math.tau/sides;rr=r*(.88+p.r.random()*.22)
    ring.append(p.vertex((math.cos(a)*rr,math.sin(a)*rr*.85,z+p.r.random()*.09),(.23+j*.015,.25+j*.016,.20+j*.014)))
   rings.append(ring)
  for a,b in zip(rings,rings[1:]):
   for k in range(sides):q=(k+1)%sides;p.f.extend([(a[k],a[q],b[q]),(a[k],b[q],b[k])])
  p.f.extend([tuple(reversed(rings[0])),tuple(rings[-1])])
 return p

def produce():
 OUT.mkdir(parents=True,exist_ok=True)
 scene=bpy.data.scenes.new('JD_Botanical_Library');bpy.context.window.scene=scene
 material=bpy.data.materials.new('M_Botany');material.use_nodes=True
 bsdf=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 attr=material.node_tree.nodes.new('ShaderNodeVertexColor');attr.layer_name='Pigment'
 material.node_tree.links.new(attr.outputs['Color'],bsdf.inputs['Base Color']);bsdf.inputs['Roughness'].default_value=.86
 data={};objects=[]
 for index,kind in enumerate(['fern','cycad','conifer','ginkgo','shrub','horsetail','rock','flower','mushroom','log']):
  data[kind]=[]
  for lod in range(4):
   plant=build(kind,lod);mesh=plant.mesh(kind+'_LOD'+str(lod))
   ob=bpy.data.objects.new(mesh.name,mesh);scene.collection.objects.link(ob);ob.data.materials.append(material)
   # JSON is the exact triangulated Blender mesh, converted to Three.js Y-up.
   mesh.calc_loop_triangles();pos=[];colors=[];normals=[]
   for tri in mesh.loop_triangles:
    for idx in tri.vertices:
     v=mesh.vertices[idx];pos.extend([round(v.co.x,5),round(v.co.z,5),round(-v.co.y,5)])
     normals.extend([round(tri.normal.x,5),round(tri.normal.z,5),round(-tri.normal.y,5)])
     colors.extend([round(c,4) for c in plant.colors[idx]])
   encode=lambda fmt,values:base64.b64encode(struct.pack('<'+fmt*len(values),*values)).decode('ascii')
   data[kind].append({'position':encode('h',[round(v*5000) for v in pos]),'normal':encode('b',[round(v*127) for v in normals]),'color':encode('B',[round(max(0,min(1,v))*255) for v in colors])})
   if lod==0:ob.location.x=index*3;objects.append(ob)
   else:ob.hide_render=True;ob.hide_set(True)
 scene['provenance']='Original procedural botanical meshes authored for Jurassic Domination; no external assets.'
 (BASE/'src/botany-meshes.json').write_text(json.dumps(data,separators=(',',':')))
 bpy.data.libraries.write(str(OUT/'prehistoric-botany.blend'),{scene},fake_user=True,compress=True)
 bpy.ops.object.select_all(action='DESELECT')
 for o in objects:o.select_set(True)
 bpy.ops.export_scene.gltf(filepath=str(OUT/'prehistoric-botany.glb'),use_selection=True,use_active_scene=True,export_format='GLB')
 print('JD_BOTANY',json.dumps({k:len(v) for k,v in data.items()}))
 return objects

if __name__=='__main__':produce()
