import { Router } from 'express';
import { checkout, getOrders, getOrderById } from '../controllers/order.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateRequiredFields } from '../middlewares/validation.middleware';

const router = Router();

router.use(authenticateToken);

router.post('/checkout', validateRequiredFields(['shippingAddress']), checkout);
router.get('/orders', getOrders);
router.get('/orders/:id', getOrderById);

export default router;
