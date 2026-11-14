// Exclusivo del laboratorio autorizado; no importar desde server.ts.
import {config as env} from 'dotenv';
import {readFileSync,writeFileSync,existsSync,mkdirSync} from 'node:fs';
import {randomUUID,createHash} from 'node:crypto';
import {createServer} from 'node:https';
import {once} from 'node:events';
import assert from 'node:assert/strict';
import pg from 'pg';
import {PrismaPg} from '@prisma/adapter-pg';
import {PrismaClient} from '../dist/generated/prisma/client.js';
import {apiLabUrl} from '../dist/config/api-lab-url.js';
import {withInstitution} from '../dist/infrastructure/database.js';
import {AuthService} from '../dist/modules/auth/service.js';
import {PasswordHasher} from '../dist/modules/auth/password.js';
import {PrismaAuthRepository} from '../dist/repositories/auth.js';
import {PrismaAdministrationUnitOfWork} from '../dist/repositories/administration.js';
import {AdministrationService} from '../dist/modules/administration/service.js';
import {loadApplicationConfig} from '../dist/config/application.js';
import {authRoutes} from '../dist/http/controllers/auth.js';
import {administrationRoutes} from '../dist/http/controllers/administration.js';
import {security} from '../dist/http/security.js';
import {errorHandler,HttpError} from '../dist/http/errors.js';
import express from 'express';
import {chromium} from '@playwright/test';

const results={date:new Date().toISOString(),database:'asistencia_facial_api_lab',checks:[],fixturesCommitted:false};
const report=new URL('../../../docs/evidencias/fase-3-api-lab-resultados.json',import.meta.url);
const marker=new URL('../../../private_data/api-lab-run.json',import.meta.url);
const clients=[],servers=[],contexts=[];let browser,pool,stage='preflight';
const check=(name,actual,expected)=>{assert.deepEqual(actual,expected);results.checks.push({name,result:'PASS'});};
const persist=()=>writeFileSync(report,JSON.stringify(results,null,2)+'\n');
function client(options){const c=new PrismaClient({adapter:new PrismaPg(options)});clients.push(c);return c;}
try {
  if(existsSync(marker))throw Error('Run already started');
  const loaded=env({path:'.env.api-lab',quiet:true});if(loaded.error)throw Error();
  const migrationUrl=apiLabUrl(process.env.API_LAB_MIGRATION_DATABASE_URL,'asistencia_migrator');
  apiLabUrl('postgresql://asistencia_app@localhost:5432/asistencia_facial_api_lab','asistencia_app');
  const password=Buffer.from(process.env.API_LAB_FIXTURE_PASSWORD_BASE64??'','base64').toString('utf8');
  const nextPassword=Buffer.from(process.env.API_LAB_NEXT_PASSWORD_BASE64??'','base64').toString('utf8');
  assert.ok(password.length>=15&&password.length<=128&&nextPassword.length>=15&&nextPassword.length<=128&&password!==nextPassword);
  const migrator=client({connectionString:migrationUrl,max:1});
  const appOptions={host:'localhost',port:5432,database:'asistencia_facial_api_lab',user:'asistencia_app',max:5,connectionTimeoutMillis:5000};
  const app=client(appOptions),secondApp=client(appOptions);
  for(const [db,role] of [[migrator,'asistencia_migrator'],[app,'asistencia_app'],[secondApp,'asistencia_app']]){
    const [identity]=await db.$queryRaw`SELECT current_database() AS db,current_user AS role,host(inet_server_addr()) AS host,inet_server_port() AS port`;
    assert.equal(identity.db,'asistencia_facial_api_lab');assert.equal(identity.role,role);assert.equal(identity.port,5432);assert.ok(['::1','127.0.0.1'].includes(identity.host));
  }
  check('identidad real migrador y dos clientes app',true,true);
  const migrations=await migrator.$queryRaw`SELECT migration_name,checksum,finished_at,rolled_back_at FROM _prisma_migrations ORDER BY migration_name`;
  assert.equal(migrations.length,2);
  for(const m of migrations){assert.ok(m.finished_at&&!m.rolled_back_at);assert.equal(m.checksum,createHash('sha256').update(readFileSync(`prisma/migrations/${m.migration_name}/migration.sql`)).digest('hex'));}
  check('historial y checksums',true,true);
  const tables=await migrator.$queryRaw`SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE relnamespace='public'::regnamespace AND relkind='r' AND relname<>'_prisma_migrations' ORDER BY relname`;
  check('14 tablas RLS ENABLE/FORCE',tables.length===14&&tables.every(t=>t.relrowsecurity&&t.relforcerowsecurity),true);results.tables=tables;
  const permissions=await app.$queryRaw`SELECT tablename,has_table_privilege(current_user,quote_ident(tablename),'SELECT') AS sel,has_table_privilege(current_user,quote_ident(tablename),'DELETE') AS del,has_table_privilege(current_user,quote_ident(tablename),'TRUNCATE') AS trunc,has_table_privilege(current_user,quote_ident(tablename),'UPDATE') AS upd FROM pg_tables WHERE schemaname='public' ORDER BY tablename`;
  assert.ok(permissions.every(p=>!p.del&&!p.trunc));
  for(const n of ['_prisma_migrations','biometric_template_metadata'])assert.equal(permissions.find(p=>p.tablename===n).sel,false);
  for(const n of ['audit_events','attendance_corrections'])assert.equal(permissions.find(p=>p.tablename===n).upd,false);
  results.permissions=permissions;check('permisos efectivos protegidos',true,true);
  const [ddl]=await app.$queryRaw`SELECT has_database_privilege(current_user,current_database(),'CREATE') AS dbcreate,has_schema_privilege(current_user,'public','CREATE') AS schemacreate`;
  check('sin CREATE',ddl,{dbcreate:false,schemacreate:false});
  // RLS impide contar todas las instituciones: inspección física estadística no sustituye preflight previo vacío.
  check('sin contexto no revela instituciones',await app.institution.count(),0);
  const cert=readFileSync('../../.tmp/tls-auth/localhost.crt'),key=readFileSync('../../.tmp/tls-auth/localhost.key');
  browser=await chromium.launch({channel:'chrome',headless:true});results.browser=browser.version();
  mkdirSync(new URL('../../../private_data/',import.meta.url),{recursive:true});
  writeFileSync(marker,JSON.stringify({started:results.date,database:results.database}),{flag:'wx'});
  stage='fixtures';
  const hasher=new PasswordHasher();const fixtures=[];
  for(const label of ['A','B']){
    const f={label,id:randomUUID(),users:[],teachers:[randomUUID(),randomUUID()],groups:[randomUUID(),randomUUID()],students:[randomUUID(),randomUUID()]};
    for(const [role,active] of [['ADMIN',true],['ADMIN',true],['TEACHER',true],['TEACHER',false]]){
      const id=randomUUID();f.users.push({id,email:`${id}@example.test`,role,active,passwordHash:await hasher.hash(password)});
    }fixtures.push(f);
  }
  await migrator.$transaction(async tx=>{
    for(const f of fixtures){
      await tx.$executeRaw`SELECT set_config('app.institution_id',${f.id},true)`;
      await tx.institution.create({data:{id:f.id,name:`Institucion ficticia ${f.label}`}});
      for(const u of f.users)await tx.user.create({data:{...u,institutionId:f.id}});
      for(let i=0;i<2;i++){
        await tx.teacher.create({data:{id:f.teachers[i],institutionId:f.id,userId:f.users[i+2].id}});
        await tx.group.create({data:{id:f.groups[i],institutionId:f.id,grade:'Grado ficticio',section:`${i}`,schoolYear:2026}});
        await tx.student.create({data:{id:f.students[i],institutionId:f.id,studentCode:`SYN-${i}`,fullName:`Estudiante sintetico ${i}`}});
        await tx.enrollment.create({data:{id:randomUUID(),institutionId:f.id,studentId:f.students[i],groupId:f.groups[i],startsAt:new Date('2026-01-01T00:00:00Z'),endsAt:new Date('2027-01-01T00:00:00Z')}});
        await tx.teacherAssignment.create({data:{institutionId:f.id,teacherId:f.teachers[0],groupId:f.groups[i],active:i===0}});
      }
    }
  },{timeout:20000});
  results.fixturesCommitted=true;results.fixtureCounts={institutions:2,users:8,teachers:4,groups:4,students:4,enrollments:4,assignments:4};persist();
  stage='rls';const [a,b]=fixtures;
  for(const f of fixtures)check(`RLS institucion ${f.label}`,await withInstitution(app,f.id,tx=>tx.user.count()),4);
  check('RLS sin contexto despues de transacciones',await app.user.count(),0);
  pool=new pg.Pool({...appOptions,max:1});
  const conn=await pool.connect();const pid=(await conn.query('SELECT pg_backend_pid() AS pid')).rows[0].pid;
  for(const f of fixtures){await conn.query('BEGIN');await conn.query("SELECT set_config('app.institution_id',$1,true)",[f.id]);check(`pool ${f.label}`,(await conn.query('SELECT count(*)::int AS n FROM users')).rows[0].n,4);await conn.query('ROLLBACK');check('pool sin contexto',(await conn.query('SELECT count(*)::int AS n FROM users')).rows[0].n,0);}
  check('misma conexion reutilizada',(await conn.query('SELECT pg_backend_pid() AS pid')).rows[0].pid,pid);conn.release();
  stage='http-browser';const logs=[];let now=Date.now();
  async function instance(f){
    const auth=await AuthService.initialize(f.id,new PrismaAuthRepository(app,f.id),new PasswordHasher(),()=>now);
    const cfg=loadApplicationConfig({NODE_ENV:'test',API_INSTITUTION_ID:f.id,API_ORIGIN:'https://127.0.0.1:3001',API_CALENDAR_JSON:'[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]'});
    const server=createServer({key,cert});server.listen(0,'127.0.0.1');await once(server,'listening');servers.push(server);
    const origin=`https://127.0.0.1:${server.address().port}`;
    const service=new AdministrationService(cfg,new PrismaAdministrationUnitOfWork(app),id=>auth.revokeUser(id));
    const http=express();http.set('trust proxy',false);http.disable('etag');http.use(security(origin,r=>logs.push(r)),express.json({limit:'256kb',strict:true,inflate:false}));
    http.get('/lab',(_req,res)=>res.set('Content-Security-Policy',"default-src 'none'; connect-src 'self'").type('html').send('<!doctype html><title>Laboratorio local</title>'));
    http.use(authRoutes(auth,origin),administrationRoutes(service,auth,origin,f.id));http.use((_req,_res,next)=>next(new HttpError('NOT_FOUND')));http.use(errorHandler);server.on('request',http);
    const context=await browser.newContext({ignoreHTTPSErrors:true});contexts.push(context);const page=await context.newPage();await page.goto(origin+'/lab');
    const call=(path,method='GET',body,headers={})=>page.evaluate(async({path,method,body,headers})=>{const r=await fetch(path,{method,credentials:'include',headers:{...(body?{'Content-Type':'application/json'}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});const text=await r.text();return {status:r.status,body:text?JSON.parse(text):null,etag:r.headers.get('etag')};},{path:'/api/v1'+path,method,body,headers});
    return {auth,service,context,page,call,origin};
  }
  const ia=await instance(a),ib=await instance(b);
  for(const [i,f] of [[ia,a],[ib,b]]){
    check(`login real ${f.label}`,(await i.call('/auth/login','POST',{email:f.users[0].email,password})).status,200);
    const s=await i.call('/auth/session');check(`sesion institucional ${f.label}`,s.body.data.profile.institutionId,f.id);i.csrf=s.body.data.csrfToken;
    const [cookie]=await i.context.cookies();assert.equal(cookie.name,'__Host-af_session');assert.ok(cookie.httpOnly&&cookie.secure&&cookie.sameSite==='Lax'&&cookie.path==='/');
    check(`cookie HttpOnly ${f.label}`,await i.page.evaluate(()=>document.cookie),'');
  }
  results.tlsException='ignoreHTTPSErrors solo en contextos Playwright; no confianza Windows ni desactivacion global';
  const copied=await browser.newContext({ignoreHTTPSErrors:true});contexts.push(copied);await copied.addCookies(await ia.context.cookies());
  check('cookie de A se envia a otro puerto pero B rechaza',(await copied.request.get(ib.origin+'/api/v1/auth/session')).status(),401);
  for(const [email,pass] of [['missing@example.test',password],[a.users[3].email,password],[a.users[0].email,nextPassword]])check('credenciales invalidas genericas',(await ia.call('/auth/login','POST',{email,password:pass})).status,401);
  check('CSRF ausente',(await ia.call('/institution','PATCH',{name:'Ficticia'})).status,403);
  check('ADMIN lista usuarios',(await ia.call('/users')).status,200);
  check('institucion B no visible',(await ia.call(`/students/${b.students[0]}`)).status,404);
  const teacher=await instance(a);check('login docente',(await teacher.call('/auth/login','POST',{email:a.users[2].email,password})).status,200);
  check('TEACHER no administra',(await teacher.call('/users')).status,403);
  const visible=await teacher.call('/students');check('solo estudiante asignado',visible.body.data.map(x=>x.id),[a.students[0]]);
  check('asignacion inactiva excluida',(await teacher.call(`/groups/${a.groups[1]}`)).status,404);
  stage='concurrencia';
  const authUser=await withInstitution(app,a.id,tx=>tx.user.findUnique({where:{institutionId_id:{institutionId:a.id,id:a.users[0].id}}}));
  const otherAdmin=await withInstitution(app,a.id,tx=>tx.user.findUnique({where:{institutionId_id:{institutionId:a.id,id:a.users[1].id}}}));
  const svc2=new AdministrationService(loadApplicationConfig({API_INSTITUTION_ID:a.id,API_CALENDAR_JSON:'[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]'}),new PrismaAdministrationUnitOfWork(secondApp),id=>ia.auth.revokeUser(id));
  const tags=await Promise.all([ia.service.get(authUser,'user',authUser.id),svc2.get(otherAdmin,'user',otherAdmin.id)]);
  const reduce=await Promise.allSettled([ia.service.patch(authUser,'user',authUser.id,{role:'TEACHER'},tags[0].etag),svc2.patch(otherAdmin,'user',otherAdmin.id,{active:false},tags[1].etag)]);
  check('ultimo ADMIN dos clientes una confirmacion',reduce.filter(r=>r.status==='fulfilled').length,1);
  check('ultimo ADMIN rechazo',reduce.find(r=>r.status==='rejected').reason.code,'LAST_ADMIN');
  const survivor=await withInstitution(app,a.id,tx=>tx.user.findFirst({where:{active:true,role:'ADMIN'}}));check('un ADMIN permanece',await withInstitution(app,a.id,tx=>tx.user.count({where:{active:true,role:'ADMIN'}})),1);
  const et=await ia.service.get(survivor,'student',a.students[0]);
  const updates=await Promise.allSettled([ia.service.patch(survivor,'student',a.students[0],{fullName:'Sintetico uno'},et.etag),svc2.patch(survivor,'student',a.students[0],{fullName:'Sintetico dos'},et.etag)]);
  check('ETag concurrente un COMMIT',updates.filter(r=>r.status==='fulfilled').length,1);check('ETag obsoleto',updates.find(r=>r.status==='rejected').reason.code,'PRECONDITION_FAILED');
  stage='rollback';
  let revoked=false;const realUow=new PrismaAdministrationUnitOfWork(app);
  const failedUow={run:(id,fn)=>realUow.run(id,tx=>fn(new Proxy(tx,{get(target,key){if(key==='audit')return async()=>{await appNever();};const value=Reflect.get(target,key);return typeof value==='function'?value.bind(target):value;}})))};
  // Deliberate JS fault inside the actual transaction, after actual UPDATE; no schema/permission change.
  async function appNever(){throw new HttpError('INVALID_REFERENCE');}
  const failService=new AdministrationService(loadApplicationConfig({API_INSTITUTION_ID:a.id,API_CALENDAR_JSON:'[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]'}),failedUow,()=>{revoked=true;});
  const target=await ia.service.get(survivor,'user',a.users[2].id);
  await assert.rejects(failService.patch(survivor,'user',a.users[2].id,{active:false},target.etag));
  check('rollback conserva usuario',(await ia.service.get(survivor,'user',a.users[2].id)).data.active,true);check('rollback sin revocacion',revoked,false);
  check('sesion docente despues rollback',(await teacher.call('/auth/session')).status,200);
  await ia.service.patch(survivor,'user',a.users[2].id,{active:false},target.etag);
  check('desactivacion confirmada rechaza sesion',(await teacher.call('/auth/session')).status,401);
  stage='password-session';
  const beforeAudit=await withInstitution(app,b.id,tx=>tx.auditEvent.count());
  check('cambio clave real',(await ib.call('/auth/password-change','POST',{currentPassword:password,newPassword:nextPassword},{'X-CSRF-Token':ib.csrf})).status,204);
  check('auditoria cambio clave',await withInstitution(app,b.id,tx=>tx.auditEvent.count()),beforeAudit+1);
  check('sesion revocada tras clave',(await ib.call('/auth/session')).status,401);
  check('login nueva clave',(await ib.call('/auth/login','POST',{email:b.users[0].email,password:nextPassword})).status,200);
  const session=await ib.call('/auth/session');check('logout',(await ib.call('/auth/logout','POST',{}, {'X-CSRF-Token':session.body.data.csrfToken})).status,204);check('cookie eliminada',(await ib.context.cookies()).length,0);
  const direct=await ib.auth.login(b.users[1].email,password,'lab-expiry');now+=30*60_000;
  await assert.rejects(ib.auth.session(direct.token),/AUTH_REQUIRED/);check('caducidad reloj controlado con repositorio real',true,true);
  const fresh=await AuthService.initialize(b.id,new PrismaAuthRepository(app,b.id));await assert.rejects(fresh.session(direct.token),/AUTH_REQUIRED/);check('nuevo almacen rechaza token anterior',true,true);
  const safe=JSON.stringify(logs);assert.ok(!safe.includes(password)&&!safe.includes(nextPassword)&&!safe.includes('passwordHash')&&!safe.includes('__Host-af_session'));
  check('logs tecnicos sin secretos',true,true);results.completed=true;
} catch(error) {
  results.completed=false;results.failure={stage,category:error instanceof assert.AssertionError?'assertion':'operation',code:typeof error?.code==='string'&&/^[A-Z0-9_]+$/.test(error.code)?error.code:'SANITIZED'};
  process.exitCode=1;
} finally {
  for(const c of contexts)await c.close().catch(()=>{});await browser?.close().catch(()=>{});
  for(const s of servers)await new Promise(r=>s.close(r));await pool?.end().catch(()=>{});
  for(const c of clients)await c.$disconnect().catch(()=>{});persist();
  console.log(JSON.stringify({completed:results.completed,fixturesCommitted:results.fixturesCommitted,passed:results.checks.length,failure:results.failure}));
}
