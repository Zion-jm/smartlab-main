import { Router } from 'express';
import { prisma } from '../db/prisma';
import { authenticateToken, authorizeRoles } from '../middleware/auth';
import { sendError } from '../middleware/errors';
import { recordRequiredAuditLog } from '../services/auditLogService';
import { RequestActionError } from '../services/requestActionError';
const router = Router();
router.get('/', authenticateToken, async (_req, res) => {
  try { res.json(await prisma.borrowingPolicy.findUniqueOrThrow({where:{id:'default'}})); }
  catch (error) { sendError(error,res); }
});
router.put('/', authenticateToken, authorizeRoles('ADMIN'), async (req,res) => {
  try {
    const {content, revision} = req.body;
    if (typeof content !== 'string' || !content.trim() || content.length > 20000) throw new RequestActionError(400,'Enter a policy between 1 and 20,000 characters.');
    if (!Number.isInteger(revision) || revision < 1) throw new RequestActionError(409,'Reload the latest policy before saving.');
    const saved = await prisma.$transaction(async tx => {
      const changed = await tx.borrowingPolicy.updateMany({where:{id:'default',revision},data:{content:content.trim(),revision:{increment:1}}});
      if (!changed.count) throw new RequestActionError(409,'Another administrator updated this policy. Copy your draft, reload the latest policy, and review it before saving.');
      const policy = await tx.borrowingPolicy.findUniqueOrThrow({where:{id:'default'}});
      await recordRequiredAuditLog(tx,{actorUserId:req.user!.id,action:'UPDATE',entityType:'BorrowingPolicy',entityId:'default',details:{label:'Borrowing Policy',revision:policy.revision}});
      return policy;
    });
    res.json(saved);
  } catch (error) { sendError(error,res); }
});
export default router;
