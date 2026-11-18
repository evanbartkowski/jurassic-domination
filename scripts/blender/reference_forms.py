"""Reference-led anatomical profiles. Original surfaces, +X forward, metres.

The museum/specimen proportions are guidance rather than traces of artwork.
Uncertain reconstructions and unavailable references are recorded by the audit.
"""
import math
from primeval_forms import palette as old_palette, axial_sections as old_sections, leg_form as old_leg

def palette(a):
    return {'wyvern':0x786d5b,'elder-dragon':0x5e7058,'frost-dragon':0x788d9a,
      'thunder-drake':0x647a78,'ancient-wyrm':0x6c6555,'eastern-dragon':0x728268,
      'solar-unicorn':0xb39c6d,'celestial-unicorn':0xb3b7c4,'unicorn':0xb0a48a,
      'pegasus':0x9ca7a8,'gryphon':0x89765b,'hippogriff':0x8a6c54,
      'thunderbird':0x5a7385,'fenrir':0x66665e,'cerberus':0x4e4944,
      'behemoth':0x80745d,'primordial-titan':0x6b765f,'quetzalcoatl':0x7c8c68,
      'world-serpent':0x5a7069,'jormungandr':0x6b7975,'leviathan':0x526f7c,
      'basilisk':0x6b8059,'hydra':0x566953,
      'verdant-psittacosaurus':0x58764e,'verdant-iguanodon':0x536b48,
      'elderroot-therizinosaurus':0x6d7859,'cinderfang-carnotaurus':0x71463b,
      'ashborn-tyrannosaurus':0x4d4742,'eclipse-wyrm':0x494b61,
      'stormcrown-dragon':0x596d7a}.get(a['id'],old_palette(a))

def calibrate(a):
    f=a['family'];base=a['base']
    # Distinct genera within families; these values do not affect combat stats.
    profiles={
      'tyrannosaurus':dict(hip=1.66,width=.58,depth=.59,head=[1.12,1.99],skull=[1.05,.39,.36],tail=3.35,arms=.28),
      'tarbosaurus':dict(width=.51,head=[1.20,2.00],skull=[1.10,.32,.34],tail=3.30),
      'albertosaurus':dict(hip=1.81,width=.43,depth=.49,head=[1.24,2.08],skull=[.96,.28,.29],tail=3.45),
      'yutyrannus':dict(width=.48,depth=.53,head=[1.20,1.97],skull=[1.05,.28,.30],arms=.46,tail=3.20),
      'allosaurus':dict(head=[1.23,1.87],skull=[1.08,.27,.31],arms=.68,width=.48,tail=3.45),
      'giganotosaurus':dict(head=[1.23,1.80],skull=[1.30,.27,.32],width=.52,tail=3.45),
      'carcharodontosaurus':dict(head=[1.26,1.85],skull=[1.28,.28,.31],width=.50,tail=3.45),
      'acrocanthosaurus':dict(depth=.68,head=[1.22,1.84],skull=[1.20,.28,.33],tail=3.35),
      'mapusaurus':dict(head=[1.25,1.78],skull=[1.24,.26,.31],width=.46,tail=3.48),
      'torvosaurus':dict(width=.53,head=[1.22,1.82],skull=[1.15,.30,.35],arms=.68),
      'megalosaurus':dict(head=[1.23,1.80],skull=[.97,.29,.31],tail=3.18),
      'australovenator':dict(width=.35,depth=.43,head=[1.30,1.87],skull=[.88,.20,.24],arms=1.05,tail=3.30),
      'ceratosaurus':dict(head=[1.25,1.83],skull=[1.02,.25,.31],arms=.42,tail=3.15),
      'carnotaurus':dict(head=[1.17,2.00],skull=[.70,.30,.42],arms=.14,hip=1.85,width=.43,tail=3.40),
      'spinosaurus':dict(hip=1.18,width=.48,depth=.53,head=[1.60,1.49],skull=[1.25,.18,.21],tail=3.55,arms=.84),
      'baryonyx':dict(head=[1.45,1.70],skull=[1.25,.18,.22],arms=.92,tail=3.20),
      'suchomimus':dict(hip=1.65,head=[1.52,1.83],skull=[1.28,.18,.21],arms=.94,tail=3.28),
      'velociraptor':dict(hip=1.24,width=.26,depth=.32,head=[1.26,1.53],skull=[.72,.145,.16],arms=.75,tail=3.35),
      'deinonychus':dict(hip=1.34,width=.32,depth=.38,head=[1.18,1.65],skull=[.68,.18,.22],tail=3.05),
      'dromaeosaurus':dict(head=[1.15,1.61],skull=[.58,.205,.23],width=.32,tail=3.05),
      'utahraptor':dict(hip=1.35,width=.38,depth=.43,head=[1.15,1.65],skull=[.77,.21,.25],arms=.72,tail=3.20),
      'utahraptor-young':dict(hip=1.42,width=.31,depth=.35,head=[1.20,1.69],skull=[.65,.18,.22],tail=3.24),
      'troodon':dict(head=[1.20,1.73],skull=[.53,.16,.20],hip=1.45,width=.25,tail=3.08),
      'microraptor':dict(hip=1.14,width=.23,depth=.28,head=[1.16,1.41],skull=[.48,.13,.145],arms=.85,tail=3.48),
      'archaeopteryx':dict(hip=1.15,width=.23,depth=.28,head=[1.16,1.44],skull=[.48,.13,.15],arms=.90,tail=3.25,sickle=False),
      'sinosauropteryx':dict(width=.23,depth=.28,head=[1.22,1.50],skull=[.48,.13,.15],arms=.36,tail=3.70,sickle=False,wings=False),
      'compsognathus':dict(hip=1.20,width=.23,depth=.28,head=[1.30,1.53],skull=[.59,.14,.16],tail=3.18,arms=.40),
      'heterodontosaurus':dict(hip=1.24,width=.27,depth=.34,head=[1.20,1.52],skull=[.48,.19,.23],tail=2.88,arms=.43),
      'pachycephalosaurus':dict(hip=1.35,width=.44,depth=.48,head=[1.28,1.81],skull=[.49,.26,.29],tail=3.12,arms=.36),
      'stygimoloch':dict(hip=1.37,width=.34,depth=.39,head=[1.27,1.83],skull=[.43,.23,.27],tail=3.07,arms=.34),
      'ornithomimus':dict(hip=1.58,width=.28,depth=.36,head=[1.37,2.08],skull=[.48,.13,.16],tail=3.24,arms=.80),
      'gallimimus':dict(hip=1.75,width=.30,depth=.39,head=[1.43,2.24],skull=[.56,.13,.15],tail=3.40,arms=.92),
      'mononykus':dict(hip=1.52,width=.25,depth=.33,head=[1.33,1.92],skull=[.47,.13,.15],tail=3.28,arms=.19,fingers=1),
      'oviraptor':dict(hip=1.37,width=.36,depth=.43,head=[1.20,1.95],skull=[.38,.20,.29],tail=2.53,arms=.78),
      'iguanodon':dict(hip=1.43,width=.59,depth=.62,head=[1.40,1.75],skull=[.80,.24,.29],tail=3.32,arms=1.04),
      'therizinosaurus':dict(hip=1.8,width=.58,depth=.72,head=[1.28,2.18],skull=[.46,.17,.20],tail=2.72,arms=1.12),
      'lesothosaurus':dict(hip=1.31,width=.25,depth=.32,head=[1.31,1.64],skull=[.43,.14,.17],tail=3.30,arms=.39),
      'hypsilophodon':dict(hip=1.29,width=.34,depth=.43,head=[1.32,1.62],skull=[.47,.17,.20],tail=3.25,arms=.44),
      'dryosaurus':dict(hip=1.48,width=.29,depth=.36,head=[1.34,1.85],skull=[.44,.14,.18],tail=3.20,arms=.43),
      'leaellynasaura':dict(hip=1.26,width=.28,depth=.36,head=[1.33,1.64],skull=[.43,.14,.17],tail=3.75,arms=.42),
      'parasaurolophus':dict(hip=1.42,width=.58,depth=.61,head=[1.39,1.82],skull=[.78,.23,.25],tail=3.38),
      'maiasaura':dict(hip=1.34,width=.61,depth=.63,head=[1.41,1.69],skull=[.73,.27,.27],tail=3.25),
      'edmontosaurus':dict(hip=1.44,width=.65,depth=.66,head=[1.40,1.78],skull=[.88,.28,.27],tail=3.42),
      'shantungosaurus':dict(hip=1.49,width=.76,depth=.75,head=[1.41,1.79],skull=[.89,.30,.29],tail=3.55),
      'coelophysis':dict(hip=1.38,width=.24,depth=.30,head=[1.45,1.73],skull=[.72,.13,.17],tail=3.52),
      'dilophosaurus':dict(hip=1.48,width=.32,depth=.41,head=[1.28,1.86],skull=[.92,.20,.26],arms=.67,tail=3.25),
      'psittacosaurus':dict(hip=.99,width=.41,depth=.44,head=[1.20,1.24],skull=[.50,.26,.28],arms=.36,tail=2.65),
      'triceratops':dict(hip=1.02,width=.77,depth=.65,head=[1.22,1.05],skull=[.76,.36,.34],tail=2.10),
      'styracosaurus':dict(hip=.98,width=.69,depth=.60,head=[1.23,1.04],skull=[.64,.33,.30],tail=2.16),
      'pachyrhinosaurus':dict(hip=.99,width=.75,depth=.64,head=[1.22,1.01],skull=[.71,.38,.32],tail=2.18),
      'protoceratops':dict(hip=.86,width=.53,depth=.49,head=[1.17,.95],skull=[.55,.28,.28],tail=2.15),
      'ankylosaurus':dict(hip=.67,width=.95,depth=.47,head=[1.33,.59],skull=[.58,.32,.22],tail=2.62),
      'euoplocephalus':dict(hip=.71,width=.80,depth=.45,head=[1.31,.64],skull=[.53,.29,.22],tail=2.76),
      'minmi':dict(hip=.73,width=.64,depth=.42,head=[1.29,.67],skull=[.48,.23,.20],tail=2.52),
      'stegosaurus':dict(hip=1.33,width=.59,depth=.64,head=[1.49,.89],skull=[.45,.16,.20],tail=3.38),
      'kentrosaurus':dict(hip=1.20,width=.50,depth=.53,head=[1.43,.85],skull=[.39,.14,.18],tail=3.22),
      'brachiosaurus':dict(hip=1.77,width=.79,depth=.77,head=[2.28,4.36],skull=[.56,.23,.30],tail=2.92),
      'diplodocus':dict(hip=1.48,width=.66,depth=.61,head=[3.75,1.96],skull=[.48,.16,.19],tail=5.10),
      'apatosaurus':dict(hip=1.56,width=.79,depth=.72,head=[3.31,2.12],skull=[.53,.20,.22],tail=4.52),
      'argentinosaurus':dict(hip=1.85,width=.89,depth=.88,head=[3.55,3.68],skull=[.48,.20,.24],tail=4.24),
      'dreadnoughtus':dict(hip=1.84,width=.84,depth=.82,head=[3.20,3.26],skull=[.52,.21,.25],tail=4.0),
      'amargasaurus':dict(hip=1.39,width=.60,depth=.57,head=[2.63,2.17],skull=[.44,.17,.20],tail=3.5),
      'quetzalcoatlus':dict(hip=1.08,width=.25,depth=.29,head=[1.68,2.54],skull=[1.57,.105,.20],tail=.85),
      'hatzegopteryx':dict(hip=1.08,width=.36,depth=.42,head=[1.42,2.28],skull=[1.48,.24,.29],tail=.85),
      'wyvern':dict(biped=True,arms=0,hip=1.54,width=.43,depth=.49,head=[1.39,1.92],skull=[.89,.27,.29],tail=4.05),
      'frost-dragon':dict(hip=1.08,width=.70,depth=.64,head=[1.40,1.64],skull=[1.02,.35,.32],tail=4.0),
      'thunder-drake':dict(hip=1.53,width=.47,depth=.54,head=[1.42,2.05],skull=[.95,.26,.29],tail=3.80),
      'ancient-wyrm':dict(legless=True,arms=0,hip=.55,width=.39,depth=.39,head=[1.40,.96],skull=[.91,.29,.27],tail=6.5),
      'eastern-dragon':dict(hip=.55,width=.31,depth=.33,head=[1.35,.94],skull=[.80,.25,.25],tail=6.1,arms=.30),
    }
    a.update(profiles.get(base,{}))
    # Longer, planar snouts and supported necks replace the short toy-like
    # crania on the large terrestrial predators. Gameplay sizes stay unchanged.
    apex_profiles={
      'tyrannosaurus':dict(hip=1.80,width=.54,depth=.56,head=[1.24,2.08],skull=[1.20,.33,.32]),
      'tarbosaurus':dict(hip=1.76,width=.49,depth=.52,head=[1.28,2.03],skull=[1.22,.30,.30]),
      'albertosaurus':dict(head=[1.31,2.14],skull=[1.07,.24,.25]),
      'giganotosaurus':dict(head=[1.34,1.93],skull=[1.40,.25,.27]),
      'carcharodontosaurus':dict(head=[1.35,1.97],skull=[1.39,.25,.27]),
      'mapusaurus':dict(head=[1.34,1.95],skull=[1.36,.25,.27]),
      'allosaurus':dict(head=[1.31,1.96],skull=[1.16,.24,.28]),
      'carnotaurus':dict(hip=1.94,width=.41,depth=.48,head=[1.26,2.13],skull=[.83,.25,.33]),
    }
    a.update(apex_profiles.get(base,{}))
    if f=='wolf':a.update(hip=1.02,width=.37,depth=.42,head=[1.16,1.36],skull=[.73,.20,.25],tail=1.85)
    if f=='equine':a.update(hip=1.65,width=.44,depth=.60,head=[1.10,2.26],skull=[.80,.19,.28],tail=1.55)
    if f=='gryphon':a.update(hip=1.25,width=.43,depth=.50,head=[1.15,1.86],skull=[.65,.22,.25])
    if base=='tideweaver':a.update(family='plesiosaur',neck=True,hip=.65,width=.60,depth=.40,head=[3.15,1.14],skull=[.48,.16,.16],tail=1.85)
    if base=='megalodon':a.update(head=[1.05,.85],skull=[.69,.35,.23],width=.60,depth=.48)
    if f not in ['pterosaur','turtle']:a['tail']=max(1.25,a['tail'])
    if f in ['hadrosaur','iguanodont']:a['depth']*=1.15;a['tail']*=1.10
    if f=='synapsid':a.update(hip=.43,head=[1.18,.68],tail=3.02)
    if f=='serpent':a['tail']=5.8
    if f=='therizinosaur':a.update(width=.58,depth=.72,head=[1.28,2.18],skull=[.46,.17,.20],arms=1.12)
    if base=='gallimimus':a.update(hip=1.75,head=[1.43,2.24],skull=[.56,.13,.15],width=.30)
    if base=='ornithomimus':a.update(hip=1.58,head=[1.37,2.08],skull=[.48,.13,.16],width=.28)
    return a

def axial_sections(a):
    h,w,d=a['hip'],a['width'],a['depth'];hx,hz=a['head'];ln,sw,sd=a['skull'];tail=a['tail'];f=a['family']
    body=old_sections(a)
    # The rib cage bulges ventrally; the shoulder narrows into the neck. Tail
    # muscles follow the pelvis rather than forming a sharpened backwards cone.
    for i,(x,y,z,ry,rz) in enumerate(body):
        if -1.02<x<.48:
            chest=math.exp(-((x-.03)/.58)**2)
            body[i]=(x,y,z-.07*chest,ry*(1+.035*chest),rz*(1+.09*chest))
    if f=='sauropod':
        body=body[:10]
        for t in [0,.22,.44,.66,.84,1]:
            x=.60+(hx-.80)*t**1.35;z=h+.24+(hz-h-.24)*t+.11*math.sin(t*math.pi)
            body.append((x,0,z,.31*(1-t)+sw*.75*t,d*.64*(1-t)+sd*.65*t))
        body+=old_sections(a)[13:]
    if f=='pterosaur':
        body=body[:-6]
        body += [(hx-.06,0,hz,sw,sd),(hx+ln*.20,0,hz-.03,sw*.82,sd*.78),(hx+ln*.48,0,hz-.10,sw*.50,sd*.45),(hx+ln*.74,0,hz-.14,sw*.25,sd*.23),(hx+ln*.95,0,hz-.16,.009,.013),(hx+ln,0,hz-.16,.003,.004)]
    if f in ['tyrannosaur','carnosaur','abelisaur','spinosaur','coelurosaur','dromaeosaur']:
        body=body[:10]
        nw=min(w*.72,sw*1.06)
        body += [(.60,0,h+.15,w*.68,d*.70),(.80,0,(h+hz)*.5+.06,nw,sd*.86),(hx-.20,0,hz-.02,sw*.87,sd*.93)]
        # Occiput, broad orbital plane, narrowed antorbital region, blunt premaxilla.
        body += [(hx-.06,0,hz+.01,sw*.97,sd),(hx+ln*.10,0,hz+.02,sw,sd*1.02),(hx+ln*.28,0,hz,sw*.87,sd*.93),(hx+ln*.47,0,hz-sd*.08,sw*.70,sd*.78),(hx+ln*.76,0,hz-sd*.10,sw*.69,sd*.73),(hx+ln*.92,0,hz-sd*.10,sw*.65,sd*.70),(hx+ln*1.01,0,hz-sd*.13,sw*.43,sd*.52),(hx+ln*1.035,0,hz-sd*.14,.012,.018)]
    if a['base']=='spinosaurus':
        body=[(x,y,z,ry,rz*(1.95 if -tail*.85<x<-.95 else 1)) for x,y,z,ry,rz in body]
    return body

def leg_form(a,side,front):
    if a['family'] in ['crocodilian','synapsid','sauropod']:
        return old_leg(a,side,front)
    h,w=a['hip'],a['width'];biped=a['biped'];x=.53 if front else -.56;y=side*w*.68
    start=(x,y,h*(.94 if front else 1))
    if front:
        knee=(x-.07,side*w*1.04,h*.54);ankle=(x+.04,side*w*1.07,.19);bulk=.19
    else:
        knee=(x+.32,side*w*1.04,h*.56);ankle=(x-.12,side*w*1.08,.30 if biped else .18);bulk=.26 if biped else .28
    if a['family']=='wolf':bulk=.16 if front else .21
    if a['family']=='equine':bulk=.14 if front else .22
    if a['family']=='gryphon':bulk=.18 if front else .24
    if a['family']=='dragon' and h<.7:bulk=.11 if front else .14
    foot=(ankle[0]+(.26 if biped else .14),ankle[1],.075)
    # Rounded anterior thigh/caudofemoral mass, patella, tapering shin, long
    # digitigrade metatarsus. Seven controls avoid the previous angular knee.
    mid=(x+.15,side*w*.91,h*.80)
    points=[start,(x+.04,side*w*.79,h*.94),mid,knee,((knee[0]+ankle[0])*.5,ankle[1],(knee[2]+ankle[2])*.5),ankle,foot]
    radii=[bulk*.9,bulk,bulk*.91,bulk*.49,bulk*.34,.068 if biped else .09,.085]
    return start,knee,ankle,foot,bulk,points,radii
