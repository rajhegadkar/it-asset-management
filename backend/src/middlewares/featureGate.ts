import { Request, Response, NextFunction } from 'express';
import { FeatureFlagsEngine } from '../customization/featureFlagsEngine.js';
import { FeatureFlagsConfig } from '../customization/types.js';
import { ApiResponse } from '../utils/apiResponse.js';

/** Rejects requests to a module that has been switched off in the Customization Center. */
export function requireFeature(flag: keyof FeatureFlagsConfig) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const flags = await FeatureFlagsEngine.getFlags();
      if (flags[flag] === false) {
        return ApiResponse.error(res, 'This module is disabled by your administrator.', 403, 'FEATURE_DISABLED');
      }
      next();
    } catch (e) {
      next(e);
    }
  };
}

const MAINTENANCE_ALLOW = [/^\/api\/v1\/auth\//, /^\/api\/v1\/health/, /^\/api\/v1\/customization\/(branding|features)/];

/**
 * Maintenance mode: when enabled, only SUPER_ADMIN can make changes; everyone else gets 503
 * on write requests (reads keep working so people can still look things up).
 */
export async function maintenanceMode(req: Request, res: Response, next: NextFunction) {
  try {
    if (req.method === 'GET' || MAINTENANCE_ALLOW.some((r) => r.test(req.originalUrl))) return next();
    const flags = await FeatureFlagsEngine.getFlags();
    if (flags.maintenanceMode && req.user?.roleName !== 'SUPER_ADMIN') {
      return ApiResponse.error(
        res,
        flags.maintenanceMessage || 'System is under maintenance. Please try again later.',
        503,
        'MAINTENANCE_MODE'
      );
    }
    next();
  } catch (e) {
    next(e);
  }
}
