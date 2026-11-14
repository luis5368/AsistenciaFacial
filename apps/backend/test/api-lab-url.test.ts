import { test } from 'node:test';
import assert from 'node:assert/strict';
import { apiLabUrl } from '../src/config/api-lab-url.js';

test('API lab: acepta exclusivamente localhost:5432 y el rol solicitado', () => {
  for (const role of ['asistencia_app', 'asistencia_migrator'] as const) {
    const url = `postgresql://${role}@localhost:5432/asistencia_facial_api_lab`;
    assert.equal(apiLabUrl(url, role), url);
  }
});
test('API lab: rechaza bases protegidas, otros roles, parámetros y destinos alternativos', () => {
  const valid = 'postgresql://asistencia_app@localhost:5432/asistencia_facial_api_lab';
  for (const value of [undefined, '', ...['asistencia_facial','asistencia_facial_sandbox','asistencia_facial_restore_check'].map(db => valid.replace('asistencia_facial_api_lab',db)),
    valid.replace('asistencia_app','postgres'),valid.replace('asistencia_app','asistencia_migrator'),valid.replace('localhost','127.0.0.1'),
    valid.replace('5432','5433'),valid+'?schema=public',valid+'#fragment']) {
    assert.throws(() => apiLabUrl(value, 'asistencia_app'), { message: 'Destino o rol de laboratorio API no autorizado.' });
  }
});
