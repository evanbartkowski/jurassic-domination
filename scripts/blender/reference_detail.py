"""Authored secondary anatomy and rooted tertiary surfaces for the full roster.

All positions use the generator's +X forward / +Z up skeleton frame. These
features are created before the existing skin-weight, atlas and LOD stages.
"""
import math
from mathutils import Vector
from mathutils.bvhtree import BVHTree

PREDATORS={'tyrannosaur','carnosaur','abelisaur','spinosaur','dragon','pliosaur','mosasaur','crocodilian','shark'}

def sculpt_planes(body,a):
    hx,hz=a['head'];length,sw,sd=a['skull'];hip=a['hip'];depth=a['depth']
    predator=a['family'] in PREDATORS
    for vertex in body.data.vertices:
        x,y,z=vertex.co;side=1 if y>=0 else -1
        if x>hx-.18 and abs(y)>sw*.4:
            # Inset orbit, temporal hollow and a firm maxillary shelf replace
            # the uninterrupted round potato profile of the old cranium.
            orbit=math.exp(-((x-hx-.08)/.13)**2-((z-hz-sd*.20)/.09)**2)
            temple=math.exp(-((x-hx+.08)/.13)**2-((z-hz)/max(.06,sd*.6))**2)
            cheek=math.exp(-((x-hx-length*.28)/max(.12,length*.4))**2-((z-hz+sd*.22)/max(.04,sd*.18))**2)
            naris=math.exp(-((x-hx-length*.81)/max(.05,length*.075))**2-((z-hz)/max(.035,sd*.19))**2)
            vertex.co.y+=side*(-sw*.15*orbit-sw*.09*temple-sw*.10*naris+sw*(.09 if predator else .04)*cheek)
            roof=math.exp(-((x-hx-.06)/.19)**2)*max(0,min(1,(z-hz)/max(.01,sd)))
            vertex.co.z+=roof*(.035 if predator else .012)
        if -.7<x<.45 and abs(y)>a['width']*.65:
            # Ribcage/waist separation and shoulder tendon, intentionally subtle.
            waist=math.exp(-((x+.68)/.18)**2)
            vertex.co.y*=1-.035*waist
            tendon=math.exp(-((x-.28)/.13)**2-((z-hip-depth*.23)/max(.1,depth*.7))**2)
            vertex.co.y+=side*tendon*.018
    body.data.update()

def add_fine_anatomy(a,body,part,ellipsoid,tube,material,feather_surface,mesh):
    hx,hz=a['head'];length,sw,sd=a['skull'];hip=a['hip'];width=a['width'];depth=a['depth']
    predator=a['family'] in PREDATORS
    tint=material('Hide_detail_ochre',0x88795a)
    soft=material('Hide_detail_fold',0x5e6650)
    dark=material('Facial_recess',0x272b22)
    ivory=material('Corneal_highlight',0xe9e1b8)
    tree=BVHTree.FromPolygons([v.co.copy() for v in body.data.vertices],[tuple(p.vertices) for p in body.data.polygons])
    counts={'orbitalRims':0,'facialScales':0,'skinFolds':0,'bodyScutes':0,'individualFeathers':0,'predatorScars':0}
    def anchor(x,z,side):
        hit=tree.ray_cast(Vector((x,side*(width+sw+2),z)),Vector((0,-side,0)))
        if hit[0] is None:hit=tree.find_nearest(Vector((x,side*sw,z)))
        return hit[0]+hit[1]*.001
    def plate(name,p,r,mat):
        normal=tree.find_nearest(p)[1];u=normal.cross(Vector((0,0,1)) if abs(normal.z)<.9 else Vector((1,0,0))).normalized();v=normal.cross(u).normalized()
        vertices=[]
        for radius,height in [(r,-.006),(r*.72,.003)]:
            for j in range(8):
                angle=j*math.tau/8;vertices.append(p+normal*height+u*math.cos(angle)*radius+v*math.sin(angle)*radius*.72)
        vertices.append(p+normal*.0045)
        faces=[tuple(reversed(range(8)))]+[(j,(j+1)%8,(j+1)%8+8,j+8) for j in range(8)]+[(8+j,8+(j+1)%8,16) for j in range(8)]
        return mesh(name,vertices,faces,mat)
    for side in [-1,1]:
        # Real eyelid contours, with a low upper lid on large predators.
        eye=Vector((hx+.08,side*(sw*.98+.008),hz+sd*.20))
        fitted_eye=a['family'] in ['sauropod','plesiosaur']
        if fitted_eye:
            hit=tree.find_nearest(eye);eye=hit[0]+hit[1]*.012
        ex=.075 if a['id']=='troodon' else min(.066,max(.046,sd*.17));ez=ex*.77
        for upper in [True,False]:
            points=[]
            for i in range(9):
                angle=(i/8*math.pi)+(0 if upper else math.pi)
                x=eye.x+math.cos(angle)*ex*1.15;z=eye.z+math.sin(angle)*ez*(.66 if predator and upper else 1.08)
                if fitted_eye:p=Vector((x,eye.y+side*.004,z))
                else:
                    p=anchor(x,z,side);p.y=side*max(abs(p.y),abs(eye.y)+.012)
                points.append(p)
            part(tube('Orbital_upper_lid' if upper else 'Orbital_lower_lid',points,[.011 if predator else .008]*len(points),tint,sides=8,subdiv=1),'head')
            counts['orbitalRims']+=1
        part(ellipsoid('Corneal_glint',(eye.x+.008,eye.y+side*.029,eye.z+.011),(.008,.004,.009),ivory,rings=5,sides=8),'head')
        # Antorbital pits, supraorbital scales and small irregular cheek scales.
        for row in range(3):
            for i in range(7):
                t=(i+.4*(row%2))/7
                x=hx+length*(.16+t*.68);z=hz+sd*(.42-row*.30)+math.sin(i*2.3+row)*.017
                p=anchor(x,z,side);r=(.009+sd*.018)*(1+.25*math.sin(i*4.1+row))
                mat=tint if (i+row)%4==0 else soft
                ob=plate('Facial_scale',p,r,mat) if a['family'] in ['plesiosaur','dragon','sauropod'] else ellipsoid('Facial_scale',p,(r,.004,r*.72),mat,rings=4,sides=7)
                part(ob,'head')
                counts['facialScales']+=1
        for i in range(4):
            x=hx+length*(.26+i*.14);p=anchor(x,hz+sd*.40,side)
            part(ellipsoid('Supraorbital_scute',p,(.038,.016,.028),tint,rings=5,sides=8),'head')
        if predator:
            p=anchor(hx+.07,hz+sd*.37,side)
            part(ellipsoid('Angular_brow_shelf',p,(.145,.047,.036),soft,rot=(0,-.14,side*.08),rings=4,sides=8),'head')
        # A short ear opening behind the orbit, rooted rather than floating.
        p=anchor(hx-.07,hz+sd*.08,side)
        part(ellipsoid('Auditory_opening',p,(.018,.009,.029),dark,rings=6,sides=10),'head')
        p=anchor(hx+length*.81,hz-sd*.01,side)
        part(ellipsoid('Nasal_fossa',p,(.037,.007,.020),dark,rings=6,sides=12),'head')
        # Three convergent neck folds and a shoulder fold, not concentric hoops.
        for k in range(3):
            neck_start=Vector((.60,0,hip+.15));neck_end=Vector((hx-.20,0,hz-.02))
            direction=(neck_end-neck_start).normalized();cross=Vector((-direction.z,0,direction.x))
            center=neck_start.lerp(neck_end,.62+k*.15)
            points=[anchor(center.x+cross.x*(j-2)*.038,center.z+cross.z*(j-2)*.038,side)+Vector((0,side*.004,0)) for j in range(5)]
            part(tube('Gular_skin_fold',points,[.004,.007,.009,.007,.004],soft,sides=7,subdiv=1),'neck')
            counts['skinFolds']+=1
        points=[anchor(.34-j*.06,hip+depth*(.48-j*.18),side)+Vector((0,side*.004,0)) for j in range(6)]
        part(tube('Scapular_skin_fold',points,[.005,.009,.012,.012,.008,.004],soft,sides=7,subdiv=1),'spine')
        counts['skinFolds']+=1
        if not a.get('feathered') and a['family'] not in ['wolf','equine']:
            for row in range(2):
                for i in range(11):
                    x=-.87+i*.105+math.sin(i*2.8+row)*.021;z=hip+depth*(.28+row*.32)+math.sin(i*2.1)*.038;p=anchor(x,z,side)
                    radius=.018+(.013 if a.get('armor') else .003)*((i+row)%3)
                    part(ellipsoid('Flank_scute',p,(radius,.006,radius*.75),tint if i%4==0 else soft,rings=4,sides=7),'spine')
                    counts['bodyScutes']+=1
        if predator and a['family'] not in ['shark']:
            for scar in range(2):
                points=[anchor(hx+length*(.16+scar*.15)+j*.022,hz+sd*.12-j*.025,side) for j in range(6)]
                part(tube('Healed_facial_scar',points,[.004,.009,.011,.009,.006,.003],tint,sides=6,subdiv=1),'head')
                counts['predatorScars']+=1
    if a.get('feathered'):
        feather=material('Feather_chestnut',0x40504a);edge=material('Feather_warm_edge',0x788774)
        for side in [-1,1]:
            for row in range(1 if a.get('wings') else 3):
                for i in range(12):
                    winged=bool(a.get('wings'))
                    x=-.93+i*.10;z=hip+depth*((.80+row*.12) if winged else (.25+row*.24));p=anchor(x,z,side)
                    tip=p+Vector((-.16,side*.055,.025 if winged else -.075-row*.015))
                    part(feather_surface('Layered_scapular_feather',p,tip,.028,feather if i%3 else edge),'spine')
                    counts['individualFeathers']+=1
            for i in range(7):
                p=anchor(hx-.22-i*.055,hz-sd*.15-i*.027,side)
                part(feather_surface('Nape_covert',p,p+Vector((-.14,side*.045,.018)),.027,edge),'neck')
                counts['individualFeathers']+=1
    return counts
