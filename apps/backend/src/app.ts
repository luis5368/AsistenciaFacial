import express from 'express';
import { loadApplicationConfig } from './config/application.js';
import type { ApplicationConfig } from './config/application.js';
import { security } from './http/security.js';
import type { SafeLogger } from './http/security.js';
import { errorHandler, HttpError } from './http/errors.js';
import { routes } from './http/routes.js';
import { authRoutes } from './http/controllers/auth.js';
import type { AuthService } from './modules/auth/service.js';

// No rutas de escritura, autenticación ni conexión automática en esta preparación.
export function createApp(config: ApplicationConfig = loadApplicationConfig(process.env), logger?: SafeLogger, auth?: AuthService) {
  const app = express();
  app.disable('x-powered-by');
  app.disable('etag');
  app.set('trust proxy', false);
  app.set('query parser', 'simple');
  app.use(security(config.origin, logger));
  app.use(express.json({ limit: 256 * 1024, strict: true, inflate: false }));
  app.use(routes());
  if (auth) app.use(authRoutes(auth, config.origin));
  app.use((_req, _res, next) => next(new HttpError('NOT_FOUND')));
  app.use(errorHandler);
  return app;
}
