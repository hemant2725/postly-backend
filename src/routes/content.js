import { Router } from 'express';

const router = Router();

router.post('/generate', async (req, res) => {
  res.status(501).json({
    error: 'Content generation is not implemented yet.',
    data: null
  });
});

export default router;
