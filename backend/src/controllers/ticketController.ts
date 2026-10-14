import { Request, Response, NextFunction } from 'express';
import { TicketService } from '../services/ticketService.js';
import { MaintenanceService } from '../services/maintenanceService.js';
import { ApiResponse } from '../utils/apiResponse.js';

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
      });

      return ApiResponse.success(res, result.tickets, 'Tickets retrieved', 200, result.pagination);
    } catch (error) {
      next(error);
    }
  }

  static async getTicketById(req: Request, res: Response, next: NextFunction) {
    try {
      const ticket = await TicketService.getTicketById(req.params.id);
      return ApiResponse.success(res, ticket, 'Ticket details retrieved');
    } catch (error) {
      next(error);
    }
  }

  static async createTicket(req: Request, res: Response, next: NextFunction) {
    try {
      const requesterId = req.body.requesterId || req.user?.employeeId;
      if (!requesterId) {
        return ApiResponse.error(res, 'Requester employee profile is required', 400);
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

      const result = await TicketService.addComment(req.params.id, {
        comment,
        isInternal,
        attachments,
        user: req.user,
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
