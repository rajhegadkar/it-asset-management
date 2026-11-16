import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { ApiResponse } from '../utils/apiResponse.js';
import { logger } from '../config/logger.js';
import { env } from '../config/env.js';

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  const statusCodeHint = err?.statusCode || 500;
  if (statusCodeHint >= 500) {
    logger.error('Unhandled request error:', err);
  } else {
    logger.warn(`Request rejected (${statusCodeHint}) ${req.method} ${req.originalUrl}: ${err?.message}`);
  }

  // Zod Validation Error
  if (err instanceof ZodError) {
    const formattedErrors = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return ApiResponse.error(res, 'Validation failed for input data', 400, 'VALIDATION_ERROR', formattedErrors);
  }

  // Multer errors (file too large, wrong type)
  if (err?.name === 'MulterError' || /Unsupported file type/.test(err?.message || '')) {
    return ApiResponse.error(res, err.message, 400, 'UPLOAD_ERROR');
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

  // Prisma Foreign Key Constraint Error (P2003): record is still referenced elsewhere
  if (err.code === 'P2003' || err.code === 'P2014') {
    return ApiResponse.error(
      res,
      'This record is still in use by other records (assets, employees, tickets or history) and cannot be deleted. Deactivate or reassign it instead.',
      409,
      'RECORD_IN_USE'
    );
  }

  // Prisma Record Not Found Error (P2025)
  if (err.code === 'P2025') {
    return ApiResponse.error(res, 'The requested resource was not found.', 404, 'NOT_FOUND');
  }

  // Invalid input to Prisma (unknown field, wrong type) is a client error, not a crash
  if (err?.name === 'PrismaClientValidationError') {
    return ApiResponse.error(res, 'Invalid input data.', 400, 'VALIDATION_ERROR');
  }

  // Custom Application Error
  const statusCode = typeof err.statusCode === 'number' ? err.statusCode : 500;
  const code = typeof err.code === 'string' && !/^P\d{4}$/.test(err.code) ? err.code : 'INTERNAL_ERROR';
  // Never leak internal error text (SQL, file paths, stack) for unexpected errors in production
  const message =
    statusCode >= 500 && env.IS_PROD ? 'Internal server error occurred' : err.message || 'Internal server error occurred';

  return ApiResponse.error(res, message, statusCode, code, Array.isArray(err.errors) ? err.errors : []);
}
