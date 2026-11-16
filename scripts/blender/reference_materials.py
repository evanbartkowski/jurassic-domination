"""Engine-ready texture painting: authored spatial markings and scale relief baked to UVs."""
import bpy,math,time
from pathlib import Path

def surface_material(mat,anatomy):
 nodes=mat.node_tree.nodes;links=mat.node_tree.links;p=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
 tex=nodes.new('ShaderNodeTexCoord');sep=nodes.new('ShaderNodeSeparateXYZ');links.new(tex.outputs['Object'],sep.inputs[0])
 def mathnode(op,a,b):
  n=nodes.new('ShaderNodeMath');n.operation=op
  for i,v in enumerate([a,b]):
   if isinstance(v,(int,float)):n.inputs[i].default_value=v
   else:links.new(v,n.inputs[i])
  return n.outputs[0]
 noise=nodes.new('ShaderNodeTexNoise');noise.inputs['Scale'].default_value=7;noise.inputs['Detail'].default_value=3;noise.inputs['Roughness'].default_value=.65;links.new(tex.outputs['Object'],noise.inputs['Vector'])
 # Countershading follows anatomy. Markings wrap around the body, not UV seams.
 z=mathnode('SUBTRACT',sep.outputs['Z'],anatomy['hip']-anatomy['depth']*.20);top=mathnode('MULTIPLY',z,1/(anatomy['depth']*1.6))
 ramp=nodes.new('ShaderNodeValToRGB');ramp.color_ramp.elements[0].position=.05;ramp.color_ramp.elements[0].color=(.62,.55,.42,1);ramp.color_ramp.elements[1].position=.85;ramp.color_ramp.elements[1].color=(.22,.25,.20,1);links.new(top,ramp.inputs[0])
 pigment=next((n for n in nodes if n.type=='VERTEX_COLOR'),None)
 base=p.inputs['Base Color'].default_value[:]
 blend=nodes.new('ShaderNodeMixRGB');blend.blend_type='MULTIPLY';blend.inputs[0].default_value=.42;blend.inputs[1].default_value=base;links.new(ramp.outputs[0],blend.inputs[2])
 wave=mathnode('SINE',mathnode('ADD',mathnode('MULTIPLY',sep.outputs['X'],8.5),mathnode('MULTIPLY',noise.outputs['Fac'],5)),0)
 mask=mathnode('MULTIPLY',mathnode('GREATER_THAN',wave,.25),mathnode('MAXIMUM',top,.05));shade=nodes.new('ShaderNodeMixRGB');shade.blend_type='MULTIPLY';links.new(mathnode('MULTIPLY',mask,.22),shade.inputs[0]);links.new(blend.outputs[0],shade.inputs[1]);shade.inputs[2].default_value=(.12,.18,.15,1);links.new(shade.outputs[0],p.inputs['Base Color'])
 # Pigment mottling and scales are separate frequencies; no painted lighting.
 flecks=nodes.new('ShaderNodeTexNoise');flecks.inputs['Scale'].default_value=125;flecks.inputs['Detail'].default_value=2;links.new(tex.outputs['Object'],flecks.inputs['Vector'])
 mottled=nodes.new('ShaderNodeMixRGB');mottled.blend_type='MULTIPLY';mottled.inputs[0].default_value=.25;links.new(shade.outputs[0],mottled.inputs[1]);links.new(noise.outputs['Color'],mottled.inputs[2]);links.new(mottled.outputs[0],p.inputs['Base Color'])
 scales=nodes.new('ShaderNodeTexVoronoi');scales.feature='DISTANCE_TO_EDGE';scales.inputs['Scale'].default_value=72;scales.inputs['Randomness'].default_value=.75;links.new(tex.outputs['Object'],scales.inputs['Vector'])
 bump=nodes.new('ShaderNodeBump');bump.inputs['Strength'].default_value=.24;bump.inputs['Distance'].default_value=.006;links.new(scales.outputs['Distance'],bump.inputs['Height']);links.new(bump.outputs['Normal'],p.inputs['Normal'])
 links.new(mathnode('ADD',mathnode('MULTIPLY',noise.outputs['Fac'],.21),.64),p.inputs['Roughness'])
 p.inputs['Metallic'].default_value=0

def bake(surface,anatomy,directory):
 directory=Path(directory);directory.mkdir(parents=True,exist_ok=True);scene=bpy.context.scene
 scene.render.engine='CYCLES';scene.cycles.samples=1;scene.cycles.use_denoising=False;scene.render.bake.margin=12;scene.render.bake.use_clear=True
 bpy.ops.object.select_all(action='DESELECT');surface.select_set(True);bpy.context.view_layer.objects.active=surface
 mats=list(surface.data.materials);targets=[];outputs={}
 for m in mats:
  if m.name.startswith('Hide'):surface_material(m,anatomy)
 for kind,size in [('Albedo',1024),('Normal',1024),('Roughness',512)]:
  image=bpy.data.images.new(anatomy['id']+'_'+kind,width=size,height=size,alpha=False);image.colorspace_settings.name='sRGB' if kind=='Albedo' else 'Non-Color'
  image.generated_color=(.5,.5,1,1) if kind=='Normal' else (.35,.35,.35,1)
  for m in mats:
   node=m.node_tree.nodes.new('ShaderNodeTexImage');node.image=image;m.node_tree.nodes.active=node;targets.append((m,node))
  started=time.time()
  if kind=='Albedo':
   scene.render.bake.use_pass_direct=False;scene.render.bake.use_pass_indirect=False;scene.render.bake.use_pass_color=True;bpy.ops.object.bake(type='DIFFUSE')
  elif kind=='Normal':bpy.ops.object.bake(type='NORMAL',normal_space='TANGENT')
  else:bpy.ops.object.bake(type='ROUGHNESS')
  image.filepath_raw=str(directory/(kind+'.jpg' if kind=='Albedo' else kind+'.png'));image.file_format='JPEG' if kind=='Albedo' else 'PNG';scene.render.image_settings.quality=94;image.save();image.pack();outputs[kind]=image
  for m,node in targets:m.node_tree.nodes.remove(node)
  targets=[];print('PRIMEVAL_BAKE',anatomy['id'],kind,round(time.time()-started,2),flush=True)
 material=bpy.data.materials.new('Hide_PBR');p=next(n for n in material.node_tree.nodes if n.type=='BSDF_PRINCIPLED');links=material.node_tree.links
 for kind,socket in [('Albedo','Base Color'),('Roughness','Roughness'),('Normal','Normal')]:
  node=material.node_tree.nodes.new('ShaderNodeTexImage');node.image=outputs[kind]
  if kind=='Normal':normal=material.node_tree.nodes.new('ShaderNodeNormalMap');links.new(node.outputs['Color'],normal.inputs['Color']);links.new(normal.outputs['Normal'],p.inputs[socket])
  else:links.new(node.outputs['Color'],p.inputs[socket])
 p.inputs['Metallic'].default_value=0;p.inputs['Roughness'].default_value=.75
 surface.data.materials.clear();surface.data.materials.append(material)
 for poly in surface.data.polygons:poly.material_index=0
 return {k:{'width':v.size[0],'height':v.size[1],'file':Path(v.filepath_raw).name} for k,v in outputs.items()}
