import { Router } from 'express';
import {
  getCart,
  addItemToCart,
  updateCartItem,
  removeCartItem,
  clearCart,
} from '../controllers/cart.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateRequiredFields } from '../middlewares/validation.middleware';

const router = Router();

router.use(authenticateToken);

router.get('/', getCart);
router.delete('/', clearCart);
router.post('/items', validateRequiredFields(['productId', 'quantity']), addItemToCart);
router.put('/items/:id', validateRequiredFields(['quantity']), updateCartItem);
router.delete('/items/:id', removeCartItem);

export default router;
