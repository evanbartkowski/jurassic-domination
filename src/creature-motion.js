import * as T from 'three';

/** Cache joints and body-space axes once, never allocate vectors in the frame loop. */
export function prepareSecondaryMotion(surface,seed=0){
 surface.updateMatrixWorld(true);
 const joints=[];
 surface.traverse(bone=>{
  if(!bone.isBone||!/^(spine|neck|head|tail\d|jaw)$/.test(bone.name))return;
  const inverse=bone.getWorldQuaternion(new T.Quaternion()).invert();
  joints.push({bone,base:new T.Quaternion(),offset:new T.Quaternion(),pitch:new T.Vector3(0,0,1).applyQuaternion(inverse),yaw:new T.Vector3(0,1,0).applyQuaternion(inverse),roll:new T.Vector3(1,0,0).applyQuaternion(inverse)});
 });
 return{joints,phase:seed,clock:seed,applied:false,q:new T.Quaternion()};
}
export function removeSecondaryMotion(state){
 if(!state?.applied)return;
 for(const j of state.joints)j.bone.quaternion.copy(j.base);
 state.applied=false;
}
export function applySecondaryMotion(state,dt,move,turn,attack,sleeping,dead){
 if(!state)return;
 // Restore first also makes this helper safe without a mixer or on paused frames.
 removeSecondaryMotion(state);state.clock+=Math.max(0,dt);
 if(dead||sleeping)return;
 const t=state.clock,breath=Math.sin(t*1.7),look=Math.sin(t*.53)*Math.sin(t*.19),stride=Math.min(1,move),impact=attack||0;
 for(const j of state.joints){
  const n=j.bone.name;let pitch=0,yaw=0,roll=0;
  if(n==='spine'){roll=Math.sin(t*2.3)*.012*(1-stride);pitch=breath*.008-impact*.055;}
  if(n==='neck'){pitch=breath*.014-impact*.09;yaw=look*.085*(1-stride)-turn*.045;}
  if(n==='head'){pitch=-breath*.012+Math.sin(t*.87)*.012;yaw=look*.11*(1-stride);}
  if(n==='jaw')pitch=-impact*.18;
  if(n.startsWith('tail')){const i=Number(n.at(-1));yaw=Math.sin(t*1.35-i*.65)*(.012+i*.004)*(1-stride*.6)+turn*(.025+i*.009);}
  j.base.copy(j.bone.quaternion);
  j.offset.setFromAxisAngle(j.pitch,pitch).multiply(state.q.setFromAxisAngle(j.yaw,yaw)).multiply(state.q.setFromAxisAngle(j.roll,roll));
  j.bone.quaternion.multiply(j.offset);
 }
 state.applied=true;
}

/** Contact occupies 60% of a walk cycle; bent knees clear the ground on recovery. */
export function gaitPose(phase,running=false){
 const p=((phase%(Math.PI*2))+Math.PI*2)%(Math.PI*2)/(Math.PI*2),contact=running?.48:.6;
 const swing=p<contact?1-2*p/contact:-Math.cos((p-contact)/(1-contact)*Math.PI);
 const lift=p<contact?0:Math.sin((p-contact)/(1-contact)*Math.PI);
 return{hip:swing*(running?.62:.4),knee:lift*(running?1.05:.8),ankle:-swing*(running?.25:.18)-lift*.35};
}

/** Improve the exported gait curves while retaining the source rig and every other clip. */
export function naturalGaitClips(surface,clips){
 surface.updateMatrixWorld(true);
 return clips.map(clip=>{
  const kind=clip.name.split('_').at(-1);if(!['Walk','Run'].includes(kind))return clip;
  const result=clip.clone(),running=kind==='Run';
  for(const track of result.tracks){
   if(!track.name.endsWith('.quaternion'))continue;
   const name=track.name.slice(0,-11),bone=surface.getObjectByName(name);
   if(!bone?.isBone||!name.startsWith('hind')&&!name.startsWith('front'))continue;
   const axis=new T.Vector3(0,0,1).applyQuaternion(bone.getWorldQuaternion(new T.Quaternion()).invert()),rest=bone.quaternion.clone(),q=new T.Quaternion(),offset=new T.Quaternion();
   for(let i=0;i<track.times.length;i++){
    const phase=track.times[i]/clip.duration*Math.PI*2+(/R(?:_|$)/.test(name)?Math.PI:0)+(name.startsWith('front')?Math.PI:0),pose=gaitPose(phase,running);
    const angle=name.includes('_shin')?pose.knee:name.includes('_foot')?pose.ankle:pose.hip;
    q.copy(rest).multiply(offset.setFromAxisAngle(axis,-angle));q.toArray(track.values,i*4);
   }
  }
  return result;
 });
}
