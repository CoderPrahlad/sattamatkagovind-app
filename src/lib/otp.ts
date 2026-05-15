/**
 * SMS OTP Service using Start Messaging API
 * Sends OTP via SMS to user's mobile number
 * OTP storage is handled by API routes using the database (SQLite) for persistence
 */

const START_MSG_API_URL = 'https://api.startmessaging.com/otp/send';
// FAIL FAST: No hardcoded live API keys — must be set via env vars
const START_MSG_API_KEY = process.env.START_MSG_API_KEY;
const START_MSG_TEMPLATE_ID = process.env.START_MSG_TEMPLATE_ID;
const APP_NAME = 'MatkaKing';

// Rate limiting: one OTP per mobile per 60 seconds (in-memory — acceptable to lose on restart)
const otpRateLimit = new Map<string, number>();

// OTP attempt tracking (in-memory — acceptable to lose on restart)
const otpVerifyAttempts = new Map<string, { count: number; lockedUntil: number }>();

// ── Periodic cleanup of in-memory entries ──
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
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
export function generateOTP(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Check rate limit for OTP sending
 */
export function checkRateLimit(mobile: string): { allowed: boolean; error?: string } {
  const lastSent = otpRateLimit.get(mobile);
  if (lastSent && Date.now() - lastSent < 60000) {
    const waitSecs = Math.ceil((60000 - (Date.now() - lastSent)) / 1000);
    return { allowed: false, error: `Please wait ${waitSecs} seconds before requesting a new OTP` };
  }

  // Check if mobile is locked due to too many failed attempts
  const attempts = otpVerifyAttempts.get(mobile);
  if (attempts && attempts.lockedUntil > Date.now()) {
    return { allowed: false, error: 'Too many failed attempts. Please try again later.' };
  }

  return { allowed: true };
}

/**
 * Mark rate limit after successful OTP send
 */
export function markRateLimit(mobile: string): void {
  otpRateLimit.set(mobile, Date.now());
}

/**
 * Clear rate limit (e.g., on API error to allow retry)
 */
export function clearRateLimit(mobile: string): void {
  otpRateLimit.delete(mobile);
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
        variables: { otp: 'PLACEHOLDER', appName: APP_NAME },
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[OTP] Start Messaging API error:', response.status, data);
      return { success: false, error: 'Failed to send OTP. Please try again.' };
    }

    console.log(`[OTP] SMS OTP sent to ${mobile}`);
    return { success: true };
  } catch (error) {
    console.error('[OTP] Failed to send SMS OTP:', error);
    return { success: false, error: 'Failed to send OTP. Please check your connection.' };
  }
}

/**
 * Send OTP via SMS with the actual OTP value in the template variables
 */
export async function sendSMSOTPWithCode(mobile: string, otp: string): Promise<{ success: boolean; error?: string }> {
  // Check if API key is configured
  if (!START_MSG_API_KEY || !START_MSG_TEMPLATE_ID) {
    console.error('[OTP] FATAL: START_MSG_API_KEY or START_MSG_TEMPLATE_ID not set in environment');
    return { success: false, error: 'SMS service is not configured. Please contact support.' };
  }

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
      return { success: false, error: 'Failed to send OTP. Please try again.' };
    }

    console.log(`[OTP] SMS OTP sent to ${mobile}`);
    return { success: true };
  } catch (error) {
    console.error('[OTP] Failed to send SMS OTP:', error);
    return { success: false, error: 'Failed to send OTP. Please check your connection.' };
  }
}

/**
 * Verify OTP entered by user (against database entry)
 */
export function verifyOTPAttempt(mobile: string, otp: string, storedOtp: string, expiresAt: Date): { valid: boolean; error?: string } {
  // Check if locked out
  const attempts = otpVerifyAttempts.get(mobile);
  if (attempts && attempts.lockedUntil > Date.now()) {
    const waitMins = Math.ceil((attempts.lockedUntil - Date.now()) / 60000);
    return { valid: false, error: `Too many failed attempts. Try again in ${waitMins} minutes.` };
  }

  // Check expiry
  if (new Date() > new Date(expiresAt)) {
    otpVerifyAttempts.delete(mobile);
    return { valid: false, error: 'OTP has expired. Please request a new one.' };
  }

  // Check OTP match
  if (storedOtp === otp) {
    otpVerifyAttempts.delete(mobile);
    return { valid: true };
  }

  // Failed attempt
  const currentAttempts = attempts || { count: 0, lockedUntil: 0 };
  const newCount = currentAttempts.count + 1;
  if (newCount >= 5) {
    otpVerifyAttempts.set(mobile, { count: newCount, lockedUntil: Date.now() + 15 * 60 * 1000 });
    return { valid: false, error: 'Too many failed attempts. Please request a new OTP.' };
  } else {
    otpVerifyAttempts.set(mobile, { count: newCount, lockedUntil: 0 });
    return { valid: false, error: `Invalid OTP. ${5 - newCount} attempts remaining.` };
  }
}

/**
 * Check if mobile is locked from too many attempts
 */
export function isLockedOut(mobile: string): boolean {
  const attempts = otpVerifyAttempts.get(mobile);
  return !!(attempts && attempts.lockedUntil > Date.now());
}
