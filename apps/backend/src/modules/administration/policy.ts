import type { AuthUser } from '../auth/repository.js';
import type { Catalog, Kind } from './ports.js';
import { HttpError } from '../../http/errors.js';
import { makeEtag } from '../../http/validation.js';

export function requireAdmin(actor: AuthUser) {
  if (actor.role !== 'ADMIN') throw new HttpError('FORBIDDEN');
}
export function verifyActor(expected: AuthUser, current: AuthUser | null, institutionId: string) {
  if (!current || !current.active || current.institutionId !== institutionId || expected.institutionId !== institutionId
    || current.id !== expected.id || current.role !== expected.role || current.passwordHash !== expected.passwordHash) {
    throw new HttpError('AUTH_REQUIRED');
  }
}
/** Explicit projections: neither Prisma extras nor passwordHash can enter HTTP/ETag. */
export function project<K extends Kind>(kind: K, row: Catalog[K]): Record<string, string | number | boolean> {
  switch (kind) {
    case 'institution': { const r = row as Catalog['institution']; return { id: r.id, name: r.name }; }
    case 'user': { const r = row as Catalog['user']; return { id: r.id, email: r.email, role: r.role, active: r.active }; }
    case 'teacher': { const r = row as Catalog['teacher']; return { id: r.id, userId: r.userId }; }
    case 'student': { const r = row as Catalog['student']; return { id: r.id, studentCode: r.studentCode, fullName: r.fullName, active: r.active }; }
    case 'group': { const r = row as Catalog['group']; return { id: r.id, grade: r.grade, section: r.section, schoolYear: r.schoolYear }; }
  }
  throw new HttpError('INVALID_REQUEST');
}
export function representation<K extends Kind>(institutionId: string, kind: K, row: Catalog[K]) {
  const data = project(kind, row);
  return { data, etag: makeEtag([institutionId, kind, ...Object.values(data)]) };
}
