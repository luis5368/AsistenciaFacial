import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:https';
import { once } from 'node:events';
import express from 'express';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/service.js';
import { PasswordHasher } from '../src/modules/auth/password.js';
import { AdministrationService } from '../src/modules/administration/service.js';
import { PrismaAdministrationUnitOfWork } from '../src/repositories/administration.js';
import { administrationRoutes } from '../src/http/controllers/administration.js';
import { authRoutes } from '../src/http/controllers/auth.js';
import { security } from '../src/http/security.js';
import { errorHandler, HttpError } from '../src/http/errors.js';
import { createApp } from '../src/app.js';
import { loadApplicationConfig } from '../src/config/application.js';
import { MemoryAdministration, ids } from './helpers/administration.js';

const password = 'Synthetic administration phrase!';
const hash = await new PasswordHasher().hash(password);
const cert = readFileSync('../../.tmp/tls-auth/localhost.crt');
const key = readFileSync('../../.tmp/tls-auth/localhost.key');
const config = (institutionId = ids.a) => loadApplicationConfig({ NODE_ENV: 'test', API_INSTITUTION_ID: institutionId,
  API_ORIGIN: 'https://localhost:3001', API_CALENDAR_JSON: '[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]' });
const fixture = () => { const db = new MemoryAdministration(); db.seed(hash); return db; };
async function setup(t: { after: (fn: () => Promise<void>) => void }, db = fixture(), institutionId = ids.a) {
  const cfg = config(institutionId), auth = await AuthService.initialize(institutionId, db.auth(institutionId));
  const service = new AdministrationService(cfg, db, id => { db.events.push('REVOKE'); auth.revokeUser(id); });
  const app = express(), logs: unknown[] = []; app.disable('x-powered-by'); app.disable('etag'); app.set('trust proxy', false); app.set('query parser', 'simple');
  app.use(security(cfg.origin, r => logs.push(r)), express.json({ limit: 256*1024, strict: true, inflate: false }));
  app.use(authRoutes(auth, cfg.origin), administrationRoutes(service, auth, cfg.origin, institutionId));
  app.use((_req,_res,next) => next(new HttpError('NOT_FOUND'))); app.use(errorHandler);
  const server = createServer({ key, cert }, app); server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => new Promise<void>((resolve,reject) => server.close(e => e ? reject(e) : resolve())));
  const address = server.address(); assert.ok(address && typeof address !== 'string');
  const req = () => request(`https://127.0.0.1:${address.port}`);
  async function login(email: string) {
    const r = await req().post('/api/v1/auth/login').ca(cert).set('Origin', cfg.origin).send({ email, password }); assert.equal(r.status, 200);
    const cookie = (r.headers['set-cookie'][0] as string).split(';')[0]!;
    const s = await req().get('/api/v1/auth/session').ca(cert).set('Cookie',cookie); assert.equal(s.status,200);
    return { cookie, csrf: s.body.data.csrfToken as string };
  }
  const admin = await login('admin@example.test'), teacher = await login('teacher@example.test');
  const headers = (s = admin) => ({ Cookie: s.cookie, Origin: cfg.origin, 'X-CSRF-Token': s.csrf });
  return { db, auth, service, req, logs, admin, teacher, headers, login };
}

test('matriz HTTP ADMIN/TEACHER: todas las lecturas y catálogos, proyecciones y alcance', async t => {
  const f = await setup(t);
  const cases = [
    ['/institution',200,200], ['/me',200,200], ['/users',200,403], [`/users/${ids.admin}`,200,403],
    ['/teachers',200,403], [`/teachers/${ids.teacher}`,200,403], ['/students',200,200], [`/students/${ids.student}`,200,200],
    [`/students/${ids.student2}`,200,404], ['/groups',200,200], [`/groups/${ids.group}`,200,200], [`/groups/${ids.group2}`,200,404],
    ['/me/assignments',403,200], [`/teachers/${ids.teacher}/assignments/${ids.group}`,200,403],
  ] as const;
  for (const [path,a,b] of cases) for (const [session,status] of [[f.admin,a],[f.teacher,b]] as const) {
    const r = await f.req().get('/api/v1'+path).ca(cert).set(f.headers(session)); assert.equal(r.status,status,path);
    assert.ok(!r.text.includes(hash)); assert.ok(!r.text.includes('passwordHash')); assert.ok(!r.text.includes(session.cookie));
  }
  const students = await f.req().get('/api/v1/students').ca(cert).set(f.headers(f.teacher)); assert.equal(students.body.data.length,1);
  const mutations = [
    ['post','/users',{ email:'new@example.test',role:'TEACHER',password }], ['post','/teachers',{ userId:ids.teacherUser }],
    ['post','/students',{ studentCode:'X',fullName:'Synthetic' }], ['post','/groups',{ grade:'2',section:'A',schoolYear:2026 }],
    ['patch','/institution',{ name:'New' }], ['patch',`/users/${ids.admin}`,{ active:false }],
    ['patch',`/students/${ids.student}`,{ active:false }], ['patch',`/groups/${ids.group}`,{ grade:'2' }],
    ['put',`/teachers/${ids.teacher}/assignments/${ids.group}`,{ active:false }],
  ] as const;
  for(const [method,path,body] of mutations) {
    const r=await f.req()[method]('/api/v1'+path).ca(cert).set(f.headers(f.teacher)).send(body); assert.equal(r.status,403,path);
  }
  assert.equal((await f.req().get('/api/v1/users').ca(cert)).status,401);
  assert.equal(f.db.state.audits.length,0);
});

test('altas ADMIN, referencias, edición ETag, auditoría y ningún passwordHash expuesto', async t => {
  const f = await setup(t);
  const u = await f.req().post('/api/v1/users').ca(cert).set(f.headers()).send({ email:'created@example.test',role:'TEACHER',password });
  assert.equal(u.status,201); assert.ok(u.headers.location); assert.ok(u.headers.etag); assert.ok(!u.text.includes('password'));
  const stored = f.db.state.tables.user.find(x=>x.id===u.body.data.id)!; assert.equal(await new PasswordHasher().verify(stored.passwordHash,password),true);
  const teacher = await f.req().post('/api/v1/teachers').ca(cert).set(f.headers()).send({ userId:stored.id }); assert.equal(teacher.status,201);
  assert.equal((await f.req().post('/api/v1/teachers').ca(cert).set(f.headers()).send({userId:ids.admin})).status,422);
  const student=await f.req().post('/api/v1/students').ca(cert).set(f.headers()).send({studentCode:'new',fullName:'Synthetic new'});assert.equal(student.status,201);
  const group=await f.req().post('/api/v1/groups').ca(cert).set(f.headers()).send({grade:'2',section:'A',schoolYear:2026});assert.equal(group.status,201);
  const changes=[['/institution',{name:'Synthetic renamed'}],[`/users/${stored.id}`,{email:'changed@example.test'}],[`/students/${student.body.data.id}`,{active:false}],[`/groups/${group.body.data.id}`,{grade:'3'}]] as const;
  for(const [path,body] of changes){
    const before=await f.req().get('/api/v1'+path).ca(cert).set(f.headers());assert.equal(before.status,200);
    assert.equal((await f.req().patch('/api/v1'+path).ca(cert).set(f.headers()).send(body)).status,428);
    const after=await f.req().patch('/api/v1'+path).ca(cert).set(f.headers()).set('If-Match',before.headers.etag).send(body);assert.equal(after.status,200);assert.notEqual(after.headers.etag,before.headers.etag);
    assert.equal((await f.req().patch('/api/v1'+path).ca(cert).set(f.headers()).set('If-Match',before.headers.etag).send(body)).status,412);
  }
  assert.equal(f.db.state.audits.length,8);assert.ok(f.db.state.audits.every(a=>a.actorId===ids.admin));
  assert.ok(!JSON.stringify(f.db.state.audits).includes(password));
});

test('asignaciones: crear con If-None-Match, consultar ETag, desactivar y revocar alcance docente',async t=>{
  const f=await setup(t),path=`/api/v1/teachers/${ids.teacher}/assignments/${ids.group2}`;
  assert.equal((await f.req().put(path).ca(cert).set(f.headers()).send({active:true})).status,428);
  const created=await f.req().put(path).ca(cert).set(f.headers()).set('If-None-Match','*').send({active:true});assert.equal(created.status,201);
  assert.equal((await f.req().get(`/api/v1/groups/${ids.group2}`).ca(cert).set(f.headers(f.teacher))).status,200);
  assert.equal((await f.req().put(path).ca(cert).set(f.headers()).set('If-None-Match','*').send({active:true})).status,412);
  const read=await f.req().get(path).ca(cert).set(f.headers());assert.equal(read.headers.etag,created.headers.etag);
  assert.equal((await f.req().put(path).ca(cert).set(f.headers()).set('If-Match',read.headers.etag).send({active:false})).status,200);
  const oldPath=`/api/v1/teachers/${ids.teacher}/assignments/${ids.group}`;
  const old=await f.req().get(oldPath).ca(cert).set(f.headers());
  assert.equal((await f.req().put(oldPath).ca(cert).set(f.headers()).set('If-Match',old.headers.etag).send({active:false})).status,200);
  assert.equal((await f.req().get(`/api/v1/groups/${ids.group}`).ca(cert).set(f.headers(f.teacher))).status,404);
  assert.equal((await f.req().get('/api/v1/students').ca(cert).set(f.headers(f.teacher))).body.data.length,0);
  assert.equal((await f.req().get('/api/v1/me/assignments').ca(cert).set(f.headers(f.teacher))).body.data.length,0);
});

test('aislamiento A/B, cursores firmados ligados al actor/recurso e institución',async t=>{
  const db=fixture(),a=await setup(t,db,ids.a),b=await setup(t,db,ids.b);
  const tag=await a.req().get('/api/v1/institution').ca(cert).set(a.headers());
  assert.equal((await a.req().patch('/api/v1/institution').ca(cert).set(a.headers()).set('If-Match',tag.headers.etag).send({name:'Only A'})).status,200);
  assert.equal((await b.req().get('/api/v1/institution').ca(cert).set(b.headers())).body.data.name,'Synthetic institution');
  assert.equal((await b.req().get('/api/v1/users').ca(cert).set(a.headers())).status,401);
  const first=await a.req().get('/api/v1/users?limit=1').ca(cert).set(a.headers());assert.equal(first.body.data.length,1);assert.ok(first.body.nextCursor);
  const next=await a.req().get('/api/v1/users').query({limit:'1',cursor:first.body.nextCursor}).ca(cert).set(a.headers());assert.equal(next.status,200);assert.notEqual(next.body.data[0].id,first.body.data[0].id);
  assert.equal((await b.req().get('/api/v1/users').query({cursor:first.body.nextCursor}).ca(cert).set(b.headers())).status,400);
  assert.equal((await a.req().get('/api/v1/students').query({cursor:first.body.nextCursor}).ca(cert).set(a.headers())).status,400);
  const otherActor=db.state.tables.user.find(u=>u.institutionId===ids.b&&u.id===ids.admin)!;
  await assert.rejects(a.service.list(otherActor,'user',{}),/FORBIDDEN/);
  const onlyB='99999999-9999-4999-8999-999999999999';db.state.tables.student.push({id:onlyB,institutionId:ids.b,studentCode:'B',fullName:'B synthetic',active:true});
  assert.equal((await a.req().get(`/api/v1/students/${onlyB}`).ca(cert).set(a.headers())).status,404);
});

test('DTO manipulados, CSRF, HTTPS, query y calendario fallan cerrado sin auditoría',async t=>{
  const f=await setup(t);
  for(const extra of [{institutionId:ids.b},{role:'ADMIN'},{passwordHash:'bad'},{id:ids.student}])assert.equal((await f.req().post('/api/v1/students').ca(cert).set(f.headers()).send({studentCode:'X',fullName:'Synthetic',...extra})).status,400);
  assert.equal((await f.req().post('/api/v1/students').ca(cert).set('Cookie',f.admin.cookie).set('Origin',config().origin).send({studentCode:'X',fullName:'Synthetic'})).status,403);
  assert.equal((await f.req().post('/api/v1/groups').ca(cert).set(f.headers()).send({grade:'1',section:'A',schoolYear:2027})).status,400);
  assert.equal((await f.req().get('/api/v1/users?limit=101').ca(cert).set(f.headers())).status,400);
  assert.equal((await f.req().get('/api/v1/users?institutionId='+ids.b).ca(cert).set(f.headers())).status,400);
  assert.equal((await f.req().get('/api/v1/users').ca(cert).set(f.headers()).set('X-Role','ADMIN')).status,400);
  assert.equal((await f.req().delete(`/api/v1/users/${ids.admin}`).ca(cert).set(f.headers())).status,404);
  assert.equal(f.db.state.audits.length,0);
  const logs=JSON.stringify(f.logs);for(const sensitive of [password,hash,f.admin.cookie,f.admin.csrf,'Synthetic'])assert.ok(!logs.includes(sensitive));
});

test('último ADMIN: solicitudes concurrentes solo permiten una reducción, sin borrado lógico adicional',async t=>{
  const f=await setup(t);const second=await f.login('second@example.test');
  const a=await f.req().get(`/api/v1/users/${ids.admin}`).ca(cert).set(f.headers());
  const b=await f.req().get(`/api/v1/users/${ids.admin2}`).ca(cert).set(f.headers(second));
  const results=await Promise.all([
    f.req().patch(`/api/v1/users/${ids.admin}`).ca(cert).set(f.headers()).set('If-Match',a.headers.etag).send({active:false}),
    f.req().patch(`/api/v1/users/${ids.admin2}`).ca(cert).set(f.headers(second)).set('If-Match',b.headers.etag).send({role:'TEACHER'}),
  ]);
  assert.deepEqual(results.map(r=>r.status).sort(),[200,409]);
  assert.equal(f.db.state.tables.user.filter(u=>u.institutionId===ids.a&&u.active&&u.role==='ADMIN').length,1);
  assert.equal(f.db.state.audits.length,1);
});

test('rollback de auditoría/COMMIT conserva datos y sesiones; COMMIT precede revocación',async t=>{
  const f=await setup(t);const before=await f.req().get(`/api/v1/users/${ids.teacherUser}`).ca(cert).set(f.headers());
  for(const fault of ['failAudit','failCommit'] as const){
    f.db[fault]=true;f.db.events.length=0;
    const r=await f.req().patch(`/api/v1/users/${ids.teacherUser}`).ca(cert).set(f.headers()).set('If-Match',before.headers.etag).send({active:false});assert.equal(r.status,500);assert.ok(!r.text.includes('synthetic'));
    assert.ok(f.db.events.includes('ROLLBACK'));assert.ok(!f.db.events.includes('REVOKE'));assert.equal(f.db.state.audits.length,0);
    f.db[fault]=false;
    assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set(f.headers(f.teacher))).status,200);
  }
  f.db.events.length=0;
  assert.equal((await f.req().patch(`/api/v1/users/${ids.teacherUser}`).ca(cert).set(f.headers()).set('If-Match',before.headers.etag).send({active:false})).status,200);
  assert.ok(f.db.events.indexOf('COMMIT')<f.db.events.indexOf('REVOKE'));
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set(f.headers(f.teacher))).status,401);
  assert.equal((await f.req().get('/api/v1/groups').ca(cert).set(f.headers(f.teacher))).status,401);
});

test('rol confirmado revoca; autorización se vuelve a comprobar bajo bloqueo después de autenticar',async t=>{
  const f=await setup(t);const second=await f.login('second@example.test');
  const r=await f.req().get(`/api/v1/users/${ids.admin2}`).ca(cert).set(f.headers());
  assert.equal((await f.req().patch(`/api/v1/users/${ids.admin2}`).ca(cert).set(f.headers()).set('If-Match',r.headers.etag).send({role:'TEACHER'})).status,200);
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set(f.headers(second))).status,401);
  const actor=structuredClone(f.db.state.tables.user.find(u=>u.institutionId===ids.a&&u.id===ids.admin)!);
  f.db.state.tables.user.find(u=>u.institutionId===ids.a&&u.id===ids.admin)!.active=false;
  await assert.rejects(f.service.list(actor,'user',{}),/AUTH_REQUIRED/);
});

test('runtime habitual mantiene todos los módulos administrativos sin montar',async()=>{
  const app=createApp(config());
  for(const path of ['/users','/institution','/teachers','/students','/groups','/me','/me/assignments'])assert.equal((await request(app).get('/api/v1'+path)).status,404);
  const source=readFileSync('src/server.ts','utf8');assert.ok(!source.includes('Administration'));assert.ok(!source.includes('administrationRoutes'));
});

test('dos PATCH con el mismo ETag: uno confirma y otro falla sin sobrescribir',async t=>{
  const f=await setup(t);const path=`/api/v1/students/${ids.student}`;
  const read=await f.req().get(path).ca(cert).set(f.headers());
  const results=await Promise.all(['First synthetic','Second synthetic'].map(fullName=>f.req().patch(path).ca(cert).set(f.headers()).set('If-Match',read.headers.etag).send({fullName})));
  assert.deepEqual(results.map(r=>r.status).sort(),[200,412]);assert.equal(f.db.state.audits.length,1);
  const stored=f.db.state.tables.student.find(s=>s.institutionId===ids.a&&s.id===ids.student)!;
  assert.equal(stored.fullName,results.find(r=>r.status===200)!.body.data.fullName);
});

test('cambio de contraseña: fallo de auditoría revierte hash y conserva sesión; COMMIT revoca',async t=>{
  const f=await setup(t),newPassword='Another synthetic password phrase!';
  const change=()=>f.req().post('/api/v1/auth/password-change').ca(cert).set(f.headers(f.teacher)).send({currentPassword:password,newPassword});
  f.db.failAudit=true;assert.equal((await change()).status,500);f.db.failAudit=false;
  assert.equal(f.db.state.tables.user.find(u=>u.institutionId===ids.a&&u.id===ids.teacherUser)!.passwordHash,hash);
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set(f.headers(f.teacher))).status,200);
  assert.equal((await change()).status,204);assert.equal(f.db.state.audits.length,1);
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set(f.headers(f.teacher))).status,401);
  assert.equal(await new PasswordHasher().verify(f.db.state.tables.user.find(u=>u.institutionId===ids.a&&u.id===ids.teacherUser)!.passwordHash,newPassword),true);
});

test('referencias ajenas, usuario inactivo y duplicados rechazan altas sin auditoría parcial',async t=>{
  const f=await setup(t);
  const foreign='90000000-0000-4000-8000-000000000001';
  f.db.state.tables.user.push({id:foreign,institutionId:ids.b,email:'foreign@example.test',role:'TEACHER',active:true,passwordHash:hash});
  assert.equal((await f.req().post('/api/v1/teachers').ca(cert).set(f.headers()).send({userId:foreign})).status,422);
  assert.equal((await f.req().post('/api/v1/teachers').ca(cert).set(f.headers()).send({userId:ids.teacherUser})).status,409);
  f.db.state.tables.user.find(u=>u.institutionId===ids.a&&u.id===ids.teacherUser)!.active=false;
  assert.equal((await f.req().post('/api/v1/teachers').ca(cert).set(f.headers()).send({userId:ids.teacherUser})).status,422);
  assert.equal((await f.req().put(`/api/v1/teachers/${ids.teacher}/assignments/${ids.group2}`).ca(cert).set(f.headers()).set('If-None-Match','*').send({active:true})).status,422);
  assert.equal((await f.req().post('/api/v1/users').ca(cert).set(f.headers()).send({email:'admin@example.test',role:'ADMIN',password})).status,409);
  assert.equal(f.db.state.audits.length,0);
});

test('adaptador Prisma: contexto, bloqueo parametrizado, filtros institucionales/docentes y auditoría',async()=>{
  const calls:{name:string;args:unknown}[]=[];
  const capture=(name:string,result:unknown)=>async(args:unknown)=>{calls.push({name,args});return result;};
  const tx={ $executeRaw:capture('context',1),$queryRaw:async(strings:TemplateStringsArray,...values:unknown[])=>{calls.push({name:'lock',args:{sql:strings.join('?'),values}});return [{id:ids.a}];},
    user:{findFirst:capture('user',{id:ids.admin,institutionId:ids.a}),count:capture('count',2),update:capture('update',{})},
    student:{findMany:capture('students',[])},group:{findMany:capture('groups',[])},teacherAssignment:{findMany:capture('assignments',[])},auditEvent:{create:capture('audit',{})} };
  const db={$transaction:async(fn:(t:typeof tx)=>Promise<unknown>,options:unknown)=>{assert.deepEqual(options,{isolationLevel:'ReadCommitted'});calls.push({name:'begin',args:null});const result=await fn(tx);calls.push({name:'commit',args:null});return result;}};
  const uow=new PrismaAdministrationUnitOfWork(db as never);
  await uow.run(ids.a,async repo=>{
    await repo.lockInstitution();await repo.lockActor(ids.admin);await repo.get('user',ids.admin);await repo.countActiveAdmins();
    const scope={teacherUserId:ids.teacherUser,years:[2026],now:new Date('2026-06-01T00:00:00.000Z')};
    await repo.list('student',{limit:2},scope);await repo.list('group',{limit:2},scope);await repo.ownAssignments(ids.teacherUser,{limit:2},scope);
    await repo.update('user',ids.admin,{email:'synthetic@example.test'});await repo.audit(ids.admin,'user.updated','user',ids.admin);
  });
  assert.deepEqual(calls.slice(0,4).map(c=>c.name),['begin','context','lock','lock']);assert.equal(calls.at(-1)!.name,'commit');
  const locks=calls.filter(c=>c.name==='lock');assert.match(JSON.stringify(locks[0]),/FOR UPDATE/);assert.match(JSON.stringify(locks[1]),/FOR SHARE/);
  for(const name of ['students','groups','assignments','update','audit','count'])assert.ok(JSON.stringify(calls.find(c=>c.name===name)).includes(ids.a),name);
  const students=JSON.stringify(calls.find(c=>c.name==='students'));for(const required of ['enrollments','startsAt','endsAt','assignments','active',ids.teacherUser])assert.ok(students.includes(required));
  const audit=JSON.stringify(calls.find(c=>c.name==='audit'));assert.ok(!audit.includes('password'));assert.ok(!audit.includes('synthetic@example.test'));
});
