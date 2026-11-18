/** Presentation velocity filters fixed-step updates; gameplay positions stay authoritative. */
export function sampleLocomotion(state,x,z,dt){
 const initialized=state.motionX!==undefined;
 const distance=initialized?Math.hypot(x-state.motionX,z-state.motionY):0;
 state.motionX=x;state.motionY=z;
 if(!initialized||distance>Math.max(12,dt*100)){state.worldSpeed=0;return;}
 if(dt<=0)return;
 const raw=distance/dt;
 state.worldSpeed=(state.worldSpeed||0)+(raw-(state.worldSpeed||0))*(1-Math.exp(-12*dt));
 if(raw===0&&state.worldSpeed<.015)state.worldSpeed=0;
}
/** Sprint changes gait and speed, never lens/framing. */
export function cameraDistance(size){return 15+Math.pow(Math.max(.1,size),1.08)*8.5;}
