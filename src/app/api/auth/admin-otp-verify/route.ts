import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { verifyOTP } from '@/lib/email';
import { createAuthToken, excludePassword } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, otp } = body;

    if (!mobile || !otp) {
      return NextResponse.json(
        { success: false, error: 'Mobile and OTP are required' },
        { status: 400 }
      );
    }

    // Verify OTP
    const isValid = await verifyOTP(mobile, otp);
    if (!isValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid or expired OTP' },
        { status: 400 }
      );
    }

    // Find user
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'AdminOTPVerify: findUser' }
    );

    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Admin account not found' },
        { status: 400 }
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
      message: 'Admin login successful',
    });
  } catch (error: unknown) {
    console.error('Admin OTP verify error:', error);
    return NextResponse.json(
      { success: false, error: 'OTP verification failed. Please try again.' },
      { status: 500 }
    );
  }
}
