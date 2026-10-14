import { prisma } from '../config/db.js';
import { EmailService } from '../utils/emailService.js';
import { NumberingEngine } from '../customization/numberingEngine.js';

export interface CreateTicketInput {
  subject: string;
  description: string;
  category?: string;
  priority?: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  requesterId: string;
  assetId?: string;
  departmentId?: string;
  locationId?: string;
  assignedEngineerId?: string;
}

export class TicketService {
  /**
   * Generates next sequential Ticket Number based on customizable rule
   */
  static async generateTicketNumber(): Promise<string> {
    return await NumberingEngine.generateNext('TICKET');
  }

  /**
   * List tickets with pagination & filters
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

    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { ticketNumber: { contains: q } },
        { subject: { contains: q } },
        { description: { contains: q } },
      ];
    }

    const [total, tickets] = await Promise.all([
      prisma.ticket.count({ where }),
      prisma.ticket.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: true,
          assignedEngineer: true,
          asset: true,
          department: true,
        },
      }),
    ]);

    return {
      tickets,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get single ticket with comments & asset info
   */
  static async getTicketById(idOrNumber: string) {
    const ticket = await prisma.ticket.findFirst({
      where: {
        OR: [{ id: idOrNumber }, { ticketNumber: idOrNumber }],
      },
      include: {
        requester: { include: { department: true, location: true } },
        assignedEngineer: true,
        asset: { include: { category: true } },
        department: true,
        location: true,
        comments: {
          orderBy: { createdAt: 'asc' },
          include: { user: true },
        },
      },
    });

    if (!ticket) {
      throw { statusCode: 404, message: 'Ticket not found', code: 'TICKET_NOT_FOUND' };
    }

    return ticket;
  }

  /**
   * Create Helpdesk Ticket
   */
  static async createTicket(input: CreateTicketInput, user?: any) {
    const ticketNumber = await this.generateTicketNumber();

    // Default SLA: Critical = 4h, High = 24h, Medium = 48h, Low = 72h
    let slaHours = 48;
    if (input.priority === 'CRITICAL') slaHours = 4;
    else if (input.priority === 'HIGH') slaHours = 24;
    else if (input.priority === 'LOW') slaHours = 72;

    const slaDueDate = new Date(Date.now() + slaHours * 60 * 60 * 1000);

    const ticket = await prisma.ticket.create({
      data: {
        ticketNumber,
        subject: input.subject,
        description: input.description,
        category: input.category || 'HARDWARE',
        priority: input.priority || 'MEDIUM',
        status: input.assignedEngineerId ? 'ASSIGNED' : 'OPEN',
        requesterId: input.requesterId,
        assetId: input.assetId,
        departmentId: input.departmentId,
        locationId: input.locationId,
        assignedEngineerId: input.assignedEngineerId,
        slaDueDate,
      },
      include: {
        requester: true,
        asset: true,
      },
    });

    // Notify requester
    if (ticket.requester.email) {
      const emailHtml = EmailService.wrapTemplate(
        'Support Ticket Created',
        `
          <p>Dear <strong>${ticket.requester.firstName}</strong>,</p>
          <p>Your support ticket has been received and registered into our queue.</p>
          <ul>
            <li><strong>Ticket Number:</strong> ${ticket.ticketNumber}</li>
            <li><strong>Subject:</strong> ${ticket.subject}</li>
            <li><strong>Priority:</strong> ${ticket.priority}</li>
            <li><strong>Estimated SLA:</strong> Within ${slaHours} hours</li>
          </ul>
        `
      );
      await EmailService.sendMail({
        to: ticket.requester.email,
        subject: `[Ticket #${ticket.ticketNumber}] ${ticket.subject}`,
        html: emailHtml,
      });
    }

    return ticket;
  }

  /**
   * Update Ticket Status, Priority, Assignment
   */
  static async updateTicket(id: string, updates: {
    status?: string;
    priority?: string;
    assignedEngineerId?: string;
    category?: string;
  }, user?: any) {
    const data: any = { ...updates };
    if (updates.status === 'RESOLVED') data.resolvedAt = new Date();
    if (updates.status === 'CLOSED') data.closedAt = new Date();

    const updated = await prisma.ticket.update({
      where: { id },
      data,
      include: { requester: true, assignedEngineer: true },
    });

    return updated;
  }

  /**
   * Add Comment / Response to Ticket
   */
  static async addComment(ticketId: string, params: {
    comment: string;
    isInternal?: boolean;
    attachments?: string[];
    user: any;
  }) {
    const ticket = await prisma.ticket.findUnique({ where: { id: ticketId } });
    if (!ticket) throw { statusCode: 404, message: 'Ticket not found' };

    const comment = await prisma.ticketComment.create({
      data: {
        ticketId,
        userId: params.user.id,
        authorName: `${params.user.firstName || params.user.username}`,
        comment: params.comment,
        isInternal: params.isInternal || false,
        attachments: params.attachments ? JSON.stringify(params.attachments) : null,
      },
    });

    return comment;
  }
}
