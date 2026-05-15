import { db } from '@/lib/db';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Token-based auth - no cookies, no in-memory session store
// FAIL FAST: No hardcoded fallbacks — AUTH_SECRET MUST be set in production
const AUTH_SECRET = process.env.AUTH_SECRET;
if (!AUTH_SECRET) {
  console.error('[AUTH] FATAL: AUTH_SECRET environment variable is not set!');
  // In production, this is critical. In dev, we'll use a warning.
  if (process.env.NODE_ENV === 'production') {
    throw new Error('AUTH_SECRET environment variable is required in production');
  }
}
const EFFECTIVE_AUTH_SECRET = AUTH_SECRET || 'dev_only_fallback_change_me';

// Create a self-contained auth token
export function createAuthToken(userId: string, role: string): string {
  const timestamp = Date.now().toString(36);
  const payload = `${userId}:${role}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', EFFECTIVE_AUTH_SECRET)
    .update(payload)
    .digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

// Verify and decode an auth token
export function verifyAuthToken(token: string): { userId: string; role: string; issuedAt: number } | null {
  try {
    const decoded = Buffer.from(token, 'base64url').toString('utf-8');
    const [payload, signature] = decoded.split('.');
    if (!payload || !signature) return null;

    const expectedSig = crypto
      .createHmac('sha256', EFFECTIVE_AUTH_SECRET)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSig) return null;

    const [userId, role, timestamp] = payload.split(':');
    if (!userId || !role || !timestamp) return null;

    // Check token expiry (2 hours)
    const tokenTime = parseInt(timestamp, 36);
    const maxAge = 2 * 60 * 60 * 1000;
    if (Date.now() - tokenTime > maxAge) return null;

    return { userId, role, issuedAt: tokenTime };
  } catch {
    return null;
  }
}

// Extract token from Authorization header
export function getTokenFromRequest(request: Request): string | null {
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return null;
  if (authHeader.startsWith('Bearer ')) {
    return authHeader.slice(7);
  }
  // Also check for direct token (backward compat)
  return authHeader || null;
}

// Get session from request (reads Authorization header)
export async function getSession(request: Request): Promise<{ userId: string; role: string } | null> {
  const token = getTokenFromRequest(request);
  if (!token) return null;

  const decoded = verifyAuthToken(token);
  if (!decoded) return null;

  // Verify user still exists and is active
  try {
    const user = await db.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true, isActive: true },
    });

    if (!user || !user.isActive) return null;

    return { userId: user.id, role: user.role };
  } catch {
    return null;
  }
}

export async function requireAuth(request: Request): Promise<{ userId: string; role: string }> {
  const session = await getSession(request);
  if (!session) {
    throw new AuthError('Authentication required', 401);
  }
  return session;
}

export async function requireAdmin(request: Request): Promise<{ userId: string; role: string }> {
  const session = await requireAuth(request);
  if (session.role !== 'admin') {
    throw new AuthError('Admin access required', 403);
  }
  return session;
}

// ── Password Hashing ──
// New: bcrypt (cost factor 12) — slow, GPU-resistant
// Old formats supported for backward compatibility during migration

const BCRYPT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  return `bcrypt$${hash}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  try {
    // New format: bcrypt$<bcrypt_hash>
    if (storedHash.startsWith('bcrypt$')) {
      const bcryptHash = storedHash.slice(7);
      return await bcrypt.compare(password, bcryptHash);
    }

    // SHA-512 format: sha512$salt$hash (legacy — auto-migrate to bcrypt on next login)
    if (storedHash.startsWith('sha512$')) {
      const parts = storedHash.split('$');
      if (parts.length === 3 && parts[0] === 'sha512') {
        const [, salt, expectedHash] = parts;
        if (!salt || !expectedHash) return false;
        const AUTH_SALT = process.env.AUTH_SALT || 'matkaking_auth_salt_2024_secure';
        const computedHash = crypto.createHash('sha512').update(password + salt + AUTH_SALT).digest('hex');
        const match = computedHash === expectedHash;
        // TODO: If match, re-hash with bcrypt on next login (auto-migration)
        return match;
      }
    }

    // PBKDF2 format: iterations$salt$hash (legacy)
    if (storedHash.includes('$')) {
      const parts = storedHash.split('$');
      if (parts.length === 3) {
        const [iterationsStr, salt, expectedHash] = parts;
        const iterations = parseInt(iterationsStr, 10);
        if (!isNaN(iterations) && salt && expectedHash) {
          const computedHash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
          return computedHash === expectedHash;
        }
      }
      // Scrypt format: salt$hash (2 parts)
      if (parts.length === 2) {
        const [salt, expectedHash] = parts;
        if (salt && expectedHash) {
          const computedHash = crypto.scryptSync(password, salt, 64).toString('hex');
          return computedHash === expectedHash;
        }
      }
    }

    // Legacy format: plain SHA-256 (oldest — for backward compat)
    return crypto.createHash('sha256').update(password + 'game_sim_salt').digest('hex') === storedHash;
  } catch {
    return false;
  }
}

/**
 * Check if a password hash needs re-hashing (legacy format → bcrypt migration)
 */
export function isLegacyHash(storedHash: string): boolean {
  return !storedHash.startsWith('bcrypt$');
}

/**
 * Re-hash a password with bcrypt if it was verified using a legacy format
 */
export async function rehashIfNeeded(userId: string, password: string, storedHash: string): Promise<void> {
  if (isLegacyHash(storedHash)) {
    try {
      const newHash = await hashPassword(password);
      await db.user.update({
        where: { id: userId },
        data: { password: newHash },
      });
      console.log(`[AUTH] Migrated password hash for user ${userId} to bcrypt`);
    } catch (error) {
      console.error(`[AUTH] Failed to migrate password hash for user ${userId}:`, error);
    }
  }
}

// Custom error class for auth errors
export class AuthError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.statusCode = statusCode;
    this.name = 'AuthError';
  }
}

// Exclude password from user object
export function excludePassword<T extends { password?: string }>(user: T): Omit<T, 'password'> {
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
}
