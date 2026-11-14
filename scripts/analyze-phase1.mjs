// Read-only analysis of the four private originals; emits aggregate data only.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const names = ['mediciones-fase-1.json','mediciones-fase-2.json','mediciones-fase-3.json','mediciones-fase-4 sin red.json'];
const canonical = value => JSON.stringify(value, Object.keys(value).sort());
const tally = (rows, key) => rows.reduce((out,row) => { const v=String(row[key]); out[v]=(out[v]??0)+1; return out; }, {});
function stats(values) {
  const v=values.filter(x=>typeof x==='number' && Number.isFinite(x)).sort((a,b)=>a-b);
  if (!v.length) return null;
  return {n:v.length,mean:v.reduce((a,b)=>a+b,0)/v.length,min:v[0],max:v.at(-1),median:v.length%2?v[(v.length-1)/2]:(v[v.length/2-1]+v[v.length/2])/2,p95NearestRank:v[Math.ceil(.95*v.length)-1]};
}
let previous=[], total=0;
const files=[];
for(const name of names) {
  const raw=await readFile(new URL(`../Puebas/${name}`,import.meta.url));
  const report=JSON.parse(raw.toString('utf8').replace(/^\uFEFF/,''));
  const rows=report.measurements;
  if(!Array.isArray(rows))throw Error(`Sin measurements: ${name}`);
  if(previous.length>rows.length || !previous.every((row,i)=>canonical(row)===canonical(rows[i])))throw Error(`No es prefijo exacto: ${name}. Requiere conciliación manual; no se deduplica por similitud.`);
  const block=rows.slice(previous.length);
  const executed=block.filter(r=>r.operation==='recognition' && r.comparisonStatus==='executed');
  files.push({name,sha256:createHash('sha256').update(raw).digest('hex'),model:report.modelVersion,rows:rows.length,overlap:previous.length,newRows:block.length,range:[previous.length+1,rows.length],operation:tally(block,'operation'),outcome:tally(block,'outcome'),scenario:tally(block,'scenario'),humanReview:tally(block,'humanReview'),offlineDeclared:tally(block,'offlineTestDeclared'),onlineStart:tally(block,'browserOnlineAtStart'),onlineEnd:tally(block,'browserOnlineAtEnd'),sw:tally(block,'serviceWorkerControlled'),executed:executed.length,threshold:tally(executed,'thresholdApplied'),comparedCount:tally(executed,'comparedCount'),margin:tally(executed,'ambiguityMargin'),cosine:stats(executed.map(r=>r.bestCosine)),detectionMs:stats(executed.map(r=>r.detectionMs)),embeddingMs:stats(executed.map(r=>r.embeddingMs)),comparisonMs:stats(executed.map(r=>r.comparisonMs)),pipelineMs:stats(executed.map(r=>r.detectionMs+r.embeddingMs+r.comparisonMs)),zeroComparison:executed.filter(r=>r.comparisonMs===0).length});
  total+=rows.length;previous=rows;
}
console.log(JSON.stringify({method:'Exact ordered full-row prefixes (canonical key order), no deduplication within blocks',totalRowsInFiles:total,uniqueRows:previous.length,overlappingRows:total-previous.length,uniqueOperation:tally(previous,'operation'),uniqueOutcome:tally(previous,'outcome'),files},null,2));
