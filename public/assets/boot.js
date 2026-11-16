/* Independent of the game module: a broken bundle still offers recovery. */
(()=>{
 const screen=document.getElementById('boot-screen'),message=document.getElementById('boot-message'),retry=document.getElementById('boot-retry');
 let ready=false;
 const fail=()=>{if(ready)return;message.textContent='Startup could not finish. Retry to load the game again. Your saved progress has not been reset.';retry.hidden=false;};
 const timer=setTimeout(fail,20000);
 const error=event=>{if(event.target===window||event.target instanceof HTMLScriptElement)fail();};
 const stage=event=>{if(!ready&&typeof event.detail==='string')message.textContent=event.detail;};
 const complete=()=>{ready=true;clearTimeout(timer);window.removeEventListener('error',error,true);document.removeEventListener('jd:boot-stage',stage);document.removeEventListener('jd:boot-ready',complete);screen.classList.add('complete');setTimeout(()=>screen.remove(),matchMedia('(prefers-reduced-motion: reduce)').matches?0:200);};
 retry.onclick=()=>location.reload();window.addEventListener('error',error,true);document.addEventListener('jd:boot-stage',stage);document.addEventListener('jd:boot-ready',complete);
})();
