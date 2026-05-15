import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyOTPAttempt } from '@/lib/otp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, otp, newPassword, step } = body;
    // step 1: verify OTP only
    // step 2: reset password (after OTP verified)

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      );
    }

    if (step === 'verify-otp') {
      // Step 1: Verify the OTP
      if (!otp) {
        return NextResponse.json(
          { success: false, error: 'OTP is required' },
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
        // If too many failed attempts, delete the OTP entry
        if (result.error?.includes('Too many failed attempts')) {
          try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
        }
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

      // Mark OTP as verified in database
      try {
        await db.otpEntry.update({
          where: { id: otpEntry.id },
          data: { verified: true },
        });
      } catch {}

      return NextResponse.json({
        success: true,
        message: 'OTP verified successfully. You can now reset your password.',
      });
    }

    if (step === 'reset-password') {
      // Step 2: Reset password after OTP is verified
      if (!newPassword) {
        return NextResponse.json(
          { success: false, error: 'New password is required' },
          { status: 400 }
        );
      }

      if (newPassword.length < 6) {
        return NextResponse.json(
          { success: false, error: 'Password must be at least 6 characters' },
          { status: 400 }
        );
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
        return NextResponse.json(
          { success: false, error: 'Please verify OTP first' },
          { status: 400 }
        );
      }

      // Check expiry
      if (new Date() > otpEntry.expiresAt) {
        return NextResponse.json(
          { success: false, error: 'OTP has expired. Please request a new one.' },
          { status: 400 }
        );
      }

      // Find user
      const user = await withRetry(
        () => db.user.findUnique({ where: { mobile } }),
        { context: 'ForgotPassword: findUser' }
      );

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'Account not found' },
          { status: 400 }
        );
      }

      // Update password
      const hashedPassword = await hashPassword(newPassword);
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

      return NextResponse.json({
        success: true,
        message: 'Password reset successfully. You can now login with your new password.',
      });
    }

    return NextResponse.json(
      { success: false, error: 'Invalid step. Use "verify-otp" or "reset-password"' },
      { status: 400 }
    );
  } catch (error: unknown) {
    console.error('Forgot password error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to reset password. Please try again.' },
      { status: 500 }
    );
  }
}
