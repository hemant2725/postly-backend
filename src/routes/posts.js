import { Router } from 'express';

const router = Router();

router.post('/publish', async (req, res) => {
  res.status(501).json({
    error: 'Publishing is not implemented yet.',
    data: null
  });
});

router.post('/schedule', async (req, res) => {
  res.status(501).json({
    error: 'Scheduling is not implemented yet.',
    data: null
  });
});

router.get('/', async (req, res) => {
  res.status(501).json({
    error: 'Post listing is not implemented yet.',
    data: null
  });
});

router.get('/:id', async (req, res) => {
  res.status(501).json({
    error: 'Post detail is not implemented yet.',
    data: null
  });
});

router.post('/:id/retry', async (req, res) => {
  res.status(501).json({
    error: 'Retry is not implemented yet.',
    data: null
  });
});

router.delete('/:id', async (req, res) => {
  res.status(501).json({
    error: 'Post cancellation is not implemented yet.',
    data: null
  });
});

export default router;
