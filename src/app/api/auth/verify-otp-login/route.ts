import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { db, withRetry } from '@/lib/db';
import { verifyOTPAttempt } from '@/lib/otp';
import { createAuthToken, excludePassword } from '@/lib/auth';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawMobile = String(body.mobile ?? '');
  const rawOtp = String(body.otp ?? '');
  const mobile = sanitizeMobile(rawMobile);

  if (!mobile || !rawOtp) {
    return apiError('Mobile number and OTP are required');
  }

  if (!isValidMobile(mobile)) {
    return apiError('Invalid mobile number format');
  }

  // Look up OTP from database
  let otpEntry;
  try {
    otpEntry = await db.otpEntry.findFirst({
      where: { mobile, purpose: 'sms' },
      orderBy: { createdAt: 'desc' },
    });
  } catch {
    return apiError('Verification failed. Please try again.');
  }

  if (!otpEntry) {
    return apiError('No OTP found. Please request a new OTP.');
  }

  // Verify OTP using attempt tracking
  const result = verifyOTPAttempt(mobile, rawOtp, otpEntry.otp, otpEntry.expiresAt);
  if (!result.valid) {
    if (result.error?.includes('Too many failed attempts')) {
      try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
    }
    return apiError(result.error || 'Invalid OTP');
  }

  // Find user
  const user = await withRetry(
    () => db.user.findUnique({ where: { mobile } }),
    { context: 'VerifyOTPLogin: findUser' }
  );

  if (!user) {
    return apiError('Account not found');
  }

  if (!user.isActive) {
    return apiError('Account is deactivated. Contact support.');
  }

  // Clear OTP after successful verification
  try {
    await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
  } catch {}

  // Create auth token
  const token = createAuthToken(user.id, user.role);

  logger.info('Auth', `User logged in via OTP: ${mobile}`);

  return apiSuccess({
    ...excludePassword(user),
    token,
  }, 'Login successful');
}, { rateLimit: RATE_LIMITS.VERIFY_OTP, rateLimitSuffix: 'verify-otp-login' });
