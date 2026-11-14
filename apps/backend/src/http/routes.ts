import { Router } from 'express';
import { healthController } from './controllers/health.js';
import { HttpError } from './errors.js';
export function routes() {
  const router = Router();
  router.get('/api/v1/health', healthController);
  router.all('/api/v1/health', (_req, res, next) => { res.set('Allow', 'GET, HEAD'); next(new HttpError('METHOD_NOT_ALLOWED')); });
  return router;
}
