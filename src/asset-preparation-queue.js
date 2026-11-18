/** Spread expensive skeleton cloning across frames when a herd streams in. */
export class AssetPreparationQueue{
 constructor(schedule){this.schedule=schedule;this.tasks=[];this.scheduled=false;}
 enqueue(task,priority=false){
  if(priority)this.tasks.unshift(task);else this.tasks.push(task);
  this.request();
 }
 request(){if(this.scheduled||!this.tasks.length)return;this.scheduled=true;this.schedule(()=>{
  this.scheduled=false;const task=this.tasks.shift();try{task?.();}finally{this.request();}
 });}
}
