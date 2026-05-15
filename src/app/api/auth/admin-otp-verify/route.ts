import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { db, withRetry } from '@/lib/db';
import { verifyOTP } from '@/lib/email';
import { createAuthToken, excludePassword } from '@/lib/auth';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawMobile = String(body.mobile ?? '');
  const rawOtp = String(body.otp ?? '');
  const mobile = sanitizeMobile(rawMobile);

  if (!mobile || !rawOtp) {
    return apiError('Mobile and OTP are required');
  }

  if (!isValidMobile(mobile)) {
    return apiError('Invalid mobile number format');
  }

  // Verify OTP
  const isValid = await verifyOTP(mobile, rawOtp);
  if (!isValid) {
    return apiError('Invalid or expired OTP');
  }

  // Find user
  const user = await withRetry(
    () => db.user.findUnique({ where: { mobile } }),
    { context: 'AdminOTPVerify: findUser' }
  );

  if (!user || user.role !== 'admin') {
    return apiError('Admin account not found');
  }

  // Create auth token
  const token = createAuthToken(user.id, user.role);

  logger.info('Auth', `Admin logged in via OTP: ${mobile}`);

  return apiSuccess({
    ...excludePassword(user),
    token,
  }, 'Admin login successful');
}, { rateLimit: RATE_LIMITS.ADMIN_OTP, rateLimitSuffix: 'admin-otp-verify' });
