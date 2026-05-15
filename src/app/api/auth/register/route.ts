import { db, withRetry } from '@/lib/db';
import { hashPassword, createAuthToken, excludePassword } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody, checkRateLimit } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeMobile, sanitizeName, isValidMobile, isValidPassword, sanitizeReferralCode } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const POST = apiHandler(async (request) => {
  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const name = sanitizeName(String(body.name || ''));
  const mobile = sanitizeMobile(String(body.mobile || ''));
  const password = String(body.password || '');
  const otp = String(body.otp || '');
  const referralCode = sanitizeReferralCode(String(body.referralCode || ''));

  // Validate inputs
  if (!name || name.length < 2) {
    return apiError('Name must be at least 2 characters', 400);
  }
  if (!isValidMobile(mobile)) {
    return apiError('Mobile must be 10-15 digits', 400);
  }
  if (!isValidPassword(password)) {
    return apiError('Password must be at least 4 characters', 400);
  }
  if (!otp || otp.length < 4) {
    return apiError('OTP is required', 400);
  }

  // Verify OTP
  const otpEntry = await withRetry(
    () => db.otpEntry.findFirst({
      where: { mobile, purpose: 'sms', verified: false },
      orderBy: { createdAt: 'desc' },
    }),
    { context: 'Register: findOTP' }
  );

  if (!otpEntry) {
    return apiError('No OTP found. Please request a new one.', 400);
  }

  if (new Date() > otpEntry.expiresAt) {
    try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
    return apiError('OTP has expired. Please request a new one.', 400);
  }

  if (otpEntry.otp !== otp) {
    return apiError('Invalid OTP', 400);
  }

  // Mark OTP as verified
  try {
    await db.otpEntry.update({ where: { id: otpEntry.id }, data: { verified: true } });
  } catch {}

  // Check if user already exists
  const existingUser = await withRetry(
    () => db.user.findUnique({ where: { mobile } }),
    { context: 'Register: checkExisting' }
  );

  if (existingUser) {
    return apiError('Mobile number already registered. Please login.', 409);
  }

  // Generate referral code for new user
  const newReferralCode = `MK${mobile.slice(-4)}${Date.now().toString(36).toUpperCase()}`;

  // Hash password with bcrypt
  const hashedPassword = await hashPassword(password);

  // Find referrer if referral code provided
  let referredBy: string | null = null;
  if (referralCode) {
    const referrer = await withRetry(
      () => db.user.findUnique({ where: { referralCode } }),
      { context: 'Register: findReferrer' }
    );
    if (referrer) {
      referredBy = referrer.id;
    }
  }

  // Create user
  const user = await withRetry(
    () => db.user.create({
      data: {
        name,
        mobile,
        password: hashedPassword,
        referralCode: newReferralCode,
        referredBy,
      },
    }),
    { context: 'Register: createUser' }
  );

  // Clean up used OTPs
  try {
    await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
  } catch {}

  // Create auth token
  const token = createAuthToken(user.id, user.role);

  logger.info('Register', `New user: ${mobile.slice(0, 4)}**** referral=${!!referredBy}`);

  return apiSuccess({
    ...excludePassword(user),
    token,
  }, 'Account created successfully');
}, { rateLimit: RATE_LIMITS.REGISTER, rateLimitSuffix: 'register' });
