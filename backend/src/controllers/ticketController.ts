import { Request, Response, NextFunction } from 'express';
import { TicketService } from '../services/ticketService.js';
import { MaintenanceService } from '../services/maintenanceService.js';
import { ApiResponse } from '../utils/apiResponse.js';
import { prisma } from '../config/db.js';
import { isStaff } from '../middlewares/auth.js';

async function assertTicketAccess(req: Request, ticketId: string) {
  if (isStaff(req)) return;
  const t = await prisma.ticket.findFirst({ where: { OR: [{ id: ticketId }, { ticketNumber: ticketId }] }, select: { requesterId: true } });
  if (!t) throw { statusCode: 404, message: 'Ticket not found', code: 'TICKET_NOT_FOUND' };
  if (!req.user?.employeeId || t.requesterId !== req.user.employeeId) {
    throw { statusCode: 403, message: 'You can only view your own tickets.', code: 'FORBIDDEN' };
  }
}

export class TicketController {
  static async getTickets(req: Request, res: Response, next: NextFunction) {
    try {
      const { status, priority, category, assignedEngineerId, requesterId, assetId, search, page, limit } = req.query;

      const result = await TicketService.getTickets({
        status: status as string,
        priority: priority as string,
        category: category as string,
        assignedEngineerId: assignedEngineerId as string,
        requesterId: requesterId as string,
        assetId: assetId as string,
        search: search as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
        // Employees only ever see tickets they raised, whatever filters they send
        ...(isStaff(req) ? {} : { scopeRequesterId: req.user?.employeeId || null }),
      });

      return ApiResponse.success(res, result.tickets, 'Tickets retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      await assertTicketAccess(req, req.params.id);
      const ticket = await TicketService.getTicketById(req.params.id, { includeInternal: isStaff(req) });
      return ApiResponse.success(res, ticket, 'Ticket details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      // Employees always raise tickets as themselves. Staff may raise on behalf of an employee.
      let requesterId: string | null | undefined = isStaff(req) ? req.body.requesterId || req.user?.employeeId : req.user?.employeeId;
      if (!requesterId && req.user?.id) {
        const emp = await prisma.employee.findFirst({ where: { OR: [{ userId: req.user.id }, { email: req.user.email }] } });
        requesterId = emp?.id;
      }
      if (!requesterId) {
        return ApiResponse.error(res, 'Your login is not linked to an employee profile. Ask IT to link it, or select a requester.', 400, 'REQUESTER_REQUIRED');
      }
      const requester = await prisma.employee.findUnique({ where: { id: requesterId } });
      if (!requester) return ApiResponse.error(res, 'Requester employee not found', 400, 'REQUESTER_REQUIRED');
      if (!isStaff(req)) {
        // Employees cannot pick an engineer, and can only reference their own assets
        delete req.body.assignedEngineerId;
        if (req.body.assetId) {
          const owns = await prisma.asset.findFirst({ where: { id: req.body.assetId, currentEmployeeId: requesterId } });
          if (!owns) delete req.body.assetId;
        }
      }

      const ticket = await TicketService.createTicket({
        ...req.body,
        requesterId,
      }, req.user);

      return ApiResponse.success(res, ticket, 'Ticket raised successfully', 201);
    } catch (error) {
      next(error);
    }
  }

  static async updateTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const updated = await TicketService.updateTicket(req.params.id, req.body, req.user);
      return ApiResponse.success(res, updated, 'Ticket updated');
    } catch (error) {
      next(error);
    }
  }

  static async addComment(req: Request, res: Response, next: NextFunction) {
    try {
      const { comment, isInternal, attachments } = req.body;
      if (!comment) return ApiResponse.error(res, 'Comment text is required', 400);
      await assertTicketAccess(req, req.params.id);

      const result = await TicketService.addComment(req.params.id, {
        comment,
        isInternal,
        attachments,
        user: req.user,
        isStaff: isStaff(req),
      });

      return ApiResponse.success(res, result, 'Comment added to ticket', 201);
    } catch (error) {
      next(error);
    }
  }
}

export class MaintenanceController {
  static async getRecords(req: Request, res: Response, next: NextFunction) {
    try {
      const { assetId, type, page, limit } = req.query;
      const result = await MaintenanceService.getRecords({
        assetId: assetId as string,
        type: type as string,
        page: page ? parseInt(page as string, 10) : 1,
        limit: limit ? parseInt(limit as string, 10) : 20,
      });
      return ApiResponse.success(res, result.records, 'Maintenance records retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async createRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await MaintenanceService.createRecord(req.body, req.user);
      return ApiResponse.success(res, record, 'Maintenance scheduled', 201);
    } catch (error) {
      next(error);
    }
  }

  static async completeRecord(req: Request, res: Response, next: NextFunction) {
    try {
      const record = await MaintenanceService.completeRecord(req.params.id, req.body, req.user);
      return ApiResponse.success(res, record, 'Maintenance marked completed');
    } catch (error) {
      next(error);
    }
  }
}
