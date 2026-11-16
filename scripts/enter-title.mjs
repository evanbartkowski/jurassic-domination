/** Follow the actual first-launch Start flow in browser and packaged QA. */
export async function enterTitle(page){
 await page.waitForFunction(()=>['start','menu'].includes(document.getElementById('overlay')?.dataset.screen),null,{timeout:60000});
 const enter=page.locator('[data-action="enter"]');if(await enter.count())await enter.click();
}
