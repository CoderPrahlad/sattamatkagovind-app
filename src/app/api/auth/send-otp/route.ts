import { db, withRetry } from '@/lib/db';
import { sendSMSOTPWithCode, generateOTP, checkRateLimit as checkOtpRateLimit, markRateLimit, clearRateLimit } from '@/lib/otp';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, isValidMobile } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const mobile = sanitizeMobile(String(body.mobile || ''));
  const purpose = String(body.purpose || 'register'); // 'login' | 'forgot-password' | 'register'

  logger.info('SendOTP', `Request: ${mobile.slice(0, 4)}**** purpose=${purpose}`);

  if (!mobile) {
    return apiError('Mobile number is required', 400);
  }

  if (!isValidMobile(mobile)) {
    return apiError('Please enter a valid mobile number (10-15 digits)', 400);
  }

  // OTP-specific rate limit (from otp.ts)
  const rateCheck = checkOtpRateLimit(mobile);
  if (!rateCheck.allowed) {
    return apiError(rateCheck.error || 'Too many OTP requests. Please wait.', 429);
  }

  // For login: check if user exists and is active
  if (purpose === 'login') {
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'SendOTP: findUser' }
    );
    if (!user) {
      return apiError('No account found with this mobile number', 400);
    }
    if (!user.isActive) {
      return apiError('Account is deactivated. Contact support.', 400);
    }
  }

  // For forgot-password: check if user exists
  if (purpose === 'forgot-password') {
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'SendOTP: findUser(forgot)' }
    );
    if (!user) {
      return apiError('No account found with this mobile number', 400);
    }
  }

  // For register: check if mobile is NOT already registered
  if (purpose === 'register') {
    const existingUser = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'SendOTP: checkMobile(register)' }
    );
    if (existingUser) {
      return apiError('This mobile number is already registered. Please login instead.', 409);
    }
  }

  // Generate OTP
  const otp = generateOTP();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

  // Store OTP in database
  try {
    await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
    await db.otpEntry.create({
      data: { mobile, otp, purpose: 'sms', verified: false, expiresAt },
    });
  } catch (dbError) {
    logger.error('SendOTP', 'Failed to store OTP', dbError);
    return apiError('Failed to generate OTP. Please try again.', 500);
  }

  // Send OTP via SMS
  const result = await sendSMSOTPWithCode(mobile, otp);

  if (!result.success) {
    clearRateLimit(mobile);
    return apiError(result.error || 'Failed to send OTP', 400);
  }

  markRateLimit(mobile);

  logger.info('SendOTP', `OTP sent: ${mobile.slice(0, 4)}****`);
  return apiSuccess(null, 'OTP sent to your mobile number via SMS');
}, { rateLimit: RATE_LIMITS.SEND_OTP, rateLimitSuffix: 'send-otp' });
