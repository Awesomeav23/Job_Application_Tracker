import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { getActivity, getAnalytics } from '../services/analyticsService';

const router = Router();
router.use(requireAuth);

const analyticsQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
});

const activityQuerySchema = z.object({
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  bucket: z.enum(['day', 'week']).optional().default('week'),
});

router.get('/analytics', async (req, res) => {
  try {
    const parsed = analyticsQuerySchema.safeParse({
      from: req.query.from,
      to: req.query.to,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'from and to must be valid ISO dates' } });
    }

    const data = await getAnalytics(req.user!.id, parsed.data.from, parsed.data.to);
    return res.json(data);
  } catch (error: any) {
    if (error.message === 'INVALID_DATE') {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'from and to must be valid ISO dates' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to fetch analytics' } });
  }
});

router.get('/analytics/activity', async (req, res) => {
  try {
    const parsed = activityQuerySchema.safeParse({
      from: req.query.from,
      to: req.query.to,
      bucket: req.query.bucket,
    });

    if (!parsed.success) {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'Bucket must be day or week' } });
    }

    const data = await getActivity(req.user!.id, parsed.data.from, parsed.data.to, parsed.data.bucket);
    return res.json(data);
  } catch (error: any) {
    if (error.message === 'INVALID_DATE') {
      return res.status(400).json({ error: { code: 'VALIDATION_FAILED', message: 'from and to must be valid ISO dates' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to fetch activity metrics' } });
  }
});

export default router;
