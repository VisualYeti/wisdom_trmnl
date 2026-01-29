import { Router } from 'express';
import quoteRoutes from './quote.js';
import adminRoutes from './admin.js';

const router = Router();

// Mount routes
router.use('/', quoteRoutes);
router.use('/admin', adminRoutes);

export default router;
