import { test } from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import express from 'express';
import { createApp } from '../src/app.js';
import { loadApplicationConfig } from '../src/config/application.js';
import { errorHandler } from '../src/http/errors.js';
import { security } from '../src/http/security.js';

const config = loadApplicationConfig({ NODE_ENV: 'test', API_INSTITUTION_ID: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  API_CALENDAR_JSON: '[{"schoolYear":2026,"startsAt":"2026-01-01T06:00:00.000Z","endsAt":"2027-01-01T06:00:00.000Z"}]' });
test('salud mínima, cabeceras y requestId independiente del cliente', async () => {
  const app = createApp(config);
  const r = await request(app).get('/api/v1/health').set('X-Request-Id', 'PRIVATE_TOKEN');
  assert.equal(r.status, 200); assert.deepEqual(r.body, { status: 'ok' });
  assert.match(r.headers['x-request-id'], /^[a-f0-9-]{36}$/);
  assert.equal(r.headers['cache-control'], 'no-store'); assert.equal(r.headers['x-powered-by'], undefined);
  assert.equal(r.headers['x-content-type-options'], 'nosniff'); assert.equal(r.headers['access-control-allow-origin'], undefined);
  assert.equal((await request(app).head('/api/v1/health')).status, 200);
});
test('rutas no autorizadas no existen y salud solo admite GET/HEAD', async () => {
  const app = createApp(config);
  for (const path of ['/health', '/api/v1/auth/login', '/api/v1/users', '/api/v1/sync/attendances']) {
    const r = await request(app).post(path).send({}); assert.equal(r.status, 404);
    assert.equal(r.body.error.code, 'NOT_FOUND');
  }
  const r = await request(app).post('/api/v1/health').send({});
  assert.equal(r.status, 405); assert.equal(r.headers.allow, 'GET, HEAD');
});
test('rechaza JSON malformado, primitivos, formato y tamaño sin reflejar cuerpo', async () => {
  const app = createApp(config);
  for (const body of ['{"secret":"PRIVATE_TOKEN"', '42']) {
    const r = await request(app).post('/missing').set('Content-Type','application/json').send(body);
    assert.equal(r.status,400); assert.ok(!r.text.includes('PRIVATE_TOKEN'));
  }
  assert.equal((await request(app).post('/missing').type('text').send('private')).status,415);
  assert.equal((await request(app).post('/missing').send({data:'a'.repeat(262144)})).status,413);
  assert.equal((await request(app).get('/api/v1/health?institutionId=private')).status,400);
  assert.equal((await request(app).get('/api/v1/health').send({})).status,400);
});
test('rechaza origen extraño, contexto falsificado y ETag inválido', async () => {
  const app=createApp(config);
  assert.equal((await request(app).get('/api/v1/health').set('Origin','https://evil.test')).status,403);
  assert.equal((await request(app).get('/api/v1/health').set('Origin',config.origin)).status,200);
  for (const [key,val] of [['X-Institution-Id','private'],['X-Role','ADMIN'],['If-Match','*']]) {
    assert.equal((await request(app).get('/api/v1/health').set(key!,val!)).status,400);
  }
});
test('errores desconocidos y logs no revelan URL, contraseña, ruta ni cuerpo', async () => {
  const logs: unknown[]=[];
  // Aplicación de prueba, nunca montada en createApp.
  const app=express(); app.use(security(config.origin,e=>logs.push(e)));
  app.get('/private',()=>{throw new Error('postgresql://user:SECRET@localhost/private');});app.use(errorHandler);
  const r=await request(app).get('/private').set('Cookie','secret=SECRET');
  assert.equal(r.status,500); assert.ok(!r.text.includes('SECRET'));assert.equal(r.body.error.requestId,r.headers['x-request-id']);
  assert.equal(logs.length,1);assert.deepEqual(Object.keys(logs[0] as object).sort(),['durationMs','requestId','status']);
  assert.ok(!JSON.stringify(logs).includes('SECRET'));
});
