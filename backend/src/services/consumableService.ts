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

  static async createConsumable(input: any) {
    const category = input.category || 'OTHER';
    const itemCode = input.itemCode?.trim() || `CONS-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const stockQuantity = Number(input.stockQuantity ?? input.currentStock ?? 0) || 0;
    const minQuantity = Number(input.minQuantity ?? input.minStockAlert ?? 5) || 5;
    const maxQuantity = Number(input.maxQuantity ?? 100) || 100;
    const unitCost = input.unitCost !== undefined ? Number(input.unitCost) : 0;

    return await prisma.consumable.create({
      data: {
        name: input.name,
        category,
        itemCode,
        stockQuantity,
        minQuantity,
        maxQuantity,
        unitCost,
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

  static async getConsumableById(id: string) {
    const item = await prisma.consumable.findUnique({
      where: { id },
      include: { location: true, vendor: true, transactions: true },
    });
    if (!item) throw { statusCode: 404, message: 'Consumable item not found' };
    return item;
  }

  static async updateConsumable(id: string, input: Partial<CreateConsumableInput>) {
    const data: any = { ...input };
    if (input.stockQuantity !== undefined) data.stockQuantity = Number(input.stockQuantity);
    if (input.minQuantity !== undefined) data.minQuantity = Number(input.minQuantity);
    if (input.maxQuantity !== undefined) data.maxQuantity = Number(input.maxQuantity);
    if (input.unitCost !== undefined) data.unitCost = Number(input.unitCost);

    return await prisma.consumable.update({
      where: { id },
      data,
      include: { location: true, vendor: true },
    });
  }

  static async deleteConsumable(id: string) {
    await prisma.consumableTransaction.deleteMany({ where: { consumableId: id } });
    return await prisma.consumable.delete({
      where: { id },
    });
  }
}
