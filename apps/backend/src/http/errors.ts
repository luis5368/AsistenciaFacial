import type { ErrorRequestHandler } from 'express';

const definitions = {
  CONFLICT: [409, 'Conflicto de integridad o concurrencia.'], LAST_ADMIN: [409, 'Debe conservarse un administrador activo.'],
  INVALID_REFERENCE: [422, 'Referencia no permitida.'],
  INVALID_CREDENTIALS: [401, 'Credenciales no válidas.'], CSRF_FAILED: [403, 'Solicitud no permitida.'],
  RATE_LIMITED: [429, 'Demasiadas solicitudes.'], SERVICE_UNAVAILABLE: [503, 'Servicio temporalmente no disponible.'],
  INVALID_REQUEST: [400, 'Solicitud inválida.'], INVALID_JSON: [400, 'JSON inválido.'],
  INVALID_HEADER: [400, 'Encabezado inválido.'], FORBIDDEN: [403, 'Operación no permitida.'],
  AUTH_REQUIRED: [401, 'Autenticación requerida.'], NOT_FOUND: [404, 'Recurso no encontrado.'],
  METHOD_NOT_ALLOWED: [405, 'Método no permitido.'], PAYLOAD_TOO_LARGE: [413, 'Solicitud demasiado grande.'],
  UNSUPPORTED_MEDIA_TYPE: [415, 'Formato no admitido.'], PRECONDITION_REQUIRED: [428, 'Precondición requerida.'],
  PRECONDITION_FAILED: [412, 'Versión del recurso desactualizada.'], INTERNAL_ERROR: [500, 'Error interno.'],
} as const;
export type HttpErrorCode = keyof typeof definitions;
export class HttpError extends Error {
  constructor(readonly code: HttpErrorCode) { super(code); }
}
export const errorHandler: ErrorRequestHandler = (error: unknown, _req, res, next) => {
  if (res.headersSent) { next(error); return; }
  // Los mensajes/body/stack de Express, Zod, Prisma o errores desconocidos nunca se serializan.
  const type = error && typeof error === 'object' && 'type' in error ? error.type : undefined;
  const code: HttpErrorCode = error instanceof HttpError ? error.code
    : type === 'entity.too.large' ? 'PAYLOAD_TOO_LARGE'
    : type === 'entity.parse.failed' ? 'INVALID_JSON'
    : type === 'encoding.unsupported' || type === 'charset.unsupported' ? 'UNSUPPORTED_MEDIA_TYPE' : 'INTERNAL_ERROR';
  const [status, message] = definitions[code];
  if (code === 'RATE_LIMITED') res.set('Retry-After', '900');
  res.status(status).json({ error: { code, message, requestId: res.locals.requestId } });
};
