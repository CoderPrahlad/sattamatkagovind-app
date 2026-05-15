import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { verifyOTPAttempt } from '@/lib/otp';
import { createAuthToken, excludePassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json(
        { success: false, error: 'Mobile number and OTP are required' },
        { status: 400 }
      );
    }

    // Look up OTP from database
    let otpEntry;
    try {
      otpEntry = await db.otpEntry.findFirst({
        where: { mobile, purpose: 'sms' },
        orderBy: { createdAt: 'desc' },
      });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    if (!otpEntry) {
      return NextResponse.json(
        { success: false, error: 'No OTP found. Please request a new OTP.' },
        { status: 400 }
      );
    }

    // Verify OTP using attempt tracking
    const result = verifyOTPAttempt(mobile, otp, otpEntry.otp, otpEntry.expiresAt);
    if (!result.valid) {
      if (result.error?.includes('Too many failed attempts')) {
        try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
      }
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    // Find user
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'VerifyOTPLogin: findUser' }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Account not found' },
        { status: 400 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Contact support.' },
        { status: 400 }
      );
    }

    // Clear OTP after successful verification
    try {
      await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
    } catch {}

    // Create auth token
    const token = createAuthToken(user.id, user.role);

    return NextResponse.json({
      success: true,
      data: {
        ...excludePassword(user),
        token,
      },
      message: 'Login successful',
    });
  } catch (error: unknown) {
    console.error('Verify OTP login error:', error);
    return NextResponse.json(
      { success: false, error: 'OTP verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
