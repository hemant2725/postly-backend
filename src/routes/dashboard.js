import { Router } from 'express';

const router = Router();

router.get('/stats', async (req, res) => {
  res.status(501).json({
    error: 'Dashboard stats are not implemented yet.',
    data: null
  });
});

export default router;
