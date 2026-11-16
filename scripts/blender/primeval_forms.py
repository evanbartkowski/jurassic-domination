"""Primary and secondary creature forms, rebuilt from longitudinal surface profiles.

The ribcage, pelvis, neck, skull and weight-bearing limbs have separate anatomical
rhythms; the output is fused into one skin before UVs or surface detail are added.
"""
import math

def axial_sections(a):
 h,w,d=a['hip'],a['width'],a['depth'];hx,hz=a['head'];length,sw,sd=a['skull'];tail=a['tail']
 # A muscular, horizontal animal with a narrow waist and supported neck.
 # Tail stations stay behind the pelvis even on short-tailed mammals and flyers.
 # The previous percentage-only spacing doubled back through the rump on them.
 reach=max(1.18,tail);span=reach-1.05
 body=[(-reach,0,h-.10,.006,.008),(-1.05-span*.82,0,h-.04,w*.08,d*.09),(-1.05-span*.56,0,h+.02,w*.24,d*.26),(-1.05-span*.24,0,h+.04,w*.50,d*.53),(-1.05,0,h+.03,w*.68,d*.70),(-.78,0,h+.04,w*.88,d*.88),(-.46,0,h+.02,w*.97,d*.94),(-.10,0,h,w,d),(.24,0,h+.04,w*.91,d*.92),(.49,0,h+.14,w*.72,d*.76)]
 if a['family']=='serpent':body=[(x,math.sin(x*1.4)*.13 if x<-.8 else 0,z,ry,rz)for x,y,z,ry,rz in body]
 neck_width=.19 if a.get('neck') else min(w*.64,sw*.90)
 body += [(.68,0,h+.26,neck_width*1.12,d*.55),(.68+(hx-.80)*.48,0,(h+hz)*.5+.17,neck_width,d*.44),(hx-.24,0,hz+.06,sw*.71,sd*.72)]
 # The rear skull, orbital plane, antorbital region and snout form distinct planes.
 family=a['family'];round_head=family in ['equine','wolf','gryphon','phoenix','turtle','pterosaur']
 if round_head:
  body += [(hx-.04,0,hz,sw*.93,sd*.88),(hx+length*.22,0,hz-.025,sw,sd*.91),(hx+length*.52,0,hz-sd*.17,sw*.78,sd*.69),(hx+length*.85,0,hz-sd*.28,sw*.58,sd*.52),(hx+length,0,hz-sd*.27,.015,.018)]
 else:
  body += [(hx-.06,0,hz+.025,sw*.98,sd*.91),(hx+length*.12,0,hz+.03,sw,sd*.96),(hx+length*.31,0,hz-.015,sw*.85,sd*.83),(hx+length*.53,0,hz-sd*.12,sw*.70,sd*.65),(hx+length*.82,0,hz-sd*.17,sw*.62,sd*.58),(hx+length*.98,0,hz-sd*.21,sw*.54,sd*.47),(hx+length*1.04,0,hz-sd*.24,.015,.02)]
 return body

def calibrate(a):
 # These are shape choices, independent of combat statistics or game size.
 family=a['family']
 if family in ['tyrannosaur','carnosaur','abelisaur','dromaeosaur','coelurosaur','ornithopod','ornithomimid','pachycephalosaur','therizinosaur']:a['tail']*=1.24
 a['tail']=max(1.18,a['tail'])
 if family in ['tyrannosaur','carnosaur','abelisaur']:
  a['head']=[a['head'][0]+.10,a['head'][1]-.12];a['skull']=[a['skull'][0]*.92,a['skull'][1]*.91,a['skull'][2]*.78];a['width']*=1.06
 elif family in ['dromaeosaur','coelurosaur','ornithopod']:
  a['skull']=[a['skull'][0]*.93,a['skull'][1]*.88,a['skull'][2]*.84];a['width']*=1.03
 elif family=='ceratopsian':a['skull']=[a['skull'][0]*1.10,a['skull'][1],a['skull'][2]*.90]
 return a

def leg_form(a,side,front):
 h,w=a['hip'],a['width'];x=.53 if front else -.57;y=side*w*.77
 z=h*(1.14 if front and a['base']=='brachiosaurus' else .94 if front else 1)
 if a['family'] in ['crocodilian','synapsid']:
  knee=(x-.12,side*(w+.31),z*.55);ankle=(x+.13,side*(w+.43),.13)
 else:knee=(x+(.05 if front else .35),side*(w+.06),z*.55);ankle=(x+(.08 if front else -.11),side*(w+.08),.18)
 start=(x,y,z);foot=(ankle[0]+.23,ankle[1],.075)
 bulk=(.18 if front else .30)*(1.15 if not a['biped'] else 1)
 if a['family']=='sauropod':bulk*=1.35
 if a['family']=='crocodilian':bulk=.10 if front else .15
 if a['family']=='synapsid':bulk=.12 if front else .18
 shoulder=(x-.02,side*(abs(y)+.04),z*.86)
 muscle=(x+(.01 if front else .14),side*(w+.01),z*.72)
 hock=(ankle[0]-.02,ankle[1],.28)
 points=[start,shoulder,muscle,knee,hock,ankle,foot]
 radii=[bulk*.88,bulk,bulk*.88,bulk*.52,bulk*.33,.085,.09]
 return start,knee,ankle,foot,bulk,points,radii

def palette(a):
 # A consistent natural-history palette. Fantasy forms use bounded related hues.
 swatches={'tyrannosaur':0x7e765b,'carnosaur':0x697568,'abelisaur':0x94624c,'spinosaur':0x5b7a78,'dromaeosaur':0x697f82,'coelurosaur':0x8e815b,'ceratopsian':0x74836a,'ankylosaur':0x8b7c5e,'stegosaur':0x6b806c,'sauropod':0x818675,'hadrosaur':0x8d8867,'iguanodont':0x7c8060,'ornithopod':0x8c8d61,'ornithomimid':0x9d9278,'therizinosaur':0x6d7974,'pachycephalosaur':0x827957,'pterosaur':0x8b7c6c,'crocodilian':0x526b5c,'synapsid':0x946f57,'plesiosaur':0x55777e,'pliosaur':0x476878,'ichthyosaur':0x557681,'mosasaur':0x536e72,'shark':0x627780,'armored-fish':0x62736c,'turtle':0x718462,'serpent':0x587269,'equine':0xaea18a,'wolf':0x736f65,'gryphon':0x8c7660,'phoenix':0xac7354,'dragon':0x657873}
 return swatches.get(a['family'],0x78816b)
