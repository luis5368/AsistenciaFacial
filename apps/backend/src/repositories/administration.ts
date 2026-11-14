import type { Prisma, PrismaClient } from '../generated/prisma/client.js';
import { withInstitution } from '../infrastructure/database.js';
import { HttpError } from '../http/errors.js';
import type { AdministrationTx, AdministrationUnitOfWork, Assignment, Catalog, Kind, Page, Scope } from '../modules/administration/ports.js';

/** Dormant adapter: never imported/constructed by server.ts in this stage. */
export class PrismaAdministrationUnitOfWork implements AdministrationUnitOfWork {
  constructor(private readonly db: PrismaClient) {}
  async run<T>(institutionId: string, action: (tx: AdministrationTx) => Promise<T>): Promise<T> {
    try { return await withInstitution(this.db, institutionId, tx => action(new PrismaAdministrationTx(tx, institutionId)), { isolationLevel: 'ReadCommitted' }); }
    catch (error) {
      const code = error && typeof error === 'object' && 'code' in error ? error.code : undefined;
      if (code === 'P2002') throw new HttpError('CONFLICT');
      if (code === 'P2003') throw new HttpError('INVALID_REFERENCE');
      if (code === 'P2034') throw new HttpError('CONFLICT');
      throw error;
    }
  }
}

class PrismaAdministrationTx implements AdministrationTx {
  constructor(private readonly tx: Prisma.TransactionClient, private readonly institutionId: string) {}
  async lockInstitution() {
    const rows = await this.tx.$queryRaw<{ id: string }[]>`SELECT id FROM institutions WHERE id = ${this.institutionId}::uuid FOR UPDATE`;
    if (rows.length !== 1) throw new HttpError('NOT_FOUND');
  }
  async lockActor(id: string) {
    await this.tx.$queryRaw`SELECT id FROM users WHERE institution_id = ${this.institutionId}::uuid AND id = ${id}::uuid FOR SHARE`;
  }
  private groupScope(scope?: Scope): Prisma.GroupWhereInput {
    if (!scope) return {};
    return { schoolYear: { in: scope.years }, ...(scope.teacherUserId ? {
      assignments: { some: { institutionId: this.institutionId, active: true,
        teacher: { institutionId: this.institutionId, userId: scope.teacherUserId,
          user: { institutionId: this.institutionId, active: true, role: 'TEACHER' } } } },
    } : {}) };
  }
  private studentScope(scope?: Scope): Prisma.StudentWhereInput {
    if (!scope?.teacherUserId) return {};
    return { active: true, enrollments: { some: { institutionId: this.institutionId,
      startsAt: { lte: scope.now }, OR: [{ endsAt: null }, { endsAt: { gt: scope.now } }],
      group: this.groupScope(scope) } } };
  }
  async get<K extends Kind>(kind: K, id: string, scope?: Scope): Promise<Catalog[K] | null> {
    const where = { institutionId: this.institutionId, id };
    let row: Catalog[Kind] | null;
    switch (kind) {
      case 'institution': row = await this.tx.institution.findFirst({ where: { id: this.institutionId, AND: { id } } }); break;
      case 'user': row = await this.tx.user.findFirst({ where }); break;
      case 'teacher': row = await this.tx.teacher.findFirst({ where }); break;
      case 'student': row = await this.tx.student.findFirst({ where: { ...where, ...this.studentScope(scope) } }); break;
      case 'group': row = await this.tx.group.findFirst({ where: { ...where, ...this.groupScope(scope) } }); break;
    }
    return row! as Catalog[K] | null;
  }
  async list<K extends Kind>(kind: K, page: Page, scope: Scope): Promise<Catalog[K][]> {
    const where = { institutionId: this.institutionId, ...(page.after ? { id: { gt: page.after } } : {}) };
    const options = { take: page.limit, orderBy: { id: 'asc' as const } };
    let rows: Catalog[Kind][];
    switch (kind) {
      case 'institution': throw new HttpError('FORBIDDEN');
      case 'user': rows = await this.tx.user.findMany({ where, ...options }); break;
      case 'teacher': rows = await this.tx.teacher.findMany({ where, ...options }); break;
      case 'student': rows = await this.tx.student.findMany({ where: { ...where, ...this.studentScope(scope) }, ...options }); break;
      case 'group': rows = await this.tx.group.findMany({ where: { ...where, ...this.groupScope(scope) }, ...options }); break;
    }
    return rows! as Catalog[K][];
  }
  async insert<K extends Kind>(kind: K, record: Catalog[K]): Promise<Catalog[K]> {
    let result: Catalog[Kind];
    switch (kind) {
      case 'institution': throw new HttpError('FORBIDDEN');
      case 'user': { const r = record as Catalog['user']; result = await this.tx.user.create({ data: { ...r, institutionId: this.institutionId } }); break; }
      case 'teacher': { const r = record as Catalog['teacher']; result = await this.tx.teacher.create({ data: { ...r, institutionId: this.institutionId } }); break; }
      case 'student': { const r = record as Catalog['student']; result = await this.tx.student.create({ data: { ...r, institutionId: this.institutionId } }); break; }
      case 'group': { const r = record as Catalog['group']; result = await this.tx.group.create({ data: { ...r, institutionId: this.institutionId } }); break; }
    }
    return result! as Catalog[K];
  }
  async update<K extends Kind>(kind: K, id: string, changes: Partial<Catalog[K]>): Promise<Catalog[K]> {
    const where = { institutionId_id: { institutionId: this.institutionId, id } };
    let result: Catalog[Kind];
    // Explicit mutable columns; no identity, password or year may be changed here.
    switch (kind) {
      case 'institution': { if (id !== this.institutionId) throw new HttpError('NOT_FOUND'); const c = changes as Partial<Catalog['institution']>;
        result = await this.tx.institution.update({ where: { id: this.institutionId }, data: { name: c.name } }); break; }
      case 'user': { const c = changes as Partial<Catalog['user']>; result = await this.tx.user.update({ where, data: { email: c.email, role: c.role, active: c.active } }); break; }
      case 'student': { const c = changes as Partial<Catalog['student']>; result = await this.tx.student.update({ where, data: { studentCode: c.studentCode, fullName: c.fullName, active: c.active } }); break; }
      case 'group': { const c = changes as Partial<Catalog['group']>; result = await this.tx.group.update({ where, data: { grade: c.grade, section: c.section } }); break; }
      case 'teacher': throw new HttpError('FORBIDDEN');
    }
    return result! as Catalog[K];
  }
  countActiveAdmins() { return this.tx.user.count({ where: { institutionId: this.institutionId, active: true, role: 'ADMIN' } }); }
  assignment(teacherId: string, groupId: string) {
    return this.tx.teacherAssignment.findUnique({ where: { institutionId_teacherId_groupId: { institutionId: this.institutionId, teacherId, groupId } } });
  }
  saveAssignment(r: Assignment, exists: boolean) {
    const key = { institutionId: this.institutionId, teacherId: r.teacherId, groupId: r.groupId };
    return exists ? this.tx.teacherAssignment.update({ where: { institutionId_teacherId_groupId: key }, data: { active: r.active } })
      : this.tx.teacherAssignment.create({ data: { ...key, active: r.active } });
  }
  ownAssignments(userId: string, page: Page, scope: Scope) {
    return this.tx.teacherAssignment.findMany({ where: { institutionId: this.institutionId, active: true,
      ...(page.after ? { groupId: { gt: page.after } } : {}),
      teacher: { institutionId: this.institutionId, userId, user: { active: true, role: 'TEACHER', institutionId: this.institutionId } },
      group: { institutionId: this.institutionId, schoolYear: { in: scope.years } } }, orderBy: { groupId: 'asc' }, take: page.limit });
  }
  async audit(actorId: string, action: string, kind: string, resourceId: string) {
    await this.tx.auditEvent.create({ data: { institutionId: this.institutionId, actorId, action, resourceType: kind, resourceId } });
  }
}
