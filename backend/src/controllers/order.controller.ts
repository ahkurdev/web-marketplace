import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { AppError } from '../middlewares/error.middleware';

export const checkout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { shippingAddress } = req.body;

    if (!shippingAddress || typeof shippingAddress !== 'string' || shippingAddress.trim() === '') {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Shipping address is required' },
      });
    }

    const order = await prisma.$transaction(async (tx) => {
      const cartItems = await tx.cartItem.findMany({
        where: { userId },
        include: { product: true },
      });

      if (cartItems.length === 0) {
        throw new AppError(400, 'EMPTY_CART', 'Cannot checkout with an empty cart');
      }

      for (const item of cartItems) {
        if (item.product.stock < item.quantity) {
          throw new AppError(
            400,
            'INSUFFICIENT_STOCK',
            `Insufficient stock for product: ${item.product.title}`
          );
        }
      }

      const totalAmount = cartItems.reduce(
        (sum, item) => sum + item.quantity * item.product.price,
        0
      );

      for (const item of cartItems) {
        await tx.product.update({
          where: { id: item.productId },
          data: {
            stock: { decrement: item.quantity },
          },
        });
      }

      const createdOrder = await tx.order.create({
        data: {
          userId,
          totalAmount,
          status: 'PENDING',
          shippingAddress: shippingAddress.trim(),
          items: {
            create: cartItems.map((item) => ({
              productId: item.productId,
              price: item.product.price,
              quantity: item.quantity,
            })),
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
      });

      await tx.cartItem.deleteMany({
        where: { userId },
      });

      return createdOrder;
    });

    return res.status(201).json(order);
  } catch (err) {
    next(err);
  }
};

export const getOrders = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json(orders);
  } catch (err) {
    next(err);
  }
};

export const getOrderById = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!order || (order.userId !== userId && req.user?.role !== 'ADMIN')) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Order not found' },
      });
    }

    return res.status(200).json(order);
  } catch (err) {
    next(err);
  }
};
