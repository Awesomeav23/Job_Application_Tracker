import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth';
import { createApplication, deleteApplication, getApplication, listApplications, updateApplication } from '../services/applicationService';
import { sendValidationError } from '../utils/errors';

const router = Router();

router.use(requireAuth);

router.get('/', async (req, res) => {
  try {
    const applications = await listApplications(req.user!.id);
    return res.json(applications);
  } catch (error) {
    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to list applications' } });
  }
});

router.post('/', async (req, res) => {
  try {
    const application = await createApplication(req.user!.id, req.body);
    return res.status(201).json(application);
  } catch (error: any) {
    if (error.message === 'VALIDATION_FAILED') {
      return sendValidationError(res, error.fields ?? {});
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to create application' } });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const application = await getApplication(req.user!.id, req.params.id);
    return res.json(application);
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to fetch application' } });
  }
});

router.patch('/:id', async (req, res) => {
  try {
    const application = await updateApplication(req.user!.id, req.params.id, req.body);
    return res.json(application);
  } catch (error: any) {
    if (error.message === 'VALIDATION_FAILED') {
      return sendValidationError(res, error.fields ?? {});
    }

    if (error.statusCode === 400 && error.code === 'WRONG_DOCUMENT_KIND') {
      return res.status(400).json({
        error: {
          code: 'WRONG_DOCUMENT_KIND',
          message: 'The selected document does not match the requested field type.',
        },
      });
    }

    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to update application' } });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await deleteApplication(req.user!.id, req.params.id);
    return res.json({ deleted: true });
  } catch (error: any) {
    if (error.statusCode === 404) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Application not found' } });
    }

    return res.status(500).json({ error: { code: 'INTERNAL_SERVER_ERROR', message: 'Unable to delete application' } });
  }
});

export default router;
