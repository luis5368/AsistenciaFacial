import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { BiometricEngine, MODEL_VERSION } from './engine';
import { type Face } from './math';
import { compareMeasured, createReport, publicMeasurement, type Scenario, type HumanReview } from './measurement';
import { prepareResources, resourcesAvailable, recordMeasurement, exportMeasurements, clearMeasurements, reviewMeasurement, type Measurement } from './storage';
import './style.css';

type Profile={id:string;embedding:Float32Array};
function App() {
  const video=useRef<HTMLVideoElement>(null),overlay=useRef<HTMLCanvasElement>(null);
  const engine=useRef(new BiometricEngine()),stream=useRef<MediaStream|null>(null),profiles=useRef<Profile[]>([]);
  const [consent,setConsent]=useState(false),[busy,setBusy]=useState(false),[ready,setReady]=useState(false),[camera,setCamera]=useState(false);
  const [message,setMessage]=useState('Prepara los recursos para comenzar.'),[error,setError]=useState(''),[count,setCount]=useState(0),[threshold,setThreshold]=useState('0.5');
  const [metrics,setMetrics]=useState<Measurement|null>(null),[cached,setCached]=useState(false),[controlled,setControlled]=useState(!!navigator.serviceWorker?.controller);
  const [online,setOnline]=useState(navigator.onLine);
  const [scenario,setScenario]=useState<Scenario>('unspecified');
  const [offlineTest,setOfflineTest]=useState(false);
  function context(): Partial<Measurement> {return {schemaVersion:2,scenario,offlineTestDeclared:offlineTest,browserOnlineAtStart:navigator.onLine,serviceWorkerControlled:!!navigator.serviceWorker?.controller,humanReview:'not_reviewed'};}
  useEffect(()=>{
    const network=()=>setOnline(navigator.onLine),controller=()=>setControlled(true);
    window.addEventListener('online',network);window.addEventListener('offline',network);
    navigator.serviceWorker?.addEventListener('controllerchange',controller);
    if(import.meta.env.PROD) navigator.serviceWorker?.register('/sw.js').catch(()=>setError('No se pudo registrar la PWA.'));
    resourcesAvailable().then(setCached).catch(()=>setCached(false));
    return ()=>{window.removeEventListener('online',network);window.removeEventListener('offline',network);navigator.serviceWorker?.removeEventListener('controllerchange',controller);stream.current?.getTracks().forEach(t=>t.stop());profiles.current.forEach(p=>p.embedding.fill(0));void engine.current.dispose();};
  },[]);
  async function run(action:()=>Promise<void>) {if(busy)return;setBusy(true);setError('');try{await action();}catch(e){setError(e instanceof Error?e.message:String(e));setMessage('Operación no completada. No se registró asistencia.');}finally{setBusy(false);}}
  async function saveMetrics(row:Measurement) {
    const memory=(performance as Performance & {memory?:{usedJSHeapSize:number}}).memory;
    const estimate=await navigator.storage?.estimate().catch(()=>undefined);
    row.heapBytes=memory?.usedJSHeapSize;row.storageBytes=estimate?.usage;row.browserOnlineAtEnd=navigator.onLine;setMetrics(row);
    try {const id=await recordMeasurement(row);setMetrics({...row,id});}catch{setError('La medición se muestra, pero IndexedDB no pudo guardarla.');}
  }
  async function load() {
    if(ready)return;
    if(!await resourcesAvailable()) await prepareResources(setMessage);
    setCached(true);setMessage('Inicializando YuNet y SFace con WASM…');
    const loadContext=context();
    const timing=await engine.current.initialize();setReady(true);
    await saveMetrics({...loadContext,kind:'load',operation:'load',outcome:'loaded',comparisonStatus:'not_applicable',comparisonMs:null,...timing});setMessage('Modelos cargados. La precisión aún no está validada.');
  }
  async function startCamera() {
    if(!consent)throw new Error('Se requiere consentimiento de una persona adulta.');
    if(!navigator.mediaDevices?.getUserMedia)throw new Error('Cámara no disponible: usa localhost o HTTPS.');
    const media=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480}}});
    stream.current=media;video.current!.srcObject=media;
    try{await video.current!.play();setCamera(true);setMessage('Cámara activa. Solo se procesa al pulsar un botón.');}catch(e){media.getTracks().forEach(t=>t.stop());throw e;}
  }
  function stopCamera() {stream.current?.getTracks().forEach(t=>t.stop());stream.current=null;if(video.current)video.current.srcObject=null;setCamera(false);if(overlay.current)overlay.current.width=overlay.current.width;}
  function revoke() {stopCamera();profiles.current.forEach(p=>p.embedding.fill(0));profiles.current=[];setCount(0);setConsent(false);setMessage('Consentimiento retirado: cámara detenida y perfiles de esta sesión eliminados.');}
  function draw(faces:Face[],width:number,height:number) {
    const c=overlay.current!;c.width=width;c.height=height;const ctx=c.getContext('2d')!;ctx.strokeStyle='#95ffad';ctx.fillStyle='#95ffad';ctx.lineWidth=3;
    for(const face of faces){ctx.strokeRect(...face.box);for(const [x,y] of face.points){ctx.beginPath();ctx.arc(x,y,3,0,2*Math.PI);ctx.fill();}}
  }
  async function analyze(enroll=false,control=false) {
    if(!ready)throw new Error('Carga los modelos primero.');
    if(!control&&(!consent||!camera))throw new Error('Activa la cámara con consentimiento.');
    const source=document.createElement('canvas');source.width=control?640:video.current!.videoWidth;source.height=control?480:video.current!.videoHeight;
    if(!source.width||!source.height)throw new Error('La cámara todavía no entrega imágenes.');
    const ctx=source.getContext('2d')!;
    if(control){ctx.fillStyle='#808080';ctx.fillRect(0,0,source.width,source.height);}else ctx.drawImage(video.current!,0,0);
    const row:Measurement={...context(),kind:control?'control':'inference',operation:control?'control':enroll?'enrollment':'recognition',scenario:control||enroll?'unspecified':scenario,candidateCount:profiles.current.length,comparedCount:0,comparisonStatus:'not_applicable',comparisonMs:null,bestCosine:null,thresholdApplied:null,ambiguityMargin:null};
    try {
      const result=await engine.current.extract(source);if(!control)draw(result.faces,source.width,source.height);
      Object.assign(row,{faces:result.faces.length,detectionMs:result.detectionMs,embeddingMs:result.embeddingMs});
      const controlResult=control?await engine.current.controlEmbedding():{};
      if(control){row.outcome='control';setMessage(`Control sin personas: ${result.faces.length} rostros detectados; SFace produjo 128 valores desde una entrada gris. No demuestra precisión facial.`);}
      else if(!result.embedding){row.outcome=result.faces.length===0?'no_face':'multiple_faces';row.comparisonStatus=row.outcome;setMessage(result.faces.length===0?'No se detectó un rostro. Ajusta luz y distancia o usa la vía manual.':'Hay varios rostros. No se registra ni compara un perfil.');}
      else {
        try{
          if(enroll){if(profiles.current.length>=10){row.outcome='profile_limit';setMessage('Máximo 10 perfiles temporales; no se registró otro.');}else{const id=`Voluntario ${profiles.current.length+1}`;profiles.current.push({id,embedding:result.embedding.slice()});setCount(profiles.current.length);row.outcome='enrolled';setMessage(`${id} registrado solo en memoria. Una muestra experimental, no enrolamiento académico completo.`);}}
          else {const comparison=compareMeasured(result.embedding,profiles.current,threshold.trim()===''?NaN:Number(threshold));Object.assign(row,comparison.metrics);const match=comparison.match;setMessage(!match?'No hay perfiles temporales: no se ejecutó comparación. Registra un adulto primero.':match.state==='candidate'?`Candidato: ${match.id}. Coseno ${match.score.toFixed(4)}. Requiere confirmación humana; no registra asistencia.`:match.state==='ambiguous'?'Resultado ambiguo: usa la vía manual.':`Desconocido / sin coincidencia aceptada${match.score===null?'':`. Coseno máximo ${match.score.toFixed(4)}`}. Usa la vía manual.`);}
        }finally{result.embedding.fill(0);}
      }
      await saveMetrics({...row,...controlResult});
    }catch(e){await saveMetrics({...row,outcome:'error',comparisonStatus:'error'});throw e;}finally{source.width=0;}
  }
  async function exportReport() {
    const data=createReport(await exportMeasurements(),MODEL_VERSION);
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download='mediciones-fase-1.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  async function review(value: HumanReview) {if(metrics?.id===undefined)throw new Error('La medición no está guardada.');await reviewMeasurement(metrics.id,value);setMetrics({...metrics,humanReview:value});}
  return <main>
    <header><div className="brand">AF <span>ASISTENCIA FACIAL</span></div><span className="pill">FASE 1 · EXPERIMENTAL</span></header>
    <section className="intro"><p className="eyebrow">LABORATORIO LOCAL</p><h1>Reconocimiento facial,<br/>bajo observación.</h1><p>YuNet + SFace en tu navegador. Prueba exclusiva con personas adultas que hayan dado su consentimiento.</p></section>
    <div className="statusbar"><span>{online?'Red disponible (indicio)':'Sin conexión de red'}</span><span>{cached?'Recursos guardados':'Recursos pendientes'}</span><span>{controlled?'PWA controla esta página':'PWA pendiente / modo desarrollo'}</span></div>
    <div className="layout"><section className="panel"><h2>01 · Preparación</h2><p>Los modelos se descargan al preparar (~39 MB más WASM). Las fotos nunca se guardan y los perfiles desaparecen al recargar.</p><button disabled={busy||ready} onClick={()=>void run(load)}>{busy?'Procesando…':ready?'Modelos cargados':'Preparar y cargar modelos'}</button>
    <label className="consent"><input type="checkbox" checked={consent} disabled={busy} onChange={e=>e.target.checked?setConsent(true):revoke()}/> Soy adulto y consiento esta prueba local. Confirmo que no habrá menores en la cámara.</label>
    <div className="actions"><button disabled={busy||!consent||camera} onClick={()=>void run(startCamera)}>Activar cámara</button><button className="secondary" disabled={busy||!camera} onClick={stopCamera}>Detener cámara</button></div>
    <h2>02 · Perfiles temporales</h2><p>{count} / 10 perfiles en memoria. Cada adulto debe consentir antes de participar; retira el consentimiento para borrar todos los perfiles.</p><label>Umbral coseno experimental<input aria-label="Umbral coseno" type="number" min="-1" max="1" step="0.01" value={threshold} disabled={busy} onChange={e=>setThreshold(e.target.value)}/></label><small>Valor inicial 0.50 sin calibrar. No es porcentaje de precisión. Margen entre candidatos: 0.05.</small>
    <label>Escenario declarado antes de comparar<select aria-label="Escenario de prueba" disabled={busy} value={scenario} onChange={e=>setScenario(e.target.value as Scenario)}><option value="unspecified">Exploración sin clasificar</option><option value="known_person">Persona previamente enrolada</option><option value="unknown_person">Persona no enrolada (desconocido)</option></select></label>
    <label className="consent"><input type="checkbox" checked={offlineTest} disabled={busy} onChange={e=>setOfflineTest(e.target.checked)}/> Ensayo con red desconectada por el operador</label><small>Esta declaración se registra aparte del indicio de conectividad del navegador. No altera el reconocimiento.</small>
    <div className="actions"><button disabled={busy||!ready||!camera||!consent} onClick={()=>void run(()=>analyze(true))}>Registrar adulto</button><button disabled={busy||!ready||!camera||!consent||threshold===''} onClick={()=>void run(()=>analyze())}>Detectar y comparar</button></div><button className="textbutton" disabled={busy} onClick={revoke}>Retirar consentimiento y borrar perfiles</button>
    </section><section className="panel"><div className="viewheading"><h2>Vista de cámara</h2><span className="pill">{camera?'ACTIVA':'DETENIDA'}</span></div><div className="camera"><video ref={video} playsInline muted/><canvas ref={overlay}/>{!camera&&<div className="camera-empty">La cámara está detenida.<br/><small>Se activa únicamente con tu permiso.</small></div>}</div><p role="status" className="result">{message}</p>{error&&<p role="alert" className="error">{error}</p>}<button className="secondary" disabled={busy} onClick={()=>{setMessage('Vía manual: este laboratorio no registra asistencia. Usa el procedimiento manual del colegio.');}}>Usar alternativa manual</button>
    <h2>03 · Mediciones</h2><p>La memoria JS es aproximada; no incluye toda la memoria WASM, GPU ni el proceso del navegador. Tiempo null significa que no se comparó; cero con estado executed puede deberse a la resolución del reloj.</p>
    {metrics?.operation==='recognition'&&metrics.comparisonStatus==='executed'&&<label>Revisión humana de la última comparación<select aria-label="Revisión humana" disabled={busy||metrics.id===undefined} value={metrics.humanReview??'not_reviewed'} onChange={e=>void run(()=>review(e.target.value as HumanReview))}><option value="not_reviewed">Sin revisar</option>{metrics.outcome==='candidate'?<><option value="correct_candidate">Candidato correcto según el operador</option><option value="incorrect_candidate">Candidato incorrecto según el operador</option></>:<><option value="correct_rejection">Rechazo correcto según el operador</option><option value="incorrect_rejection">Rechazo incorrecto según el operador</option></>}<option value="inconclusive">No se puede determinar</option></select></label>}
    <pre data-testid="metrics">{metrics?JSON.stringify(publicMeasurement(metrics),null,2):'Aún no hay mediciones.'}</pre><div className="actions"><button className="secondary" disabled={busy||!ready} onClick={()=>void run(()=>analyze(false,true))}>Control sin personas</button><button className="secondary" disabled={busy} onClick={()=>void run(exportReport)}>Exportar mediciones</button><button className="textbutton" disabled={busy} onClick={()=>void run(async()=>{await clearMeasurements();setMetrics(null);})}>Borrar mediciones</button></div></section></div>
    <footer>Sin servidor biométrico · Sin prueba de vida · Sin precisión validada<br/>Para probar offline: prepara en la versión compilada, recarga hasta que la PWA controle la página y desconecta la red. Recargar elimina perfiles; vuelve a registrarlos localmente.</footer>
  </main>;
}
createRoot(document.getElementById('root')!).render(<App/>);
