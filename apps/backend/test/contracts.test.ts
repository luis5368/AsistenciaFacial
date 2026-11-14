import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { schemas, syncSchema, parsePagination } from '../src/http/contracts.js';
import { makeEtag, requireIfMatch, parseDto } from '../src/http/validation.js';
import { loadApplicationConfig } from '../src/config/application.js';
import { parseManualEvent, attendanceHash } from '../src/domain/attendance.js';
import { inPrincipalTransaction } from '../src/repositories/context.js';
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const env={NODE_ENV:'test',API_INSTITUTION_ID:id,API_CALENDAR_JSON:'[{"schoolYear":2026,"startsAt":"2026-01-01T00:00:00.000Z","endsAt":"2027-01-01T00:00:00.000Z"}]'};
const event={schema_version:1,event_uuid:id,student_id:id,session_id:id,device_id:id,occurred_at_client:'2026-11-13T12:00:00.000Z',method:'manual'};
test('configuración fail-closed sin datos secretos y calendario institucional inmutable',()=>{
  const c=loadApplicationConfig(env);assert.equal(c.syncMaxAgeHours,24);assert.equal(c.futureToleranceMinutes,5);assert.ok(Object.isFrozen(c.calendar));
  for(const override of [{API_INSTITUTION_ID:''},{API_CALENDAR_JSON:'SECRET'},{NODE_ENV:'production'},{API_ORIGIN:'https://user:SECRET@evil.test'},{SYNC_MAX_AGE_HOURS:'0'},{SYNC_FUTURE_TOLERANCE_MINUTES:'5.5'},{API_CALENDAR_JSON:'[]'}]){
    assert.throws(()=>loadApplicationConfig({...env,...override}),e=>e instanceof Error&&!e.message.includes('SECRET'));
  }
});
test('DTO manual preserva contrato y hash; rechaza actor, tenant, biometría y fechas imposibles',()=>{
  const parsed=parseDto(schemas.ManualEvent,event);assert.deepEqual(parsed,parseManualEvent(event));
  assert.equal(attendanceHash(parsed,{institutionId:id,userId:id}),attendanceHash(event,{institutionId:id,userId:id}));
  for(const extra of ['institutionId','createdBy','enrollmentId','embedding','payloadHash'])assert.equal(schemas.ManualEvent.safeParse({...event,[extra]:id}).success,false);
  assert.equal(schemas.ManualEvent.safeParse({...event,occurred_at_client:'2026-02-30T00:00:00.000Z'}).success,false);
  assert.equal(syncSchema.safeParse({events:Array(101).fill(event)}).success,false);
  assert.equal(syncSchema.safeParse({events:[event]}).success,true);
});
test('DTO estrictos de catálogos y corrección; no mutar identificadores',()=>{
  assert.equal(schemas.UserPatch.safeParse({role:'SUPERADMIN'}).success,false);
  assert.equal(schemas.EnrollmentPatch.safeParse({studentId:id}).success,false);
  assert.equal(schemas.GroupPatch.safeParse({schoolYear:2027}).success,false);
  assert.equal(schemas.StudentPatch.safeParse({}).success,false);
  assert.equal(schemas.SessionCreate.safeParse({startsAt:'2026-02-01T00:00:00.000Z',endsAt:'2026-01-01T00:00:00.000Z'}).success,false);
  assert.equal(schemas.Correction.safeParse({correctionId:id,expectedVersion:0,toStatus:'VOID',reason:'REGISTRATION_ERROR'}).success,false);
  assert.equal(schemas.DateRange.safeParse({from:'2026-01-01T00:00:00.000Z',to:'2026-03-01T00:00:00.000Z'}).success,false);
});
test('paginación acotada y ETag fuerte con precondición explícita',()=>{
  assert.equal(parsePagination({}).limit,50);assert.throws(()=>parsePagination({limit:'101'}));assert.throws(()=>parsePagination({limit:['2','3']}));
  const tag=makeEtag(['a',1]);assert.doesNotThrow(()=>requireIfMatch(tag,tag));
  assert.throws(()=>requireIfMatch(undefined,tag),/PRECONDITION_REQUIRED/);
  assert.throws(()=>requireIfMatch('*',tag),/INVALID_HEADER/);
  assert.throws(()=>requireIfMatch(makeEtag(['b']),tag),/PRECONDITION_FAILED/);
});
test('repositorios solo reciben tx con contexto, rechazan principal de otra institución antes de consultar',async()=>{
  const calls:string[]=[];const tx={$executeRaw:async()=>{calls.push('context');return 1;}};
  const db={$transaction:async(fn:(t:typeof tx)=>Promise<number>)=>{calls.push('begin');const n=await fn(tx);calls.push('commit');return n;}};
  const actor={institutionId:id,userId:id,role:'ADMIN' as const};
  assert.equal(await inPrincipalTransaction(db as never,id,actor,async c=>{assert.equal(c.tx,tx);calls.push('work');return 7;}),7);
  assert.deepEqual(calls,['begin','context','work','commit']);calls.length=0;
  await assert.rejects(inPrincipalTransaction(db as never,'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',actor,async()=>1));assert.deepEqual(calls,[]);
});
test('OpenAPI distingue implementación, pruebas con dobles y activación administrativa pendiente',()=>{
  const spec=JSON.parse(readFileSync('../../docs/openapi-v1.json','utf8'));
  assert.equal(spec.openapi,'3.1.0');assert.equal(spec.paths['/api/v1/health'].get['x-implemented'],true);
  for(const [path,methods] of Object.entries(spec.paths))for(const op of Object.values(methods as object)){
    const admin=/^\/api\/v1\/(?:institution|me(?:\/assignments)?|(?:users|teachers|students|groups)(?:\/\{id\})?|teachers\/\{id\}\/assignments\/\{groupId\})$/.test(path);
    const runtime=path==='/api/v1/health'||path.startsWith('/api/v1/auth/');
    assert.equal((op as any)['x-implemented'],runtime||admin);assert.equal((op as any)['x-runtime-enabled'],runtime);
    assert.equal((op as any)['x-postgresql-validated'],false);
    if(admin){assert.equal((op as any)['x-tested'],'automated-doubles');assert.ok((op as any)['x-pending-activation'].includes('explicit-authorization'));}
  }
  assert.equal(spec.components.schemas.ManualEvent.additionalProperties,false);
});
