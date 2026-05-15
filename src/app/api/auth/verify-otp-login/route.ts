import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { verifyUserOTP } from '@/lib/otp';
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

    // Verify OTP
    const result = verifyUserOTP(mobile, otp);
    if (!result.valid) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 401 }
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
        { status: 404 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Contact support.' },
        { status: 403 }
      );
    }

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
