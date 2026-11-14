import pg from 'pg';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const after=process.argv.includes('--after');
const c=new pg.Client({host:'localhost',port:5432,database:'asistencia_facial_sandbox',user:'asistencia_migrator'});
const out={tables:{},historicalOutsideEpisode:after?0:null};
try{
 await c.connect();
 const {rows:[r]}=await c.query('SELECT current_database() AS db,current_user AS role');
 assert.equal(r.db,'asistencia_facial_sandbox');assert.equal(r.role,'asistencia_migrator');
 await c.query('BEGIN');
 await c.query('ALTER TABLE institutions NO FORCE ROW LEVEL SECURITY');
 const tenants=(await c.query('SELECT id FROM institutions ORDER BY id')).rows;
 await c.query('ALTER TABLE institutions FORCE ROW LEVEL SECURITY');
 for(const table of ['enrollments','attendances','attendance_corrections','audit_events']){
  const rows=[];
  for(const t of tenants){
   await c.query("SELECT set_config('app.institution_id',$1,true)",[t.id]);
   rows.push(...(await c.query(`SELECT (to_jsonb(x)-'enrollment_id'-'transition_txid') AS row FROM ${table} x ORDER BY institution_id,id`)).rows.map(x=>x.row));
  }
  out.tables[table]={count:rows.length,sha256:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }
 if(after)for(const t of tenants){
   await c.query("SELECT set_config('app.institution_id',$1,true)",[t.id]);
   out.historicalOutsideEpisode+=Number((await c.query("SELECT count(*) AS n FROM attendances a JOIN enrollments e ON e.institution_id=a.institution_id AND e.id=a.enrollment_id WHERE NOT(a.occurred_at_client <@ tstzrange(e.starts_at,e.ends_at,'[)'))")).rows[0].n);
 }
 await c.query('ROLLBACK');
 if(after){const before=JSON.parse(readFileSync(new URL('../../../../docs/evidencias/preservation-before.json',import.meta.url)));assert.deepEqual(out.tables,before.tables);out.preserved=true;}
 writeFileSync(new URL('../../../../docs/evidencias/preservation-'+(after?'after':'before')+'.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
 console.log(JSON.stringify(out));
}finally{await c.query('ROLLBACK').catch(()=>{});await c.end();}
