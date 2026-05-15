import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import { verifyUserOTP, isOTPVerified, clearOTP } from '@/lib/otp';

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

      const result = verifyUserOTP(mobile, otp);
      if (!result.valid) {
        return NextResponse.json(
          { success: false, error: result.error },
          { status: 400 }
        );
      }

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

      // Check if OTP was verified
      if (!isOTPVerified(mobile)) {
        return NextResponse.json(
          { success: false, error: 'Please verify OTP first' },
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
          { status: 404 }
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

      // Clear OTP
      clearOTP(mobile);

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
