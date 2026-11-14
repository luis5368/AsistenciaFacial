import { test } from 'node:test';
import assert from 'node:assert/strict';
import { localDatabaseUrl } from '../src/config/database-url.js';
import { createDatabase, withInstitution } from '../src/infrastructure/database.js';

test('solo permite base y roles locales previstos', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    const url = `postgresql://asistencia_app@${host}:5432/asistencia_facial`;
    assert.equal(localDatabaseUrl(url, 'application'), url);
  }
  assert.doesNotThrow(() => localDatabaseUrl('postgresql://asistencia_migrator@localhost:5432/asistencia_facial', 'migration'));
});
test('rechaza red remota, destino alterado, roles compartidos y parámetros', () => {
  for (const url of [undefined, '', 'invalid',
    'postgresql://asistencia_app@remote.test:5432/asistencia_facial',
    'postgresql://asistencia_app@localhost:5433/asistencia_facial',
    'postgresql://asistencia_app@localhost:5432/production',
    'postgresql://asistencia_migrator@localhost:5432/asistencia_facial',
    'postgresql://asistencia_app@localhost:5432/asistencia_facial?host=remote.test',
    'postgresql://asistencia_app@localhost:5432/asistencia_facial#fragment']) {
    assert.throws(() => localDatabaseUrl(url, 'application'));
  }
});
test('errores de configuración no revelan credenciales', () => {
  assert.throws(() => createDatabase('postgresql://asistencia_app:TEST_ONLY_SECRET@remote.test/asistencia_facial'),
    (error: unknown) => error instanceof Error && !error.message.includes('TEST_ONLY_SECRET'));
});
test('construir y cerrar cliente no requiere conexión: no se ejecutan consultas', async () => {
  const db = createDatabase('postgresql://asistencia_app@127.0.0.1:5432/asistencia_facial');
  await db.$disconnect();
});
test('rechaza institución inválida antes de abrir transacción', async () => {
  let called = false;
  const db = { $transaction() { called = true; throw new Error('No debe consultar'); } };
  await assert.rejects(withInstitution(db as never, 'invalid', async () => 1));
  assert.equal(called, false);
});
test('contexto institucional parametrizado se configura dentro de la transacción', async () => {
  const calls: unknown[] = [];
  const tx = { async $executeRaw(sql: TemplateStringsArray, value: string) {
    calls.push([sql.join('?'), value]); return 1;
  } };
  const db = { async $transaction(fn: (client: typeof tx) => Promise<number>) { return fn(tx); } };
  const institutionId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  assert.equal(await withInstitution(db as never, institutionId, async () => { calls.push('operation'); return 3; }), 3);
  assert.deepEqual(calls, [["SELECT set_config('app.institution_id', ?, true)", institutionId], 'operation']);
  // Doble de transacción: NO acredita que RLS funcione en PostgreSQL.
});
