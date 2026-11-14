import {extraTests} from './corrections-cases.mjs';
// Ensayo explícito: nunca carga .env ni acepta URLs/destinos externos.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { writeFileSync } from 'node:fs';
import pg from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../../dist/generated/prisma/client.js';
import { withInstitution } from '../../dist/infrastructure/database.js';
import { attendanceHash, classifyReplay } from '../../dist/domain/attendance.js';

if (process.argv[2] !== '--run-sandbox') throw new Error('Requiere --run-sandbox explícito.');
const config = user => ({ host: 'localhost', port: 5432, database: 'asistencia_facial_sandbox', user,
  connectionTimeoutMillis: 5000, statement_timeout: 10000, application_name: 'asistencia_fase2_sandbox' });
const report = { runId: randomUUID(), startedAt: new Date().toISOString(), database: 'asistencia_facial_sandbox',
  tests: [], findings: [], inventory: {} };
const clients = [];
const output = new URL('../../../../docs/evidencias/ensayo-postgresql-correcciones-resultados.json', import.meta.url);
let prisma;
async function connect(role) {
  assert.ok(['asistencia_app','asistencia_migrator'].includes(role));
  const c = new pg.Client(config(role)); clients.push(c); await c.connect();
  const { rows: [r] } = await c.query(`SELECT current_database() AS db,current_user AS role,
    host(inet_server_addr()) AS host,inet_server_port() AS port,current_setting('server_version') AS version,
    rolsuper,rolbypassrls FROM pg_roles WHERE rolname=current_user`);
  assert.equal(r.db, config(role).database); assert.equal(r.role, role);
  assert.ok(['::1','127.0.0.1'].includes(r.host)); assert.equal(r.port,5432); assert.equal(r.version,'18.6');
  assert.equal(r.rolsuper,false); assert.equal(r.rolbypassrls,false);
  return c;
}
async function tx(c, tenant, operation, commit = true) {
  await c.query('BEGIN');
  try {
    if (tenant) await c.query("SELECT set_config('app.institution_id',$1,true)",[tenant]);
    const result = await operation(c);
    await c.query(commit ? 'COMMIT' : 'ROLLBACK'); return result;
  } catch (e) { await c.query('ROLLBACK'); throw e; }
}
async function test(name, fn) {
  try { const detail = await fn(); report.tests.push({ name, status:detail?.acceptedUnexpectedly ? 'finding' : 'passed', ...(detail ? {detail} : {}) }); }
  catch (e) { report.tests.push({name,status:'failed',code:e.code ?? e.name}); throw e; }
}
async function denied(c, tenant, sql, args, code, constraint) {
  let error;
  try { await tx(c,tenant,async()=>{ await c.query(sql,args); },false); } catch(e){error=e;}
  assert.ok(error,'Operación inesperadamente permitida'); assert.equal(error.code,code);
  if(constraint) assert.equal(error.constraint,constraint);
  return {sqlstate:error.code,...(error.constraint ? {constraint:error.constraint} : {})};
}
function ids() { return Object.fromEntries(['institution','user','student','group','enrollment','session','device','attendance','event'].map(k=>[k,randomUUID()])); }
const A=ids(), B=ids();
const time='2026-11-13T12:00:00.000Z';
const event = (x, eventId=x.event, sessionId=x.session) => ({schema_version:1,event_uuid:eventId,student_id:x.student,
  session_id:sessionId,device_id:x.device,occurred_at_client:time,method:'manual'});
const hash = (x,e=event(x))=>attendanceHash(e,{institutionId:x.institution,userId:x.user});
const insertAttendance = `INSERT INTO attendances(institution_id,id,event_uuid,student_id,group_id,session_id,device_id,created_by,payload_hash,occurred_at_client,enrollment_id)
 VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`;
const attendanceArgs=(x,id=x.attendance,ev=x.event,session=x.session)=>[x.institution,id,ev,x.student,x.group,session,x.device,x.user,hash(x,event(x,ev,session)),time,x.enrollment];
async function fixture(c,x) {
  await tx(c,x.institution,async()=>{
    await c.query('INSERT INTO institutions(id,name) VALUES($1,$2)',[x.institution,'INSTITUCION FICTICIA '+report.runId]);
    await c.query(`INSERT INTO users(institution_id,id,email,password_hash,role) VALUES($1,$2,$3,'DISABLED_TEST_ACCOUNT','ADMIN')`,[x.institution,x.user,`${x.user}@example.invalid`]);
    await c.query(`INSERT INTO students(institution_id,id,student_code,full_name) VALUES($1,$2,'FICTICIO','ESTUDIANTE FICTICIO')`,[x.institution,x.student]);
    await c.query(`INSERT INTO groups(institution_id,id,grade,section,school_year) VALUES($1,$2,'FICTICIO','A',2026)`,[x.institution,x.group]);
    await c.query(`INSERT INTO enrollments(institution_id,id,student_id,group_id,starts_at) VALUES($1,$2,$3,$4,'2026-01-01Z')`,[x.institution,x.enrollment,x.student,x.group]);
    await c.query(`INSERT INTO class_sessions(institution_id,id,group_id,starts_at,ends_at,status) VALUES($1,$2,$3,'2026-11-13T11:00Z','2026-11-13T13:00Z','OPEN')`,[x.institution,x.session,x.group]);
    await c.query(`INSERT INTO devices(institution_id,id,assigned_user_id,expires_at) VALUES($1,$2,$3,'2026-12-01Z')`,[x.institution,x.device,x.user]);
  });
}
try {
  const migrator = await connect('asistencia_migrator'), app = await connect('asistencia_app');
  await test('Conexiones reales separadas y propietario',async()=>{
    const {rows:[r]}=await migrator.query('SELECT pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()');
    assert.equal(r.owner,'asistencia_migrator');
    return {migrator:'asistencia_migrator',application:'asistencia_app',owner:r.owner};
  });
  await test('Inventario físico completo',async()=>{
    const queries={
      tables:`SELECT c.relname,pg_get_userbyid(c.relowner) AS owner,c.relrowsecurity,c.relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r' AND c.relname<>'_prisma_migrations' ORDER BY c.relname`,
      enums:`SELECT t.typname,e.enumlabel FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace JOIN pg_enum e ON e.enumtypid=t.oid WHERE n.nspname='public' ORDER BY t.typname,e.enumsortorder`,
      constraints:`SELECT conname,contype,pg_get_constraintdef(oid) AS definition FROM pg_constraint WHERE connamespace='public'::regnamespace ORDER BY conname`,
      indexes:`SELECT indexname,indexdef FROM pg_indexes WHERE schemaname='public' AND tablename<>'_prisma_migrations' ORDER BY indexname`,
      triggers:`SELECT tgname,pg_get_triggerdef(t.oid) AS definition FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace='public'::regnamespace AND NOT t.tgisinternal ORDER BY tgname`,
      policies:`SELECT tablename,policyname,qual,with_check FROM pg_policies WHERE schemaname='public' ORDER BY tablename`,
      functions:`SELECT proname FROM pg_proc WHERE pronamespace='public'::regnamespace ORDER BY proname`};
    for(const [k,q] of Object.entries(queries)) report.inventory[k]=(await migrator.query(q)).rows;
    const i=report.inventory;
    assert.equal(i.tables.length,14); assert.ok(i.tables.every(t=>t.owner==='asistencia_migrator'&&t.relrowsecurity&&t.relforcerowsecurity));
    assert.equal(new Set(i.enums.map(x=>x.typname)).size,6);
    assert.equal(i.constraints.filter(x=>x.contype==='f').length,20);
    assert.equal(i.constraints.filter(x=>x.contype==='c').length,12);
    assert.equal(i.indexes.length,41); assert.equal(i.triggers.length,9); assert.equal(i.policies.length,14); assert.equal(i.functions.length,8);
  });
  await test('Dos instituciones ficticias creadas con app',async()=>{await fixture(app,A);await fixture(app,B);});
  await test('Sin contexto: cero filas para app y migrador bajo FORCE RLS',async()=>{
    for(const c of [app,migrator]) assert.equal((await c.query('SELECT * FROM institutions')).rowCount,0);
  });
  await test('INSERT sin contexto denegado por RLS',()=>denied(app,null,'INSERT INTO institutions(id,name) VALUES($1,$2)',[randomUUID(),'FICTICIA'],'42501'));
  await test('A no ve ni modifica B; ambos roles están sujetos a RLS',async()=>{
    for(const c of [app,migrator]) await tx(c,A.institution,async()=>{
      assert.equal((await c.query('SELECT id FROM institutions WHERE id=$1',[B.institution])).rowCount,0);
      assert.equal((await c.query('SELECT id FROM institutions WHERE id=$1',[A.institution])).rowCount,1);
      assert.equal((await c.query("UPDATE students SET full_name='NO DEBE CAMBIAR' WHERE institution_id=$1",[B.institution])).rowCount,0);
    });
  });
  await test('INSERT cruzado denegado por RLS',()=>denied(app,A.institution,
    "INSERT INTO students(institution_id,id,student_code,full_name) VALUES($1,$2,'OTRO','FICTICIO')",[B.institution,randomUUID()],'42501'));
  await test('FK impide referencia a estudiante de otro colegio',()=>denied(app,A.institution,
    'INSERT INTO enrollments(institution_id,id,student_id,group_id,starts_at) VALUES($1,$2,$3,$4,$5)',
    [A.institution,randomUUID(),B.student,A.group,time],'23503'));
  await test('CHECK rechaza periodo invertido',()=>denied(app,A.institution,
    'INSERT INTO class_sessions(institution_id,id,group_id,starts_at,ends_at) VALUES($1,$2,$3,$4,$4)',[A.institution,randomUUID(),A.group,time],'23514','sessions_valid_period'));
  await test('Prisma real: pool de una conexión no conserva contexto tras commit/rollback',async()=>{
    prisma=new PrismaClient({adapter:new PrismaPg({...config('asistencia_app'),max:1})});
    const [{db,role}]=await prisma.$queryRawUnsafe('SELECT current_database() AS db,current_user AS role');
    assert.equal(db,'asistencia_facial_sandbox');assert.equal(role,'asistencia_app');
    let pid;
    await withInstitution(prisma,A.institution,async p=>{
      pid=(await p.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid;
      assert.equal((await p.institution.findUnique({where:{id:A.institution}})).id,A.institution);
      assert.equal(await p.institution.findUnique({where:{id:B.institution}}),null);
    });
    assert.equal((await prisma.$queryRawUnsafe('SELECT pg_backend_pid() AS pid'))[0].pid,pid);
    assert.equal(await prisma.institution.count(),0);
    await assert.rejects(withInstitution(prisma,B.institution,async p=>{
      assert.equal((await p.institution.findUnique({where:{id:B.institution}})).id,B.institution);throw new Error('rollback controlado');
    }));
    assert.equal(await prisma.institution.count(),0);
    return {sameBackendPid:pid,withoutContextCount:0};
  });
  await test('Registro real y reintento con hash canónico',async()=>{
    await tx(app,A.institution,()=>app.query(insertAttendance,attendanceArgs(A)));
    await tx(app,A.institution,async()=>{
      const {rows:[r]}=await app.query('SELECT payload_hash FROM attendances WHERE institution_id=$1 AND event_uuid=$2',[A.institution,A.event]);
      assert.equal(classifyReplay(r.payload_hash,hash(A)),'already_accepted');
      assert.equal(classifyReplay(r.payload_hash,hash(A,{...event(A),occurred_at_client:'2026-11-13T12:01:00.000Z'})),'needs_review');
      assert.equal((await app.query('SELECT id FROM attendances WHERE institution_id=$1',[A.institution])).rowCount,1);
    });
  });
  await test('UUID duplicado rechazado por índice',()=>denied(app,A.institution,insertAttendance,attendanceArgs(A,randomUUID()),'23505','attendances_institution_id_event_uuid_key'));
  await test('Asistencia activa única con otro UUID',()=>denied(app,A.institution,insertAttendance,attendanceArgs(A,randomUUID(),randomUUID()),'23505','attendances_one_active_per_session'));
  await test('Corrección sin auditoría falla al COMMIT y revierte',async()=>{
    let code;
    try { await tx(app,A.institution,()=>app.query("UPDATE attendances SET status='VOID',version=2 WHERE institution_id=$1 AND id=$2",[A.institution,A.attendance])); } catch(e){code=e.code;}
    assert.equal(code,'P0001');
    const r=await tx(app,A.institution,async()=> (await app.query('SELECT status,version FROM attendances WHERE institution_id=$1 AND id=$2',[A.institution,A.attendance])).rows[0]);
    assert.deepEqual(r,{status:'ACTIVE',version:1});return {sqlstate:code};
  });
  let correctionId;
  await test('Corrección y auditoría consistentes confirman',async()=>{
    correctionId=randomUUID();
    await tx(app,A.institution,async()=>{
      const r=await app.query("UPDATE attendances SET status='VOID',version=2 WHERE institution_id=$1 AND id=$2 AND version=1",[A.institution,A.attendance]);assert.equal(r.rowCount,1);
      await app.query(`INSERT INTO attendance_corrections(institution_id,id,attendance_id,actor_id,from_version,to_version,from_status,to_status,reason)
        VALUES($1,$2,$3,$4,1,2,'ACTIVE','VOID','REGISTRATION_ERROR')`,[A.institution,correctionId,A.attendance,A.user]);
      await app.query(`INSERT INTO audit_events(institution_id,id,actor_id,action,resource_type,resource_id)
        VALUES($1,$2,$3,'attendance.corrected','attendance_correction',$4)`,[A.institution,randomUUID(),A.user,correctionId]);
    });
    await tx(app,A.institution,async()=>{
      const {rows:[r]}=await app.query('SELECT status,version FROM attendances WHERE id=$1',[A.attendance]);assert.deepEqual(r,{status:'VOID',version:2});
      assert.equal((await app.query("UPDATE attendances SET status='ACTIVE',version=2 WHERE id=$1 AND version=1",[A.attendance])).rowCount,0);
    });
  });
  for(const [name,sql] of [
    ['CREATE TABLE','CREATE TABLE public.forbidden_probe(id int)'],
    ['DROP TABLE','DROP TABLE audit_events'],
    ['ALTER TABLE','ALTER TABLE audit_events ADD COLUMN forbidden_probe int'],
    ['TRUNCATE historial','TRUNCATE audit_events'],
    ['DELETE auditoría','DELETE FROM audit_events'],
    ['UPDATE auditoría',"UPDATE audit_events SET action='forbidden'"],
    ['DELETE correcciones','DELETE FROM attendance_corrections'],
    ['UPDATE correcciones',"UPDATE attendance_corrections SET reason='REVIEW_CONFIRMED'"]]) {
    await test('App bloqueada: '+name,()=>denied(app,A.institution,sql,[],'42501'));
  }
  await test('Migrador puede DDL en sandbox; rollback no deja tabla',async()=>{
    await tx(migrator,null,()=>migrator.query('CREATE TABLE public.migrator_probe(id int)'),false);
    assert.equal((await migrator.query("SELECT to_regclass('public.migrator_probe') AS x")).rows[0].x,null);
  });
  await test('Trigger protege auditoría incluso frente a UPDATE del dueño',()=>denied(migrator,A.institution,"UPDATE audit_events SET action='forbidden'",[],'P0001'));
  await test('Contenido original inmutable también para migrador',()=>denied(migrator,A.institution,
    'UPDATE attendances SET event_uuid=$1 WHERE institution_id=$2 AND id=$3',[randomUUID(),A.institution,A.attendance],'P0001'));
  const episode2=randomUUID();
  await test('Reinscripcion conserva episodio previo y admite intervalo contiguo',async()=>{
    await tx(app,A.institution,async()=>{
      await app.query("UPDATE enrollments SET ends_at='2026-11-14Z' WHERE id=$1",[A.enrollment]);
      await app.query("INSERT INTO enrollments(institution_id,id,student_id,group_id,starts_at,ends_at) VALUES($1,$2,$3,$4,'2026-11-14Z','2026-12-01Z')",[A.institution,episode2,A.student,A.group]);
      assert.equal((await app.query('SELECT id FROM enrollments WHERE student_id=$1 AND group_id=$2',[A.student,A.group])).rowCount,2);
      assert.equal((await app.query('SELECT enrollment_id FROM attendances WHERE id=$1',[A.attendance])).rows[0].enrollment_id,A.enrollment);
    });
  });
  await test('Fallo de transacción revierte escritura previa',async()=>{
    const newStudent=randomUUID();let code;
    try{await tx(app,A.institution,async()=>{
      await app.query("INSERT INTO students(institution_id,id,student_code,full_name) VALUES($1,$2,'ROLLBACK','FICTICIO')",[A.institution,newStudent]);
      await app.query('SELECT 1/0');
    });}catch(e){code=e.code;}
    assert.equal(code,'22012');
    assert.equal(await tx(migrator,A.institution,async()=> (await migrator.query('SELECT id FROM students WHERE id=$1',[newStudent])).rowCount),0);
    return {sqlstate:code};
  });
  for(const sameUuid of [true,false]) await test('Concurrencia: '+(sameUuid?'mismo UUID':'misma asistencia activa'),async()=>{
    const session=randomUUID(), ev=randomUUID();
    await tx(app,B.institution,()=>app.query("INSERT INTO class_sessions(institution_id,id,group_id,starts_at,ends_at) VALUES($1,$2,$3,'2026-11-13T14:00Z','2026-11-13T15:00Z')",[B.institution,session,B.group]));
    const c1=await connect('asistencia_app'),c2=await connect('asistencia_app');
    const outcomes=await Promise.allSettled([c1,c2].map((c,index)=>tx(c,B.institution,()=>c.query(insertAttendance,attendanceArgs(B,randomUUID(),sameUuid?ev:randomUUID(),session)))));
    assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
    const rejection=outcomes.find(x=>x.status==='rejected');assert.equal(rejection.reason.code,'23505');
    assert.equal(await tx(app,B.institution,async()=> (await app.query('SELECT id FROM attendances WHERE session_id=$1',[session])).rowCount),1);
    return {commits:1,rejected:1,sqlstate:rejection.reason.code,constraint:rejection.reason.constraint};
  });
  await extraTests({app,migrator,A,B,episode2,tx,test,denied,connect,insertAttendance,attendanceArgs,randomUUID,assert});

} catch(e) {
  report.error={code:e.code ?? e.name, ...(e.name==='AssertionError' ? {assertion:e.message} : {})};process.exitCode=1;
} finally {
  if(prisma) await prisma.$disconnect();
  await Promise.allSettled(clients.map(c=>c.end()));
  report.finishedAt=new Date().toISOString();
  report.acceptance=report.findings.length ? 'blocked' : report.error ? 'failed' : 'passed';
  if(report.findings.length && !process.exitCode) process.exitCode=2;
  writeFileSync(output,JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({tests:report.tests,findings:report.findings,error:report.error},null,2));
}
