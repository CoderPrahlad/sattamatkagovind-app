import { db, withRetry } from '@/lib/db';
import { verifyPassword, createAuthToken, excludePassword, rehashIfNeeded } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody, checkRateLimit } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile, isValidPassword } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const POST = apiHandler(async (request) => {
  // Parse body safely
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const mobile = sanitizeMobile(String(body.mobile || ''));
  const password = String(body.password || '');

  logger.info('Login', `Attempt for mobile ${mobile.slice(0, 4)}****`);

  // Validate inputs
  if (!mobile || !password) {
    return apiError('Mobile and password are required', 400);
  }

  if (!isValidMobile(mobile)) {
    return apiError('Mobile must be 10-15 digits', 400);
  }

  if (!isValidPassword(password)) {
    return apiError('Invalid credentials', 400);
  }

  // Find user with retry for SQLite busy/locked
  const user = await withRetry(
    () => db.user.findUnique({ where: { mobile } }),
    { context: 'Login: findUser' }
  );

  if (!user) {
    logger.warn('Login', `Failed - user not found: ${mobile.slice(0, 4)}****`);
    return apiError('Invalid mobile or password', 400);
  }

  if (!user.isActive) {
    logger.warn('Login', `Failed - deactivated: ${mobile.slice(0, 4)}****`);
    return apiError('Account is deactivated. Contact support.', 400);
  }

  // Verify password
  const passwordValid = await verifyPassword(password, user.password);
  if (!passwordValid) {
    logger.warn('Login', `Failed - wrong password: ${mobile.slice(0, 4)}****`);
    return apiError('Invalid mobile or password', 400);
  }

  // Auto-migrate legacy password hashes (fire-and-forget)
  rehashIfNeeded(user.id, password, user.password).catch(() => {});

  // Create auth token
  const token = createAuthToken(user.id, user.role);

  logger.info('Login', `Success: ${mobile.slice(0, 4)}**** role=${user.role}`);

  return apiSuccess({
    ...excludePassword(user),
    token,
  }, 'Login successful');
}, { rateLimit: RATE_LIMITS.LOGIN, rateLimitSuffix: 'login' });
