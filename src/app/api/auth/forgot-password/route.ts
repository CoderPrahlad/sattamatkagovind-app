import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile, isValidPassword } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';
import { db, withRetry } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyOTPAttempt } from '@/lib/otp';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const rawMobile = String(body.mobile ?? '');
  const rawOtp = String(body.otp ?? '');
  const rawNewPassword = String(body.newPassword ?? '');
  const step = String(body.step ?? '');
  const mobile = sanitizeMobile(rawMobile);

  logger.info('ForgotPassword', `Request: mobile=${mobile}, step=${step}, hasOtp=${!!rawOtp}, hasNewPassword=${!!rawNewPassword}`);

  // step 1: verify OTP only
  // step 2: reset password (after OTP verified)

  if (!mobile) {
    return apiError('Mobile number is required');
  }

  if (!isValidMobile(mobile)) {
    return apiError('Invalid mobile number format');
  }

  if (step === 'verify-otp') {
    // Step 1: Verify the OTP
    if (!rawOtp) {
      return apiError('OTP is required');
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
      logger.warn('ForgotPassword', `No OTP found for mobile: ${mobile}`);
      return apiError('No OTP found. Please request a new OTP.');
    }

    logger.debug('ForgotPassword', 'OTP entry found, verifying...');

    // Verify OTP using attempt tracking
    const result = verifyOTPAttempt(mobile, rawOtp, otpEntry.otp, otpEntry.expiresAt);
    if (!result.valid) {
      logger.warn('ForgotPassword', `OTP verification failed: ${result.error}`);
      // If too many failed attempts, delete the OTP entry
      if (result.error?.includes('Too many failed attempts')) {
        try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
      }
      return apiError(result.error || 'Invalid OTP');
    }

    // Mark OTP as verified in database
    try {
      await db.otpEntry.update({
        where: { id: otpEntry.id },
        data: { verified: true },
      });
    } catch {}

    return apiSuccess(null, 'OTP verified successfully. You can now reset your password.');
  }

  if (step === 'reset-password') {
    // Step 2: Reset password after OTP is verified
    if (!rawNewPassword) {
      return apiError('New password is required');
    }

    if (!isValidPassword(rawNewPassword) || rawNewPassword.length < 6) {
      return apiError('Password must be at least 6 characters');
    }

    // Check if OTP was verified (from database)
    let otpEntry;
    try {
      otpEntry = await db.otpEntry.findFirst({
        where: { mobile, purpose: 'sms' },
        orderBy: { createdAt: 'desc' },
      });
    } catch {}

    if (!otpEntry || !otpEntry.verified) {
      return apiError('Please verify OTP first');
    }

    // Check expiry
    if (new Date() > otpEntry.expiresAt) {
      return apiError('OTP has expired. Please request a new one.');
    }

    // Find user
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'ForgotPassword: findUser' }
    );

    if (!user) {
      return apiError('Account not found');
    }

    // Update password
    const hashedPassword = await hashPassword(rawNewPassword);
    await withRetry(
      () => db.user.update({
        where: { mobile },
        data: { password: hashedPassword },
      }),
      { context: 'ForgotPassword: updatePassword' }
    );

    // Clear OTP from database
    try {
      await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
    } catch {}

    logger.info('ForgotPassword', `Password reset successfully for mobile: ${mobile}`);

    return apiSuccess(null, 'Password reset successfully. You can now login with your new password.');
  }

  return apiError('Invalid step. Use "verify-otp" or "reset-password"');
}, { rateLimit: RATE_LIMITS.FORGOT_PASSWORD, rateLimitSuffix: 'forgot-password' });
