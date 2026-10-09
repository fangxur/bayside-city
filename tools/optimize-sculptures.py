"""Run with Blender --background --python tools/optimize-sculptures.py -- --source-dir /path/to/sources.
See assets/sculptures/CREDITS.md for download links and licenses.
Input files: bayside-david-full.glb, bayside-venus-original.glb,
bayside-victory-original.fbx, bayside-discobolus-original.stl.
"""
import bpy,math,json,struct,base64,os,sys,argparse
from pathlib import Path
from mathutils import Matrix, Vector
from mathutils.bvhtree import BVHTree
parser=argparse.ArgumentParser();parser.add_argument('--source-dir',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:])
SOURCE=Path(args.source_dir);OUT=Path(__file__).resolve().parents[1]/'assets'/'sculptures'
OUT.mkdir(parents=True,exist_ok=True)
models=[('david','sculptureDavid',2.48,16000),('venus','sculptureVenus',2.30,16000),('victory','sculptureVictory',2.52,18000),('discobolus','sculptureDiscobolus',2.03,14000)]
for name,kind,height,budget in models:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 ext={'david':'glb','venus':'glb','victory':'fbx','discobolus':'stl'}[name]
 filename='bayside-david-full.glb' if name=='david' else 'bayside-'+name+'-original.'+ext
 path=str(SOURCE/filename)
 if ext=='glb':bpy.ops.import_scene.gltf(filepath=path)
 elif ext=='fbx':bpy.ops.import_scene.fbx(filepath=path)
 else:bpy.ops.wm.stl_import(filepath=path)
 obs=[o for o in bpy.context.scene.objects if o.type=='MESH'];bpy.ops.object.select_all(action='DESELECT')
 for o in obs:o.select_set(True)
 bpy.context.view_layer.objects.active=obs[0]
 if len(obs)>1:bpy.ops.object.join()
 o=bpy.context.object;o.data.transform(o.matrix_world);o.parent=None;o.matrix_world.identity()
 bpy.context.view_layer.objects.active=o;o.select_set(True)
 if name in ['david','victory']:o.data.transform(Matrix.Rotation(.6 if name=='david' else .9,4,'Z'))
 # Weld split UV vertices before simplifying, preserving continuous stone normals.
 bpy.ops.object.mode_set(mode='EDIT');bpy.ops.mesh.select_all(action='SELECT');bpy.ops.mesh.remove_doubles(threshold=.00001);bpy.ops.mesh.normals_make_consistent(inside=False);bpy.ops.object.mode_set(mode='OBJECT')
 o.data.calc_loop_triangles();tri=len(o.data.loop_triangles)
 if tri>budget:
  mod=o.modifiers.new('City silhouette LOD','DECIMATE');mod.ratio=budget/tri;mod.use_collapse_triangulate=True;bpy.ops.object.modifier_apply(modifier=mod.name)
 o.data.calc_loop_triangles()
 mn=[min(v.co[i] for v in o.data.vertices) for i in range(3)];mx=[max(v.co[i] for v in o.data.vertices) for i in range(3)];print('BOUNDS',name,mn,mx,flush=True)
 scale=min(height/(mx[2]-mn[2]),1.72/(mx[0]-mn[0]),1.72/(mx[1]-mn[1]))
 points=[((v.co.x-(mn[0]+mx[0])/2)*scale,(v.co.z-mn[2])*scale,-(v.co.y-(mn[1]+mx[1])/2)*scale) for v in o.data.vertices]
 bounds=[[min(p[i] for p in points) for i in range(3)],[max(p[i] for p in points) for i in range(3)]]
 raw=bytearray()
 for p in points:
  for i in range(3):raw+=struct.pack('<H',round((p[i]-bounds[0][i])/(bounds[1][i]-bounds[0][i])*65535))
 for t in o.data.loop_triangles:raw+=struct.pack('<3H',*t.vertices)
 # Bake local occlusion into one byte per vertex; no texture fetch or extra light.
 tree=BVHTree.FromPolygons([v.co for v in o.data.vertices],[t.vertices for t in o.data.loop_triangles],all_triangles=True)
 radius=(mx[2]-mn[2])*.13;epsilon=radius*.002
 for v in o.data.vertices:
  n=v.normal.normalized();t=n.cross(Vector((0,0,1)))
  if t.length<.01:t=n.cross(Vector((0,1,0)))
  t.normalize();bn=n.cross(t);blocked=0
  for sample in range(32):
   z=math.sqrt((sample+.5)/32);r=math.sqrt(1-z*z);a=sample*2.399963229728653
   direction=n*z+t*(r*math.cos(a))+bn*(r*math.sin(a))
   hit=tree.ray_cast(v.co+n*epsilon,direction,radius)
   if hit[0] is not None:blocked+=1-hit[3]/radius
  raw+=struct.pack('B',round(255*(1-.58*blocked/32)))
 data={'kind':kind,'vertices':len(points),'triangles':len(o.data.loop_triangles),'bounds':bounds,'data':base64.b64encode(raw).decode()}
 open(OUT/(name+'.js'),'w').write('// Optimized sculpture mesh. Source, license and modifications: ./CREDITS.md\nexport default '+json.dumps(data,separators=(',',':'))+';\n')
 print('EXPORTED',name,len(points),len(o.data.loop_triangles),bounds,len(raw),flush=True)
