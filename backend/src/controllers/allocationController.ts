import { Request, Response, NextFunction } from 'express';
import { AllocationService } from '../services/allocationService.js';
import { ReturnService } from '../services/returnService.js';
import { TransferService } from '../services/transferService.js';
import { DisposalService } from '../services/disposalService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';

export class AllocationController {
  // --- Allocation ---
  static async allocateAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await AllocationService.allocate(req.body, req.user);
      return ApiResponse.success(res, result, 'Asset successfully allocated', 201);
    } catch (error) {
      next(error);
    }
  }

  static async acknowledgeAllocation(req: Request, res: Response, next: NextFunction) {
    try {
      const ipAddress = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
      const result = await AllocationService.acknowledge(req.params.id, {
        signatureData: req.body.signatureData,
        ipAddress,
        user: req.user,
      });
      return ApiResponse.success(res, result, 'Asset allocation acknowledged successfully');
    } catch (error) {
      next(error);
    }
  }

  static async downloadHandoverPdf(req: Request, res: Response, next: NextFunction) {
    try {
      const buffer = await AllocationService.getHandoverPdf(req.params.id);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="handover-certificate-${req.params.id}.pdf"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  }

  static async listAssignments(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, assetId, status } = req.query;
      const where: any = {};
      if (employeeId) where.employeeId = employeeId as string;
      if (assetId) where.assetId = assetId as string;
      if (status) where.status = status as string;

      const assignments = await prisma.assetAssignment.findMany({
        where,
        orderBy: { allocationDate: 'desc' },
        include: {
          asset: { include: { category: true } },
          employee: { include: { department: true } },
        },
      });

      return ApiResponse.success(res, assignments, 'Assignments retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async myAssets(req: Request, res: Response, next: NextFunction) {
    try {
      let empId = req.user?.employeeId;
      if (!empId && req.user?.id) {
        const emp = await prisma.employee.findFirst({ where: { userId: req.user.id } });
        empId = emp?.id;
      }
      if (!empId) {
        return ApiResponse.success(res, [], 'No employee profile linked to user');
      }
      const assignments = await prisma.assetAssignment.findMany({
        where: { employeeId: empId, status: { in: ['ACTIVE', 'ASSIGNED', 'PENDING_ACKNOWLEDGEMENT'] } },
        orderBy: { allocationDate: 'desc' },
        include: {
          asset: { include: { category: true } },
          employee: { include: { department: true } },
        },
      });
      return ApiResponse.success(res, assignments, 'My assigned assets retrieved');
    } catch (error) {
      next(error);
    }
  }

  // --- Return ---
  static async returnAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await ReturnService.processReturn(req.body, req.user);
      return ApiResponse.success(res, result, 'Asset returned successfully');
    } catch (error) {
      next(error);
    }
  }

  // --- Transfer ---
  static async transferAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await TransferService.transfer(req.body, req.user);
      return ApiResponse.success(res, result, 'Asset transferred successfully');
    } catch (error)
    {
      next(error);
    }
  }

  // --- Disposal ---
  static async disposeAsset(req: Request, res: Response, next: NextFunction) {
    try {
      const result = await DisposalService.dispose(req.body, req.user);
      return ApiResponse.success(res, result, 'Asset permanently disposed');
    } catch (error) {
      next(error);
    }
  }
}
