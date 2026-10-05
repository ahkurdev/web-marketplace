import { Response, NextFunction } from 'express';
import { prisma } from '../config/db';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';

export const getCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const items = await prisma.cartItem.findMany({
      where: { userId },
      include: { product: true },
      orderBy: { createdAt: 'asc' },
    });

    const subtotal = items.reduce((sum, item) => sum + item.quantity * item.product.price, 0);

    return res.status(200).json({
      items,
      subtotal,
    });
  } catch (err) {
    next(err);
  }
};

export const addItemToCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { productId, quantity } = req.body;

    const numQty = Number(quantity);
    if (!numQty || !Number.isInteger(numQty) || numQty < 1) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Quantity must be an integer greater than or equal to 1' },
      });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const existingCartItem = await prisma.cartItem.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    const targetQuantity = (existingCartItem ? existingCartItem.quantity : 0) + numQty;

    if (targetQuantity > product.stock) {
      return res.status(400).json({
        error: { code: 'INSUFFICIENT_STOCK', message: 'Requested quantity exceeds available stock' },
      });
    }

    let resultItem;
    if (existingCartItem) {
      resultItem = await prisma.cartItem.update({
        where: { id: existingCartItem.id },
        data: { quantity: targetQuantity },
        include: { product: true },
      });
    } else {
      resultItem = await prisma.cartItem.create({
        data: {
          userId,
          productId,
          quantity: numQty,
        },
        include: { product: true },
      });
    }

    return res.status(201).json(resultItem);
  } catch (err) {
    next(err);
  }
};

export const updateCartItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    const { quantity } = req.body;

    const numQty = Number(quantity);
    if (!numQty || !Number.isInteger(numQty) || numQty < 1) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'Quantity must be an integer greater than or equal to 1' },
      });
    }

    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
      include: { product: true },
    });

    if (!cartItem || cartItem.userId !== userId) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Cart item not found' },
      });
    }

    if (numQty > cartItem.product.stock) {
      return res.status(400).json({
        error: { code: 'INSUFFICIENT_STOCK', message: 'Requested quantity exceeds available stock' },
      });
    }

    const updated = await prisma.cartItem.update({
      where: { id },
      data: { quantity: numQty },
      include: { product: true },
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

export const removeCartItem = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;

    const cartItem = await prisma.cartItem.findUnique({
      where: { id },
    });

    if (!cartItem || cartItem.userId !== userId) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Cart item not found' },
      });
    }

    await prisma.cartItem.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: 'Cart item removed',
    });
  } catch (err) {
    next(err);
  }
};

export const clearCart = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;

    await prisma.cartItem.deleteMany({
      where: { userId },
    });

    return res.status(200).json({
      success: true,
      message: 'Cart emptied successfully',
    });
  } catch (err) {
    next(err);
  }
};
