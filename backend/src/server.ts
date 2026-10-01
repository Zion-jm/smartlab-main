import './config/loadEnvironment';
import { createShutdown } from './services/shutdown';
import { drainNotifications } from './services/notificationService';
import { prisma } from './db/prisma';
import { corsOptions } from './config/cors';
import { errorHandler, errorResponseContract } from './middleware/errors';
import path from 'node:path';
import { existsSync } from 'node:fs';

import express, { Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';


// Import routes
import authRoutes from './routes/auth';
import equipmentRoutes from './routes/equipment';
import userRoutes from './routes/users';
import borrowRequestRoutes from './routes/borrowRequests';
import labScheduleRoutes from './routes/labSchedules';
import academicDirectoryRoutes from './routes/academicDirectory';
import conflictRoutes from './routes/conflicts';
import equipmentConflictsRoutes from './routes/equipmentConflicts';
import equipmentAdjustmentsRoutes from './routes/equipmentAdjustments';
import notificationRoutes from './routes/notifications';
import reportRoutes from './routes/reports';
import academicPeriodRoutes from './routes/academicPeriod';
import auditLogRoutes from './routes/auditLogs';
import { verifyEmailTransport } from './services/email';

const app = express();

const PORT = process.env.PORT || 3001;

// Middleware
app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: process.env.NODE_ENV === 'production' && process.env.FRONTEND_URL?.startsWith('https:') ? [] : null } } }));
app.use(cors(corsOptions(process.env)));
// Never trust client-supplied forwarding headers by default.
if (process.env.TRUSTED_PROXIES) app.set('trust proxy', process.env.TRUSTED_PROXIES.split(',').map(value => value.trim()));
app.use(errorResponseContract);
app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    service: 'SmartLab API',
    version: '2.0.0'
  });
});

// Readiness reveals no data or driver diagnostics.
app.get('/ready', async (_req, res) => {
  if (stopping) { res.status(503).json({ status: 'unavailable' }); return; }
  try { await prisma.$queryRaw`SELECT 1`; res.json({ status: 'ready' }); }
  catch { res.status(503).json({ status: 'unavailable' }); }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/users', userRoutes);
app.use('/api/borrow-requests', borrowRequestRoutes);
app.use('/api/lab-schedules', labScheduleRoutes);
app.use('/api/academic-directory', academicDirectoryRoutes);
app.use('/api/conflicts', conflictRoutes);
app.use('/api/equipment-conflicts', equipmentConflictsRoutes);
app.use('/api/equipment-adjustments', equipmentAdjustmentsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/academic-period', academicPeriodRoutes);
app.use('/api/audit-logs', auditLogRoutes);

// Unknown API paths must never fall through to React.
app.use('/api', (_req, res) => { res.status(404).json({ error: 'API route not found' }); });
const frontendDirectory = path.resolve(__dirname, '../../frontend/dist');
if (process.env.NODE_ENV === 'production') {
  app.use('/assets', express.static(path.join(frontendDirectory, 'assets'), { immutable: true, maxAge: '1y', fallthrough: false }));
  app.use(express.static(frontendDirectory, { index: false, maxAge: 0 }));
  app.get('*', (req, res, next) => {
    if (path.extname(req.path) || !req.accepts('html')) return next();
    res.setHeader('Cache-Control', 'no-cache');
    res.sendFile(path.join(frontendDirectory, 'index.html'));
  });
}

app.use(errorHandler);
app.use((_req: Request, res: Response) => { res.status(404).json({ error: 'Route not found' }); });

// Validate dependencies before accepting traffic; never migrate or seed here.
let server: ReturnType<typeof app.listen> | undefined;
let stopping = false;
async function start() {
  if (process.env.NODE_ENV === 'production' && !existsSync(path.join(frontendDirectory, 'index.html')))
    throw new Error('Frontend build missing.');
  await prisma.$connect();
  await prisma.user.findFirst({ select: { sessionVersion: true } });
  await prisma.equipment.findFirst({ select: { retiredAt: true } });
  if (stopping) return;
  server = app.listen(PORT, () => {
    console.log('SmartLab listening on port ' + PORT + ' (' + (process.env.NODE_ENV || 'development') + ')');
    verifyEmailTransport();
  });
}
const started = start().catch(async () => {
  console.error('SmartLab startup failed. Check environment, migrations and built assets.');
  await prisma.$disconnect();
  process.exitCode = 1;
});
const shutdown = createShutdown({
  closeHttp: async () => {
    stopping = true;
    await started;
    if (server) await new Promise<void>((resolve, reject) => {
      server!.close(error => error ? reject(error) : resolve());
      server!.closeIdleConnections();
    });
  },
  drain: drainNotifications,
  disconnect: () => prisma.$disconnect(),
  exit: code => process.exit(code),
});
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
