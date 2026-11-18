/** A single next action. Urgent survival takes precedence over optional goals. */
export function hudFocus({player,incident,lesson,quests,objective,survivalHint=''}){
 if(incident&&!incident.safe)return {badge:'WORLD EVENT',title:incident.label,step:'TAKE COVER',progressText:incident.seconds+'s',progress:Math.min(1,incident.seconds/50),hint:incident.detail};
 if(player.hp<player.maxHp*.25)return {badge:'SURVIVE',title:'Retreat and recover',step:'CRITICAL HEALTH',progressText:Math.ceil(player.hp)+' HP',progress:player.hp/player.maxHp,hint:survivalHint||'Move away from attackers. Eat safe food to restore health.'};
 if(player.hunger<15)return {badge:'SURVIVE',title:'Find food now',step:'STARVING',progressText:Math.ceil(player.hunger)+'%',progress:player.hunger/100,hint:survivalHint||'Seek nearby edible food. Hold E to feed.'};
 if(incident)return {badge:'WORLD EVENT',title:incident.label,step:'SHELTERED',progressText:incident.seconds+'s',progress:1,hint:incident.detail};
 if(lesson)return {badge:'LEARN TO SURVIVE',title:lesson.title,step:`${lesson.index} / ${lesson.total}`,progressText:lesson.action||'pause',progress:(lesson.index-1)/lesson.total,hint:lesson.text,learning:true};
 const main=quests?.main;
 if(main)return {badge:'THE LAST CHORUS',title:main.title,step:`CHAPTER ${quests.chapter+1} / ${quests.total}`,progressText:main.ready?'READY':`${main.progress} / ${main.target}`,progress:main.progress/main.target,hint:main.ready?'Open Story & quests to continue this chapter.':main.goal};
 return {badge:'YOUR NEXT GOAL',title:objective.title,step:`${objective.step} / ${objective.totalSteps}`,progressText:objective.progressText,progress:objective.progress,hint:objective.hint};
}
