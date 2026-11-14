import { test } from 'node:test';
import assert from 'node:assert/strict';
import { attendanceHash, classifyReplay, parseManualEvent, validateCorrection } from '../src/domain/attendance.js';

const id = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const other = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const actor = { institutionId: id, userId: id };
const event = { schema_version: 1, event_uuid: id, student_id: id, session_id: id,
  device_id: id, occurred_at_client: '2026-11-13T12:00:00.000Z', method: 'manual' };

test('reintento conserva hash pese al orden de claves y mayúsculas UUID', () => {
  const reordered = Object.fromEntries(Object.entries(event).reverse());
  assert.equal(attendanceHash(event, actor), attendanceHash({ ...reordered, event_uuid: id.toUpperCase() }, actor));
  assert.equal(classifyReplay(attendanceHash(event, actor), attendanceHash(reordered, actor)), 'already_accepted');
});
test('UUID reutilizado con otro estudiante genera conflicto', () => {
  assert.equal(classifyReplay(attendanceHash(event, actor), attendanceHash({ ...event, student_id: other }, actor)), 'needs_review');
  assert.equal(classifyReplay(null, attendanceHash(event, actor)), 'new');
});
test('institución y actor autenticados forman parte del contenido canónico', () => {
  assert.notEqual(attendanceHash(event, actor), attendanceHash(event, { ...actor, institutionId: other }));
  assert.notEqual(attendanceHash(event, actor), attendanceHash(event, { ...actor, userId: other }));
});
test('rechaza campos suplantados o biométricos y método no habilitado', () => {
  for (const key of ['institution_id', 'created_by', 'embedding', 'photo', 'full_name']) {
    assert.throws(() => parseManualEvent({ ...event, [key]: 'prohibido' }));
  }
  assert.throws(() => parseManualEvent({ ...event, method: 'biometric_confirmed' }));
});
test('rechaza versiones, UUIDs y fechas inválidas', () => {
  for (const changed of [{ schema_version: 2 }, { student_id: '1' },
    { occurred_at_client: '2026-02-30T12:00:00.000Z' }, { occurred_at_client: '2026-11-13' }]) {
    assert.throws(() => parseManualEvent({ ...event, ...changed }));
  }
  assert.throws(() => parseManualEvent(null));
});
test('corrección exige versión vigente, motivo y transición explícita', () => {
  const command = { correctionId: id, attendanceId: id, expectedVersion: 1,
    toStatus: 'VOID' as const, reason: 'REGISTRATION_ERROR' as const };
  assert.deepEqual(validateCorrection(command, { version: 1, status: 'ACTIVE' }),
    { fromVersion: 1, toVersion: 2, fromStatus: 'ACTIVE', toStatus: 'VOID' });
  assert.throws(() => validateCorrection(command, { version: 2, status: 'ACTIVE' }));
  assert.throws(() => validateCorrection(command, { version: 1, status: 'VOID' }));
});
