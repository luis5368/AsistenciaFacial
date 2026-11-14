import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';
import { HttpError } from './errors.js';
export interface RequestSummary { requestId: string; status: number; durationMs: number }
export type SafeLogger = (event: RequestSummary) => void;
export function security(origin: string, logger?: SafeLogger): RequestHandler {
  return (req, res, next) => {
    const requestId = randomUUID(); // Nunca aceptar el ID externo como identidad ni reflejarlo.
    const start = performance.now();
    res.locals.requestId = requestId;
    res.set({ 'X-Request-Id': requestId, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
      'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin', 'Permissions-Policy': 'camera=(), microphone=()' });
    res.on('finish', () => { try { logger?.({ requestId, status: res.statusCode, durationMs: Math.round(performance.now() - start) }); } catch { /* logging no altera respuesta */ } });
    if (req.headers.origin !== undefined && req.headers.origin !== origin) return next(new HttpError('FORBIDDEN'));
    if (req.headers['sec-fetch-site'] === 'cross-site') return next(new HttpError('FORBIDDEN'));
    for (const header of ['x-institution-id', 'x-tenant-id', 'x-user-id', 'x-role']) {
      if (req.headers[header] !== undefined) return next(new HttpError('INVALID_HEADER'));
    }
    if (req.headers['if-match'] !== undefined && (typeof req.headers['if-match'] !== 'string'
      || !/^"[a-f0-9]{64}"$/.test(req.headers['if-match']))) return next(new HttpError('INVALID_HEADER'));
    const hasBody = req.headers['transfer-encoding'] !== undefined || Number(req.headers['content-length'] ?? 0) > 0;
    if (hasBody && !/^application\/json(?:\s*;\s*charset=utf-8)?$/i.test(req.headers['content-type'] ?? '')) {
      return next(new HttpError('UNSUPPORTED_MEDIA_TYPE'));
    }
    next();
  };
}
