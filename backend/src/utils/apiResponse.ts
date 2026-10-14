import { Response } from 'express';

export interface ApiResponseOptions<T = any> {
  res: Response;
  statusCode?: number;
  message?: string;
  data?: T;
  code?: string;
  errors?: any[];
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class ApiResponse {
  static success<T = any>(
    res: Response,
    data?: T,
    message: string = 'Operation successful',
    statusCode: number = 200,
    pagination?: { total: number; page: number; limit: number; totalPages: number }
  ) {
    return res.status(statusCode).json({
      success: true,
      message,
      data,
      ...(pagination ? { pagination } : {}),
    });
  }

  static error(
    res: Response,
    message: string = 'Internal server error',
    statusCode: number = 500,
    code: string = 'SERVER_ERROR',
    errors: any[] = []
  ) {
    return res.status(statusCode).json({
      success: false,
      message,
      code,
      errors,
    });
  }
}
