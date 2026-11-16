import { prisma } from '../config/db.js';
import { NumberingEngine } from '../customization/numberingEngine.js';
import { SAFE_USER_SELECT } from '../utils/sanitize.js';
import { ci } from '../utils/dbCompat.js';
import { sendTemplatedEmail } from './notificationTemplates.js';
import { z } from 'zod';

export const TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED', 'REOPENED'] as const;
export const OPEN_TICKET_STATUSES = ['OPEN', 'ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'REOPENED'];
const PRIORITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const CATEGORIES = ['HARDWARE', 'SOFTWARE', 'NETWORK', 'ACCESS', 'EMAIL', 'PRINTER', 'OTHER'] as const;

// Allowed status transitions (anything -> same status is a no-op)
const TRANSITIONS: Record<string, string[]> = {
  OPEN: ['ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED'],
  ASSIGNED: ['OPEN', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED'],
  IN_PROGRESS: ['ASSIGNED', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED'],
  PENDING_USER: ['IN_PROGRESS', 'ASSIGNED', 'RESOLVED', 'CLOSED'],
  PENDING_VENDOR: ['IN_PROGRESS', 'ASSIGNED', 'RESOLVED', 'CLOSED'],
  RESOLVED: ['CLOSED', 'REOPENED'],
  CLOSED: ['REOPENED'],
  REOPENED: ['ASSIGNED', 'IN_PROGRESS', 'PENDING_USER', 'PENDING_VENDOR', 'RESOLVED', 'CLOSED'],
};

export const SLA_HOURS: Record<string, number> = { CRITICAL: 4, HIGH: 24, MEDIUM: 48, LOW: 72 };

const upper = (v: unknown) => (typeof v === 'string' ? v.toUpperCase() : v);

export const createTicketSchema = z.object({
  subject: z.string().min(1).max(300).optional(),
  title: z.string().min(1).max(300).optional(),
  description: z.string().min(1, 'Description is required').max(20000),
  category: z.preprocess(upper, z.enum(CATEGORIES)).optional(),
  priority: z.preprocess(upper, z.enum(PRIORITIES)).optional(),
  assetId: z.string().optional().nullable(),
  departmentId: z.string().optional().nullable(),
  locationId: z.string().optional().nullable(),
  assignedEngineerId: z.string().optional().nullable(),
  requesterId: z.string().optional().nullable(),
});

export const updateTicketSchema = z.object({
  status: z.preprocess(upper, z.enum(TICKET_STATUSES)).optional(),
  priority: z.preprocess(upper, z.enum(PRIORITIES)).optional(),
  category: z.preprocess(upper, z.enum(CATEGORIES)).optional(),
  assignedEngineerId: z.string().nullable().optional(),
  subject: z.string().min(1).max(300).optional(),
  description: z.string().min(1).max(20000).optional(),
});

const TICKET_LIST_INCLUDE = {
  requester: true,
  assignedEngineer: { select: SAFE_USER_SELECT },
  asset: true,
  department: true,
};

export class TicketService {
  static async generateTicketNumber(): Promise<string> {
    return await NumberingEngine.generateNext('TICKET');
  }

  /**
   * List tickets with pagination & filters. `scopeRequesterId` (set for employees) is always enforced.
   */
  static async getTickets(params: {
    status?: string;
    priority?: string;
    category?: string;
    assignedEngineerId?: string;
    requesterId?: string;
    assetId?: string;
    search?: string;
    page?: number;
    limit?: number;
    scopeRequesterId?: string | null;
  }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.status) where.status = params.status;
    if (params.priority) where.priority = params.priority;
    if (params.category) where.category = params.category;
    if (params.assignedEngineerId) where.assignedEngineerId = params.assignedEngineerId;
    if (params.requesterId) where.requesterId = params.requesterId;
    if (params.assetId) where.assetId = params.assetId;
    if (params.scopeRequesterId !== undefined) where.requesterId = params.scopeRequesterId || '__none__';

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [{ ticketNumber: ci(q) }, { subject: ci(q) }, { description: ci(q) }];
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' }, include: TICKET_LIST_INCLUDE }),
    ]);

    return { tickets, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  /**
   * Get single ticket with comments & asset info. Internal notes are hidden unless includeInternal.
   */
  static async getTicketById(idOrNumber: string, opts: { includeInternal: boolean } = { includeInternal: true }) {
    const ticket = await prisma.ticket.findFirst({
      where: { OR: [{ id: idOrNumber }, { ticketNumber: idOrNumber }] },
      include: {
        requester: { include: { department: true, location: true } },
        assignedEngineer: { select: SAFE_USER_SELECT },
        asset: { include: { category: true } },
        department: true,
        location: true,
        comments: {
          where: opts.includeInternal ? {} : { isInternal: false },
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { id: true, firstName: true, lastName: true, username: true } } },
        },
      },
    });

    if (!ticket) throw { statusCode: 404, message: 'Ticket not found', code: 'TICKET_NOT_FOUND' };
    return ticket;
  }

  /**
   * Create Helpdesk Ticket
   */
  static async createTicket(rawInput: z.input<typeof createTicketSchema> & { requesterId: string }, user?: any) {
    const input = createTicketSchema.parse(rawInput);
    const subject = input.subject || input.title || 'General Incident Request';
    const priority = input.priority || 'MEDIUM';
    const slaHours = SLA_HOURS[priority];
    const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);
    const ticketNumber = await this.generateTicketNumber();

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject,
        description: input.description,
        category: input.category || 'HARDWARE',
        priority,
        status: input.assignedEngineerId ? 'ASSIGNED' : 'OPEN',
        requesterId: rawInput.requesterId,
        assetId: input.assetId || null,
        departmentId: input.departmentId || null,
        locationId: input.locationId || null,
        assignedEngineerId: input.assignedEngineerId || null,
        organizationId: user?.organizationId || null,
        slaDueDate,
      },
      include: { requester: true, asset: true },
    });

    await sendTemplatedEmail('TICKET_CREATED', 'ticket', ticket.requester.email, {
      ticketNumber: ticket.ticketNumber,
      subject: ticket.subject,
      priority: ticket.priority,
      category: ticket.category,
      requesterName: `${ticket.requester.firstName} ${ticket.requester.lastName}`,
      assetTag: ticket.asset?.assetTag || 'N/A',
      createdAt: ticket.createdAt.toISOString().replace('T', ' ').slice(0, 16),
    });

    if (ticket.assignedEngineerId) {
      await this.notifyUser(ticket.assignedEngineerId, ticket, 'TICKET_UPDATE', `Ticket ${ticket.ticketNumber} assigned to you`, ticket.subject);
    }

    return ticket;
  }

  /**
   * Update Ticket Status, Priority, Assignment — validated state machine.
   */
  static async updateTicket(id: string, rawUpdates: z.input<typeof updateTicketSchema>, user?: any) {
    const updates = updateTicketSchema.parse(rawUpdates);
    const existing = await prisma.ticket.findUnique({ where: { id }, include: { requester: true } });
    if (!existing) throw { statusCode: 404, message: 'Ticket not found', code: 'TICKET_NOT_FOUND' };

    const data: any = {};
    if (updates.subject !== undefined) data.subject = updates.subject;
    if (updates.description !== undefined) data.description = updates.description;
    if (updates.category !== undefined) data.category = updates.category;

    if (updates.assignedEngineerId !== undefined) {
      if (updates.assignedEngineerId) {
        const eng = await prisma.user.findUnique({ where: { id: updates.assignedEngineerId }, include: { role: true } });
        if (!eng || !eng.isActive || !['SUPER_ADMIN', 'IT_ADMIN', 'SUPPORT_ENGINEER'].includes(eng.role.name)) {
          throw { statusCode: 400, message: 'Tickets can only be assigned to active IT staff.', code: 'INVALID_ASSIGNEE' };
        }
      }
      data.assignedEngineerId = updates.assignedEngineerId || null;
      if (updates.assignedEngineerId && existing.status === 'OPEN' && !updates.status) data.status = 'ASSIGNED';
    }

    if (updates.status && updates.status !== existing.status) {
      const allowed = TRANSITIONS[existing.status] || [];
      if (!allowed.includes(updates.status)) {
        throw { statusCode: 400, message: `A ${existing.status} ticket cannot move to ${updates.status}.`, code: 'INVALID_STATUS_TRANSITION' };
      }
      data.status = updates.status;
      if (updates.status === 'RESOLVED') data.resolvedAt = new Date();
      if (updates.status === 'CLOSED') {
        data.closedAt = new Date();
        if (!existing.resolvedAt) data.resolvedAt = new Date();
      }
      if (updates.status === 'REOPENED') {
        data.resolvedAt = null;
        data.closedAt = null;
        data.slaBreachNotifiedAt = null;
        data.slaDueDate = new Date(Date.now() + SLA_HOURS[existing.priority] * 3600 * 1000);
      }
      if (!existing.firstResponseAt && user && ['IN_PROGRESS', 'PENDING_USER', 'RESOLVED'].includes(updates.status)) {
        data.firstResponseAt = new Date();
      }
    }

    // Priority change recalculates the SLA from when the ticket was raised
    if (updates.priority && updates.priority !== existing.priority) {
      data.priority = updates.priority;
      if (OPEN_TICKET_STATUSES.includes(data.status || existing.status)) {
        data.slaDueDate = new Date(existing.createdAt.getTime() + SLA_HOURS[updates.priority] * 3600 * 1000);
        data.slaBreachNotifiedAt = null;
      }
    }

    const updated = await prisma.ticket.update({
      where: { id },
      data,
      include: { requester: true, assignedEngineer: { select: SAFE_USER_SELECT } },
    });

    if (data.status === 'RESOLVED') {
      await sendTemplatedEmail('TICKET_RESOLVED', 'ticket', updated.requester.email, {
        ticketNumber: updated.ticketNumber,
        subject: updated.subject,
        requesterName: `${updated.requester.firstName} ${updated.requester.lastName}`,
        resolutionNotes: '',
        resolvedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
      });
    }
    if (data.status && updated.requester.userId) {
      await this.notifyUser(updated.requester.userId, updated, 'TICKET_UPDATE', `Ticket ${updated.ticketNumber} is now ${data.status}`, updated.subject);
    }
    if (data.assignedEngineerId && data.assignedEngineerId !== existing.assignedEngineerId) {
      await this.notifyUser(data.assignedEngineerId, updated, 'TICKET_UPDATE', `Ticket ${updated.ticketNumber} assigned to you`, updated.subject);
    }

    return updated;
  }

  /**
   * Add Comment / Response to Ticket. Notifies the other party; staff replies count as first response.
   */
  static async addComment(ticketId: string, params: { comment: string; isInternal?: boolean; attachments?: string[]; user: any; isStaff: boolean }) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId }, include: { requester: true } });
    if (!ticket) throw { statusCode: 404, message: 'Ticket not found', code: 'TICKET_NOT_FOUND' };
    if (!params.comment || !params.comment.trim()) throw { statusCode: 400, message: 'Comment text is required' };
    if (params.comment.length > 20000) throw { statusCode: 400, message: 'Comment is too long' };

    const isInternal = params.isStaff ? !!params.isInternal : false; // only IT staff can write internal notes

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: params.user.id,
        authorName: [params.user.firstName, params.user.lastName].filter(Boolean).join(' ') || params.user.username,
        comment: params.comment.trim(),
        isInternal,
        attachments: Array.isArray(params.attachments) ? JSON.stringify(params.attachments.slice(0, 20)) : null,
      },
    });

    const ticketUpdate: any = {};
    if (params.isStaff && !isInternal && !ticket.firstResponseAt) ticketUpdate.firstResponseAt = new Date();
    if (!params.isStaff && ticket.status === 'PENDING_USER') ticketUpdate.status = 'IN_PROGRESS';
    if (Object.keys(ticketUpdate).length) await prisma.ticket.update({ where: { id: ticketId }, data: ticketUpdate });

    if (!isInternal) {
      if (params.isStaff && ticket.requester.userId && ticket.requester.userId !== params.user.id) {
        await this.notifyUser(ticket.requester.userId, ticket, 'TICKET_UPDATE', `New reply on ticket ${ticket.ticketNumber}`, params.comment.slice(0, 140));
      } else if (!params.isStaff && ticket.assignedEngineerId) {
        await this.notifyUser(ticket.assignedEngineerId, ticket, 'TICKET_UPDATE', `Requester replied on ${ticket.ticketNumber}`, params.comment.slice(0, 140));
      }
    }

    return comment;
  }

  private static async notifyUser(userId: string, ticket: { id: string; organizationId?: string | null }, type: string, title: string, message: string) {
    try {
      await prisma.notification.create({
        data: { userId, organizationId: ticket.organizationId || null, type, title, message, link: `/tickets?id=${ticket.id}` },
      });
    } catch {
      /* notification failures never block ticket work */
    }
  }
}
