import { z } from 'zod';

export const uuid = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
export const utc = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine(value => Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value);
const text = (max: number) => z.string().min(1).max(max).refine(value => value.trim().length > 0);
const email = z.email().max(254).refine(value => value === value.trim().toLowerCase());
const password = z.string().min(15).max(128);
const role = z.enum(['ADMIN', 'TEACHER']);
const period = { startsAt: utc, endsAt: utc };
const ordered = (v: {startsAt: string; endsAt?: string | null}) => !v.endsAt || v.startsAt < v.endsAt;
const patch = <T extends z.ZodRawShape>(shape: T) => z.strictObject(shape).partial().refine(v => Object.keys(v).length > 0);

/** Contratos preparados; no registran rutas ni realizan consultas. */
export const schemas = {
  Empty: z.strictObject({}),
  Login: z.strictObject({ email: z.string().max(254).transform(v=>v.trim().toLowerCase()).pipe(email), password: z.string().min(1).max(128) }),
  PasswordChange: z.strictObject({ currentPassword: z.string().min(1).max(128), newPassword: password }),
  InstitutionPatch: patch({ name: text(160) }),
  UserCreate: z.strictObject({ email, role, password }),
  UserPatch: patch({ email, role, active: z.boolean() }),
  TeacherCreate: z.strictObject({ userId: uuid }),
  AssignmentPut: z.strictObject({ active: z.boolean() }),
  StudentCreate: z.strictObject({ studentCode: text(64), fullName: text(200) }),
  StudentPatch: patch({ studentCode: text(64), fullName: text(200), active: z.boolean() }),
  GroupCreate: z.strictObject({ grade: text(80), section: text(40), schoolYear: z.number().int().min(2000).max(2200) }),
  GroupPatch: patch({ grade: text(80), section: text(40) }),
  EnrollmentCreate: z.strictObject({ studentId: uuid, startsAt: utc, endsAt: utc.nullable().optional() }).refine(ordered),
  EnrollmentPatch: patch({ startsAt: utc, endsAt: utc.nullable() }),
  SessionCreate: z.strictObject(period).refine(ordered),
  SessionPatch: patch(period),
  SessionTransition: z.strictObject({ toStatus: z.enum(['OPEN', 'CLOSED', 'CANCELLED']) }),
  DeviceCreate: z.strictObject({ assignedUserId: uuid, expiresAt: utc }),
  ManualEvent: z.strictObject({ schema_version: z.literal(1), event_uuid: uuid, student_id: uuid,
    session_id: uuid, device_id: uuid, occurred_at_client: utc, method: z.literal('manual') }),
  Correction: z.strictObject({ correctionId: uuid, expectedVersion: z.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
    toStatus: z.enum(['ACTIVE', 'VOID']), reason: z.enum(['REGISTRATION_ERROR', 'REVIEW_CONFIRMED']) }),
  Pagination: z.strictObject({ limit: z.string().regex(/^(?:[1-9]|[1-9][0-9]|100)$/).optional(),
    cursor: z.string().regex(/^[A-Za-z0-9_-]+$/).max(512).optional() }),
  DateRange: z.strictObject({ from: utc, to: utc }).refine(v => v.from < v.to
    && Date.parse(v.to) - Date.parse(v.from) <= 31 * 24 * 60 * 60 * 1000),
};
export const syncSchema = z.strictObject({ events: z.array(schemas.ManualEvent).min(1).max(100) });
export type ManualEventDto = z.infer<typeof schemas.ManualEvent>;
export type CorrectionDto = z.infer<typeof schemas.Correction>;
export const etagSchema = z.string().regex(/^"[a-f0-9]{64}"$/);

export function parsePagination(input: unknown) {
  const v = schemas.Pagination.parse(input);
  return { limit: v.limit === undefined ? 50 : Number(v.limit), cursor: v.cursor };
}
