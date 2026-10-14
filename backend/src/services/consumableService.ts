import { prisma } from '../config/db.js';

export interface CreateConsumableInput {
  name: string;
  category: string;
  itemCode: string;
  stockQuantity: number;
  minQuantity: number;
  maxQuantity?: number;
  unitCost?: number;
  locationId?: string;
  vendorId?: string;
}

export class ConsumableService {
  static async getConsumables(params: { category?: string; lowStockOnly?: boolean; page?: number; limit?: number }) {
    const page = Math.max(1, params.page || 1);
    const limit = Math.min(100, Math.max(1, params.limit || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params.category) where.category = params.category;

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

    const result = params.lowStockOnly
      ? items.filter((item) => item.stockQuantity <= item.minQuantity)
      : items;

    return {
      consumables: result,
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  static async createConsumable(input: CreateConsumableInput) {
    return await prisma.consumable.create({
      data: {
        name: input.name,
        category: input.category,
        itemCode: input.itemCode,
        stockQuantity: Number(input.stockQuantity),
        minQuantity: Number(input.minQuantity),
        maxQuantity: Number(input.maxQuantity || 100),
        unitCost: input.unitCost ? Number(input.unitCost) : 0,
        locationId: input.locationId,
        vendorId: input.vendorId,
      },
    });
  }

  static async recordTransaction(params: {
    consumableId: string;
    type: 'INWARD' | 'OUTWARD_ISSUE' | 'RETURN' | 'ADJUSTMENT';
    quantity: number;
    employeeId?: string;
    assetId?: string;
    notes?: string;
    user?: any;
  }) {
    const item = await prisma.consumable.findUnique({ where: { id: params.consumableId } });
    if (!item) throw { statusCode: 404, message: 'Consumable item not found' };

    const qty = Number(params.quantity);
    if (params.type === 'OUTWARD_ISSUE' && item.stockQuantity < qty) {
      throw {
        statusCode: 400,
        message: `Insufficient inventory in stock. Available: ${item.stockQuantity}, Requested: ${qty}`,
        code: 'INSUFFICIENT_STOCK',
      };
    }

    const newStock =
      params.type === 'INWARD' || params.type === 'RETURN'
        ? item.stockQuantity + qty
        : item.stockQuantity - qty;

    const [transaction] = await Promise.all([
      prisma.consumableTransaction.create({
        data: {
          consumableId: params.consumableId,
          type: params.type,
          quantity: qty,
          employeeId: params.employeeId,
          assetId: params.assetId,
          performedById: params.user?.id,
          notes: params.notes,
        },
      }),
      prisma.consumable.update({
        where: { id: params.consumableId },
        data: { stockQuantity: newStock },
      }),
    ]);

    // Check if newStock triggers low stock alert
    if (newStock <= item.minQuantity) {
      await prisma.notification.create({
        data: {
          userId: params.user?.id,
          type: 'LOW_STOCK',
          title: 'Low Stock Alert',
          message: `Item "${item.name}" has reached low stock level (${newStock} units remaining; threshold: ${item.minQuantity}).`,
          link: '/consumables',
        },
      });
    }

    return transaction;
  }
}
