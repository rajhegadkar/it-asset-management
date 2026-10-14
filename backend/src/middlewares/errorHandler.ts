import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  logger.error('Unhandled request error:', err);

  // Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.error(res, 'Validation failed for input data', 400, 'VALIDATION_ERROR', formattedErrors);
  }

  // Prisma Unique Constraint Error (P2002)
  if (err.code === 'P2002') {
    const target = Array.isArray(err.meta?.target) ? err.meta.target.join(', ') : err.meta?.target || 'field';
    return ApiResponse.error(
      res,
      `A record with this ${target} already exists. Duplicate values are not allowed.`,
      409,
      'DUPLICATE_ENTRY',
      [{ field: target, message: 'Must be unique' }]
    );
  }

  // Prisma Record Not Found Error (P2025)
  if (err.code === 'P2025') {
    return ApiResponse.error(res, 'The requested resource was not found.', 404, 'NOT_FOUND');
  }

  // Custom Application Error
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal server error occurred';
  const code = err.code || 'INTERNAL_ERROR';

  return ApiResponse.error(res, message, statusCode, code, err.errors || []);
}
