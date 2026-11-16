import { archetypeForSpecies } from './progression.js';
const angle=(e,p)=>Math.atan2(p.y-e.y,p.x-e.x);
export function enemyAttackStyle(s){
 const role=archetypeForSpecies(s).id;
 if(['titan','colossus'].includes(role))return {windup:.78,recovery:1.35,combo:1,arc:1.10,spacing:5,pattern:['crush','tail-sweep']};
 if(role==='pack')return {windup:.43,recovery:.95,combo:2,arc:1.02,spacing:6,pattern:['bite','lunge']};
 if(role==='burst')return {windup:.65,recovery:1.4,combo:1,arc:.92,spacing:7,pattern:['lunge','bite']};
 if(role==='venom'||['flame','lightning','frost'].includes(s.abilityType))return {windup:.60,recovery:1.15,combo:1,arc:1.10,spacing:12,pattern:['bite','lunge']};
 if(role==='sprinter')return {windup:.4,recovery:.85,combo:1,arc:.95,spacing:7,pattern:['bite','lunge']};
 return {windup:.56,recovery:1.1,combo:1,arc:1.08,spacing:6,pattern:['bite','crush']};
}
export function beginEnemyAttack(e,p,s,now){
 const style=enemyAttackStyle(s),prior=e.combatPlan,followup=prior?.comboLeft>0,sequence=e.attackSequence||0;
 const kind=followup?'follow-up':style.pattern[sequence%style.pattern.length];
 const plan={phase:'windup',kind,angle:angle(e,p),startedAt:now,windup:followup?.28:style.windup,
  recovery:style.recovery,comboLeft:followup?prior.comboLeft-1:style.combo-1,recoverUntil:0,
  arc:kind==='tail-sweep'?Math.PI:style.arc,reach:kind==='tail-sweep'?1.13:kind==='lunge'?1.08:1,
  damage:followup?.76:kind==='crush'?1.18:kind==='tail-sweep'?.92:1};
 e.attackSequence=sequence+1;e.combatPlan=plan;return plan;
}
export function finishEnemyAttack(e,s,now){
 const plan=e.combatPlan||{comboLeft:0};plan.phase='recovery';plan.recoverUntil=now+(plan.comboLeft>0?.34:enemyAttackStyle(s).recovery);e.combatPlan=plan;
 e.attackCooldown=Math.max(e.attackCooldown||0,plan.comboLeft>0?.34:enemyAttackStyle(s).recovery);
}
export function enemyTactics(e,p,s,now,peers=[]){
 const style=enemyAttackStyle(s),plan=e.combatPlan,aim=angle(e,p);
 if(plan?.phase==='recovery'&&now<plan.recoverUntil)return {canStrike:false,canSkill:false,intent:'recover',move:.35,angle:aim+Math.PI*.85};
 if(plan?.phase==='windup'&&(e.telegraph||0)>0)return {canStrike:false,canSkill:false,intent:plan.kind==='tail-sweep'?'tail-sweep':'windup',move:0,angle:plan.angle};
 const role=archetypeForSpecies(s).id;
 if(role==='pack'&&peers.filter(other=>other.id!==e.id&&(other.telegraph>0||other.cast)&&Math.hypot(other.x-p.x,other.y-p.y)<15).length>=2)
  return {canStrike:false,canSkill:false,intent:'circle',move:.68,angle:aim+(e.id%2?1:-1)*1.45};
 if(!e.boss&&e.hp<e.maxHp*.24&&['pack','sprinter','glass'].includes(role))return {canStrike:false,canSkill:false,intent:'retreat',move:.95,angle:aim+Math.PI+(e.id%2?.2:-.2)};
 return {canStrike:true,canSkill:true,intent:null,move:null,angle:aim};
}
