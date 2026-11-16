"""Connected, genus-specific creatures. +X forward, +Z up; six in-place clips.
Writes only art-v3/models-v3, preserving every earlier source and export.
"""
import bpy, bmesh, math, json, sys
from pathlib import Path
from mathutils import Vector, Euler, Quaternion
from mathutils.bvhtree import BVHTree
BASE=Path(__file__).resolve().parents[2]
OUT=BASE/'assets/art-v3/creatures'; PUB=BASE/'public/assets/models-v3'
ENTRIES=json.loads((BASE/'assets/art-v3/anatomy.json').read_text())
SKILLS=Path(r'C:/Users/evan/.agents/skills')

def rgb(value):
 return tuple(((v/255)/12.92 if v/255<=.04045 else ((v/255+.055)/1.055)**2.4) for v in [(value>>16)&255,(value>>8)&255,value&255])
def material(name,color,vertex=False):
 m=bpy.data.materials.new(name)
 m.diffuse_color=(*rgb(color),1)
 p=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');p.inputs['Base Color'].default_value=(*rgb(color),1);p.inputs['Roughness'].default_value=.77
 if vertex:
  v=m.node_tree.nodes.new('ShaderNodeVertexColor');v.layer_name='Pigment';m.node_tree.links.new(v.outputs['Color'],p.inputs['Base Color'])
 return m
def mesh(name,verts,faces,mat):
 me=bpy.data.meshes.new(name);me.from_pydata(verts,[],faces);me.update()
 ob=bpy.data.objects.new(name,me);bpy.context.scene.collection.objects.link(ob);ob.data.materials.append(mat)
 return ob
def ellipsoid(name,p,s,mat,rot=(0,0,0),rings=10,sides=16):
 if bpy.context.scene.get('highHeadCount'):rings=min(rings,6);sides=min(sides,10)
 vs=[];fs=[];rotation=Euler(rot).to_matrix()
 # Distinct pole vertices avoid coincident rings and zero-area triangles.
 vs.append(Vector(p)+rotation@Vector((0,0,s[2])))
 for i in range(1,rings):
  v=math.pi*i/rings
  for j in range(sides):
   u=math.tau*j/sides;vs.append(Vector(p)+rotation@Vector((s[0]*math.sin(v)*math.cos(u),s[1]*math.sin(v)*math.sin(u),s[2]*math.cos(v))))
 vs.append(Vector(p)+rotation@Vector((0,0,-s[2])))
 for j in range(sides):fs.append((0,1+j,1+(j+1)%sides))
 for i in range(rings-2):
  for j in range(sides):a=1+i*sides+j;b=1+i*sides+(j+1)%sides;fs.append((a,a+sides,b+sides,b))
 end=len(vs)-1
 for j in range(sides):fs.append((end,end-sides+(j+1)%sides,end-sides+j))
 return mesh(name,vs,fs,mat)
def loft(name,sections,mat,sides=20,subdiv=4,box_from=1e10):
 # Sections are x,y,z,lateral radius,vertical radius.
 samples=[]
 for i in range(len(sections)-1):
  a,b,c,d=[Vector(sections[max(0,min(len(sections)-1,k))]) for k in [i-1,i,i+1,i+2]]
  for j in range(subdiv):
   t=j/subdiv;samples.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t))
 samples.append(Vector(sections[-1]));vs=[];fs=[]
 for x,y,z,ry,rz in samples:
  for j in range(sides):
   v=j*math.tau/sides;c=math.cos(v);s=math.sin(v);power=.66 if x>box_from else 1
   vs.append((x,y+math.copysign(abs(c)**power,c)*max(.006,ry),z+math.copysign(abs(s)**power,s)*max(.006,rz)))
 for i in range(len(samples)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.extend([tuple(reversed(range(sides))),tuple(range((len(samples)-1)*sides,len(samples)*sides))])
 return mesh(name,vs,fs,mat)
def tube(name,points,radii,mat,sides=12,subdiv=3):
 pts=[];rs=[]
 for i in range(len(points)-1):
  a,b,c,d=[Vector(points[max(0,min(len(points)-1,k))]) for k in [i-1,i,i+1,i+2]]
  for j in range(subdiv):
   t=j/subdiv;pts.append(.5*((2*b)+(-a+c)*t+(2*a-5*b+4*c-d)*t*t+(-a+3*b-3*c+d)*t*t*t));rs.append(max(.004,radii[i]+(radii[i+1]-radii[i])*t))
 pts.append(Vector(points[-1]));rs.append(max(.004,radii[-1]));vs=[];fs=[]
 for i,p in enumerate(pts):
  tangent=(pts[min(len(pts)-1,i+1)]-pts[max(0,i-1)]).normalized();axis=Vector((0,0,1)) if abs(tangent.z)<.95 else Vector((0,1,0));u=tangent.cross(axis).normalized();v=tangent.cross(u).normalized()
  for j in range(sides):angle=j*math.tau/sides;vs.append(p+(u*math.cos(angle)+v*math.sin(angle))*rs[i])
 for i in range(len(pts)-1):
  for j in range(sides):a=i*sides+j;b=i*sides+(j+1)%sides;fs.append((a,b,b+sides,a+sides))
 fs.extend([tuple(reversed(range(sides))),tuple(range((len(pts)-1)*sides,len(pts)*sides))])
 return mesh(name,vs,fs,mat)
def joined(objects,name):
 bpy.ops.object.select_all(action='DESELECT')
 for ob in objects:ob.select_set(True)
 bpy.context.view_layer.objects.active=objects[0];bpy.ops.object.join();ob=bpy.context.object;ob.name=name;return ob
def closest(p,a,b):
 d=b-a;t=max(0,min(1,(p-a).dot(d)/max(.000001,d.length_squared)));return (p-(a+d*t)).length

def produce(entry):
 s,a=entry['species'],entry['anatomy'];sid=s['id'];scene=bpy.data.scenes.new('Grimwild_'+sid);bpy.context.window.scene=scene
 scene['highHeadCount']=a.get('heads',1)>3
 scene.unit_settings.system='METRIC';scene.unit_settings.scale_length=1
 skin=material('Hide',a['color'],True);horn=material('Keratin',0xc4b293);dark=material('Mouth_and_nostrils',0x20191a);eye=material('Amber_iris',0xb58a39);pupil=material('Pupils',0x080b0b);tongue=material('Tongue',0x573335)
 flesh=[];extras=[];forced={};bones={};hip=a['hip'];width=a['width'];depth=a['depth'];hx,hz=a['head'];length,sw,sd=a['skull'];tail=a['tail']
 def part(ob,bone=None,organic=False):
  (flesh if organic else extras).append(ob)
  if bone:forced[ob.name]=bone
  return ob
 def bone(name,start,end,parent='spine'):bones[name]=(Vector(start),Vector(end),parent)
 bone('root',(0,0,0),(0,0,.2),None);bone('spine',(-.6,0,hip),(.55,0,hip+.06),'root')
 bone('neck',(.55,0,hip+.06),(hx-.2,0,hz),'spine');bone('head',(hx-.2,0,hz),(hx+length*.65,0,hz),'neck');bone('jaw',(hx-.14,0,hz-sd*.65),(hx+length*.8,0,hz-sd*.9),'head')
 sections=[(-tail,0,hip+.08,.008,.008),(-tail*.75,0,hip-.08,.045,.06),(-tail*.43,0,hip-.09,.13,.16),(-.90,0,hip-.02,width*.6,depth*.62),(-.48,0,hip,width*.93,depth*.96),(.12,0,hip+.03,width,depth),(.55,0,hip+.07,width*.77,depth*.85),(.74,0,hip+.12,.27 if not a.get('neck') else .34,.30),((.74+hx-.16)/2,0,(hip+hz)/2,.18 if a.get('neck') else .25,.22 if a.get('neck') else .29),(hx-.16,0,hz,sw*.8,sd*.86),(hx+.05,0,hz,sw,sd),(hx+length*.6,0,hz-sd*.12,sw*.74,sd*.62),(hx+length*.95,0,hz-sd*.12,sw*.63,sd*.56),(hx+length,0,hz-sd*.12,.012,.025)]
 if a['family']=='serpent':sections=[(x,math.sin(x*1.8)*.18 if x<-.7 else 0,z,ry,rz) for x,y,z,ry,rz in sections]
 part(loft('Continuous_axial_skin',sections,skin,box_from=hx-.04),organic=True)
 if a['family'] in ['tyrannosaur','carnosaur','abelisaur','dragon']:
  for side in [-1,1]:part(ellipsoid('Masseter',(hx-.01,side*sw*.64,hz-sd*.27),(.22,sw*.58,sd*.71),skin),organic=True)
 for i in range(5):
  start=-.65-(tail-.65)*i/5;end=-.65-(tail-.65)*(i+1)/5
  bone('tail'+str(i),(start,0,hip),(end,0,hip),'spine' if i==0 else 'tail'+str(i-1))
 # Mobile mandible with a hinge inside the skull, never translated away from it.
 jaw=loft('Mandible',[(hx-.14,0,hz-sd*.55,.11,.11),(hx+.08,0,hz-sd*.92,sw*.84,sd*.25),(hx+length*.7,0,hz-sd*.92,sw*.67,sd*.18),(hx+length*.95,0,hz-sd*.9,.035,.025)],skin)
 part(jaw,'jaw')
 part(ellipsoid('Oral_floor',(hx+length*.47,0,hz-sd*.69),(length*.39,sw*.65,.023),dark),'jaw')
 if sd>.19:part(ellipsoid('Tongue',(hx+length*.45,0,hz-sd*.65),(length*.29,sw*.4,.018),tongue),'jaw')
 for side in [-1,1]:
  eyepos=(hx+.08,side*(sw*.98+.008),hz+sd*.20)
  part(ellipsoid('Iris',eyepos,(.047,.028,.038),eye),'head')
  part(ellipsoid('Pupil',(eyepos[0]+.008,eyepos[1]+side*.021,eyepos[2]),(.015,.012,.029),pupil),'head')
  part(tube('Brow',[(hx-.04,side*sw*.82,hz+sd*.38),(hx+.12,side*sw*.94,hz+sd*.38),(hx+.23,side*sw*.83,hz+sd*.23)],[.055,.066,.035],skin),organic=True)
  part(ellipsoid('Nostril',(hx+length*.81,side*sw*.65,hz-sd*.01),(.047,.018,.026),dark),'head')
  part(tube('Lip_seam',[(hx+.05,side*sw*.84,hz-sd*.66),(hx+length*.52,side*sw*.72,hz-sd*.73),(hx+length*.86,side*sw*.61,hz-sd*.68)],[.015,.014,.008],dark),'head')
  if a['teeth']:
   count=11 if length>1 else 8
   for i in range(count):
    t=i/(count-1);x=hx+length*(.17+.68*t);y=side*sw*(.8-.14*t);z=hz-sd*.63
    tooth=(.055+(1-t)*.045)*(1+.17*math.sin(i*2.1))
    part(tube('Upper_tooth',[(x,y,z+.025),(x+.014,y,z-tooth*.55),(x+.022,y,z-tooth)],[.026,.018,.004],horn,sides=8,subdiv=1),'head')
    part(tube('Lower_tooth',[(x+.035,y,hz-sd*.74),(x+.045,y,hz-sd*.74+tooth*.7)],[.02,.004],horn,sides=8,subdiv=1),'jaw')
 if a.get('heads',1)>1:
  originals=list(extras)
  for branch_index in range(a['heads']-1):
   side=-1 if branch_index%2==0 else 1;spread=branch_index//2+1
   shift=Vector((0,side*spread*max(.82,sw*2.55),-.12+(spread-1)*.08))
   branch=[(.35,0,hip+.1,.28,.3),(.88,shift.y*.55,(hip+hz)/2,.24,.25),(hx-.16,shift.y,hz+shift.z,sw*.80,sd*.85),(hx+.05,shift.y,hz+shift.z,sw,sd),(hx+length*.6,shift.y,hz+shift.z-sd*.12,sw*.74,sd*.62),(hx+length*.95,shift.y,hz+shift.z-sd*.12,sw*.63,sd*.56),(hx+length,shift.y,hz+shift.z-sd*.12,.012,.025)]
   part(loft('Branched_neck_and_skull',branch,skin,box_from=hx),organic=True)
   for original in originals:
    copied=original.copy();copied.data=original.data.copy();scene.collection.objects.link(copied);copied.name='Secondary_'+original.name
    for vertex in copied.data.vertices:vertex.co+=shift
    extras.append(copied);forced[copied.name]=forced[original.name]
 # Anatomical limb chains. Skin is fused before weights are assigned.
 limbs=[]
 if not a.get('legless') and not a.get('flippers'):
  for side in [-1,1]:
   tag='.L' if side>0 else '.R';y=side*(width*.75)
   for front in ([False] if a['biped'] else [False,True]):
    key=('front' if front else 'hind')+tag;x=.57 if front else -.53
    z=hip*(1.15 if front and a['base']=='brachiosaurus' else .91 if front else 1)
    if a['family'] in ['crocodilian','synapsid']:
     knee=(x-.12,side*(width+.36),z*.57);ankle=(x+.1,side*(width+.48),.12)
    else:knee=(x+(.05 if front else .24),side*(width+.02),z*.55);ankle=(x+(.10 if front else -.12),side*(width+.06),.13)
    start=(x,y,z);foot=(ankle[0]+.22,ankle[1],.07)
    thick=(.15 if front else .24)*(1.15 if not a['biped'] else 1)
    part(tube(key,[start,knee,ankle,foot],[thick,.12 if front else .16,.065,.085],skin),organic=True)
    bone(key,start,knee);bone(key+'_shin',knee,ankle,key);bone(key+'_foot',ankle,(foot[0]+.35,foot[1],.07),key+'_shin');limbs.append((key,start,knee,ankle,foot,thick))
    for digit in ([] if a['family']=='equine' else [-1,0,1]):
     tip=(foot[0]+.23-abs(digit)*.05,foot[1]+digit*.10,.055)
     part(tube('Toe',[(foot[0]-.08,foot[1]+digit*.045,.095),tip],[.067,.025],skin),organic=True)
     part(tube('Claw',[tip,(tip[0]+.09,tip[1],.025)],[.028,.004],horn,sides=8),key+'_foot')
    if a.get('sickle') and not front:
     p=(foot[0]+.03,foot[1]-side*.11,.16);part(tube('Sickle_claw',[p,(p[0]+.12,p[1],.29),(p[0]+.21,p[1],.14)],[.048,.033,.004],horn),key+'_foot')
    if a['family']=='equine':part(ellipsoid('Hoof',(foot[0]+.01,foot[1],.09),(.17,.12,.09),horn),key+'_foot')
    if a.get('thumb') and front:part(tube('Thumb_spike',[(ankle[0]+.06,ankle[1]-side*.04,.18),(ankle[0]+.28,ankle[1]-side*.18,.35)],[.085,.004],horn),key+'_foot')
    if a['base']=='microraptor' and not front:
     for i in range(6):part(ellipsoid('Hindwing_feather',(ankle[0]-.15-i*.035,ankle[1]+side*(.05+i*.075),.24+i*.045),(.36,.09,.035),skin,rot=(0,.18,side*.35)),key+'_shin')
   if a['biped'] and a['arms']>0 and a['family']!='pterosaur':
    al=a['arms'];reach=min(1,max(.3,al/.6));key='arm'+tag;start=(.5,side*width*.55,hip+.12);elbow=(.5+al*.12,side*(width+.16*reach),hip+.12-al*.60);wrist=(.5+al*.4,side*(width+.23*reach),hip+.12-al)
    part(tube('Forelimb',[start,elbow,wrist],[min(.14,al*.19),min(.09,al*.15),min(.07,al*.12)],skin),organic=True)
    bone(key,start,elbow);bone(key+'_shin',elbow,wrist,key);limbs.append((key,start,elbow,wrist,wrist,min(.14,al*.19)))
    for digit in range(a['fingers']):
     dy=(digit-(a['fingers']-1)/2)*.105;tip=(wrist[0]+min(.17,al*.5),wrist[1]+dy,wrist[2]-.05)
     part(tube('Finger',[wrist,tip],[.045,.022],skin),key+'_shin')
     extension=.48 if a.get('scythes') else min(.13,al*.38)
     part(tube('Manual_claw',[tip,(tip[0]+extension*.65,tip[1],tip[2]-.07),(tip[0]+extension,tip[1],tip[2]-.19 if a.get('scythes') else tip[2]-.09)],[.035,.023,.004],horn),key+'_shin')
    if a.get('thumb'):part(tube('Thumb_spike',[wrist,(wrist[0]+.22,wrist[1]-side*.15,wrist[2]+.11)],[.08,.004],horn),key+'_shin')
 # Genus-defining cranial and dorsal structures, rooted into the skin surface.
 if a.get('frill'):
  part(ellipsoid('Ceratopsian_frill',(hx-.18,0,hz+.31),(.15,.64,.62),skin,rot=(0,-.18,0)),organic=True)
  for side in [-1,1]:
   for i in range(4):
    ang=.25+i*.40;y=side*math.sin(ang)*.57;z=hz+.31+math.cos(ang)*.56
    part(tube('Frill_rim',[(hx-.18,y,z),(hx-(.30 if a['base']=='styracosaurus' else .13),y*(1.4 if a['base']=='styracosaurus' else 1.09),z+(.30 if a['base']=='styracosaurus' else .08))],[.045,.004],horn),'head')
 if a['horns']:
  if a['family']=='ceratopsian' and a['horns']==3:
   for side in [-1,1]:part(tube('Brow_horn',[(hx+.11,side*.26,hz+.27),(hx+.37,side*.29,hz+.65),(hx+.80,side*.32,hz+.77)],[.12,.08,.004],horn),'head')
   part(tube('Nasal_horn',[(hx+.52,0,hz+.12),(hx+.66,0,hz+.46)],[.09,.004],horn),'head')
  elif a['family']=='abelisaur':
   for side in [-1,1]:part(tube('Bull_horn',[(hx+.07,side*.24,hz+.28),(hx+.12,side*.39,hz+.55)],[.095,.004],horn),'head')
  elif a['family']=='equine':part(tube('Unicorn_horn',[(hx+.08,0,hz+.26),(hx+.31,0,hz+1.05)],[.085,.004],horn),'head')
  elif a['horns']==1:part(tube('Nasal_horn',[(hx+length*.50,0,hz+sd*.40),(hx+length*.55,0,hz+sd*.40+.34)],[.095,.004],horn),'head')
  else:
   for side in [-1,1]:part(tube('Swept_horn',[(hx-.05,side*sw*.8,hz+sd*.6),(hx-.28,side*(sw+.16),hz+.61),(hx-.64,side*(sw+.24),hz+.90)],[.11,.07,.004],horn),'head')
 if a.get('boss'):part(ellipsoid('Nasal_boss',(hx+.23,0,hz+.24),(.24,.3,.19),skin),organic=True)
 if a.get('hood'):part(ellipsoid('Cobra_hood',(hx-.35,0,hz-.10),(.17,.65,.55),skin),organic=True)
 if a.get('nubs'):
  for side in [-1,1]:
   for i in range(3):part(tube('Cranial_spike',[(hx-.13,side*(.15+i*.05),hz+.06+i*.06),(hx-.42,side*(.24+i*.08),hz+.16+i*.12)],[.07,.004],horn),'head')
 if a.get('dome'):part(ellipsoid('Cranial_dome',(hx+.07,0,hz+.25),(.3,.28,.32),skin),organic=True)
 if a['crest']=='tube':part(tube('Parasaurolophus_crest',[(hx+.1,0,hz+.16),(hx-.07,0,hz+.50),(hx-.52,0,hz+.85),(hx-.96,0,hz+.75)],[.10,.13,.13,.04],skin),organic=True)
 if a['crest']=='twin':
  for side in [-1,1]:part(ellipsoid('Twin_crest',(hx+length*.23,side*.12,hz+.25),(length*.34,.035,.28),skin),organic=True)
 if a['crest'] in ['casque','pterosaur','plume']:
  part(ellipsoid('Cranial_crest',(hx-.03,0,hz+.29),(.31,.05,.34),skin,rot=(0,-.3,0)),organic=True)
 if a.get('beak') or a.get('bill'):
  part(ellipsoid('Beak',(hx+length*.87,0,hz-sd*.19),(length*.19,sw*(1.10 if a.get('bill') else .68),sd*.39),horn),'head')
 if a.get('tusks'):
  for side in [-1,1]:part(tube('Caniniform_tusk',[(hx+length*.33,side*sw*.80,hz-sd*.35),(hx+length*.37,side*sw*.88,hz-sd*.9)],[.04,.004],horn),'head')
 if a.get('sail'):
  sec=[]
  for i in range(13):
   x=-.88+i*.12;height=.08+math.sin(i/12*math.pi)**.7*(1.05 if a['family']=='synapsid' else 1.25);bottom=hip+depth*.55;sec.append((x,0,bottom+height*.5,.035,height*.55))
  part(loft('Dorsal_sail',sec,skin,sides=12),organic=True)
 if a.get('plates'):
  for i in range(10):
   x=-.97+i*.20;z=hip+depth*.78-.14*abs(x);height=.25+.58*math.sin((i+1)/11*math.pi)
   side=(-1 if i%2 else 1)*.10
   part(loft('Stegosaur_plate',[(x-.17,side,z,.035,.09),(x,side,z+height*.40,.045,height*.62),(x+.15,side,z,.025,.09)],skin,sides=10,subdiv=3),'spine' if x>-.8 else 'tail0')
  for side in [-1,1]:
   for i in range(2):
    x=-tail+.36+i*.36;part(tube('Thagomizer',[(x,side*.07,hip-.04),(x-.23,side*.54,hip+.26)],[.085,.004],horn),'tail4')
 if a.get('armor') or a.get('scutes'):
  for i in range(8):
   x=-.92+i*.22
   for side in [-1,0,1]:
    y=side*width*.66;z=hip+depth*(.88 if side==0 else .63)
    part(ellipsoid('Dermal_armor',(x,y,z),(.18,.17,.10),skin),'spine')
  if a.get('armor'):
   for side in [-1,1]:
    for i in range(5):
     x=-.70+i*.33;part(tube('Flank_spike',[(x,side*width*.90,hip+.08),(x-.10,side*(width+.30),hip+.26)],[.11,.004],horn),'spine')
 if a.get('club'):part(ellipsoid('Tail_club',(-tail+.12,0,hip+.08),(.42,.35,.24),skin),'tail4')
 if a.get('ridge') or a.get('spines'):
  for i in range(10):
   x=-.6+i*.19;z=hip+depth*.70+(max(0,x-.5)*.65 if a.get('spines') else 0)
   for side in ([-1,1] if a.get('spines') else [0]):part(tube('Neural_spine',[(x,side*.07,z),(x-.08,side*.18,z+(.60 if a.get('spines') else .20))],[.045,.004],horn),'spine')
 if a.get('fur'):
  for side in [-1,1]:part(tube('Ear',[(hx-.02,side*.18,hz+.20),(hx-.12,side*.22,hz+.60)],[.12,.013],skin),organic=True)
 if a.get('feathered'):
  for i in range(12):
   x=-1.35+i*.13;part(ellipsoid('Dorsal_feather',(x,0,hip+depth*.84),(.16,.12,.15),skin),'spine' if x>-.8 else 'tail0')
 if a.get('bristles'):
  for i in range(12):
   x=-1.2-i*.055;part(tube('Tail_bristle',[(x,0,hip+.10),(x-.10,0,hip+.42+i*.012)],[.015,.004],horn),'tail1')
 if a.get('shell'):
  part(ellipsoid('Broad_carapace',(-.15,0,hip+.08),(1.08,.88,.40),skin),organic=True)
  for i in range(5):part(ellipsoid('Carapace_scute',(-.74+i*.29,0,hip+.43),(.24,.32,.08),skin),'spine')
 if a.get('cranialArmor'):
  armor=material('Cranial_armor',0x7e8a82)
  part(loft('Faceted_cranial_shield',[(hx-.30,0,hz+.02,sw*.92,sd*.89),(hx-.02,0,hz+.02,sw*1.06,sd*1.03),(hx+length*.34,0,hz,sw*.96,sd*.85),(hx+length*.71,0,hz-.02,sw*.60,sd*.56)],armor,sides=12,subdiv=1),'head')
  for side in [-1,1]:
   part(tube('Bone_jaw_blade',[(hx+length*.15,side*sw*.75,hz-sd*.65),(hx+length*.61,side*sw*.66,hz-sd*.72)],[.075,.032],horn),'jaw')
 if a.get('dorsalFin'):
  z=hip+depth*.70;outline=[(.48,z),(.20,z+.86),(-.18,z+.65),(-.63,z)]
  vs=[(x,side*.035,v) for side in [-1,1] for x,v in outline];n=len(outline);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  part(mesh('Dorsal_fin',vs,fs,skin),'spine')
 if a.get('tailFluke'):
  x=-tail*.82;z=hip-.07;outline=[(x+.14,z),(x-.26,z+.78),(x-.66,z+.91),(x-.38,z),(x-.65,z-.68),(x-.20,z-.62)]
  vs=[(u,side*.009,v) for side in [-1,1] for u,v in outline];n=len(outline);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
  part(mesh('Caudal_fluke',vs,fs,skin),'tail4')
 if a.get('gills'):
  for side in [-1,1]:
   for i in range(5):part(ellipsoid('Gill_slit',(.45-i*.10,side*width*.94,hip+.04),(.017,.022,.18),dark),'spine')
 if a.get('newMarine'):
  for side in [-1,1]:
   tag='.L' if side>0 else '.R';span=a.get('flipperSpan',1.5);root=(.32,side*width*.6,hip-.06);tip=(-.5,side*span,hip-.12);key='wing'+tag;bone(key,root,tip)
   if a['family'] in ['shark','armored-fish']:
    outline=[(.55,side*width*.50),(-.40,side*width*.60),(-.72,side*span)]
    vs=[(x,y,hip-.08+z) for z in [-.035,.035] for x,y in outline];fs=[(2,1,0),(3,4,5),(0,1,4,3),(1,2,5,4),(2,0,3,5)]
    part(mesh('Swept_pectoral_fin',vs,fs,skin),key)
   else:part(ellipsoid('Pectoral_paddle',(-.06,side*(width*.6+span)*.5,hip-.08),(.66,(span-width*.6)*.5+.14,.085),skin,rot=(0,0,side*.28)),key)
   if a.get('hindFlippers'):
    root2=(-.70,side*width*.6,hip-.06);tip2=(-1.15,side*span*.8,hip-.14);key2='rearwing'+tag;bone(key2,root2,tip2)
    part(ellipsoid('Rear_paddle',(-.9,side*(width*.6+span*.8)*.5,hip-.10),(.46,(span*.8-width*.6)*.5+.12,.07),skin,rot=(0,0,side*.30)),key2)
 elif a.get('wings') or a.get('flippers'):
  for side in [-1,1]:
   tag='.L' if side>0 else '.R';root=(.35,side*width*.65,hip+.16);tip=(-.30,side*(3.0 if a.get('wings') else 1.65),hip+.45 if a.get('wings') else .38);key='wing'+tag
   bone(key,root,tip)
   part(tube('Wing_spar',[root,(.6,side*1.45,hip+.7),tip],[.13,.085,.025],skin),key)
   outline=[root,(.6,side*1.45,hip+.7),tip,(-1.05,side*1.95,hip+.20),(-.65,side*.3,hip)]
   vs=[(x,y,z+offset) for offset in [-.014,.014] for x,y,z in outline];n=len(outline);fs=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
   part(mesh('Wing_membrane' if a.get('wings')=='membrane' else 'Feather_vane',vs,fs,skin),key)
   if a.get('wings')=='feather':
    for i in range(10):
     y=side*(.7+i*.23);part(ellipsoid('Flight_feather',(-.48,y,hip+.28+i*.02),(.63,.11,.035),skin,rot=(0,.08,side*.23)),key)
   if a.get('flippers'):
    root2=(-.70,side*width*.7,hip);tip2=(-1.1,side*1.5,.35);key2='rearwing'+tag;bone(key2,root2,tip2)
    part(tube('Rear_flipper',[root2,tip2],[.22,.06],skin),key2)
 # Fuse anatomical skin and limbs; accessories retain their own rigid influences.
 body=joined(flesh,'Connected_skin');remesh=body.modifiers.new('Fused_anatomy','REMESH');remesh.mode='VOXEL';remesh.voxel_size=.028;remesh.use_smooth_shade=True
 bpy.ops.object.modifier_apply(modifier=remesh.name)
 sm=body.modifiers.new('Organic_transitions','SMOOTH');sm.factor=.58;sm.iterations=3;bpy.ops.object.modifier_apply(modifier=sm.name)
 tri=sum(len(p.vertices)-2 for p in body.data.polygons)
 if tri>16000:
  dec=body.modifiers.new('Web_budget','DECIMATE');dec.ratio=16000/tri;bpy.ops.object.modifier_apply(modifier=dec.name)
 # Voxel tapers can leave microscopic crumbs. The skin must be one connected
 # surface; intentional horns/teeth/eyes remain separately weighted accessories.
 bm=bmesh.new();bm.from_mesh(body.data);seen=set();islands=[]
 for vertex in bm.verts:
  if vertex in seen:continue
  stack=[vertex];island=[];seen.add(vertex)
  while stack:
   current=stack.pop();island.append(current)
   for edge in current.link_edges:
    other=edge.other_vert(current)
    if other not in seen:seen.add(other);stack.append(other)
  islands.append(island)
 if islands:
  biggest=max(islands,key=len)
  for island in islands:
   if island is not biggest:
    if len(island)>120:raise RuntimeError('Disconnected organic anatomy: '+sid)
    bmesh.ops.delete(bm,geom=island,context='VERTS')
 bm.to_mesh(body.data);bm.free()
 def tree_for(objects):
  vs=[];fs=[]
  for other in objects:
   offset=len(vs);vs.extend([v.co.copy() for v in other.data.vertices]);fs.extend([tuple(i+offset for i in p.vertices) for p in other.data.polygons])
  return BVHTree.FromPolygons(vs,fs)
 skin_tree=tree_for([body]);attachment_shifts=[]
 for ob in extras:
  if ob.name.startswith(('Iris','Pupil','Tongue','Oral_floor','Lip_seam','Nostril')):continue
  is_skin=ob.data.materials[0]==skin
  structural=[o for o in extras if o!=ob and o.name.startswith(('Wing_spar','Feather_vane','Wing_membrane','Hindwing_feather')) and forced.get(o.name)==forced.get(ob.name)]
  targets=([body]+structural) if is_skin else [body]+[o for o in extras if o.data.materials[0]==skin]
  tree=skin_tree if is_skin and not structural else tree_for(targets)
  pairs=[(v,tree.find_nearest(v.co)) for v in ob.data.vertices];vertex,hit=min(pairs,key=lambda pair:pair[1][3])
  # Intersecting rooted accessories are intentional; move only separated roots.
  if hit[3]>.008:
   shift=hit[0]-vertex.co-hit[1]*.015
   if shift.length>.35:raise RuntimeError('Accessory too far from anatomy: '+sid+' '+ob.name)
   for v in ob.data.vertices:v.co+=shift
   attachment_shifts.append({'part':ob.name,'distance':round(shift.length,4)})
 allparts=[body]+extras
 # Ground contact is defined by the rest feet, not a clipped camera or armature.
 floor=min(v.co.z for ob in allparts for v in ob.data.vertices)
 for ob in allparts:
  for v in ob.data.vertices:v.co.z-=floor
 bones={name:(start-Vector((0,0,floor)),end-Vector((0,0,floor)),parent) for name,(start,end,parent) in bones.items()}
 rigdata=bpy.data.armatures.new('Anatomical_skeleton');rig=bpy.data.objects.new('Rig',rigdata);scene.collection.objects.link(rig);bpy.context.view_layer.objects.active=rig
 bpy.ops.object.select_all(action='DESELECT');rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
 for name,(start,end,parent) in bones.items():
  eb=rigdata.edit_bones.new(name);eb.head=start;eb.tail=end
  if parent:eb.parent=rigdata.edit_bones[parent]
  eb.use_deform=name!='root';eb.align_roll(Vector((0,1,0)))
 bpy.ops.object.mode_set(mode='OBJECT')
 # Skin weighting is continuous at the shoulder/hip and along the flexible neck.
 for ob in allparts:
  bm=bmesh.new();bm.from_mesh(ob.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00001);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00001);bmesh.ops.triangulate(bm,faces=list(bm.faces));bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(ob.data);bm.free()
  groups={name:ob.vertex_groups.new(name=name) for name in bones if name!='root'}
  forcedBone=forced.get(ob.name)
  for v in ob.data.vertices:
   p=v.co;weights={}
   if forcedBone:weights={forcedBone:1}
   elif ob!=body:weights={'spine':1}
   else:
    x,y,z=p;neckT=max(0,min(1,(x-.64)/max(.1,hx-.64)));headT=max(0,min(1,(x-(hx-.32))/.30))
    if x<-.8:
     f=max(0,min(4.99,(-x-.65)/max(.01,tail-.65)*5));index=int(f);blend=f-index;weights={'tail4':1} if index==4 else {'tail'+str(index):1-blend,'tail'+str(index+1):blend}
    elif x>.64:weights={'spine':(1-neckT)*(1-headT),'neck':neckT*(1-headT),'head':headT}
    else:weights={'spine':1}
    best=None
    for key,start,knee,ankle,foot,thick in limbs:
     start=Vector(start)-Vector((0,0,floor));knee=Vector(knee)-Vector((0,0,floor));ankle=Vector(ankle)-Vector((0,0,floor))
     if y*start.y<0:continue
     foot_tip=Vector((foot[0]+.24,foot[1],foot[2]-floor))
     d=min(closest(p,start,knee),closest(p,knee,ankle),closest(p,ankle,foot_tip) if key+'_foot' in groups else 1e6);lateral=max(0,min(1,(abs(y)-width*.30)/(width*.55)))
     below=max(0,min(1,(hip+.12-floor-z)/max(.1,hip*.4)))
     influence=max(0,1-d/(thick*2.5+.08))*lateral*below
     if best is None or influence>best[0]:best=(influence,key,start,knee,ankle)
    if best and best[0]>.001:
     influence,key,start,knee,ankle=best;low=max(0,min(1,(knee.z+.09-z)/.20));footWeight=max(0,min(1,(ankle.z+.08-z)/.15)) if key+'_foot' in groups else 0
     weights={n:w*(1-influence) for n,w in weights.items()};weights[key]=influence*(1-low);weights[key+'_shin']=influence*low*(1-footWeight)
     if footWeight:weights[key+'_foot']=influence*low*footWeight
   weights=sorted([(n,w) for n,w in weights.items() if w>.001],key=lambda item:-item[1])[:4];total=sum(w for n,w in weights) or 1
   for name,w in weights:groups[name].add([v.index],w/total,'REPLACE')
  # Natural coloration is baked, so the exact same material works in WebGL offline.
  attr=ob.data.color_attributes.new(name='Pigment',type='FLOAT_COLOR',domain='POINT');base=Vector(rgb(a['color']));belly=Vector(rgb(0xb5a888));dorsal=Vector(rgb(0x303b36))
  for v in ob.data.vertices:
   x,y,z=v.co;top=max(0,min(1,(z-(hip-floor-depth*.35))/(depth*1.7)));band=(math.sin(x*5.9+math.sin(z*4)*.65)>.30)*.18
   grain=(math.sin(x*87+y*71+z*59)*math.sin(x*41-z*67))*.025
   col=base.lerp(dorsal,min(.75,top*.55+band+grain));ventral=max(0,min(1,(hip-floor-z)/(depth*.9)))*(1-min(1,abs(y)/max(.1,width)))
   col=col.lerp(belly,ventral*.57);attr.data[v.index].color=(*col,1)
  for p in ob.data.polygons:p.use_smooth=True
  modifier=ob.modifiers.new('Skin','ARMATURE');modifier.object=rig;ob.parent=rig
 sys.path.insert(0,str(SKILLS/'blender-asset-qa/scripts'));import qa_check
 if sid in ['tyrannosaurus','velociraptor','carnotaurus','sarcosuchus','mosasaurus']:
  preqa=qa_check.run(objects=[o.name for o in allparts],profile='game',eps=.00025,tol=.015,max_tris=80000,uv=False)
  (BASE/('artifacts/grimwild/'+sid+'-parts-qa.json')).write_text(json.dumps(preqa,indent=2))
 surface=joined(allparts,'Creature_surface')
 bm=bmesh.new();bm.from_mesh(surface.data);bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=.00003);bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=.00003);bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces));bm.to_mesh(surface.data);bm.free()
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.uv.smart_project(angle_limit=1.15,island_margin=.006);bpy.ops.object.mode_set(mode='OBJECT')
 scene.render.fps=24;scene.frame_start=1;scene.frame_end=25
 for clip in ['Idle','Walk','Run','Attack','Graze','Rest']:
  rig.animation_data_create();rig.animation_data.action=None
  for frame in range(1,26,2):
   phase=(frame-1)/24*math.tau;gait=clip in ['Walk','Run'];amp=.32 if clip=='Run' else .22
   for pb in rig.pose.bones:
    n=pb.name;pb.rotation_mode='QUATERNION';rx=ry=rz=0;pb.location=(0,0,0)
    if n.startswith(('hind','front','arm')):
     offset=(0 if '.L' in n else math.pi)+(math.pi if n.startswith('front') else 0)
     if gait:ry=math.sin(phase+offset)*amp*(.65 if '_shin' in n else -.25 if '_foot' in n else 1)
    if n.startswith('tail'):rz=math.sin(phase-int(n[-1])*.5)*(.035 if gait else .018)
    if n=='neck':
     ry=math.sin(phase)*.015
     if clip=='Attack':ry=math.sin(phase/2)**4*.12
     if clip=='Graze':ry=.19+math.sin(phase)*.025
     if clip=='Rest':ry=.12
    if n=='head':ry=math.sin(phase)*.025;rz=math.sin(phase)*.045 if clip=='Idle' else 0
    if n=='jaw':ry=.035+math.sin(phase/2)**2*(.43 if clip=='Attack' else .06 if clip=='Graze' else .008)
    if n.startswith(('wing','rearwing')):rx=((.18 if a.get('wings') else 0)+math.sin(phase)*(.28 if gait else .08))*(1 if '.L' in n else -1)
    inverse=pb.bone.matrix_local.to_3x3().inverted()
    pb.rotation_quaternion=Quaternion(inverse@Vector((1,0,0)),rx)@Quaternion(inverse@Vector((0,1,0)),ry)@Quaternion(inverse@Vector((0,0,1)),rz)
    pb.keyframe_insert('rotation_quaternion',frame=frame,group=n)
   if frame==1:rig.animation_data.action.name=sid+'_'+clip
  action=rig.animation_data.action;action.use_fake_user=True
  track=rig.animation_data.nla_tracks.new();track.name=clip;strip=track.strips.new(clip,1,action);strip.action_slot=rig.animation_data.action_slot;track.mute=True
 rig.animation_data.action=None
 for pb in rig.pose.bones:pb.rotation_quaternion=(1,0,0,0)
 bpy.context.view_layer.update();scene.frame_set(1)
 target=OUT/sid;target.mkdir(parents=True,exist_ok=True);PUB.mkdir(parents=True,exist_ok=True)
 scene['anatomyFamily']=a['family'];rig['forwardAxis']='X';rig['sourceVersion']=3
 bpy.data.libraries.write(str(target/(sid+'.blend')),{scene},fake_user=True,compress=True)
 bpy.ops.object.select_all(action='DESELECT');surface.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
 bpy.ops.export_scene.gltf(filepath=str(PUB/(sid+'.glb')),export_format='GLB',use_selection=True,use_active_scene=True,export_extras=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_nla_strips=True)
 # The installed QA gate is run on each exported asset's rest geometry.
 sys.path.insert(0,str(SKILLS/'blender-asset-qa/scripts'));import qa_check
 rig.data.pose_position='REST';bpy.context.view_layer.update()
 qa=qa_check.run(objects=[surface.name],profile='game',eps=.00025,tol=.015,max_tris=80000)
 rig.data.pose_position='POSE'
 report={'id':sid,'family':a['family'],'triangles':sum(len(p.vertices)-2 for p in surface.data.polygons),'bones':len(bones),'dimensions':list(surface.dimensions),'clips':['Idle','Walk','Run','Attack','Graze','Rest'],'qa':qa,'attachmentShifts':attachment_shifts,'bytes':(PUB/(sid+'.glb')).stat().st_size}
 (target/'report.json').write_text(json.dumps(report,indent=2));print('JD_ANATOMY',json.dumps({k:v for k,v in report.items() if k!='qa'}),'QA',qa.get('pass'),flush=True)
 # Free only this freshly generated scene; the user's live scene is untouched.
 return report

if __name__=='__main__':
 args=sys.argv[sys.argv.index('--')+1:] if '--' in sys.argv else []
 chosen=[e for e in ENTRIES if not args or e['species']['id'] in args]
 reports=[];failures=[]
 for entry in chosen:
  try:
   report=produce(entry);reports.append(report)
   if not report['qa']['pass']:failures.append({'id':entry['species']['id'],'errors':report['qa']['errors']})
  except Exception as error:
   import traceback;traceback.print_exc();failures.append({'id':entry['species']['id'],'error':str(error)})
 (BASE/'artifacts/grimwild/blender-summary.json').write_text(json.dumps({'reports':[{'id':r['id'],'triangles':r['triangles'],'qaPass':r['qa']['pass']} for r in reports],'failures':failures},indent=2))
 if failures:raise RuntimeError(str(len(failures))+' assets require repair')
