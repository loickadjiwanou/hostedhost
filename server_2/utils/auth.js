import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { logger } from './logger.js';

const JWT_SECRET = process.env.JWT_SECRET || 'votre-secret-jwt-super-securise';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

export async function hashPassword(password) {
  return await bcrypt.hash(password, 12);
}

export async function comparePassword(password, hashedPassword) {
  return await bcrypt.compare(password, hashedPassword);
}

export function generateToken(userId) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    logger.warn('TOKEN_VERIFICATION_FAILED', error.message);
    return null;
  }
}

export function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    logger.warn('MISSING_TOKEN', `IP: ${req.ip}, Route: ${req.originalUrl}`);
    return res.status(401).json({ 
      success: false, 
      message: 'Token d\'accès requis' 
    });
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    return res.status(403).json({ 
      success: false, 
      message: 'Token invalide ou expiré' 
    });
  }

  req.userId = decoded.userId;
  next();
}