import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/db';

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rawPage = parseInt(req.query.page as string || '1', 10);
    const rawLimit = parseInt(req.query.limit as string || '10', 10);
    const page = isNaN(rawPage) || rawPage < 1 ? 1 : rawPage;
    const limit = isNaN(rawLimit) || rawLimit < 1 ? 10 : Math.min(rawLimit, 100);

    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;

    const where: any = {};

    if (category && category.trim()) {
      where.category = category.trim();
    }

    if (search && search.trim()) {
      const term = search.trim();
      where.OR = [
        { title: { contains: term } },
        { description: { contains: term } },
      ];
    }

    const total = await prisma.product.count({ where });
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

    const data = await prisma.product.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
    });

    return res.status(200).json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
    });
  } catch (err) {
    next(err);
  }
};

export const getProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const product = await prisma.product.findUnique({
      where: { id },
    });

    if (!product) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    return res.status(200).json(product);
  } catch (err) {
    next(err);
  }
};

export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, description, price, stock, category, imageUrl } = req.body;

    const product = await prisma.product.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        category: category.trim(),
        imageUrl: imageUrl ? imageUrl.trim() : null,
      },
    });

    return res.status(201).json(product);
  } catch (err) {
    next(err);
  }
};

export const updateProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    const { title, description, price, stock, category, imageUrl } = req.body;
    const updateData: any = {};

    if (title !== undefined) {
      if (typeof title !== 'string' || title.trim() === '') {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Title cannot be empty' },
        });
      }
      updateData.title = title.trim();
    }

    if (description !== undefined) {
      if (typeof description !== 'string') {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Description must be a string' },
        });
      }
      updateData.description = description.trim();
    }

    if (price !== undefined) {
      const numPrice = Number(price);
      if (isNaN(numPrice) || numPrice <= 0) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Price must be a positive number' },
        });
      }
      updateData.price = numPrice;
    }

    if (stock !== undefined) {
      const numStock = Number(stock);
      if (isNaN(numStock) || numStock < 0 || !Number.isInteger(numStock)) {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Stock must be a non-negative integer' },
        });
      }
      updateData.stock = numStock;
    }

    if (category !== undefined) {
      if (typeof category !== 'string' || category.trim() === '') {
        return res.status(400).json({
          error: { code: 'VALIDATION_ERROR', message: 'Category cannot be empty' },
        });
      }
      updateData.category = category.trim();
    }

    if (imageUrl !== undefined) {
      updateData.imageUrl = imageUrl ? imageUrl.trim() : null;
    }

    const updated = await prisma.product.update({
      where: { id },
      data: updateData,
    });

    return res.status(200).json(updated);
  } catch (err) {
    next(err);
  }
};

export const deleteProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const existing = await prisma.product.findUnique({
      where: { id },
    });

    if (!existing) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found' },
      });
    }

    await prisma.product.delete({
      where: { id },
    });

    return res.status(200).json({
      success: true,
      message: `Product ${id} deleted successfully`,
    });
  } catch (err) {
    next(err);
  }
};
