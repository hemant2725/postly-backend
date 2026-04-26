import { Router } from 'express';
import bot from '../bot/handlers.js';

const router = Router();

router.post('/telegram', (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

export default router;