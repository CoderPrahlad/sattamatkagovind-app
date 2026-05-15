/**
 * SMS OTP Service using Start Messaging API
 * Sends OTP via SMS to user's mobile number
 */

const START_MSG_API_URL = 'https://api.startmessaging.com/otp/send';
// FAIL FAST: No hardcoded live API keys — must be set via env vars
const START_MSG_API_KEY = process.env.START_MSG_API_KEY;
const START_MSG_TEMPLATE_ID = process.env.START_MSG_TEMPLATE_ID;
const APP_NAME = 'MatkaKing';

// In-memory OTP store (shared with email.ts OTP store pattern)
const userOtpStore = new Map<string, { otp: string; expiresAt: number; mobile: string; verified: boolean }>();

// Rate limiting: one OTP per mobile per 60 seconds
const otpRateLimit = new Map<string, number>();

// OTP attempt tracking
const otpVerifyAttempts = new Map<string, { count: number; lockedUntil: number }>();

// ── Periodic cleanup of expired OTP entries (prevents memory leak under 10K users) ──
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of userOtpStore.entries()) {
      if (val.expiresAt < now) userOtpStore.delete(key);
    }
    for (const [key, val] of otpVerifyAttempts.entries()) {
      if (val.lockedUntil > 0 && val.lockedUntil < now) otpVerifyAttempts.delete(key);
    }
    for (const [key, val] of otpRateLimit.entries()) {
      if (now - val > 120000) otpRateLimit.delete(key); // Clear 2+ min old rate limits
    }
  }, 60000); // Clean up every minute
}

/**
 * Generate a 6-digit OTP
 */
function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Format Indian mobile number with country code
 * If mobile is 10 digits, prepend +91
 * If already has +, keep as-is
 */
function formatMobileForSMS(mobile: string): string {
  const digits = mobile.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length > 10 && !mobile.startsWith('+')) {
    return `+${digits}`;
  }
  if (mobile.startsWith('+')) {
    return mobile;
  }
  return `+91${digits}`;
}

/**
 * Send OTP via SMS using Start Messaging API
 */
export async function sendSMSOTP(mobile: string): Promise<{ success: boolean; error?: string }> {
  // Check if API key is configured
  if (!START_MSG_API_KEY || !START_MSG_TEMPLATE_ID) {
    console.error('[OTP] FATAL: START_MSG_API_KEY or START_MSG_TEMPLATE_ID not set in environment');
    return { success: false, error: 'SMS service is not configured. Please contact support.' };
  }

  // Rate limit check
  const lastSent = otpRateLimit.get(mobile);
  if (lastSent && Date.now() - lastSent < 60000) {
    const waitSecs = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
    return { success: false, error: `Please wait ${waitSecs} seconds before requesting a new OTP` };
  }

  // Check if mobile is locked due to too many failed attempts
  const attempts = otpVerifyAttempts.get(mobile);
  if (attempts && attempts.lockedUntil > Date.now()) {
    return { success: false, error: 'Too many failed attempts. Please try again later.' };
  }

  // Generate and store OTP
  const otp = generateOTP();
  const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes
  userOtpStore.set(mobile, { otp, expiresAt, mobile, verified: false });

  // Format phone number for SMS
  const phoneWithCountryCode = formatMobileForSMS(mobile);

  try {
    const response = await fetch(START_MSG_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': START_MSG_API_KEY,
      },
      body: JSON.stringify({
        phoneNumber: phoneWithCountryCode,
        templateId: START_MSG_TEMPLATE_ID,
        variables: { otp, appName: APP_NAME },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[OTP] Start Messaging API error:', response.status, data);
      // Still store OTP so user can try again (API might have transient errors)
      // But remove rate limit so they can retry immediately on API error
      otpRateLimit.delete(mobile);
      return { success: false, error: 'Failed to send OTP. Please try again.' };
    }

    // Set rate limit
    otpRateLimit.set(mobile, Date.now());

    console.log(`[OTP] SMS OTP sent to ${mobile}`);
    return { success: true };
  } catch (error) {
    console.error('[OTP] Failed to send SMS OTP:', error);
    otpRateLimit.delete(mobile);
    return { success: false, error: 'Failed to send OTP. Please check your connection.' };
  }
}

/**
 * Verify OTP entered by user
 */
export function verifyUserOTP(mobile: string, otp: string): { valid: boolean; error?: string } {
  // Check if locked out
  const attempts = otpVerifyAttempts.get(mobile);
  if (attempts && attempts.lockedUntil > Date.now()) {
    const waitMins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return { valid: false, error: `Too many failed attempts. Try again in ${waitMins} minutes.` };
  }

  // Check OTP exists
  const entry = userOtpStore.get(mobile);
  if (!entry) {
    return { valid: false, error: 'No OTP found. Please request a new OTP.' };
  }

  // Check expiry
  if (Date.now() > entry.expiresAt) {
    userOtpStore.delete(mobile);
    otpVerifyAttempts.delete(mobile);
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }

  // Check OTP match
  if (entry.otp === otp) {
    // Mark as verified (for forgot-password flow)
    entry.verified = true;
    otpVerifyAttempts.delete(mobile);
    return { valid: true };
  }

  // Failed attempt
  const currentAttempts = attempts || { count: 0, lockedUntil: 0 };
  const newCount = currentAttempts.count + 1;
  if (newCount >= 5) {
    otpVerifyAttempts.set(mobile, { count: newCount, lockedUntil: Date.now() + 15 * 60 * 1000 });
    userOtpStore.delete(mobile);
    return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
  } else {
    otpVerifyAttempts.set(mobile, { count: newCount, lockedUntil: 0 });
    return { valid: false, error: `Invalid OTP. ${5 - newCount} attempts remaining.` };
  }
}

/**
 * Check if a mobile number has a verified OTP (used for password reset / registration)
 */
export function isOTPVerified(mobile: string): boolean {
  const entry = userOtpStore.get(mobile);
  if (!entry) return false;
  if (Date.now() > entry.expiresAt) {
    userOtpStore.delete(mobile);
    return false;
  }
  return entry.verified;
}

/**
 * Clear OTP after use (e.g., after password reset / registration)
 */
export function clearOTP(mobile: string): void {
  userOtpStore.delete(mobile);
  otpVerifyAttempts.delete(mobile);
  otpRateLimit.delete(mobile);
}
