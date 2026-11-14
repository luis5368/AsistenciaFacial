import { randomUUID, randomBytes, createHmac, timingSafeEqual } from 'node:crypto';
import type { z } from 'zod';
import type { ApplicationConfig } from '../../config/application.js';
import { schemas, uuid } from '../../http/contracts.js';
import { parseDto, makeEtag, requireIfMatch } from '../../http/validation.js';
import { HttpError } from '../../http/errors.js';
import type { AuthUser } from '../auth/repository.js';
import { PasswordHasher } from '../auth/password.js';
import type { AdministrationUnitOfWork, AdministrationTx, Catalog, Kind, Scope } from './ports.js';
import { project, representation, requireAdmin, verifyActor } from './policy.js';

const createSchemas = { user: schemas.UserCreate, teacher: schemas.TeacherCreate, student: schemas.StudentCreate, group: schemas.GroupCreate };
const patchSchemas = { institution: schemas.InstitutionPatch, user: schemas.UserPatch, student: schemas.StudentPatch, group: schemas.GroupPatch };
export type Creatable = keyof typeof createSchemas;
export type Patchable = keyof typeof patchSchemas;

export class AdministrationService {
  private readonly cursorKey = randomBytes(32);
  constructor(private readonly config: ApplicationConfig, private readonly uow: AdministrationUnitOfWork,
    private readonly revokeUser: (id: string) => void, private readonly hasher = new PasswordHasher(), private readonly now = () => new Date()) {}

  private transaction<T>(actor: AuthUser, action: (tx: AdministrationTx) => Promise<T>): Promise<T> {
    if (actor.institutionId !== this.config.institutionId) return Promise.reject(new HttpError('FORBIDDEN'));
    return this.uow.run(this.config.institutionId, async tx => {
      await tx.lockInstitution();
      await tx.lockActor(actor.id);
      verifyActor(actor, await tx.get('user', actor.id), this.config.institutionId);
      return action(tx);
    });
  }
  private scope(actor: AuthUser): Scope {
    return { ...(actor.role === 'TEACHER' ? { teacherUserId: actor.id } : {}), years: this.config.calendar.map(p => p.schoolYear), now: this.now() };
  }
  private checkRead(actor: AuthUser, kind: Kind) {
    if (kind === 'user' || kind === 'teacher') requireAdmin(actor);
  }
  private cursor(actor: AuthUser, kind: string, last: string) {
    const data = Buffer.from(JSON.stringify([this.config.institutionId, actor.id, kind, last])).toString('base64url');
    const mac = createHmac('sha256', this.cursorKey).update(data).digest('base64url');
    // Single base64url string preserves the existing pagination contract.
    return Buffer.from(data + '.' + mac).toString('base64url');
  }
  private page(actor: AuthUser, kind: string, input: unknown) {
    const p = parseDto(schemas.Pagination, input);
    let after: string | undefined;
    if (p.cursor) {
      try {
        const [data, mac, extra] = Buffer.from(p.cursor, 'base64url').toString().split('.');
        if (!data || !mac || extra || !/^[A-Za-z0-9_-]{43}$/.test(mac)) throw Error();
        const expected = createHmac('sha256', this.cursorKey).update(data).digest('base64url');
        if (!timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) throw Error();
        const values: unknown = JSON.parse(Buffer.from(data, 'base64url').toString());
        if (!Array.isArray(values) || values.length !== 4 || values[0] !== this.config.institutionId || values[1] !== actor.id || values[2] !== kind) throw Error();
        after = uuid.parse(values[3]).toLowerCase();
      } catch { throw new HttpError('INVALID_REQUEST'); }
    }
    return { limit: p.limit ? Number(p.limit) : 50, ...(after ? { after } : {}) };
  }
  async list(actor: AuthUser, kind: Exclude<Kind, 'institution'>, query: unknown) {
    this.checkRead(actor, kind); const page = this.page(actor, kind, query);
    return this.transaction(actor, async tx => {
      const rows = await tx.list(kind, { ...page, limit: page.limit + 1 }, this.scope(actor));
      const visible = rows.slice(0, page.limit);
      return { data: visible.map(r => project(kind, r)), nextCursor: rows.length > page.limit ? this.cursor(actor, kind, visible.at(-1)!.id) : null };
    });
  }
  async get(actor: AuthUser, kind: Kind, id: string) {
    this.checkRead(actor, kind); id = parseDto(uuid, id).toLowerCase();
    if (kind === 'institution' && id !== this.config.institutionId) throw new HttpError('NOT_FOUND');
    return this.transaction(actor, async tx => {
      const row = await tx.get(kind, id, this.scope(actor));
      if (!row) throw new HttpError('NOT_FOUND');
      return representation(this.config.institutionId, kind, row);
    });
  }
  async me(actor: AuthUser) {
    return this.transaction(actor, async tx => {
      const row = (await tx.get('user', actor.id))!;
      return { data: { id: row.id, institutionId: row.institutionId, email: row.email, role: row.role } };
    });
  }
  async create(actor: AuthUser, kind: Creatable, input: unknown) {
    requireAdmin(actor);
    // Separate branches retain exact DTO typing and never spread an unvalidated HTTP body.
    let record: Catalog[Creatable];
    const identity = { id: randomUUID(), institutionId: this.config.institutionId };
    if (kind === 'user') {
      const b = parseDto(createSchemas.user, input);
      record = { ...identity, email: b.email, role: b.role, active: true, passwordHash: await this.hasher.hash(b.password) };
    } else if (kind === 'teacher') record = { ...identity, ...parseDto(createSchemas.teacher, input) };
    else if (kind === 'student') record = { ...identity, ...parseDto(createSchemas.student, input), active: true };
    else record = { ...identity, ...parseDto(createSchemas.group, input) };
    return this.transaction(actor, async tx => {
      if (kind === 'teacher') {
        const user = await tx.get('user', (record as Catalog['teacher']).userId.toLowerCase());
        if (!user || !user.active || user.role !== 'TEACHER') throw new HttpError('INVALID_REFERENCE');
        (record as Catalog['teacher']).userId = user.id;
      }
      if (kind === 'group' && !this.config.calendar.some(p => p.schoolYear === (record as Catalog['group']).schoolYear)) throw new HttpError('INVALID_REQUEST');
      const result = await tx.insert(kind, record);
      await tx.audit(actor.id, `${kind}.created`, kind, result.id);
      return representation(this.config.institutionId, kind, result);
    });
  }
  async patch(actor: AuthUser, kind: Patchable, id: string, input: unknown, ifMatch?: string) {
    requireAdmin(actor); id = parseDto(uuid, id).toLowerCase();
    const changes = parseDto(patchSchemas[kind] as z.ZodType<Partial<Catalog[Patchable]>>, input);
    const result = await this.transaction(actor, async tx => {
      const before = await tx.get(kind, id);
      if (!before) throw new HttpError('NOT_FOUND');
      requireIfMatch(ifMatch, representation(this.config.institutionId, kind, before).etag);
      if (kind === 'user') {
        const user = before as Catalog['user'], change = changes as Partial<Catalog['user']>;
        if (user.active && user.role === 'ADMIN' && (change.active === false || change.role === 'TEACHER')
          && await tx.countActiveAdmins() <= 1) throw new HttpError('LAST_ADMIN');
      }
      const updated = await tx.update(kind, id, changes);
      await tx.audit(actor.id, `${kind}.updated`, kind, id);
      const b = before as Catalog['user'], a = updated as Catalog['user'];
      return { ...representation(this.config.institutionId, kind, updated), revoke: kind === 'user' && (a.role !== b.role || a.active !== b.active) };
    });
    // run resolves only after COMMIT; an exception/rollback never reaches revocation.
    if (result.revoke) this.revokeUser(id);
    return { data: result.data, etag: result.etag };
  }
  async assignments(actor: AuthUser, query: unknown) {
    if (actor.role !== 'TEACHER') throw new HttpError('FORBIDDEN');
    const page = this.page(actor, 'assignments', query);
    return this.transaction(actor, async tx => {
      const rows = await tx.ownAssignments(actor.id, { ...page, limit: page.limit + 1 }, this.scope(actor));
      const data = rows.slice(0, page.limit).map(r => ({ teacherId: r.teacherId, groupId: r.groupId, active: r.active }));
      return { data, nextCursor: rows.length > page.limit ? this.cursor(actor, 'assignments', data.at(-1)!.groupId) : null };
    });
  }
  async putAssignment(actor: AuthUser, teacherId: string, groupId: string, input: unknown, ifMatch?: string, ifNoneMatch?: string) {
    requireAdmin(actor); teacherId = parseDto(uuid, teacherId).toLowerCase(); groupId = parseDto(uuid, groupId).toLowerCase();
    const body = parseDto(schemas.AssignmentPut, input);
    if (ifMatch && ifNoneMatch || ifNoneMatch !== undefined && ifNoneMatch !== '*') throw new HttpError('INVALID_HEADER');
    return this.transaction(actor, async tx => {
      const teacher = await tx.get('teacher', teacherId), group = await tx.get('group', groupId);
      const user = teacher && await tx.get('user', teacher.userId);
      if (!teacher || !group || !user || body.active && (!user.active || user.role !== 'TEACHER')
        || !this.config.calendar.some(p => p.schoolYear === group.schoolYear)) throw new HttpError('INVALID_REFERENCE');
      const previous = await tx.assignment(teacherId, groupId);
      const tag = (active: boolean) => makeEtag([this.config.institutionId, 'assignment', teacherId, groupId, active]);
      if (previous) {
        if (ifNoneMatch) throw new HttpError('PRECONDITION_FAILED');
        requireIfMatch(ifMatch, tag(previous.active));
      } else {
        if (ifMatch) throw new HttpError('PRECONDITION_FAILED');
        if (ifNoneMatch !== '*') throw new HttpError('PRECONDITION_REQUIRED');
      }
      await tx.saveAssignment({ institutionId: this.config.institutionId, teacherId, groupId, active: body.active }, !!previous);
      await tx.audit(actor.id, 'assignment.updated', 'teacher', teacherId);
      return { data: { teacherId, groupId, active: body.active }, etag: tag(body.active), created: !previous };
    });
  }
  async getAssignment(actor: AuthUser, teacherId: string, groupId: string) {
    requireAdmin(actor); teacherId = parseDto(uuid, teacherId).toLowerCase(); groupId = parseDto(uuid, groupId).toLowerCase();
    return this.transaction(actor, async tx => {
      const row = await tx.assignment(teacherId, groupId);
      if (!row) throw new HttpError('NOT_FOUND');
      return { data: { teacherId, groupId, active: row.active },
        etag: makeEtag([this.config.institutionId, 'assignment', teacherId, groupId, row.active]) };
    });
  }
}
