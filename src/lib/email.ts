import { Resend } from 'resend';

const SITE_NAME = 'MatkaKing';

// Dynamic admin email (reads from env at call time for hot-reload support)
function getAdminEmail(): string {
  return process.env.ADMIN_EMAIL || 'gouravkumar10769@gmail.com';
}

// Check if email is configured
function isEmailConfigured(): boolean {
  return !!(process.env.RESEND_API_KEY && process.env.ADMIN_EMAIL);
}

// Lazy-initialized Resend client (re-created if API key changes)
let _resend: Resend | null = null;
let _resendKey: string | undefined;
function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  // Re-create client if API key changed (e.g., after env hot-reload)
  if (_resend && _resendKey === key) return _resend;
  _resend = new Resend(key);
  _resendKey = key;
  return _resend;
}

// Format IST timestamp
function getISTTime(): string {
  const now = new Date();
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60 * 1000;
  const ist = new Date(utcMs + 5.5 * 60 * 60 * 1000);
  return ist.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
}

// Send admin login alert email
export async function sendAdminLoginAlert(data: {
  adminName: string;
  adminMobile: string;
  loginTime: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] Skipping admin login alert - email not configured');
    return;
  }

  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: `MatkaKing Security <onboarding@resend.dev>`,
      to: [getAdminEmail()],
      subject: `🔐 Admin Login Alert - ${data.adminName} (${data.adminMobile})`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #e5e7eb; border-radius: 12px; overflow: hidden; border: 1px solid #1f2937;">
          <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px;">🔐 Admin Login Detected</h1>
            <p style="margin: 5px 0 0; color: #fecaca; font-size: 13px;">${SITE_NAME} - Security Alert</p>
          </div>
          <div style="padding: 20px 20px 0;">
            <div style="background: #7f1d1d; border: 1px solid #dc2626; border-radius: 8px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #fca5a5; font-size: 13px; font-weight: 600;">⚠️ If this was not you, your admin credentials may be compromised!</p>
            </div>
          </div>
          <div style="padding: 20px;">
            <div style="background: #111827; border-radius: 8px; padding: 16px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 10px 0; color: #9ca3af; width: 40%;">👤 Admin Name</td><td style="padding: 10px 0; color: #f3f4f6; font-weight: 600;">${data.adminName}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 10px 0; color: #9ca3af;">📱 Mobile</td><td style="padding: 10px 0; color: #f3f4f6; font-weight: 600;">${data.adminMobile}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 10px 0; color: #9ca3af;">🕐 Login Time</td><td style="padding: 10px 0; color: #fbbf24; font-weight: 600;">${data.loginTime}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 10px 0; color: #9ca3af;">⏱️ Session Validity</td><td style="padding: 10px 0; color: #34d399; font-weight: 600;">2 Hours</td></tr>
              </table>
            </div>
          </div>
          <div style="padding: 0 20px 20px;">
            <div style="background: #111827; border-radius: 8px; padding: 14px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px; line-height: 1.6;">This is an automated security notification. Your admin session is valid for <strong style="color: #34d399;">2 hours</strong>. After that, you will need to log in again.</p>
            </div>
          </div>
          <div style="background: #111827; padding: 12px; text-align: center; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #6b7280; font-size: 11px;">This is an automated security alert from ${SITE_NAME}</p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Admin login alert sent successfully');
  } catch (error) {
    console.error('[Email] Failed to send admin login alert:', error);
  }
}

// OTP attempt tracking for admin (in-memory)
const otpAttempts = new Map<string, { count: number; lockedUntil: number }>();

// Cleanup
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, val] of otpAttempts.entries()) {
      if (val.lockedUntil > 0 && val.lockedUntil < now) otpAttempts.delete(key);
    }
  }, 60000);
}

// Send admin OTP email
export async function sendAdminOTP(data: {
  adminName: string;
  email: string;
  otp: string;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] Skipping admin OTP - email not configured');
    return;
  }

  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: `MatkaKing Security <onboarding@resend.dev>`,
      to: [data.email],
      subject: `🔐 Admin Login OTP - ${data.otp}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #e5e7eb; border-radius: 12px; overflow: hidden; border: 1px solid #1f2937;">
          <div style="background: linear-gradient(135deg, #dc2626, #b91c1c); padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px;">🔐 Admin Login OTP</h1>
            <p style="margin: 5px 0 0; color: #fecaca; font-size: 13px;">${SITE_NAME} - Secure Authentication</p>
          </div>
          <div style="padding: 30px 20px; text-align: center;">
            <p style="margin: 0 0 8px; color: #9ca3af; font-size: 14px;">Hello, <strong style="color: #f3f4f6;">${data.adminName}</strong></p>
            <p style="margin: 0 0 20px; color: #9ca3af; font-size: 13px;">Enter this OTP to complete your admin login:</p>
            <div style="background: #1f2937; border: 2px dashed #dc2626; border-radius: 12px; padding: 20px; display: inline-block; min-width: 180px;">
              <p style="margin: 0; color: #fbbf24; font-size: 36px; font-weight: bold; letter-spacing: 8px; font-family: monospace;">${data.otp}</p>
            </div>
            <p style="margin: 20px 0 0; color: #6b7280; font-size: 12px;">This OTP is valid for <strong style="color: #f3f4f6;">5 minutes</strong>. Do not share it with anyone.</p>
          </div>
          <div style="padding: 0 20px 20px;">
            <div style="background: #111827; border-radius: 8px; padding: 14px; text-align: center;">
              <p style="margin: 0; color: #6b7280; font-size: 11px;">If you did not request this OTP, please ignore this email. Your account is secure.</p>
            </div>
          </div>
          <div style="background: #111827; padding: 12px; text-align: center; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #6b7280; font-size: 11px;">This is an automated message from ${SITE_NAME}</p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Admin OTP sent to ' + data.email);
  } catch (error) {
    console.error('[Email] Failed to send admin OTP:', error);
  }
}

// Store admin OTP in database
export async function storeOTP(mobile: string, otp: string): Promise<void> {
  const { db } = await import('@/lib/db');
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
  try {
    await db.otpEntry.deleteMany({ where: { mobile, purpose: 'admin-email' } });
    await db.otpEntry.create({
      data: { mobile, otp, purpose: 'admin-email', verified: false, expiresAt },
    });
  } catch (error) {
    console.error('[Email] Failed to store OTP:', error);
  }
}

// Verify admin OTP with attempt limiting
export async function verifyOTP(mobile: string, otp: string): Promise<boolean> {
  const { db } = await import('@/lib/db');

  // Check if locked out
  const attempts = otpAttempts.get(mobile);
  if (attempts) {
    if (attempts.lockedUntil > Date.now()) {
      return false; // Locked out
    }
    if (attempts.count >= 5) {
      otpAttempts.set(mobile, { count: 0, lockedUntil: 0 });
    }
  }

  // Look up OTP in database
  let entry;
  try {
    entry = await db.otpEntry.findFirst({ where: { mobile, purpose: 'admin-email' }, orderBy: { createdAt: 'desc' } });
  } catch {
    return false;
  }

  if (!entry) return false;
  if (new Date() > entry.expiresAt) {
    try { await db.otpEntry.delete({ where: { id: entry.id } }); } catch {}
    otpAttempts.delete(mobile);
    return false;
  }

  if (entry.otp === otp) {
    otpAttempts.delete(mobile);
    try { await db.otpEntry.delete({ where: { id: entry.id } }); } catch {}
    return true;
  }

  // Increment failed attempt counter
  const currentAttempts = attempts || { count: 0, lockedUntil: 0 };
  const newCount = currentAttempts.count + 1;
  if (newCount >= 5) {
    otpAttempts.set(mobile, { count: newCount, lockedUntil: Date.now() + 15 * 60 * 1000 }); // Lock for 15 mins
  } else {
    otpAttempts.set(mobile, { count: newCount, lockedUntil: 0 });
  }

  return false;
}

// Send recharge request alert to admin
export async function sendRechargeAlert(data: {
  userName: string;
  userMobile: string;
  amount: number;
  upiNumber: string;
  utrNumber?: string | null;
  screenshotUrl?: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] Skipping recharge alert - email not configured');
    return;
  }

  try {
    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: `MatkaKing Alerts <onboarding@resend.dev>`,
      to: [getAdminEmail()],
      subject: `💰 New Recharge Request - ₹${data.amount} from ${data.userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #e5e7eb; border-radius: 12px; overflow: hidden; border: 1px solid #1f2937;">
          <div style="background: linear-gradient(135deg, #059669, #047857); padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px;">💰 New Recharge Request</h1>
            <p style="margin: 5px 0 0; color: #d1fae5; font-size: 13px;">${SITE_NAME} - Deposit Alert</p>
          </div>
          <div style="text-align: center; padding: 20px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Amount</p>
            <p style="margin: 5px 0 0; color: #34d399; font-size: 36px; font-weight: bold;">₹${data.amount.toLocaleString('en-IN')}</p>
          </div>
          <div style="padding: 0 20px 20px;">
            <div style="background: #111827; border-radius: 8px; padding: 16px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 8px 0; color: #9ca3af; width: 40%;">👤 User Name</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.userName}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">📱 Mobile</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.userMobile}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">💳 UPI Number</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.upiNumber}</td></tr>
                ${data.utrNumber ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🔑 UTR Number</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.utrNumber}</td></tr>` : ''}
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🕐 Time</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${getISTTime()}</td></tr>
              </table>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 12px; background: #111827; border-radius: 8px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Login to Admin Panel to approve or reject</p>
              <p style="margin: 5px 0 0; color: #6b7280; font-size: 11px;">Open your ${SITE_NAME} Admin Panel → Wallet section</p>
            </div>
          </div>
          <div style="background: #111827; padding: 12px; text-align: center; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #6b7280; font-size: 11px;">This is an automated alert from ${SITE_NAME}</p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Recharge alert sent successfully');
  } catch (error) {
    console.error('[Email] Failed to send recharge alert:', error);
  }
}

// Send withdrawal request alert to admin
export async function sendWithdrawalAlert(data: {
  userName: string;
  userMobile: string;
  amount: number;
  paymentMethod: string;
  accountHolder?: string | null;
  accountNumber?: string | null;
  bankName?: string | null;
  ifscCode?: string | null;
  upiId?: string | null;
}): Promise<void> {
  if (!isEmailConfigured()) {
    console.log('[Email] Skipping withdrawal alert - email not configured');
    return;
  }

  try {
    const isUPI = data.paymentMethod === 'upi';

    const client = getResend();
    if (!client) return;
    await client.emails.send({
      from: `MatkaKing Alerts <onboarding@resend.dev>`,
      to: [getAdminEmail()],
      subject: `💸 New Withdrawal Request - ₹${Math.abs(data.amount)} from ${data.userName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; background: #0a0a0a; color: #e5e7eb; border-radius: 12px; overflow: hidden; border: 1px solid #1f2937;">
          <div style="background: linear-gradient(135deg, #d97706, #b45309); padding: 20px; text-align: center;">
            <h1 style="margin: 0; color: white; font-size: 22px;">💸 New Withdrawal Request</h1>
            <p style="margin: 5px 0 0; color: #fef3c7; font-size: 13px;">${SITE_NAME} - Withdrawal Alert</p>
          </div>
          <div style="text-align: center; padding: 20px;">
            <p style="margin: 0; color: #9ca3af; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Amount</p>
            <p style="margin: 5px 0 0; color: #fbbf24; font-size: 36px; font-weight: bold;">₹${Math.abs(data.amount).toLocaleString('en-IN')}</p>
          </div>
          <div style="padding: 0 20px 20px;">
            <div style="background: #111827; border-radius: 8px; padding: 16px;">
              <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
                <tr><td style="padding: 8px 0; color: #9ca3af; width: 40%;">👤 User Name</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.userName}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">📱 Mobile</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.userMobile}</td></tr>
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🏦 Method</td><td style="padding: 8px 0; color: ${isUPI ? '#38bdf8' : '#fbbf24'}; font-weight: 600;">${isUPI ? '📱 UPI Transfer' : '🏦 Bank Transfer'}</td></tr>
                ${isUPI && data.upiId ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">💳 UPI ID</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.upiId}</td></tr>` : ''}
                ${!isUPI ? `
                ${data.accountHolder ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">👤 Account Holder</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.accountHolder}</td></tr>` : ''}
                ${data.bankName ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🏦 Bank Name</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.bankName}</td></tr>` : ''}
                ${data.accountNumber ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🔢 Account No.</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.accountNumber}</td></tr>` : ''}
                ${data.ifscCode ? `<tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🔑 IFSC Code</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${data.ifscCode}</td></tr>` : ''}
                ` : ''}
                <tr style="border-top: 1px solid #1f2937;"><td style="padding: 8px 0; color: #9ca3af;">🕐 Time</td><td style="padding: 8px 0; color: #f3f4f6; font-weight: 600;">${getISTTime()}</td></tr>
              </table>
            </div>
            <div style="text-align: center; margin-top: 20px; padding: 12px; background: #111827; border-radius: 8px;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">Login to Admin Panel to approve or reject</p>
              <p style="margin: 5px 0 0; color: #6b7280; font-size: 11px;">Open your ${SITE_NAME} Admin Panel → Wallet section</p>
            </div>
          </div>
          <div style="background: #111827; padding: 12px; text-align: center; border-top: 1px solid #1f2937;">
            <p style="margin: 0; color: #6b7280; font-size: 11px;">This is an automated alert from ${SITE_NAME}</p>
          </div>
        </div>
      `,
    });
    console.log('[Email] Withdrawal alert sent successfully');
  } catch (error) {
    console.error('[Email] Failed to send withdrawal alert:', error);
  }
}
