import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const candidate=process.argv.includes('--candidate');
const model=process.argv.includes('--model');
const final=process.argv.includes('--final') || candidate || model;
const c=new pg.Client({host:'localhost',port:5432,database:'asistencia_facial_sandbox',user:'asistencia_migrator',connectionTimeoutMillis:5000});
const report={stage:model?'model':candidate?'candidate':final?'final':'initial',verified:false,migrations:[]};
const probe='phase2_replay_check';
const root=new URL('../../prisma/migrations/',import.meta.url);
const normalize=x=>JSON.stringify(x).replaceAll('"'+probe+'".','').replaceAll(probe+'.','').replaceAll('public.','').replaceAll(probe,'public');
async function fingerprint(schema) {
 const results={};
 const queries={
 tables:`SELECT c.relname,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relkind='r' AND c.relname<>'_prisma_migrations' ORDER BY c.relname`,
 columns:`SELECT c.relname,a.attname,format_type(a.atttypid,a.atttypmod) AS type,a.attnotnull,pg_get_expr(d.adbin,d.adrelid) AS default_value FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum WHERE n.nspname=$1 AND c.relkind='r' AND c.relname<>'_prisma_migrations' AND a.attnum>0 AND NOT a.attisdropped ORDER BY c.relname,a.attname`,
 constraints:`SELECT c.relname,k.conname,k.contype,pg_get_constraintdef(k.oid) AS definition FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND c.relname<>'_prisma_migrations' ORDER BY c.relname,k.conname`,
 indexes:`SELECT tablename,indexname,indexdef FROM pg_indexes WHERE schemaname=$1 AND tablename<>'_prisma_migrations' ORDER BY tablename,indexname`,
 triggers:`SELECT c.relname,t.tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname=$1 AND NOT t.tgisinternal ORDER BY c.relname,t.tgname`,
 functions:`SELECT p.proname,pg_get_functiondef(p.oid) AS definition FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname=$1 ORDER BY p.proname`,
 enums:`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname=$1 ORDER BY t.typname,e.enumsortorder`,
 policies:`SELECT tablename,policyname,permissive,roles,cmd,qual,with_check FROM pg_policies WHERE schemaname=$1 ORDER BY tablename,policyname`};
 for(const [k,q] of Object.entries(queries))results[k]=(await c.query(q,[schema])).rows;
 return results;
}
try {
 await c.connect();
 const {rows:[r]}=await c.query("SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port");
 assert.equal(r.db,'asistencia_facial_sandbox');assert.equal(r.role,'asistencia_migrator');assert.ok(['::1','127.0.0.1'].includes(r.host));assert.equal(r.port,5432);
 assert.equal((await c.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[probe])).rowCount,0);
 if(!final)assert.equal((await c.query("SELECT to_regclass('public._prisma_migrations') AS x")).rows[0].x,null);
 await c.query('BEGIN');
 await c.query('SET LOCAL statement_timeout=30000');
 if(candidate) {
   const corrective=readFileSync(new URL('20261114000000_corrections_enrollment_episodes/migration.sql',root),'utf8');
   await c.query(corrective.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,''));
 }
 await c.query('CREATE SCHEMA '+probe);
 await c.query('SET LOCAL search_path TO '+probe+',pg_catalog');
 if(model) {
   const result=spawnSync(process.execPath,[fileURLToPath(new URL('../../../../node_modules/prisma/build/index.js',import.meta.url)),
     'migrate','diff','--from-empty','--to-schema','prisma/schema.prisma','--script'],
     {cwd:fileURLToPath(new URL('../../',import.meta.url)),encoding:'utf8',env:{...process.env,PRISMA_SANDBOX:'',DEBUG:''}});
   assert.equal(result.status,0);assert.match(result.stdout,/CREATE TABLE/);
   await c.query(result.stdout);
 }
 for(const name of (model?[]:readdirSync(root).filter(n=>/^\d/.test(n)).sort())) {
   if(!final && name!=='20261113000000_initial_review')continue;
   const sql=readFileSync(new URL(name+'/migration.sql',root),'utf8');
   report.migrations.push({name,sha256:createHash('sha256').update(sql).digest('hex')});
   // Solo se retiran delimitadores externos para ejecutar todo bajo ROLLBACK.
   await c.query(sql.replace(/^BEGIN;\s*$/m,'').replace(/COMMIT;\s*$/,''));
 }
 await c.query('SET LOCAL search_path TO public,pg_catalog');
 const actual=await fingerprint('public'),expected=await fingerprint(probe);
 if(model) {
  for(const x of [actual,expected]){
    x.tables=x.tables.map(t=>({relname:t.relname}));
    x.constraints=x.constraints.filter(c=>['p','f'].includes(c.contype));
    delete x.functions;delete x.triggers;delete x.policies;
  }
  actual.indexes=actual.indexes.filter(i=>!['attendances_one_active_per_session','audit_one_per_correction'].includes(i.indexname));
 }
 report.counts=Object.fromEntries(Object.entries(actual).map(([k,v])=>[k,v.length]));
 for(const key of Object.keys(actual)) {
   if(normalize(actual[key])!==normalize(expected[key])) {
     report.mismatch={category:key,actual:actual[key],expected:expected[key]};throw new Error('SCHEMA_MISMATCH');
   }
 }
 report.verified=true;
 report.fingerprint=createHash('sha256').update(normalize(actual)).digest('hex');
 await c.query('ROLLBACK');
 report.temporarySchemaAbsent=(await c.query('SELECT 1 FROM pg_namespace WHERE nspname=$1',[probe])).rowCount===0;
}catch(e){await c.query('ROLLBACK').catch(()=>{});report.error=e.code??e.message;process.exitCode=1;}
finally{await c.end();writeFileSync(new URL('../../../../docs/evidencias/prisma-replay-'+report.stage+'.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({...report,mismatch:report.mismatch?{category:report.mismatch.category}:undefined}));}
