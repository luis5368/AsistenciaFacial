// No aplica DDL de dominio: verifica replay exacto antes de registrar ambas migraciones.
import pg from 'pg';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
if(process.argv[2]!=='--record')throw new Error('Requiere --record; solo sandbox.');
const names=['20261113000000_initial_review','20261114000000_corrections_enrollment_episodes'];
const backend=fileURLToPath(new URL('../../',import.meta.url));
const cli=fileURLToPath(new URL('../../../../node_modules/prisma/build/index.js',import.meta.url));
const c=new pg.Client({host:'localhost',port:5432,database:'asistencia_facial_sandbox',user:'asistencia_migrator'});
const evidence={verified:false,commands:[],history:[]};
function run(args){
 const r=spawnSync(process.execPath,[cli,...args],{cwd:backend,env:{...process.env,PRISMA_SANDBOX:'1',DEBUG:'',CHECKPOINT_DISABLE:'1'},encoding:'utf8',timeout:30000});
 // No imprimir salida de CLI que pudiera incluir configuración sensible.
 evidence.commands.push({args,exitCode:r.status});
 if(r.status!==0)throw new Error('PRISMA_CLI_FAILED');
}
try{
 const replay=spawnSync(process.execPath,[fileURLToPath(new URL('verify-replay.mjs',import.meta.url)),'--final'],{encoding:'utf8',timeout:30000});
 assert.equal(replay.status,0,'REPLAY_FAILED');
 const proof=JSON.parse(readFileSync(new URL('../../../../docs/evidencias/prisma-replay-final.json',import.meta.url)));
 assert.equal(proof.verified,true);assert.equal(proof.temporarySchemaAbsent,true);
 await c.connect();
 const {rows:[r]}=await c.query('SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port');
 assert.equal(r.db,'asistencia_facial_sandbox');assert.equal(r.role,'asistencia_migrator');assert.ok(['::1','127.0.0.1'].includes(r.host));assert.equal(r.port,5432);
 const exists=(await c.query("SELECT to_regclass('public._prisma_migrations') AS x")).rows[0].x;
 const history=exists?(await c.query('SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY started_at')).rows:[];
 for(const row of history){
  assert.ok(names.includes(row.migration_name),'UNEXPECTED_HISTORY');assert.ok(row.finished_at&&!row.rolled_back_at,'INCOMPLETE_HISTORY');
  assert.equal(history.filter(x=>x.migration_name===row.migration_name).length,1,'DUPLICATE_HISTORY');
  const sql=readFileSync(new URL('../../prisma/migrations/'+row.migration_name+'/migration.sql',import.meta.url));
  assert.equal(row.checksum,createHash('sha256').update(sql).digest('hex'),'CHECKSUM_MISMATCH');
 }
 for(const name of names)if(!history.some(x=>x.migration_name===name))run(['migrate','resolve','--applied',name]);
 run(['migrate','status']);
 evidence.history=(await c.query('SELECT migration_name,checksum,finished_at,rolled_back_at,applied_steps_count FROM _prisma_migrations ORDER BY started_at')).rows;
 assert.equal(evidence.history.length,2);
 for(const row of evidence.history){
  assert.ok(row.finished_at&&!row.rolled_back_at);
  assert.equal(row.checksum,proof.migrations.find(x=>x.name===row.migration_name).sha256);
 }
 const app=new pg.Client({host:'localhost',port:5432,database:'asistencia_facial_sandbox',user:'asistencia_app'});
 try{
  await app.connect();let denied;
  try{await app.query('SELECT migration_name FROM _prisma_migrations');}catch(e){denied=e.code;}
  assert.equal(denied,'42501');evidence.applicationHistoryReadDenied=true;
 }finally{await app.end();}
 evidence.verified=true;
}catch(e){evidence.error=e.message;process.exitCode=1;}
finally{await c.end().catch(()=>{});writeFileSync(new URL('../../../../docs/evidencias/prisma-baseline-resultados.json',import.meta.url),JSON.stringify(evidence,null,2)+'\n');console.log(JSON.stringify(evidence));}
