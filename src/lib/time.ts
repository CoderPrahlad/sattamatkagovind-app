// Timezone-safe IST (Indian Standard Time) utility functions
// Server and client may run in different timezones, so we always use UTC-based IST calculation

// Get current time shifted to IST where getHours()/getMinutes() returns IST values
export function getNowIST(): Date {
  const now = new Date();
  // Convert local time to UTC, then add IST offset
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  return new Date(istMs);
}

// Get today's date in IST as YYYY-MM-DD string
export function getTodayIST(): string {
  const ist = getNowIST();
  return formatDateIST(ist);
}

// Get tomorrow's date in IST as YYYY-MM-DD string
export function getTomorrowIST(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const istMs = utcMs + 5.5 * 60 * 60 * 1000;
  const tomorrowIst = new Date(istMs + 24 * 60 * 60 * 1000);
  return formatDateIST(tomorrowIst);
}

// Format a shifted Date object (IST-shifted) as YYYY-MM-DD
// IMPORTANT: Never use .toISOString().split('T')[0] — it always returns UTC!
export function formatDateIST(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// Check if current IST time is within the CLOSING window [closeFrom, closeUntil)
// During this window, bidding is BLOCKED. Outside it, bidding is OPEN.
export function isInClosingWindow(closeFrom: string, closeUntil: string): boolean {
  const ist = getNowIST();
  const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();

  const [fh, fm] = closeFrom.split(':').map(Number);
  const [uh, um] = closeUntil.split(':').map(Number);
  const fromSec = fh * 3600 + fm * 60;
  const untilSec = uh * 3600 + um * 60;

  if (untilSec <= fromSec) {
    // Window crosses midnight (e.g. 23:00 - 01:00)
    return nowSec >= fromSec || nowSec < untilSec;
  }
  return nowSec >= fromSec && nowSec < untilSec;
}

// Legacy alias - kept for backward compat in some places
export function isWithinBidWindow(openTime: string, closeTime: string): boolean {
  return !isInClosingWindow(openTime, closeTime);
}

// Get current IST time as HH:MM:SS string
export function getCurrentTimeIST(): string {
  const ist = getNowIST();
  const h = String(ist.getHours()).padStart(2, '0');
  const m = String(ist.getMinutes()).padStart(2, '0');
  const s = String(ist.getSeconds()).padStart(2, '0');
  return `${h}:${m}:${s}`;
}

// Get seconds until next second boundary (for countdown)
export function getCountdownToTarget(targetSec: number): number {
  const ist = getNowIST();
  const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();
  const diff = targetSec - nowSec;
  if (diff <= 0) return 0;
  return diff;
}

// Get seconds until target time (HH:MM or HH:MM:SS) today in IST
export function getSecondsUntilTarget(targetTime: string): number {
  const ist = getNowIST();
  const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();

  const parts = targetTime.split(':').map(Number);
  const targetSec = parts[0] * 3600 + (parts[1] || 0) * 60 + (parts[2] || 0);

  const diff = targetSec - nowSec;
  // If target is in the past (but within the last 24h), it's for "tomorrow"
  if (diff <= 0) return diff + 24 * 3600;
  return diff;
}

// Get the status of the closing window defined by closeFrom and closeUntil (both HH:MM in IST)
// Returns: 'open' (bidding allowed), 'closing' (bidding blocked), 'resumes_soon' (before closing window)
export function getClosingWindowStatus(closeFrom: string, closeUntil: string): 'open' | 'closing' | 'resumes_soon' {
  const ist = getNowIST();
  const nowSec = ist.getHours() * 3600 + ist.getMinutes() * 60 + ist.getSeconds();

  const [fh, fm] = closeFrom.split(':').map(Number);
  const [uh, um] = closeUntil.split(':').map(Number);
  const fromSec = fh * 3600 + fm * 60;
  const untilSec = uh * 3600 + um * 60;

  if (untilSec <= fromSec) {
    // Window crosses midnight (e.g. 23:00 - 01:00)
    if (nowSec >= fromSec || nowSec < untilSec) return 'closing';
    return 'open';
  }

  if (nowSec < fromSec) return 'resumes_soon';
  if (nowSec < untilSec) return 'closing';
  return 'open';
}

// Legacy alias kept for compat
export function getTimePeriodStatus(openTime: string, closeTime: string): 'before_open' | 'accepting' | 'closed' {
  const status = getClosingWindowStatus(openTime, closeTime);
  if (status === 'closing') return 'closed';
  if (status === 'resumes_soon') return 'before_open';
  return 'accepting';
}
