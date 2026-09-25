import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import {
  createInterviewQuestions,
  listApplicationAnalyses,
  listInterviewQuestions,
  runApplicationAnalysis,
} from '../services/aiService';

const router = Router();
router.use(requireAuth);

router.post('/applications/:id/analyze', async (req, res) => {
  try {
    const analysis = await runApplicationAnalysis(req.user!.id, req.params.id);
    return res.status(201).json(analysis);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    if (error.code === 'NO_RESUME_ATTACHED') {
      return res.status(400).json({ error: { code: 'NO_RESUME_ATTACHED', message: 'Attach a resume to this application before running an analysis.' } });
    }

    if (error.code === 'RESUME_TEXT_UNAVAILABLE') {
      return res.status(422).json({ error: { code: 'RESUME_TEXT_UNAVAILABLE', message: 'Resume text could not be extracted.' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to run analysis' } });
  }
});

router.get('/applications/:id/analyses', async (req, res) => {
  try {
    const analyses = await listApplicationAnalyses(req.user!.id, req.params.id);
    return res.json(analyses);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list analyses' } });
  }
});

router.post('/applications/:id/interview-questions', async (req, res) => {
  try {
    const result = await createInterviewQuestions(req.user!.id, req.params.id);
    return res.status(201).json(result);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to generate interview questions' } });
  }
});

router.get('/applications/:id/interview-questions', async (req, res) => {
  try {
    const result = await listInterviewQuestions(req.user!.id, req.params.id);
    return res.json(result);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list interview questions' } });
  }
});

export default router;
