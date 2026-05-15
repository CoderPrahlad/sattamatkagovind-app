/**
 * Input sanitization and validation utilities.
 * Prevents injection attacks, XSS, and malformed data.
 */

/**
 * Strip HTML tags and dangerous characters from a string.
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/[<>]/g, '')           // Remove < and > (prevents HTML injection)
    .replace(/&/g, '&amp;')         // Escape ampersands
    .replace(/"/g, '&quot;')        // Escape quotes
    .replace(/'/g, '&#x27;')        // Escape single quotes
    .trim();
}

/**
 * Sanitize a mobile number - only digits allowed.
 */
export function sanitizeMobile(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^\d]/g, '');
}

/**
 * Validate a mobile number format.
 */
export function isValidMobile(mobile: string): boolean {
  return /^\d{10,15}$/.test(mobile);
}

/**
 * Validate password strength.
 * Minimum 4 characters (kept flexible for this app's context).
 */
export function isValidPassword(password: string): boolean {
  return typeof password === 'string' && password.length >= 4 && password.length <= 128;
}

/**
 * Validate and sanitize a name.
 */
export function sanitizeName(name: string): string {
  if (typeof name !== 'string') return '';
  // Allow letters, spaces, and common characters
  return name
    .replace(/[<>'"&]/g, '')
    .trim()
    .slice(0, 100); // Max 100 chars
}

/**
 * Validate amount - must be a positive number within range.
 */
export function isValidAmount(amount: number, min: number = 1, max: number = 10_000_000): boolean {
  return typeof amount === 'number' && 
    isFinite(amount) && 
    amount >= min && 
    amount <= max;
}

/**
 * Sanitize a UPI number/id.
 */
export function sanitizeUPI(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>'";&|]/g, '').trim().slice(0, 100);
}

/**
 * Sanitize UTR number - only alphanumeric.
 */
export function sanitizeUTR(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
}

/**
 * Validate bid number format.
 * Single: 0-9, Jodi: 00-99
 */
export function isValidBidNumber(number: string, bidType: string): boolean {
  if (typeof number !== 'string') return false;
  if (bidType === 'single') {
    return /^[0-9]$/.test(number);
  }
  if (bidType === 'jodi') {
    return /^[0-9]{2}$/.test(number);
  }
  return false;
}

/**
 * Validate bid type.
 */
export function isValidBidType(bidType: string): boolean {
  return bidType === 'single' || bidType === 'jodi';
}

/**
 * Validate URL format.
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Sanitize a generic text field (for messages, subjects, etc.)
 */
export function sanitizeText(input: string, maxLength: number = 2000): string {
  if (typeof input !== 'string') return '';
  return input
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')  // Remove script tags
    .replace(/<[^>]+>/g, '')                              // Remove HTML tags
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '')      // Remove control chars
    .trim()
    .slice(0, maxLength);
}

/**
 * Validate a date string (YYYY-MM-DD format).
 */
export function isValidDateString(date: string): boolean {
  if (typeof date !== 'string') return false;
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && !isNaN(Date.parse(date));
}

/**
 * Validate game result format (single digit 0-9 or jodi 00-99).
 */
export function isValidResult(result: string): boolean {
  return /^\d{1,2}$/.test(result);
}

/**
 * Validate bank account number.
 */
export function sanitizeAccountNumber(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30);
}

/**
 * Validate IFSC code format.
 */
export function isValidIFSC(ifsc: string): boolean {
  if (typeof ifsc !== 'string') return false;
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

/**
 * Sanitize referral code.
 */
export function sanitizeReferralCode(input: string): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[^a-zA-Z0-9]/g, '').trim().slice(0, 20);
}

/**
 * Validate and clamp pagination parameters.
 */
export function sanitizePagination(page?: number, limit?: number): { page: number; limit: number; skip: number } {
  const safePage = Math.max(1, Math.min(10000, Math.floor(Number(page) || 1)));
  const safeLimit = Math.max(1, Math.min(200, Math.floor(Number(limit) || 20)));
  return { page: safePage, limit: safeLimit, skip: (safePage - 1) * safeLimit };
}
