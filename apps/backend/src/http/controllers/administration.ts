import { Router } from 'express';
import type { Response, RequestHandler } from 'express';
import type { AuthService } from '../../modules/auth/service.js';
import type { AdministrationService, Creatable, Patchable } from '../../modules/administration/service.js';
import type { Kind } from '../../modules/administration/ports.js';
import type { AuthUser } from '../../modules/auth/repository.js';
import { cookie } from './auth.js';
import { schemas } from '../contracts.js';
import { parseDto } from '../validation.js';
import { HttpError } from '../errors.js';

/** Factory only: production server deliberately does not mount this router. */
export function administrationRoutes(service: AdministrationService, auth: AuthService, origin: string, institutionId: string) {
  if (!origin.startsWith('https://')) throw new Error('HTTPS requerido.');
  const router = Router();
  const guard: RequestHandler = async (req, res, next) => {
    if (!req.secure) throw new HttpError('FORBIDDEN');
    const session = await auth.authenticate(cookie(req.headers.cookie));
    if (session.user.institutionId !== institutionId) throw new HttpError('FORBIDDEN');
    if (!['GET', 'HEAD'].includes(req.method)) {
      if (req.headers.origin !== origin) throw new HttpError('CSRF_FAILED');
      auth.assertCsrf(session.token, req.get('X-CSRF-Token'));
      parseDto(schemas.Empty, req.query);
    } else if (req.body !== undefined) throw new HttpError('INVALID_REQUEST');
    res.locals.adminActor = session.user;
    next();
  };
  const actor = (res: Response) => res.locals.adminActor as AuthUser;
  const send = (res: Response, result: { data: unknown; etag?: string }, status = 200) => {
    if (result.etag) res.set('ETag', result.etag);
    res.status(status).json({ data: result.data, meta: { requestId: res.locals.requestId } });
  };
  router.get('/api/v1/me', guard, async (req, res) => { parseDto(schemas.Empty, req.query); send(res, await service.me(actor(res))); });
  router.get('/api/v1/me/assignments', guard, async (req, res) => res.json(await service.assignments(actor(res), req.query)));
  router.get('/api/v1/institution', guard, async (req, res) => { parseDto(schemas.Empty, req.query); send(res, await service.get(actor(res), 'institution', institutionId)); });
  router.patch('/api/v1/institution', guard, async (req, res) => send(res, await service.patch(actor(res), 'institution', institutionId, req.body, req.get('If-Match'))));
  const catalog: [string, Exclude<Kind, 'institution'>][] = [['users', 'user'], ['teachers', 'teacher'], ['students', 'student'], ['groups', 'group']];
  for (const [path, kind] of catalog) {
    router.get(`/api/v1/${path}`, guard, async (req, res) => res.json(await service.list(actor(res), kind, req.query)));
    router.get(`/api/v1/${path}/:id`, guard, async (req, res) => { parseDto(schemas.Empty, req.query); send(res, await service.get(actor(res), kind, String(req.params.id))); });
    router.post(`/api/v1/${path}`, guard, async (req, res) => {
      const result = await service.create(actor(res), kind as Creatable, req.body);
      res.location(`/api/v1/${path}/${result.data.id}`); send(res, result, 201);
    });
    if (kind !== 'teacher') router.patch(`/api/v1/${path}/:id`, guard, async (req, res) => send(res, await service.patch(actor(res), kind as Patchable, String(req.params.id), req.body, req.get('If-Match'))));
  }
  router.get('/api/v1/teachers/:id/assignments/:groupId', guard, async (req, res) => {
    parseDto(schemas.Empty, req.query);
    send(res, await service.getAssignment(actor(res), String(req.params.id), String(req.params.groupId)));
  });
  router.put('/api/v1/teachers/:id/assignments/:groupId', guard, async (req, res) => {
    const result = await service.putAssignment(actor(res), String(req.params.id), String(req.params.groupId), req.body, req.get('If-Match'), req.get('If-None-Match'));
    if (result.created) res.location(`/api/v1/teachers/${result.data.teacherId}/assignments/${result.data.groupId}`);
    send(res, result, result.created ? 201 : 200);
  });
  return router;
}
