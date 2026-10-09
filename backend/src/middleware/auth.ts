import { accountApiLimiter, writeLimiter } from './requestLimiter';
import { prisma } from '../db/prisma';
import { sendError } from './errors';
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { UserRole, UserStatus } from '@prisma/client';



// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        role: UserRole;
        firstName: string;
        lastName: string;
        sessionVersion: number;
      };
    }
  }
}

export const authenticateToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    let decoded: jwt.JwtPayload;
    try {
      const payload = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] });
      if (typeof payload === 'string' || typeof payload.userId !== 'string' || !Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 0) throw new Error('Invalid token claims');
      decoded = payload;
    } catch {
      res.status(401).json({ error: 'Invalid or expired token. Please sign in again.', code: 'SESSION_INVALID' });
      return;
    }

    // Get full user details from database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        firstName: true,
        lastName: true,
        status: true,
        sessionVersion: true,
      },
    });

    if (!user) {
      res.status(401).json({ error: 'Session no longer valid. Please sign in again.', code: 'SESSION_INVALID' });
      return;
    }

    if (user.status !== UserStatus.ACTIVE || user.sessionVersion !== decoded.sessionVersion) {
      res.status(401).json({ error: 'Session no longer valid. Please sign in again.', code: 'SESSION_INVALID' });
      return;
    }
    req.user = user;
    res.setHeader('Cache-Control', 'no-store');
    accountApiLimiter(req, res, () => {
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) writeLimiter(req, res, next);
      else next();
    });
  } catch (error) {
    sendError(error, res);
  }
};

// Role-based authorization middleware
export const authorizeRoles = (...roles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
};

// Generate JWT token
export const generateToken = (user: {
  id: string;
  email: string;
  role: UserRole;
  sessionVersion: number;
}): string => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role, sessionVersion: user.sessionVersion },
    process.env.JWT_SECRET!,
    { expiresIn: '24h', algorithm: 'HS256' }
  );
};
