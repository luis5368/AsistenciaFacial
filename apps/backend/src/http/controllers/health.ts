import type { RequestHandler } from 'express';
import { schemas } from '../contracts.js';
import { parseDto } from '../validation.js';
import { HttpError } from '../errors.js';
import { healthStatus } from '../../modules/health/service.js';
export const healthController: RequestHandler = (req, res) => {
  parseDto(schemas.Empty, req.query);
  if (req.body !== undefined || Number(req.headers['content-length'] ?? 0) > 0 || req.headers['transfer-encoding']) throw new HttpError('INVALID_REQUEST');
  res.json(healthStatus());
};
