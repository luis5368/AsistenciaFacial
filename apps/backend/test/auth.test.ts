import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:https';
import { readFileSync } from 'node:fs';
import { once } from 'node:events';
import { argon2 } from 'node:crypto';
import request from 'supertest';
import { AuthService } from '../src/modules/auth/service.js';
import { PasswordHasher } from '../src/modules/auth/password.js';
import { MemorySessions, MemoryRateLimit, digest } from '../src/modules/auth/memory.js';
import type { AuthRepository, AuthUser } from '../src/modules/auth/repository.js';
import { createApp } from '../src/app.js';
import { loadApplicationConfig } from '../src/config/application.js';
import { PrismaAuthRepository } from '../src/repositories/auth.js';

const institutionId='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const password='Synthetic passphrase 2026!';
const nextPassword='Different synthetic passphrase!';
const hasher=new PasswordHasher();
const initialHash=await hasher.hash(password);
class FakeRepository implements AuthRepository {
  exists=true; audits=0;
  user:AuthUser={id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',institutionId,email:'adult@example.test',role:'ADMIN',active:true,passwordHash:initialHash};
  async institutionExists(){return this.exists;}
  async findByEmail(email:string){return email===this.user.email?{...this.user}:null;}
  async findById(id:string){return id===this.user.id?{...this.user}:null;}
  async replacePassword(expected:AuthUser,next:string){if(expected.passwordHash!==this.user.passwordHash||!this.user.active||expected.role!==this.user.role)return false;this.user.passwordHash=next;this.audits++;return true;}
}
const config=loadApplicationConfig({NODE_ENV:'test',API_INSTITUTION_ID:institutionId,API_ORIGIN:'https://localhost:3001',API_CALENDAR_JSON:'[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]'});
const cert=readFileSync('../../.tmp/tls-auth/localhost.crt');
const key=readFileSync('../../.tmp/tls-auth/localhost.key');
async function setup(t:{after:(fn:()=>Promise<void>)=>void},repo=new FakeRepository()){
  const logs:unknown[]=[];const auth=await AuthService.initialize(institutionId,repo);
  const server=createServer({key,cert},createApp(config,e=>logs.push(e),auth));server.listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve())));
  const address=server.address();assert.ok(address&&typeof address!=='string');
  const req=()=>request(`https://127.0.0.1:${address.port}`);
  const login=()=>req().post('/api/v1/auth/login').ca(cert).set('Origin',config.origin).send({email:repo.user.email,password});
  return {repo,auth,logs,req,login};
}
function cookie(r:{headers:Record<string,any>}){return (r.headers['set-cookie'][0] as string).split(';')[0]!;}
function token(c:string){return c.split('=')[1]!;}
test('Argon2id real: sal aleatoria, parámetros PHC, contraseña correcta/incorrecta y vector RFC 9106',async()=>{
  const other=await hasher.hash(password);assert.notEqual(other,initialHash);assert.match(other,/^\$argon2id\$v=19\$m=19456,t=2,p=1\$/);
  assert.equal(await hasher.verify(initialHash,password),true);assert.equal(await hasher.verify(initialHash,'wrong'),false);
  assert.equal(await hasher.verify('$argon2id$v=19$m=99999999,t=9,p=9$malformed','wrong'),false);
  const actual=await new Promise<Buffer>((resolve,reject)=>argon2('argon2id',{message:Buffer.alloc(32,1),nonce:Buffer.alloc(16,2),secret:Buffer.alloc(8,3),associatedData:Buffer.alloc(12,4),parallelism:4,tagLength:32,memory:32,passes:3},(e,b)=>e?reject(e):resolve(b)));
  assert.equal(actual.toString('hex'),'0d640df58d78766c08c037a34a8b53c9d01ef0452d75b65eb52520e96b01e659');
});
test('HTTPS real con doble: login, cookie segura, sesión, CSRF y logout',async t=>{
  const f=await setup(t);const r=await f.login();assert.equal(r.status,200);
  const setCookie=r.headers['set-cookie'][0];for(const flag of ['HttpOnly','Secure','SameSite=Lax','Path=/'])assert.ok(setCookie.includes(flag));assert.ok(!setCookie.includes('Domain='));
  const c=cookie(r);assert.ok(!r.text.includes(token(c)));assert.ok(!r.text.includes('passwordHash'));
  const s=await f.req().get('/api/v1/auth/session').ca(cert).set('Cookie',c);assert.equal(s.status,200);assert.equal(s.body.data.profile.institutionId,institutionId);
  assert.equal((await f.req().post('/api/v1/auth/logout').ca(cert).set('Cookie',c).set('Origin',config.origin).send({})).status,403);
  const out=await f.req().post('/api/v1/auth/logout').ca(cert).set('Cookie',c).set('Origin',config.origin).set('X-CSRF-Token',s.body.data.csrfToken).send({});assert.equal(out.status,204);assert.match(out.headers['set-cookie'][0],/Expires=Thu, 01 Jan 1970/);
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set('Cookie',c)).status,401);
  assert.ok(!JSON.stringify(f.logs).includes(password));assert.ok(!JSON.stringify(f.logs).includes(token(c)));assert.ok(!JSON.stringify(f.logs).includes(s.body.data.csrfToken));
});
test('credenciales inexistentes/inactivas/incorrectas responden igual y no escalan rol',async t=>{
  const f=await setup(t);const results=[];
  for(const email of ['missing@example.test',f.repo.user.email]){const r=await f.req().post('/api/v1/auth/login').ca(cert).set('Origin',config.origin).send({email,password:'wrong'});results.push([r.status,r.body.error.code,r.body.error.message]);}
  f.repo.user.active=false;const r=await f.login();results.push([r.status,r.body.error.code,r.body.error.message]);assert.deepEqual(results[0],results[1]);assert.deepEqual(results[1],results[2]);
  const forged=await f.req().post('/api/v1/auth/login').ca(cert).set('Origin',config.origin).send({email:f.repo.user.email,password,role:'ADMIN',institutionId});assert.equal(forged.status,400);
});
test('login cross-site/sin origen/HTTP rechazado, tokens inválidos y campos estrictos',async t=>{
  const f=await setup(t);
  for(const origin of [undefined,'https://evil.test']){let q=f.req().post('/api/v1/auth/login').ca(cert);if(origin)q=q.set('Origin',origin);assert.equal((await q.send({email:f.repo.user.email,password})).status,403);}
  assert.equal((await request(createApp(config,undefined,f.auth)).post('/api/v1/auth/login').set('Origin',config.origin).send({email:f.repo.user.email,password})).status,403);
  assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set('Cookie','__Host-af_session=bad')).status,401);
  assert.equal((await f.req().post('/api/v1/auth/login').ca(cert).set('Origin',config.origin).set('Sec-Fetch-Site','cross-site').send({email:f.repo.user.email,password})).status,403);
});
test('cambio de contraseña revoca todas las sesiones, compara contraseña y registra auditoría del doble',async t=>{
  const f=await setup(t);const a=await f.login(),b=await f.login();const c=cookie(a);
  const s=await f.req().get('/api/v1/auth/session').ca(cert).set('Cookie',c);
  const change=(currentPassword:string)=>f.req().post('/api/v1/auth/password-change').ca(cert).set('Origin',config.origin).set('Cookie',c).set('X-CSRF-Token',s.body.data.csrfToken).send({currentPassword,newPassword:nextPassword});
  assert.equal((await change('wrong')).status,401);assert.equal((await change(password)).status,204);assert.equal(f.repo.audits,1);
  for(const prior of [cookie(a),cookie(b)])assert.equal((await f.req().get('/api/v1/auth/session').ca(cert).set('Cookie',prior)).status,401);
  assert.equal((await f.login()).status,401);
  assert.equal((await f.req().post('/api/v1/auth/login').ca(cert).set('Origin',config.origin).send({email:f.repo.user.email,password:nextPassword})).status,200);
});
test('límites de login por cuenta e IP se reservan antes de Argon2',async t=>{
  const f=await setup(t);for(let n=0;n<5;n++)assert.equal((await f.login()).status,200);
  const r=await f.login();assert.equal(r.status,429);assert.equal(r.headers['retry-after'],'900');
  const limits=new MemoryRateLimit(()=>0);for(let n=0;n<30;n++)limits.take('ip',30,900000);assert.throws(()=>limits.take('ip',30,900000),/RATE_LIMITED/);
});
test('expiración inactiva/absoluta, máximo de sesiones y almacenamiento solo de digest',()=>{
  let now=0;const sessions=new MemorySessions(()=>now);const t=sessions.issue('u',institutionId,'fp');
  const records=(sessions as any).records as Map<string,unknown>;assert.ok(records.has(digest(t)));assert.ok(!JSON.stringify([...records]).includes(t));
  now=30*60_000;assert.equal(sessions.get(t),undefined);
  now=0;const absolute=sessions.issue('u',institutionId,'fp');for(let n=1;n<16;n++){now=n*29*60_000;sessions.touch(absolute);}now=8*60*60_000;assert.equal(sessions.get(absolute),undefined);
  now=0;const first=sessions.issue('u',institutionId,'fp');for(let n=0;n<5;n++)sessions.issue('u',institutionId,'fp');assert.equal(sessions.get(first),undefined);
});
test('revocación ante cambio de rol/estado/hash, reinicio y otra institución',async()=>{
  for(const change of ['role','active','passwordHash'] as const){const repo=new FakeRepository(),service=await AuthService.initialize(institutionId,repo);const {token}=await service.login(repo.user.email,password,'ip');
    if(change==='role')repo.user.role='TEACHER';if(change==='active')repo.user.active=false;if(change==='passwordHash')repo.user.passwordHash=await hasher.hash(nextPassword);
    await assert.rejects(service.session(token),/AUTH_REQUIRED/);
  }
  const repo=new FakeRepository(),service=await AuthService.initialize(institutionId,repo);const {token}=await service.login(repo.user.email,password,'ip');const restarted=await AuthService.initialize(institutionId,repo);await assert.rejects(restarted.session(token),/AUTH_REQUIRED/);
  const other=await AuthService.initialize('cccccccc-cccc-4ccc-8ccc-cccccccccccc',repo);await assert.rejects(other.login(repo.user.email,password,'ip'),/INVALID_CREDENTIALS/);await assert.rejects(other.session(token),/AUTH_REQUIRED/);
  service.revokeUser(repo.user.id);await assert.rejects(service.session(token),/AUTH_REQUIRED/);
});
test('institución ausente/inexistente falla cerrado antes de emitir sesiones',async()=>{
  const repo=new FakeRepository();await assert.rejects(AuthService.initialize('',repo));repo.exists=false;await assert.rejects(AuthService.initialize(institutionId,repo),/Institución no disponible/);
});
test('repositorio Prisma con doble: contexto transaccional, CAS y auditoría sin queries globales',async()=>{
  const calls:string[]=[];let count=1;
  const tx={$executeRaw:async()=>{calls.push('context');return 1;},institution:{findUnique:async()=>({id:institutionId})},user:{findUnique:async()=>null,updateMany:async(args:any)=>{assert.equal(args.where.institutionId,institutionId);assert.equal(args.where.active,true);calls.push('update');return {count};}},auditEvent:{create:async(args:any)=>{assert.equal(args.data.action,'auth.password_changed');assert.ok(!JSON.stringify(args).includes('passwordHash'));calls.push('audit');}}};
  const db={$transaction:async(fn:(t:typeof tx)=>Promise<any>)=>{calls.push('begin');const r=await fn(tx);calls.push('commit');return r;}};
  const repo=new PrismaAuthRepository(db as never,institutionId);assert.equal(await repo.institutionExists(),true);calls.length=0;
  assert.equal(await repo.replacePassword(new FakeRepository().user,'synthetic'),true);assert.deepEqual(calls,['begin','context','update','audit','commit']);
  calls.length=0;count=0;assert.equal(await repo.replacePassword(new FakeRepository().user,'synthetic'),false);assert.ok(!calls.includes('audit'));
});
