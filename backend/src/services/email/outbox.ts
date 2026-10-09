import { randomUUID } from 'node:crypto';
import { prisma } from '../../db/prisma';
import { sendQueuedEmail, emailDeliveryConfigured, EmailDeliveryError } from './transporter';


type Mail = { eventKey: string; to: string; subject: string; html: string; text: string };
type Job = { id: string; recipient: string; subject: string; html: string; text: string; attempts: number };
let timer: ReturnType<typeof setInterval> | undefined;
let active: Promise<void> | undefined;
export async function enqueueEmail(mail: Mail): Promise<void> {
  await prisma.$executeRaw`INSERT INTO "EmailOutbox" ("id", "eventKey", "recipient", "subject", "html", "text")
    VALUES (${randomUUID()}, ${mail.eventKey}, ${mail.to}, ${mail.subject}, ${mail.html}, ${mail.text}) ON CONFLICT ("eventKey") DO NOTHING`;
}
export async function deliverEmailBatch(): Promise<void> {
  // No external delivery unless explicitly enabled. Pending messages remain saved.
  if (process.env.EMAIL_DELIVERY_ENABLED !== 'true' || !emailDeliveryConfigured()) return;
  for (let count = 0; count < 10; count++) {
    const jobs = await prisma.$queryRaw<Job[]>`UPDATE "EmailOutbox" SET "status"='SENDING', "lockedAt"=NOW(), "attempts"="attempts"+1
      WHERE "id"=(SELECT "id" FROM "EmailOutbox" WHERE ("status"='PENDING' AND "nextAttemptAt"<=NOW())
        OR ("status"='SENDING' AND "lockedAt"<NOW()-INTERVAL '5 minutes')
        ORDER BY "createdAt" LIMIT 1 FOR UPDATE SKIP LOCKED) RETURNING *`;
    const job = jobs[0]; if (!job) break;
    try {
      await sendQueuedEmail(job);
      await prisma.$executeRaw`UPDATE "EmailOutbox" SET "status"='SENT', "sentAt"=NOW(), "lockedAt"=NULL, "lastError"=NULL WHERE "id"=${job.id}`;
    } catch (error) {
      const safeError = error instanceof EmailDeliveryError ? error.message : "Email delivery failed; check transport configuration.";
      const status = job.attempts >= 5 ? 'FAILED' : 'PENDING';
      const next = new Date(Date.now() + Math.min(3600000, 60000 * 2 ** (job.attempts - 1)));
      await prisma.$executeRaw`UPDATE "EmailOutbox" SET "status"=${status}, "nextAttemptAt"=${next}, "lockedAt"=NULL, "lastError"=${safeError} WHERE "id"=${job.id}`;
    }
  }
}
export function startEmailWorker() {
  if (timer) return;
  const tick = () => { if (!active) active = deliverEmailBatch().catch(() => { console.error('Email queue processing failed.'); }).finally(() => { active = undefined; }); };
  timer = setInterval(tick, 30000); timer.unref(); tick();
}
export async function stopEmailWorker() { if (timer) clearInterval(timer); timer = undefined; await active; }
