import { createHash } from 'node:crypto';

export interface ManualAttendanceEvent {
  schema_version: 1;
  event_uuid: string;
  student_id: string;
  session_id: string;
  device_id: string;
  occurred_at_client: string;
  method: 'manual';
}

export interface AuthenticatedActor {
  institutionId: string;
  userId: string;
}

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const allowed = ['schema_version', 'event_uuid', 'student_id', 'session_id', 'device_id', 'occurred_at_client', 'method'];

export function parseManualEvent(input: unknown): ManualAttendanceEvent {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Evento inválido.');
  const event = input as Record<string, unknown>;
  if (Object.keys(event).length !== allowed.length || Object.keys(event).some((key) => !allowed.includes(key))
    || event.schema_version !== 1 || event.method !== 'manual') throw new Error('Contrato no admitido.');
  for (const key of ['event_uuid', 'student_id', 'session_id', 'device_id']) {
    if (typeof event[key] !== 'string' || !uuid.test(event[key])) throw new Error('UUID inválido.');
  }
  // Exige UTC canónico con milisegundos; evita normalización silenciosa de fechas imposibles.
  if (typeof event.occurred_at_client !== 'string'
    || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(event.occurred_at_client)
    || !Number.isFinite(Date.parse(event.occurred_at_client))
    || new Date(event.occurred_at_client).toISOString() !== event.occurred_at_client) throw new Error('Fecha UTC inválida.');
  return {
    schema_version: 1, event_uuid: (event.event_uuid as string).toLowerCase(),
    student_id: (event.student_id as string).toLowerCase(), session_id: (event.session_id as string).toLowerCase(),
    device_id: (event.device_id as string).toLowerCase(), occurred_at_client: event.occurred_at_client, method: 'manual',
  };
}

export function attendanceHash(input: unknown, actor: AuthenticatedActor): string {
  if (!uuid.test(actor.institutionId) || !uuid.test(actor.userId)) throw new Error('Actor inválido.');
  const event = parseManualEvent(input);
  // Orden explícito, sin nombres, imágenes ni embeddings. No se usa como autorización.
  return createHash('sha256').update(JSON.stringify([
    event.schema_version, actor.institutionId.toLowerCase(), actor.userId.toLowerCase(),
    event.event_uuid, event.student_id, event.session_id, event.device_id, event.occurred_at_client, event.method,
  ])).digest('hex');
}

export function classifyReplay(existingHash: string | null, incomingHash: string) {
  return existingHash === null ? 'new' : existingHash === incomingHash ? 'already_accepted' : 'needs_review';
}

export type AttendanceState = 'ACTIVE' | 'VOID';
export interface CorrectionCommand {
  correctionId: string;
  attendanceId: string;
  expectedVersion: number;
  toStatus: AttendanceState;
  reason: 'REGISTRATION_ERROR' | 'REVIEW_CONFIRMED';
}

export function validateCorrection(command: CorrectionCommand, current: { version: number; status: AttendanceState }) {
  if (!uuid.test(command.correctionId) || !uuid.test(command.attendanceId)
    || !Number.isSafeInteger(command.expectedVersion) || command.expectedVersion < 1
    || command.expectedVersion !== current.version) throw new Error('Corrección inválida o versión en conflicto.');
  if (!['ACTIVE', 'VOID'].includes(command.toStatus) || command.toStatus === current.status
    || !['REGISTRATION_ERROR', 'REVIEW_CONFIRMED'].includes(command.reason)) throw new Error('Transición inválida.');
  return { fromVersion: current.version, toVersion: current.version + 1, fromStatus: current.status, toStatus: command.toStatus };
}
