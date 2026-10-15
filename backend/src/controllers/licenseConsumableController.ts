import { Request, Response, NextFunction } from 'express';
import { LicenseService } from '../services/licenseService.js';
import { ConsumableService } from '../services/consumableService.js';
import { ApiResponse } from '../utils/apiResponse.js';

export class LicenseController {
  static async getLicenses(req: Request, res: Response, next: NextFunction) {
    try {
      const { search, type, page, limit } = req.query;
      const result = await LicenseService.getLicenses({
        search: search as string,
        type: type as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      return ApiResponse.success(res, result.licenses, 'Licenses retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async createLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const license = await LicenseService.createLicense(req.body);
      return ApiResponse.success(res, license, 'License created successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async getLicenseById(req: Request, res: Response, next: NextFunction) {
    try {
      const license = await LicenseService.getLicenseById(req.params.id);
      return ApiResponse.success(res, license, 'License retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async updateLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await LicenseService.updateLicense(req.params.id, req.body);
      return ApiResponse.success(res, updated, 'License updated successfully');
    } catch (error) {
      next(error);
    }
  }

  static async deleteLicense(req: Request, res: Response, next: NextFunction) {
    try {
      await LicenseService.deleteLicense(req.params.id);
      return ApiResponse.success(res, null, 'License deleted successfully');
    } catch (error) {
      next(error);
    }
  }

  static async assignLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const assignment = await LicenseService.assignLicense(req.params.id, req.body);
      return ApiResponse.success(res, assignment, 'License seat assigned');
    } catch (error) {
      next(error);
    }
  }

  static async revokeLicense(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await LicenseService.revokeLicense(req.params.assignmentId);
      return ApiResponse.success(res, result, 'License seat revoked');
    } catch (error) {
      next(error);
    }
  }
}

export class ConsumableController {
  static async getConsumables(req: Request, res: Response, next: NextFunction) {
    try {
      const { category, lowStockOnly, page, limit } = req.query;
      const result = await ConsumableService.getConsumables({
        category: category as string,
        lowStockOnly: lowStockOnly === 'true',
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      return ApiResponse.success(res, result.consumables, 'Consumables retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async getConsumableById(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ConsumableService.getConsumableById(req.params.id);
      return ApiResponse.success(res, item, 'Consumable item retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createConsumable(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ConsumableService.createConsumable(req.body);
      return ApiResponse.success(res, item, 'Consumable item created', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateConsumable(req: Request, res: Response, next: NextFunction) {
    try {
      const item = await ConsumableService.updateConsumable(req.params.id, req.body);
      return ApiResponse.success(res, item, 'Consumable item updated');
    } catch (error) {
      next(error);
    }
  }

  static async deleteConsumable(req: Request, res: Response, next: NextFunction) {
    try {
      await ConsumableService.deleteConsumable(req.params.id);
      return ApiResponse.success(res, null, 'Consumable item deleted');
    } catch (error) {
      next(error);
    }
  }

  static async recordTransaction(req: Request, res: Response, next: NextFunction) {
    try {
      const transaction = await ConsumableService.recordTransaction({
        ...req.body,
        consumableId: req.params.id,
        user: req.user,
      });
      return ApiResponse.success(res, transaction, 'Stock transaction recorded', 201);
    } catch (error) {
      next(error);
    }
  }
}
