import { Router } from 'express';
import { createAuthLimiter } from '../middleware/authLimiter';
import { sendError } from '../middleware/errors';
import { setupAccess, beginSetup, resendSetup, setupProgress, verifySetupEmail, finishSetup } from '../services/installationSetupService';
const router = Router();
router.use(createAuthLimiter({ipMax:30,accountMax:10}));
router.post('/access', async (req,res) => { try { res.json(await setupAccess(req.get('X-Setup-Token'))); } catch(e) { sendError(e,res); } });
router.post('/begin', async (req,res) => { try { res.json(await beginSetup(req.get('X-Setup-Token'),req.body || {})); } catch(e) { sendError(e,res); } });
router.post('/resend', async (req,res) => { try { res.json(await resendSetup(req.get('X-Setup-Token'),req.get('X-Setup-Session'))); } catch(e) { sendError(e,res); } });
router.post('/progress', async (req,res) => { try { res.json(await setupProgress(req.get('X-Setup-Token'),req.get('X-Setup-Session'))); } catch(e) { sendError(e,res); } });
// Explicit POST avoids consuming links through email scanners or page prefetching.
router.post('/verify', async (req,res) => { try { res.json(await verifySetupEmail(req.body?.token)); } catch(e) { sendError(e,res); } });
router.post('/finish', async (req,res) => { try { res.json(await finishSetup(req.get('X-Setup-Token'),req.get('X-Setup-Session'),req.body || {})); } catch(e) { sendError(e,res); } });
export default router;
