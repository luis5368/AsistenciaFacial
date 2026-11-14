import {test} from 'node:test';
import assert from 'node:assert/strict';
import {sandboxMigrationUrl} from '../src/config/sandbox-url.js';
const base='postgresql://asistencia_migrator@localhost:5432/asistencia_facial_sandbox';
test('sandbox acepta solo destino local y schema public opcional',()=>{
  assert.equal(sandboxMigrationUrl(base),base);
  assert.equal(sandboxMigrationUrl(base+'?schema=public'),base+'?schema=public');
});
test('sandbox rechaza principal, roles, puertos, host y parámetros alternativos',()=>{
  for(const value of [base.replace('_sandbox',''),base.replace('migrator','app'),base.replace('localhost','remote.invalid'),
    base.replace('5432','5433'),base+'?host=remote.invalid',base+'?schema=other',base+'?schema=public&schema=public',base+'#fragment','invalid']) {
    assert.throws(()=>sandboxMigrationUrl(value));
  }
});
test('sandbox no expone autenticación en los errores',()=>{
  assert.throws(()=>sandboxMigrationUrl('postgresql://asistencia_migrator:TEST_ONLY@remote.invalid:5432/asistencia_facial_sandbox'),
    (e:unknown)=>e instanceof Error&&!e.message.includes('TEST_ONLY'));
});
