// Datos sintéticos efímeros. No carga entorno ni abre conexiones.
import { performance } from 'node:perf_hooks';
import { writeFileSync } from 'node:fs';
import { PasswordHasher, ARGON_PROFILE } from '../dist/modules/auth/password.js';
const hasher = new PasswordHasher();
const password = 'Synthetic benchmark only, not an account';
await hasher.hash(password);
const before = process.memoryUsage().rss;
const samples = [];
for (let i=0;i<10;i++) {
  let start=performance.now();const hash=await hasher.hash(password);
  const hashMs=performance.now()-start;start=performance.now();
  if(!await hasher.verify(hash,password))throw Error('Verification failed');
  samples.push({hashMs,verifyMs:performance.now()-start});
}
const report={observedAt:new Date().toISOString(),node:process.version,platform:process.platform,
  profile:ARGON_PROFILE,samples,meanHashMs:samples.reduce((s,x)=>s+x.hashMs,0)/samples.length,
  meanVerifyMs:samples.reduce((s,x)=>s+x.verifyMs,0)/samples.length,
  rssBeforeBytes:before,rssAfterBytes:process.memoryUsage().rss,
  limitation:'RSS is process-wide, not peak Argon memory. Sequential local samples; no load benchmark.'};
writeFileSync(new URL('../../../docs/evidencias/fase-3-argon2-mediciones.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({meanHashMs:report.meanHashMs,meanVerifyMs:report.meanVerifyMs}));
