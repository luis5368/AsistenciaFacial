import {attendanceHash} from '../../dist/domain/attendance.js';
export async function extraTests(h) {
 const {app,migrator,A,episode2,tx,test,denied,connect,insertAttendance,attendanceArgs,randomUUID,assert}=h;
 const setDate=(args,date)=>{
  args[9]=date;
  args[8]=attendanceHash({schema_version:1,event_uuid:args[2],student_id:args[3],session_id:args[5],device_id:args[6],occurred_at_client:date,method:'manual'},
   {institutionId:args[0],userId:args[7]});
 };
 const correction=`INSERT INTO attendance_corrections(institution_id,id,attendance_id,actor_id,from_version,to_version,from_status,to_status,reason)
  VALUES($1,$2,$3,$4,$5,$6,$7,$8,'REVIEW_CONFIRMED')`;
 const audit=`INSERT INTO audit_events(institution_id,id,actor_id,action,resource_type,resource_id)
  VALUES($1,$2,$3,'attendance.corrected','attendance_correction',$4)`;
 async function rejected(fn,code='P0001') {
  let err;try{await tx(app,A.institution,fn);}catch(e){err=e;}
  assert.ok(err,'Transacción inconsistente confirmada');assert.equal(err.code,code);return {sqlstate:err.code};
 }
 const change=()=>app.query("UPDATE attendances SET status='ACTIVE',version=3 WHERE id=$1 AND institution_id=$2 AND version=2",[A.attendance,A.institution]);
 const corr=(id,actor=A.user,from='VOID',to='ACTIVE')=>app.query(correction,[A.institution,id,A.attendance,actor,2,3,from,to]);
 const log=(id,actor=A.user)=>app.query(audit,[A.institution,randomUUID(),actor,id]);
 await test('Corrección aislada rechazada al COMMIT',()=>rejected(()=>corr(randomUUID())));
 await test('Corrección y auditoría sin transición rechazadas al COMMIT',()=>rejected(async()=>{const id=randomUUID();await corr(id);await log(id);}));
 await test('Auditoría aislada rechazada al COMMIT',()=>rejected(()=>log(randomUUID())));
 await test('Transición e historial sin auditoría rechazados',()=>rejected(async()=>{await change();await corr(randomUUID());}));
 const otherActor=randomUUID();
 await tx(app,A.institution,()=>app.query("INSERT INTO users(institution_id,id,email,password_hash,role) VALUES($1,$2,$3,'DISABLED_TEST_ACCOUNT','ADMIN')",[A.institution,otherActor,`${otherActor}@example.invalid`]));
 await test('Actor de auditoría distinto al de corrección rechazado',()=>rejected(async()=>{const id=randomUUID();await change();await corr(id);await log(id,otherActor);}));
 await test('Historial con estados distintos a transición real rechazado',()=>rejected(async()=>{const id=randomUUID();await change();await corr(id,A.user,'ACTIVE','VOID');await log(id);}));
 await test('Segunda transición de una asistencia en una transacción rechazada',()=>rejected(async()=>{
  await change();await app.query("UPDATE attendances SET status='VOID',version=4 WHERE id=$1",[A.attendance]);
 }));
 await test('Historial no puede falsificar transaction id',()=>rejected(async()=>{
  await app.query(`INSERT INTO attendance_corrections(institution_id,id,attendance_id,actor_id,from_version,to_version,from_status,to_status,reason,transition_txid)
    VALUES($1,$2,$3,$4,2,3,'VOID','ACTIVE','REVIEW_CONFIRMED',0)`,[A.institution,randomUUID(),A.attendance,A.user]);
 }));
 await test('Corrección legítima admite historial antes de UPDATE con constraints diferidas',async()=>{
  await tx(app,A.institution,async()=>{const id=randomUUID();await corr(id);await change();await log(id);});
  const r=await tx(app,A.institution,async()=> (await app.query('SELECT status,version FROM attendances WHERE id=$1',[A.attendance])).rows[0]);
  assert.deepEqual(r,{status:'ACTIVE',version:3});
 });
 await test('Reintento de UUID de corrección no crea otro historial',async()=>{
  await tx(app,A.institution,async()=>{
   const {rows:[c]}=await app.query('SELECT id,from_version,to_version FROM attendance_corrections WHERE attendance_id=$1 AND to_version=3',[A.attendance]);
   assert.equal(c.from_version,2);assert.equal(c.to_version,3);
   assert.equal((await app.query('SELECT id FROM attendance_corrections WHERE id=$1',[c.id])).rowCount,1);
  });
 });
 await test('Versiones obsoletas no actualizan asistencia',async()=>{
  await tx(app,A.institution,async()=>assert.equal((await app.query("UPDATE attendances SET status='VOID',version=3 WHERE id=$1 AND version=2",[A.attendance])).rowCount,0));
 });
 await test('Concurrencia de correcciones: solo una transición confirmada',async()=>{
  const c1=await connect('asistencia_app'),c2=await connect('asistencia_app');
  const results=await Promise.all([c1,c2].map(c=>tx(c,A.institution,async()=>{
   const r=await c.query("UPDATE attendances SET status='VOID',version=4 WHERE id=$1 AND version=3",[A.attendance]);
   if(!r.rowCount)return 'stale';
   const id=randomUUID();await c.query(correction,[A.institution,id,A.attendance,A.user,3,4,'ACTIVE','VOID']);
   await c.query(audit,[A.institution,randomUUID(),A.user,id]);return 'committed';
  })));
  assert.deepEqual(results.sort(),['committed','stale']);return {committed:1,stale:1};
 });
 await test('Matrícula superpuesta rechazada',()=>denied(app,A.institution,
  "INSERT INTO enrollments(institution_id,id,student_id,group_id,starts_at,ends_at) VALUES($1,$2,$3,$4,'2026-11-13Z','2026-11-20Z')",
  [A.institution,randomUUID(),A.student,A.group],'23P01'));
 await test('Modificar periodo para superponerlo también se rechaza',()=>denied(app,A.institution,
  "UPDATE enrollments SET starts_at='2026-11-13Z' WHERE id=$1",[episode2],'23P01'));
 await test('Acortar matrícula no puede invalidar asistencia histórica',()=>denied(app,A.institution,
  "UPDATE enrollments SET ends_at='2026-06-01Z' WHERE id=$1",[A.enrollment],'23514'));
 await test('Identidad del episodio histórico es inmutable',()=>denied(app,A.institution,
  'UPDATE enrollments SET id=$1 WHERE id=$2',[randomUUID(),A.enrollment],'P0001'));
 const newSession=randomUUID(),newAttendance=randomUUID();
 await tx(app,A.institution,()=>app.query("INSERT INTO class_sessions(institution_id,id,group_id,starts_at,ends_at) VALUES($1,$2,$3,'2026-11-15T10:00Z','2026-11-15T11:00Z')",[A.institution,newSession,A.group]));
 await test('Asistencia queda vinculada al nuevo episodio; histórico preservado',async()=>{
  const args=attendanceArgs(A,newAttendance,randomUUID(),newSession);setDate(args,'2026-11-15T10:00:00.000Z');args[10]=episode2;
  await tx(app,A.institution,()=>app.query(insertAttendance,args));
  await tx(app,A.institution,async()=>{
   assert.equal((await app.query('SELECT enrollment_id FROM attendances WHERE id=$1',[newAttendance])).rows[0].enrollment_id,episode2);
   assert.equal((await app.query('SELECT enrollment_id FROM attendances WHERE id=$1',[A.attendance])).rows[0].enrollment_id,A.enrollment);
  });
 });
 await test('Asistencia fuera del episodio es rechazada antes de duplicados',async()=>{
  const args=attendanceArgs(A,randomUUID(),randomUUID(),newSession);setDate(args,'2026-11-15T10:00:00.000Z');
  return denied(app,A.institution,insertAttendance,args,'23514');
 });
 await test('Fin exclusivo del episodio no acepta una asistencia en ese instante',async()=>{
  const args=attendanceArgs(A,randomUUID(),randomUUID(),newSession);setDate(args,'2026-12-01T00:00:00.000Z');args[10]=episode2;
  return denied(app,A.institution,insertAttendance,args,'23514');
 });
 for(const isolation of ['READ COMMITTED','REPEATABLE READ'])await test('Matrículas concurrentes sin solape: '+isolation,async()=>{
  const group=randomUUID();
  await tx(app,A.institution,()=>app.query("INSERT INTO groups(institution_id,id,grade,section,school_year) VALUES($1,$2,$3,'A',2027)",[A.institution,group,randomUUID()]));
  const cs=await Promise.all([connect('asistencia_app'),connect('asistencia_app')]);
  await Promise.all(cs.map(async c=>{
   await c.query('BEGIN ISOLATION LEVEL '+isolation);
   await c.query("SELECT set_config('app.institution_id',$1,true)",[A.institution]);
   await c.query('SELECT id FROM students WHERE id=$1',[A.student]);
  }));
  const results=await Promise.allSettled(cs.map(async c=>{
   try{await c.query("INSERT INTO enrollments(institution_id,id,student_id,group_id,starts_at) VALUES($1,$2,$3,$4,'2027-01-01Z')",[A.institution,randomUUID(),A.student,group]);await c.query('COMMIT');}
   catch(e){await c.query('ROLLBACK');throw e;}
  }));
  assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
  const code=results.find(x=>x.status==='rejected').reason.code;
  assert.equal(code,isolation==='READ COMMITTED'?'23P01':'40001');
  assert.equal(await tx(app,A.institution,async()=> (await app.query('SELECT id FROM enrollments WHERE group_id=$1',[group])).rowCount),1);
  return {commits:1,rejected:1,sqlstate:code};
 });
 await test('Migrador tampoco puede insertar corrección aislada',async()=>{
  let e;try{await tx(migrator,A.institution,()=>migrator.query(correction,[A.institution,randomUUID(),A.attendance,A.user,4,5,'VOID','ACTIVE']));}catch(err){e=err;}
  assert.equal(e?.code,'P0001');
 });
}
