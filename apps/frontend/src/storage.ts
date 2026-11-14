import Dexie, { type EntityTable } from 'dexie';
import { publicMeasurement, type Measurement, type HumanReview } from './measurement';
export type { Measurement } from './measurement';
const db = new Dexie('asistencia-facial-lab-metrics') as Dexie & { measurements: EntityTable<Measurement,'id'> };
db.version(1).stores({ measurements:'++id,at,kind' });
export async function recordMeasurement(row: Measurement) {
  return db.transaction('rw',db.measurements,async()=>{
    const id = await db.measurements.add({ ...publicMeasurement(row), schemaVersion: 2, kind: row.kind } as Measurement);
    const excess=await db.measurements.count()-100;
    if(excess>0) await db.measurements.orderBy('id').limit(excess).delete();
    return id;
  });
}
export async function exportMeasurements() { return db.measurements.toArray(); }
export async function clearMeasurements() {await db.measurements.clear();}
export async function reviewMeasurement(id: number, review: HumanReview) {
  const row = await db.measurements.get(id);
  if (!row || row.operation !== 'recognition' || row.comparisonStatus !== 'executed') throw new Error('No hay comparación guardada para revisar.');
  const allowed = row.outcome === 'candidate'
    ? ['not_reviewed', 'correct_candidate', 'incorrect_candidate', 'inconclusive']
    : ['not_reviewed', 'correct_rejection', 'incorrect_rejection', 'inconclusive'];
  if (!allowed.includes(review)) throw new Error('Revisión incompatible con el resultado.');
  await db.measurements.update(id, { humanReview: review });
}

const CACHE='af-public-models-v1';
type Manifest={models:{file:string;sha256:string;bytes:number}[];runtimeAssets:string[]};
export async function prepareResources(progress:(message:string)=>void) {
  const response=await fetch('/models/manifest.json?download=1',{cache:'no-store'});
  if(!response.ok) throw new Error('Falta manifest de modelos; ejecutar npm run assets');
  const manifest: Manifest=await response.json();
  const cache=await caches.open(CACHE);
  for(const asset of [...manifest.models.map(m=>`/models/${m.file}`),...manifest.runtimeAssets]) {
    progress(`Preparando ${asset.split('/').at(-1)}`);
    let resource=await cache.match(asset);
    if(!resource) resource=await fetch(`${asset}?download=1`,{cache:'no-store'});
    if(!resource.ok) throw new Error(`Recurso no disponible: ${asset}`);
    const bytes=await resource.clone().arrayBuffer();
    const model=manifest.models.find(m=>asset.endsWith(m.file));
    if(model) {
      const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==model.sha256||bytes.byteLength!==model.bytes) {await cache.delete(asset);throw new Error(`Integridad incorrecta: ${model.file}`);}
    }
    // Local immutable assets: omit transport Vary/encoding headers from Vite.
    // Module imports send Origin whereas a regular fetch may not; Vary: Origin
    // otherwise makes an already downloaded module miss CacheOnly.
    await cache.put(asset,new Response(bytes,{headers:{'Content-Type':resource.headers.get('Content-Type')||'application/octet-stream'}}));
  }
  await cache.put('/models/manifest.json',new Response(JSON.stringify(manifest),{headers:{'Content-Type':'application/json'}}));
}
export async function resourcesAvailable() {
  const cache=await caches.open(CACHE),response=await cache.match('/models/manifest.json');
  if(!response) return false;
  const manifest: Manifest=await response.json();
  for(const asset of [...manifest.models.map(m=>`/models/${m.file}`),...manifest.runtimeAssets]) if(!await cache.match(asset)) return false;
  return true;
}
