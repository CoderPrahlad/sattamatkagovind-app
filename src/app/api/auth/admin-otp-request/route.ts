import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile, isValidPassword } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { db, withRetry } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { sendAdminOTP, storeOTP } from '@/lib/email';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawMobile = String(body.mobile ?? '');
  const rawPassword = String(body.password ?? '');
  const mobile = sanitizeMobile(rawMobile);

  if (!mobile || !rawPassword) {
    return apiError('Mobile and password are required');
  }

  if (!isValidMobile(mobile)) {
    return apiError('Mobile must be 10-15 digits');
  }

  if (!isValidPassword(rawPassword)) {
    return apiError('Invalid password format');
  }

  // Find user
  const user = await withRetry(
    () => db.user.findUnique({ where: { mobile } }),
    { context: 'AdminOTP: findUser' }
  );

  if (!user) {
    return apiError('Invalid mobile or password', 401);
  }

  if (!user.isActive) {
    return apiError('Account is deactivated', 403);
  }

  if (user.role !== 'admin') {
    return apiError('Access denied. Admin accounts only.', 403);
  }

  // Verify password (now async - supports bcrypt)
  if (!await verifyPassword(rawPassword, user.password)) {
    return apiError('Invalid mobile or password', 401);
  }

  // Generate 6-digit OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  // Store OTP in database
  storeOTP(mobile, otp);

  // Get admin email from env (with fallback)
  const adminEmail = process.env.ADMIN_EMAIL || 'gouravkumar10769@gmail.com';

  // Send OTP email (fire-and-forget with catch to prevent unhandled rejection / 502)
  sendAdminOTP({
    adminName: user.name,
    email: adminEmail,
    otp,
  }).catch(() => {});

  logger.info('Auth', `Admin OTP requested for: ${mobile}`);

  return apiSuccess(null, 'OTP sent to admin email');
}, { rateLimit: RATE_LIMITS.ADMIN_OTP, rateLimitSuffix: 'admin-otp-request' });
