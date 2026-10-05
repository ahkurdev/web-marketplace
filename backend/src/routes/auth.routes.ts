import { Router } from 'express';
import { register, login, getMe } from '../controllers/auth.controller';
import { authenticateToken } from '../middlewares/auth.middleware';
import { validateRegister, validateRequiredFields } from '../middlewares/validation.middleware';

const router = Router();

router.post('/register', validateRegister, register);
router.post('/login', validateRequiredFields(['email', 'password']), login);
router.get('/me', authenticateToken, getMe);

export default router;
