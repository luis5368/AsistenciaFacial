import { test, expect } from '@playwright/test';
import { readFile, writeFile } from 'node:fs/promises';

test('consentimiento y permiso denegado no crean perfiles',async({page,context})=>{
  await context.clearPermissions();
  await page.goto('/');
  await expect(page.getByRole('button',{name:'Activar cámara'})).toBeDisabled();
  await page.getByRole('checkbox',{name:/Soy adulto/}).check();
  await page.getByRole('button',{name:'Activar cámara'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByText('0 / 10 perfiles en memoria.',{exact:false})).toBeVisible();
});

test('modelos reales, captura de prueba y recarga offline sin inferir precisión',async({page,context},testInfo)=>{
  await context.grantPermissions(['camera']);
  const pageErrors:string[]=[];page.on('pageerror',e=>pageErrors.push(e.message));
  const external:string[]=[];page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173')&&!r.url().startsWith('blob:')&&!r.url().startsWith('data:'))external.push(r.url());});
  await page.goto('/');
  await page.evaluate(()=>navigator.serviceWorker.ready);
  await page.reload();
  await expect(page.getByText('PWA controla esta página',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Preparar y cargar modelos'}).click();
  await expect(page.getByRole('button',{name:'Modelos cargados',exact:true}).or(page.getByRole('alert'))).toBeVisible({timeout:120000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  const load=JSON.parse(await page.getByTestId('metrics').innerText());
  await page.getByRole('button',{name:'Control sin personas',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('SFace produjo 128 valores',{timeout:60000});
  const control=JSON.parse(await page.getByTestId('metrics').innerText());
  expect(control.faces).toBe(0);expect(control.controlDimensions).toBe(128);expect(control.controlSfaceMs).toBeGreaterThan(0);
  expect(control.comparisonMs).toBeNull();expect(control.comparisonStatus).toBe('not_applicable');
  await page.getByRole('checkbox',{name:/Soy adulto/}).check();
  await page.getByLabel('Escenario de prueba').selectOption('unknown_person');
  await page.getByRole('button',{name:'Activar cámara'}).click();
  await expect.poll(()=>page.locator('video').evaluate((v:HTMLVideoElement)=>v.videoWidth)).toBeGreaterThan(0);
  await page.getByRole('button',{name:'Detectar y comparar',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('No se detectó un rostro',{timeout:60000});
  const noFace=JSON.parse(await page.getByTestId('metrics').innerText());
  expect(noFace).toMatchObject({operation:'recognition',scenario:'unknown_person',outcome:'no_face',comparisonStatus:'no_face',comparisonMs:null,comparedCount:0});
  await page.getByRole('button',{name:'Retirar consentimiento y borrar perfiles'}).click();
  await expect(page.getByRole('checkbox',{name:/Soy adulto/})).not.toBeChecked();
  await context.setOffline(true);await page.reload();
  await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await page.getByRole('checkbox',{name:/Ensayo con red/}).check();
  await page.getByRole('button',{name:'Preparar y cargar modelos'}).click();
  await expect(page.getByRole('button',{name:'Modelos cargados',exact:true}).or(page.getByRole('alert'))).toBeVisible({timeout:120000});
  await expect(page.getByRole('alert')).toHaveCount(0);
  await page.getByRole('button',{name:'Control sin personas',exact:true}).click();
  await expect(page.getByRole('status')).toContainText('SFace produjo 128 valores',{timeout:60000});
  const offline=JSON.parse(await page.getByTestId('metrics').innerText());
  expect(offline).toMatchObject({offlineTestDeclared:true,browserOnlineAtStart:false,browserOnlineAtEnd:false,operation:'control',comparisonMs:null});
  const downloadPromise=page.waitForEvent('download');
  await page.getByRole('button',{name:'Exportar mediciones',exact:true}).click();
  const download=await downloadPromise;
  const exported=JSON.parse(await readFile((await download.path())!,'utf8'));
  expect(exported.schemaVersion).toBe(2);
  expect(exported.measurements).toHaveLength(5);
  expect(exported.measurements[2]).toMatchObject({operation:'recognition',scenario:'unknown_person',outcome:'no_face',comparisonMs:null});
  expect(JSON.stringify(exported)).not.toMatch(/"(id|at|embedding|name|userAgent|matchedId)":/);
  await writeFile(testInfo.outputPath('exportacion-v2-controles.json'),JSON.stringify(exported,null,2));
  expect(offline.faces).toBe(0);expect(external).toEqual([]);expect(pageErrors).toEqual([]);
  const evidence=JSON.stringify({browser:await page.evaluate(()=>navigator.userAgent),load,control,offline,warning:'Cámara sintética de Chromium; no validación facial ni Android'},null,2);
  await writeFile(testInfo.outputPath('mediciones.json'),evidence);
  await testInfo.attach('mediciones-controles-sin-personas',{body:evidence,contentType:'application/json'});
  await page.screenshot({path:testInfo.outputPath('laboratorio-sin-personas.png'),fullPage:true});
});

test('cache incompleta offline informa fallo sin declarar modelos listos',async({page,context})=>{
  await page.goto('/');await page.evaluate(()=>navigator.serviceWorker.ready);await page.reload();
  await context.setOffline(true);
  await page.getByRole('button',{name:'Preparar y cargar modelos'}).click();
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button',{name:'Modelos cargados',exact:true})).toHaveCount(0);
  await expect(page.getByRole('button',{name:'Registrar adulto'})).toBeDisabled();
});

test('interfaz móvil sin desbordamiento horizontal',async({page},testInfo)=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await page.screenshot({path:testInfo.outputPath('movil-sin-personas.png'),fullPage:true});
});
