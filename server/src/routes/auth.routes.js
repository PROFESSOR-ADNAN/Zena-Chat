import express from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, refresh, logout, getMe, suspendUser, searchUsers } from '../controllers/auth.controller.js';
import { protect, requireAdmin } from '../middleware/auth.js';

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Too many auth attempts from this IP, please try again in 15 minutes' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', protect, getMe);
router.get('/users/search', protect, searchUsers);
router.get('/users', protect, searchUsers);
router.post('/users/:userId/suspend', protect, requireAdmin, suspendUser);

export default router;
