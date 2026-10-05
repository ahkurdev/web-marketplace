import { Request, Response, NextFunction } from 'express';

export const validateRequiredFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing = fields.filter((f) => req.body[f] === undefined || req.body[f] === null || req.body[f] === '');
    if (missing.length > 0) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Missing required fields: ${missing.join(', ')}`,
        },
      });
    }
    next();
  };
};

export const validateRegister = (req: Request, res: Response, next: NextFunction) => {
  const { email, password, name } = req.body;
  const errors: string[] = [];

  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push('Valid email is required');
  }
  if (!password || typeof password !== 'string' || password.length < 8) {
    errors.push('Password must be at least 8 characters long');
  }
  if (!name || typeof name !== 'string' || name.trim() === '') {
    errors.push('Name is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.join(', '),
        details: errors,
      },
    });
  }
  next();
};

export const validateProductInput = (req: Request, res: Response, next: NextFunction) => {
  const { title, description, price, stock, category } = req.body;
  const errors: string[] = [];

  if (!title || typeof title !== 'string' || title.trim() === '') {
    errors.push('Title is required');
  }
  if (!description || typeof description !== 'string') {
    errors.push('Description is required');
  }
  if (price === undefined || typeof price !== 'number' || price <= 0) {
    errors.push('Price must be a positive number');
  }
  if (stock === undefined || typeof stock !== 'number' || stock < 0 || !Number.isInteger(stock)) {
    errors.push('Stock must be a non-negative integer');
  }
  if (!category || typeof category !== 'string' || category.trim() === '') {
    errors.push('Category is required');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: errors.join(', '),
        details: errors,
      },
    });
  }
  next();
};
