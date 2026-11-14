import { chromium } from '@playwright/test';
const browser=await chromium.launch({channel:'chrome',headless:true});
try{
 const page=await browser.newPage();
 page.on('console',m=>console.log(m.type(),m.text()));
 page.on('requestfailed',r=>console.log('FAILED',r.url(),r.failure()));
 await page.goto('http://127.0.0.1:4173');
 await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
 await page.getByRole('button',{name:'Preparar y cargar modelos'}).click();
 await page.waitForFunction(()=>!!document.querySelector('[role=alert]')||[...document.querySelectorAll('button')].some(b=>b.textContent==='Modelos cargados'),{},{timeout:60000});
 console.log(await page.locator('[role=alert],[role=status]').allTextContents());
 console.log(await page.evaluate(async()=>{
   const cache=await caches.open('af-public-models-v1');
   const r=await cache.match('/ort/ort-wasm-simd-threaded.mjs');
   return {cacheKeys:await caches.keys(),match:r?{url:r.url,type:r.type,status:r.status,headers:[...r.headers]}:null};
 }));
}finally{await browser.close();}
