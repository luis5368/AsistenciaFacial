import type { AdministrationTx, AdministrationUnitOfWork, Assignment, Catalog, Kind, Scope } from '../../src/modules/administration/ports.js';
import type { AuthRepository } from '../../src/modules/auth/repository.js';
import { HttpError } from '../../src/http/errors.js';

export const ids = {
  a: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', b: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  admin: '10000000-0000-4000-8000-000000000001', admin2: '10000000-0000-4000-8000-000000000002',
  teacherUser: '10000000-0000-4000-8000-000000000003', teacher: '20000000-0000-4000-8000-000000000001',
  student: '30000000-0000-4000-8000-000000000001', student2: '30000000-0000-4000-8000-000000000002',
  group: '40000000-0000-4000-8000-000000000001', group2: '40000000-0000-4000-8000-000000000002',
};
type Tables = { [K in Kind]: Catalog[K][] };
interface State { tables: Tables; assignments: Assignment[]; audits: { actorId: string; action: string; kind: string; resourceId: string }[] }
/** Deterministic serialized transactional double; not a PostgreSQL/RLS emulator. */
export class MemoryAdministration implements AdministrationUnitOfWork {
  state: State = { tables: { institution: [], user: [], teacher: [], student: [], group: [] }, assignments: [], audits: [] };
  failAudit = false; failCommit = false;
  events: string[] = [];
  private tail = Promise.resolve();
  seed(hash: string) {
    for (const institutionId of [ids.a, ids.b]) {
      const t = this.state.tables;
      t.institution.push({ id: institutionId, name: 'Synthetic institution' });
      for (const [id, email, role] of [[ids.admin, 'admin@example.test', 'ADMIN'], [ids.admin2, 'second@example.test', 'ADMIN'], [ids.teacherUser, 'teacher@example.test', 'TEACHER']] as const)
        t.user.push({ id, institutionId, email, role, active: true, passwordHash: hash });
      t.teacher.push({ id: ids.teacher, institutionId, userId: ids.teacherUser });
      for (const id of [ids.student, ids.student2]) t.student.push({ id, institutionId, studentCode: id, fullName: 'Synthetic student', active: true });
      for (const id of [ids.group, ids.group2]) t.group.push({ id, institutionId, grade: '1', section: id, schoolYear: 2026 });
      this.state.assignments.push({ institutionId, teacherId: ids.teacher, groupId: ids.group, active: true });
    }
  }
  auth(institutionId: string): AuthRepository {
    return {
      institutionExists: async () => this.state.tables.institution.some(x => x.id === institutionId),
      findByEmail: async email => structuredClone(this.state.tables.user.find(x => x.institutionId === institutionId && x.email === email) ?? null),
      findById: async id => structuredClone(this.state.tables.user.find(x => x.institutionId === institutionId && x.id === id) ?? null),
      replacePassword: async (expected, hash) => this.run(institutionId, async tx => {
        const row = await tx.get('user', expected.id);
        if (!row || !row.active || row.role !== expected.role || row.passwordHash !== expected.passwordHash) return false;
        await tx.update('user', row.id, { passwordHash: hash }); await tx.audit(row.id, 'auth.password_changed', 'user', row.id); return true;
      }),
    };
  }
  async run<T>(institutionId: string, action: (tx: AdministrationTx) => Promise<T>): Promise<T> {
    const previous = this.tail; let release!: () => void;
    this.tail = new Promise<void>(resolve => { release = resolve; }); await previous;
    const state = structuredClone(this.state); this.events.push('BEGIN');
    const belongs = <K extends Kind>(kind: K, row: Catalog[K]) => kind === 'institution' ? row.id === institutionId : (row as Catalog['user']).institutionId === institutionId;
    const scoped = <K extends Kind>(kind: K, row: Catalog[K], scope?: Scope) => {
      if (!belongs(kind, row)) return false;
      if (kind === 'group' && scope && !scope.years.includes((row as Catalog['group']).schoolYear)) return false;
      if (!scope?.teacherUserId || !['student', 'group'].includes(kind)) return true;
      const teacher = state.tables.teacher.find(t => t.institutionId === institutionId && t.userId === scope.teacherUserId);
      const user = state.tables.user.find(t => t.institutionId === institutionId && t.id === scope.teacherUserId);
      const groupId = kind === 'group' ? row.id : ids.group;
      const assigned = teacher && user?.active && user.role === 'TEACHER' && state.assignments.some(a => a.institutionId === institutionId && a.teacherId === teacher.id && a.active && a.groupId === groupId);
      // Synthetic read-only enrollment: student belongs to group; student2 has none.
      return !!assigned && (kind === 'group' || row.id === ids.student && (row as Catalog['student']).active);
    };
    const tx: AdministrationTx = {
      lockInstitution: async () => { this.events.push('LOCK'); }, lockActor: async () => { this.events.push('ACTOR'); },
      get: async (kind, id, scope) => structuredClone(state.tables[kind].find(r => r.id === id && scoped(kind, r, scope)) ?? null) as never,
      list: async (kind, page, scope) => structuredClone(state.tables[kind].filter(r => scoped(kind, r, scope) && (!page.after || r.id > page.after)).sort((a,b) => a.id.localeCompare(b.id)).slice(0, page.limit)) as never,
      insert: async (kind, record) => {
        const rows = state.tables[kind] as Catalog[Kind][];
        if (rows.some(r => belongs(kind, r) && (r.id === record.id || kind === 'user' && (r as Catalog['user']).email === (record as Catalog['user']).email || kind === 'teacher' && (r as Catalog['teacher']).userId === (record as Catalog['teacher']).userId))) throw new HttpError('CONFLICT');
        rows.push(structuredClone(record)); return structuredClone(record);
      },
      update: async (kind, id, changes) => {
        const row = state.tables[kind].find(r => r.id === id && belongs(kind, r)); if (!row) throw new HttpError('NOT_FOUND');
        Object.assign(row, changes); this.events.push('WRITE'); return structuredClone(row) as never;
      },
      countActiveAdmins: async () => state.tables.user.filter(u => u.institutionId === institutionId && u.active && u.role === 'ADMIN').length,
      assignment: async (teacherId, groupId) => structuredClone(state.assignments.find(r => r.institutionId === institutionId && r.teacherId === teacherId && r.groupId === groupId) ?? null),
      saveAssignment: async (r, exists) => { if (exists) Object.assign(state.assignments.find(a => a.institutionId === institutionId && a.teacherId === r.teacherId && a.groupId === r.groupId)!, r); else state.assignments.push(r); return r; },
      ownAssignments: async (userId, page, scope) => state.assignments.filter(a => a.institutionId === institutionId && a.active && (!page.after || a.groupId > page.after)
        && state.tables.teacher.some(t => t.institutionId === institutionId && t.id === a.teacherId && t.userId === userId)
        && state.tables.group.some(g => g.institutionId === institutionId && g.id === a.groupId && scope.years.includes(g.schoolYear))).sort((a,b) => a.groupId.localeCompare(b.groupId)).slice(0,page.limit),
      audit: async (actorId, action, kind, resourceId) => { this.events.push('AUDIT'); if (this.failAudit) throw Error('synthetic audit failure'); state.audits.push({ actorId, action, kind, resourceId }); },
    };
    try {
      const result = await action(tx); if (this.failCommit) throw Error('synthetic COMMIT failure');
      this.state = state; this.events.push('COMMIT'); return result;
    } catch (e) { this.events.push('ROLLBACK'); throw e; } finally { release(); }
  }
}
