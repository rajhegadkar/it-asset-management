import { prisma } from '../config/db.js';
import { ci } from '../utils/dbCompat.js';
import { sendTemplatedEmail } from './notificationTemplates.js';
import { z } from 'zod';

const intLike = z.union([z.number(), z.string()]).optional().nullable().transform((v) => (v === '' || v == null ? undefined : Number(v)));

export const consumableSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200),
  category: z.string().max(50).optional().nullable(),
  itemCode: z.string().max(100).optional().nullable(),
  stockQuantity: intLike,
  currentStock: intLike,
  minQuantity: intLike,
  minStockAlert: intLike,
  maxQuantity: intLike,
  unitCost: intLike,
  locationId: z.string().optional().nullable(),
  vendorId: z.string().optional().nullable(),
});

export const transactionSchema = z.object({
  type: z.enum(['INWARD', 'OUTWARD_ISSUE', 'RETURN', 'ADJUSTMENT']),
  quantity: z.union([z.number(), z.string()]).transform((v) => Number(v)),
  employeeId: z.string().optional().nullable(),
  assetId: z.string().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateConsumableInput = z.input<typeof consumableSchema>;

function checkInt(v: number | undefined, field: string, min = 0) {
  if (v !== undefined && (!Number.isInteger(v) || v < min)) {
    throw { statusCode: 400, message: `${field} must be a whole number of at least ${min}`, code: 'VALIDATION_ERROR' };
  }
}

/** Notify active IT admins once, when an item first drops to its minimum level. */
async function alertLowStock(item: { id: string; name: string; itemCode: string; minQuantity: number; organizationId: string | null; location?: { name: string } | null }, newStock: number) {
  const admins = await prisma.user.findMany({
    where: { isActive: true, role: { name: { in: ['SUPER_ADMIN', 'IT_ADMIN'] } } },
    select: { id: true, email: true },
  });
  if (admins.length) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        userId: a.id,
        organizationId: item.organizationId,
        type: 'LOW_STOCK',
        title: 'Low Stock Alert',
        message: `Item "${item.name}" has reached low stock level (${newStock} units remaining; threshold: ${item.minQuantity}).`,
        link: '/consumables',
      })),
    });
  }
  await sendTemplatedEmail('LOW_STOCK', undefined, admins.map((a) => a.email), {
    itemName: item.name,
    itemCode: item.itemCode,
    currentStock: newStock,
    minQuantity: item.minQuantity,
    locationName: item.location?.name || 'N/A',
  });
}

export class ConsumableService {
  static async getConsumables(params: { category?: string; lowStockOnly?: boolean; search?: string; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.category) where.category = params.category;
    // Filter in the database so pagination and totals are correct
    if (params.lowStockOnly) where.stockQuantity = { lte: prisma.consumable.fields.minQuantity };
    if (params.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [{ name: ci(q) }, { itemCode: ci(q) }];
    }

    const [total, items] = await Promise.all([
      prisma.consumable.count({ where }),
      prisma.consumable.findMany({
        where,
        skip,
        take: limit,
        orderBy: { stockQuantity: 'asc' },
        include: { location: true, vendor: true },
      }),
    ]);

    return { consumables: items, pagination: { total, page, limit, totalPages: Math.ceil(total / limit) } };
  }

  static async createConsumable(raw: CreateConsumableInput) {
    const input = consumableSchema.parse(raw);
    const stockQuantity = input.stockQuantity ?? input.currentStock ?? 0;
    const minQuantity = input.minQuantity ?? input.minStockAlert ?? 5; // 0 is a valid minimum
    const maxQuantity = input.maxQuantity ?? 100;
    const unitCost = input.unitCost ?? 0;
    checkInt(stockQuantity, 'Stock quantity');
    checkInt(minQuantity, 'Minimum quantity');
    checkInt(maxQuantity, 'Maximum quantity');
    if (maxQuantity < minQuantity) throw { statusCode: 400, message: 'Maximum quantity must be at least the minimum', code: 'VALIDATION_ERROR' };
    if (!Number.isFinite(unitCost) || unitCost < 0) throw { statusCode: 400, message: 'Unit cost must be a positive number', code: 'VALIDATION_ERROR' };

    return await prisma.consumable.create({
      data: {
        name: input.name,
        category: input.category || 'OTHER',
        itemCode: input.itemCode?.trim() || `CONS-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).substring(2, 5).toUpperCase()}`,
        stockQuantity,
        minQuantity,
        maxQuantity,
        unitCost,
        locationId: input.locationId || null,
        vendorId: input.vendorId || null,
      },
    });
  }

  /**
   * Stock movement. Quantity must be a positive whole number, except ADJUSTMENT which is signed
   * (+5 found in audit, -2 written off). Stock can never go below zero; updates are atomic.
   */
  static async recordTransaction(params: {
    consumableId: string;
    type: string;
    quantity: number | string;
    employeeId?: string | null;
    assetId?: string | null;
    notes?: string | null;
    user?: any;
  }) {
    const input = transactionSchema.parse(params);
    const qty = input.quantity;
    if (!Number.isInteger(qty) || qty === 0 || (input.type !== 'ADJUSTMENT' && qty < 0)) {
      throw { statusCode: 400, message: 'Quantity must be a whole number greater than zero (adjustments may be negative).', code: 'VALIDATION_ERROR' };
    }
    if (input.type === 'ADJUSTMENT' && !input.notes) {
      throw { statusCode: 400, message: 'Please give a reason for the stock adjustment.', code: 'VALIDATION_ERROR' };
    }
    const delta = input.type === 'OUTWARD_ISSUE' ? -qty : qty;

    const { transaction, item, before, after } = await prisma.$transaction(async (tx) => {
      const item = await tx.consumable.findUnique({ where: { id: params.consumableId }, include: { location: true } });
      if (!item) throw { statusCode: 404, message: 'Consumable item not found' };

      if (delta < 0) {
        const moved = await tx.consumable.updateMany({
          where: { id: item.id, stockQuantity: { gte: -delta } },
          data: { stockQuantity: { decrement: -delta } },
        });
        if (moved.count !== 1) {
          throw { statusCode: 400, message: `Insufficient inventory in stock. Available: ${item.stockQuantity}, Requested: ${-delta}`, code: 'INSUFFICIENT_STOCK' };
        }
      } else {
        await tx.consumable.update({ where: { id: item.id }, data: { stockQuantity: { increment: delta } } });
      }
      const fresh = await tx.consumable.findUniqueOrThrow({ where: { id: item.id } });

      const transaction = await tx.consumableTransaction.create({
        data: {
          consumableId: item.id,
          type: input.type,
          quantity: qty,
          employeeId: input.employeeId || null,
          assetId: input.assetId || null,
          performedById: params.user?.id,
          notes: input.notes,
        },
      });
      return { transaction, item, before: item.stockQuantity, after: fresh.stockQuantity };
    });

    // Alert only when crossing the threshold, not on every movement below it
    if (before > item.minQuantity && after <= item.minQuantity) {
      await alertLowStock(item, after);
    }

    return transaction;
  }

  static async getConsumableById(id: string) {
    const item = await prisma.consumable.findUnique({
      where: { id },
      include: { location: true, vendor: true, transactions: { orderBy: { createdAt: 'desc' }, take: 200 } },
    });
    if (!item) throw { statusCode: 404, message: 'Consumable item not found' };
    return item;
  }

  /** Stock level is changed only through transactions (so every movement is recorded). */
  static async updateConsumable(id: string, raw: Partial<CreateConsumableInput>) {
    const input = consumableSchema.partial().parse(raw || {});
    const data: any = {};
    if (input.name) data.name = input.name;
    if (input.category) data.category = input.category;
    if (input.itemCode) data.itemCode = input.itemCode.trim();
    const minQ = input.minQuantity ?? input.minStockAlert;
    if (minQ !== undefined) {
      checkInt(minQ, 'Minimum quantity');
      data.minQuantity = minQ;
    }
    if (input.maxQuantity !== undefined) {
      checkInt(input.maxQuantity, 'Maximum quantity');
      data.maxQuantity = input.maxQuantity;
    }
    if (input.unitCost !== undefined) {
      if (!Number.isFinite(input.unitCost) || input.unitCost < 0) throw { statusCode: 400, message: 'Unit cost must be a positive number', code: 'VALIDATION_ERROR' };
      data.unitCost = input.unitCost;
    }
    if (input.locationId !== undefined) data.locationId = input.locationId || null;
    if (input.vendorId !== undefined) data.vendorId = input.vendorId || null;

    const newStock = input.stockQuantity ?? input.currentStock;
    if (newStock !== undefined) {
      checkInt(newStock, 'Stock quantity');
      const current = await prisma.consumable.findUnique({ where: { id } });
      if (!current) throw { statusCode: 404, message: 'Consumable item not found' };
      if (newStock !== current.stockQuantity) {
        // Record the edit as an adjustment so stock history stays complete
        await prisma.consumableTransaction.create({
          data: { consumableId: id, type: 'ADJUSTMENT', quantity: newStock - current.stockQuantity, notes: 'Stock level edited on item record' },
        });
        data.stockQuantity = newStock;
      }
    }

    return await prisma.consumable.update({ where: { id }, data, include: { location: true, vendor: true } });
  }

  /** Items with stock history are kept for audit; only never-used items can be deleted. */
  static async deleteConsumable(id: string) {
    const history = await prisma.consumableTransaction.count({ where: { consumableId: id } });
    if (history > 0) {
      throw { statusCode: 409, message: `This item has ${history} stock movement(s) on record and cannot be deleted. Set its stock to 0 instead.`, code: 'RECORD_IN_USE' };
    }
    return await prisma.consumable.delete({ where: { id } });
  }
}
