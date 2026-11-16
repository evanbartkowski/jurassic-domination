"""Non-destructive, repeatable art pass over the ten original Blender creatures.

Run with Blender --background --python ...; also callable through Blender MCP.
Original sources are read-only. New meshes use baked vertex pigment and a
deforming skeleton; no network services, external assets or paid generation.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector
from mathutils.bvhtree import BVHTree

BASE = Path(__file__).resolve().parents[2]
OUT = BASE / 'assets/art-v2/creatures'
PUB = BASE / 'public/assets/models-v2'
PALETTES = {
 'tyrannosaurus': ('876246', '303e36', 'd7bd8b'),
 'velociraptor': ('697a79', '293c47', 'd9be90'),
 'triceratops': ('7e8c69', '3c5147', 'c7b991'),
 'ankylosaurus': ('8d7958', '46564c', 'c7b17e'),
 'stegosaurus': ('6e8470', '344d43', 'd1be8c'),
 'brachiosaurus': ('84896b', '424f45', 'd1c19a'),
 'spinosaurus': ('567f7a', '293e47', 'c7b890'),
 'compsognathus': ('9a935f', '495842', 'ddd0a1'),
 'carnotaurus': ('a56c51', '493e36', 'ddbc8c'),
 'dilophosaurus': ('638675', '304c49', 'd4c39c'),
}
QUADS = {'triceratops','ankylosaurus','stegosaurus','brachiosaurus'}
def rgb(h):
 def linear(v): return v/12.92 if v<.04045 else ((v+.055)/1.055)**2.4
 return Vector(tuple(linear(int(h[i:i+2],16)/255) for i in (0,2,4)))
def smooth(a,b,x):
 t=max(0,min(1,(x-a)/(b-a))); return t*t*(3-2*t)

def produce(species):
 bpy.context.preferences.filepaths.save_version=0
 # A separate scene prevents accidental edits to the user's scene during MCP use.
 scene=bpy.data.scenes.new('JD_Art_'+species)
 bpy.context.window.scene=scene
 path=BASE/'assets/models'/species/(species+'.blend')
 with bpy.data.libraries.load(str(path),link=False) as (src,dst):
  dst.objects=[n for n in src.objects if not any(s in n.lower() for s in ('pedestal','camera','key','fill','rim','light'))]
 meshes=[]
 for ob in dst.objects:
  if not ob or ob.type!='MESH': continue
  scene.collection.objects.link(ob)
  bpy.context.view_layer.update()
  # Evaluate source sculpt/remesh modifiers once, rather than exporting authoring overhead.
  deps=bpy.context.evaluated_depsgraph_get()
  data=bpy.data.meshes.new_from_object(ob.evaluated_get(deps))
  data.transform(ob.matrix_world)
  ob.data=data; ob.matrix_world.identity(); ob.parent=None
  meshes.append(ob)
 # Replace the visibly segmented axial bodies in the three earlier primitive
 # sources with a continuous, smoothly interpolated anatomical loft.
 if species in ('compsognathus','carnotaurus','dilophosaurus'):
  factor={'compsognathus':1,'carnotaurus':1.75,'dilophosaurus':1.45}[species]
  sections=[(-3.25,.88,.005,.005),(-2.4,.70,.035,.04),(-1.5,.57,.07,.085),(-.8,.58,.16,.18),(-.4,.65,.24,.28),(0,.66,.26,.29),(.38,.72,.19,.22),(.64,.91,.105,.14),(.86,1.13,.085,.13),(1.04,1.26,.115,.13),(1.22,1.24,.095,.085),(1.42,1.21,.04,.045),(1.47,1.21,.005,.005)]
  verts=[];faces=[];sides=24
  # Catmull-Rom interpolation preserves shoulder/neck transitions without beads.
  samples=[]
  for i in range(len(sections)-1):
   a=Vector(sections[max(0,i-1)]);b=Vector(sections[i]);c=Vector(sections[i+1]);d=Vector(sections[min(len(sections)-1,i+2)])
   for j in range(5):
    t=j/5;samples.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
  samples.append(Vector(sections[-1]))
  for y,z,rx,rz in samples:
   for j in range(sides):
    angle=j*math.tau/sides;verts.append((math.cos(angle)*max(.003,rx)*factor,y*factor,(z+math.sin(angle)*max(.003,rz))*factor))
  for i in range(len(samples)-1):
   for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;faces.append((a,b,b+sides,a+sides))
  faces.extend([tuple(reversed(range(sides))),tuple(range((len(samples)-1)*sides,len(samples)*sides))])
  data=bpy.data.meshes.new('Axial_Anatomy');data.from_pydata(verts,[],faces);data.update()
  ob=bpy.data.objects.new('Body_Continuous',data);scene.collection.objects.link(ob)
  removed=[o for o in meshes if any(k in o.name.lower() for k in ('torso','pelvis','belly','neck_','tail_','cranium','snout'))]
  meshes=[o for o in meshes if o not in removed]+[ob]
  for o in removed:bpy.data.objects.remove(o,do_unlink=True)
  # Fuse the original overlapping limb primitives into the new axial surface.
  skin_parts=[o for o in meshes if any(k in o.name.lower() for k in ('body_continuous','thigh','shin','metatarsal','toe_','upperarm','forearm'))]
  body=ob
  # Replace narrow disconnected source limbs with closed curved anatomical tubes.
  discarded=[o for o in skin_parts if o!=body]
  for o in discarded:meshes.remove(o);bpy.data.objects.remove(o,do_unlink=True)
  skin_parts=[body]
  def limb(name,points,radii):
   vs=[];fs=[];sides=12
   for i,point in enumerate(points):
    center=Vector(point)*factor
    direction=(Vector(points[min(i+1,len(points)-1)])-Vector(points[max(0,i-1)])).normalized()
    u=direction.cross(Vector((0,1,0))).normalized();v=direction.cross(u)
    for j in range(sides):vs.append(center+(u*math.cos(j*math.tau/sides)+v*math.sin(j*math.tau/sides))*radii[i]*factor)
   for i in range(len(points)-1):
    for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
   fs.extend([tuple(reversed(range(sides))),tuple(range((len(points)-1)*sides,len(points)*sides))])
   data=bpy.data.meshes.new(name);data.from_pydata(vs,[],fs);data.update()
   part=bpy.data.objects.new(name,data);scene.collection.objects.link(part);meshes.append(part);skin_parts.append(part)
  for side in [-1,1]:
   x=side*.22
   limb('Hindlimb',[(x,-.35,.67),(x,-.40,.48),(x,-.43,.34),(x,-.29,.12),(x,-.15,.07)],[.14,.105,.07,.05,.065])
   limb('Forelimb',[(side*.18,.23,.7),(side*.22,.23,.54),(side*.22,.30,.43),(side*.22,.40,.37)],[.075,.05,.035,.032])
  for part in skin_parts:
   if part==body:continue
   others=[o for o in skin_parts if o!=part];vs=[];ps=[]
   for o in others:
    offset=len(vs);vs.extend([v.co.copy() for v in o.data.vertices]);ps.extend([tuple(i+offset for i in p.vertices) for p in o.data.polygons])
   tree=BVHTree.FromPolygons(vs,ps)
   v,hit=min(((v,tree.find_nearest(v.co)) for v in part.data.vertices),key=lambda x:x[1][3])
   if hit[3]>.002:
    shift=hit[0]-v.co-hit[1]*.006
    for vertex in part.data.vertices:vertex.co+=shift
  bpy.ops.object.select_all(action='DESELECT')
  for o in skin_parts:o.select_set(True)
  bpy.context.view_layer.objects.active=body;bpy.ops.object.join()
  remesh=body.modifiers.new('Anatomical_Surface','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.024*factor;remesh.use_smooth_shade=True
  bpy.ops.object.modifier_apply(modifier=remesh.name)
  smoothmod=body.modifiers.new('Muscle_Transitions','SMOOTH');smoothmod.factor=.7;smoothmod.iterations=3
  bpy.ops.object.modifier_apply(modifier=smoothmod.name)
  # Remove sub-voxel crumbs at the taper, retaining the connected animal.
  bm=bmesh.new();bm.from_mesh(body.data);seen=set();islands=[]
  for vertex in bm.verts:
   if vertex in seen:continue
   stack=[vertex];island=[];seen.add(vertex)
   while stack:
    v=stack.pop();island.append(v)
    for edge in v.link_edges:
     other=edge.other_vert(v)
     if other not in seen:seen.add(other);stack.append(other)
   islands.append(island)
  for island in islands:
   if len(island)<60:bmesh.ops.delete(bm,geom=island,context='VERTS')
  bm.to_mesh(body.data);bm.free()
  meshes=[o for o in meshes if o not in skin_parts]+[body]
  if species=='carnotaurus':
   for o in meshes:
    if 'lowerjaw' in o.name.lower():
     for vertex in o.data.vertices:vertex.co.z-=.025
 # Repair source winding and reconnect small keratin accessories at their roots.
 for o in meshes:
  bm=bmesh.new();bm.from_mesh(o.data)
  bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003)
  bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00003)
  bmesh.ops.triangulate(bm,faces=list(bm.faces))
  bm.to_mesh(o.data);bm.free()
 flesh=[o for o in meshes if any(k in o.name.lower() for k in ('body','torso','thigh','shin','jaw','mandible','upperarm','forearm','metatarsal','frill'))]
 verts=[];polys=[]
 for o in flesh:
  offset=len(verts);verts.extend([v.co.copy() for v in o.data.vertices]);polys.extend([tuple(i+offset for i in p.vertices) for p in o.data.polygons])
 tree=BVHTree.FromPolygons(verts,polys)
 for o in meshes:
  if o not in flesh:
   pairs=[(v,tree.find_nearest(v.co)) for v in o.data.vertices]
   v,hit=min(pairs,key=lambda x:x[1][3] if x[1][0] is not None else 1e9)
   if hit[0] is not None and hit[3]>.002:
    shift=hit[0]-v.co-hit[1]*.006
    for vertex in o.data.vertices:vertex.co+=shift
  bm=bmesh.new();bm.from_mesh(o.data);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(o.data);bm.free()
 points=[v.co for o in meshes for v in o.data.vertices]
 lo=Vector(tuple(min(p[i] for p in points) for i in range(3)))
 hi=Vector(tuple(max(p[i] for p in points) for i in range(3)))
 length=hi.y-lo.y; height=hi.z-lo.z; width=hi.x-lo.x
 quad=species in QUADS
 h=height*(.31 if species=='brachiosaurus' else .51 if quad else .55)
 hipY=-.38 if length>4 else -.28
 frontY=.75 if length>4 else .45
 headY=hi.y-length*.19
 tailStart=hipY-.32
 # Bone axes are local, with Blender +Y forward, +Z up.
 rigdata=bpy.data.armatures.new('JD_'+species)
 rig=bpy.data.objects.new('Rig',rigdata); scene.collection.objects.link(rig)
 bpy.context.view_layer.objects.active=rig; rig.select_set(True)
 bpy.ops.object.mode_set(mode='EDIT')
 bones={}
 def bone(name,a,b,parent=None):
  eb=rigdata.edit_bones.new(name); eb.head=a; eb.tail=b
  if parent: eb.parent=rigdata.edit_bones[parent]
  bones[name]=(Vector(a),Vector(b))
 bone('spine',(0,hipY,h),(0,.6,h*1.1))
 bone('neck',(0,.6,h*1.1),(0,headY,height*.82),'spine')
 bone('head',(0,headY,height*.82),(0,hi.y,height*.84),'neck')
 bone('jaw',(0,headY,height*.77),(0,hi.y,height*.74),'head')
 prev='spine'
 for i in range(4):
  ya=tailStart+(lo.y-tailStart)*i/4; yb=tailStart+(lo.y-tailStart)*(i+1)/4
  name='tail'+str(i); bone(name,(0,ya,h*.95),(0,yb,h*(.95-.08*i)),prev);prev=name
 for side in [-1,1]:
  for front in ([False,True] if quad else [False]):
   tag=('front' if front else 'hind')+('_L' if side>0 else '_R')
   x=side*width*(.30 if quad else .31); y=frontY if front else hipY
   bone(tag,(x,y,h),(x,y-.10,h*.48),'spine')
   bone(tag+'_shin',(x,y-.10,h*.48),(x,y+.12,.08),tag)
 bpy.ops.object.mode_set(mode='OBJECT')
 # Portable pigment: scale-sized tonal variation, dorsal bands, warm ventrum.
 skin=bpy.data.materials.new('M_'+species+'_Pigment')
 skin.use_nodes=True
 shader=next(n for n in skin.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 vc=skin.node_tree.nodes.new('ShaderNodeVertexColor');vc.layer_name='Pigment'
 skin.node_tree.links.new(vc.outputs['Color'],shader.inputs['Base Color'])
 shader.inputs['Roughness'].default_value=.78
 base,dorsal,belly=map(rgb,PALETTES[species])
 for ob in meshes:
  name=ob.name.lower()
  # Retain bone, eye, feather, teeth and horn materials; paint organic skin surfaces.
  is_skin=not any(s in name for s in ('claw','tooth','tongue','eye','pupil','talon'))
  if is_skin:
   ob.data.materials.clear();ob.data.materials.append(skin)
   attr=ob.data.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT')
   for v in ob.data.vertices:
    x,y,z=v.co
    dorsalWeight=smooth(h*.8,h*1.5,z)*.7
    stripes=smooth(.28,.8,math.sin(y*7.4+math.sin(z*4.1)*1.3+abs(x)*2))
    flank=smooth(h*.5,h,z)*(1-smooth(h*1.3,h*1.8,z))
    col=base.lerp(dorsal,min(.88,dorsalWeight+stripes*flank*.6))
    if any(k in name for k in ('plate','sail','crest','frill','fan')):
     col=rgb('ac694b').lerp(belly,smooth(h,height,z)*.55)
    ventral=(1-smooth(h*.52,h*.87,z))*(1-smooth(width*.18,width*.45,abs(x)))
    col=col.lerp(belly,ventral*.72)
    grain=1+.055*math.sin(x*93+y*67+z*89)*math.sin(z*103-y*57)
    attr.data[v.index].color=(*[max(0,min(1,c*grain)) for c in col],1)
  groups={n:ob.vertex_groups.new(name=n) for n in bones}
  for v in ob.data.vertices:
   x,y,z=v.co
   weights={}
   if 'mandible' in name or 'lowerjaw' in name or 'tongue' in name or 'tooth_l_' in name:
    weights={'jaw':1}
   elif any(s in name for s in ('eye','pupil','crest','cranial','browhorn','beak','nosehorn','epoccipital')):
    weights={'head':1}
   elif y<tailStart:
    f=max(0,min(3.999,(tailStart-y)/(tailStart-lo.y)*4))
    a=int(f); weights={'tail'+str(a):1-(f-a)}
    other='tail'+str(min(3,a+1));weights[other]=weights.get(other,0)+(f-a)
   else:
    # Limit leg weighting to the leg columns. Broad torso remains on spine.
    legY=frontY if quad and y>(hipY+frontY)*.5 else hipY
    side='_L' if x>0 else '_R'; tag=('front' if legY==frontY else 'hind')+side
    leg=smooth(width*.17,width*.29,abs(x))*(1-smooth(h*.62,h*.96,z))*(1-smooth(.24,.58,abs(y-legY)))
    shin=1-smooth(h*.35,h*.57,z)
    if leg>.001: weights[tag]=leg*(1-shin);weights[tag+'_shin']=leg*shin
    head=smooth(.65,headY,y)
    neck=(1-head)*smooth(.22,.85,y)
    weights['spine']=(1-leg)*(1-head-neck)
    weights['neck']=(1-leg)*neck;weights['head']=(1-leg)*head
   weights=dict(sorted(((n,w) for n,w in weights.items() if w>.0001),key=lambda pair:-pair[1])[:4])
   total=sum(weights.values())
   for n,w in weights.items(): groups[n].add([v.index],w/total,'REPLACE')
  mod=ob.modifiers.new('Deformation','ARMATURE');mod.object=rig
  ob.parent=rig
  for p in ob.data.polygons:p.use_smooth=True
 # Consolidate surfaces while retaining the shared bone groups and skin weights.
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes:o.select_set(True)
 bpy.context.view_layer.objects.active=meshes[0]
 bpy.ops.object.join()
 meshes=[bpy.context.object];meshes[0].name='Creature_Surface'
 # Source remesh UV layers were degenerate. A real unwrap is retained for edits;
 # exported pigment uses vertex colors and does not rely on overlapping UVs.
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT')
 bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.004)
 bpy.ops.object.mode_set(mode='OBJECT')
 # Exportable, in-place locomotion and behavior clips. Different mass classes use
 # distinct cadence/amplitude; attack is layered by the runtime mixer.
 fps=24;scene.render.fps=fps;scene.frame_start=1;scene.frame_end=25
 for clip in ['Idle','Walk','Run','Attack','Graze','Rest']:
  rig.animation_data_create();rig.animation_data.action=None
  for pb in rig.pose.bones: pb.rotation_mode='XYZ'
  for frame in range(1,26,2):
   phase=(frame-1)/24*math.tau
   for pb in rig.pose.bones:
    rx=ry=rz=0; n=pb.name
    gait=clip in ('Walk','Run'); amp=(.22 if quad else .36)*(1.4 if clip=='Run' else 1)
    if 'hind' in n or 'front' in n:
     offset=(0 if '_L' in n else math.pi)+(math.pi*.65 if 'front' in n else 0)
     if gait: rx=math.sin(phase+offset)*amp*(.65 if 'shin' in n else 1)
    if n.startswith('tail'):
     idx=int(n[-1]);rz=math.sin(phase-idx*.6)*(.025 if not gait else .065)
    if n=='neck':
     rx=math.sin(phase)*.018
     if clip=='Attack':rx=-math.sin(phase/2)**4*.24
     if clip=='Graze':rx=.25+math.sin(phase)*.04
     if clip=='Rest':rx=.30
    if n=='jaw' and clip in ('Attack','Graze'):rx=math.sin(phase/2)**2*(.32 if clip=='Attack' else .1)
    pb.rotation_euler=(rx,ry,rz);pb.keyframe_insert('rotation_euler',frame=frame,group=n)
   if frame==1:rig.animation_data.action.name=species+'_'+clip
  action=rig.animation_data.action
  # Naming clips without species allows a single runtime state controller.
  action.name=clip
  track=rig.animation_data.nla_tracks.new();track.name=clip
  strip=track.strips.new(clip,1,action);strip.action_slot=rig.animation_data.action_slot
  track.mute=True
 rig.animation_data.action=None
 for pb in rig.pose.bones:pb.rotation_euler=(0,0,0)
 bpy.context.view_layer.update()
 # Preserve original sources, write new versioned source/export paths.
 target=OUT/species;target.mkdir(parents=True,exist_ok=True)
 pub=PUB/species;pub.mkdir(parents=True,exist_ok=True)
 bpy.ops.object.select_all(action='DESELECT')
 for o in meshes+[rig]:o.select_set(True)
 bpy.context.view_layer.objects.active=rig
 bpy.data.libraries.write(str(target/(species+'.blend')),{scene},fake_user=True,compress=True)
 bpy.ops.export_scene.gltf(filepath=str(pub/(species+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_nla_strips=True)
 report={'id':species,'source':str(target.relative_to(BASE)/(species+'.blend')),'export':str(pub.relative_to(BASE)/(species+'.glb')),'triangles':sum(len(p.vertices)-2 for o in meshes for p in o.data.polygons),'bones':len(bones),'clips':['Idle','Walk','Run','Attack','Graze','Rest'],'meshes':len(meshes),'bytes':(pub/(species+'.glb')).stat().st_size}
 (target/'report.json').write_text(json.dumps(report,indent=2))
 print('JD_ASSET',json.dumps(report),flush=True)
 return report

if __name__=='__main__':
 ids=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else list(PALETTES)
 for species in ids:produce(species)
