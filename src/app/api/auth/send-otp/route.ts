import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { sendSMSOTP } from '@/lib/otp';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, purpose } = body; // purpose: 'login' | 'forgot-password' | 'register'

    if (!mobile) {
      return NextResponse.json(
        { success: false, error: 'Mobile number is required' },
        { status: 400 }
      );
    }

    // Validate mobile format
    if (!/^\d{10,15}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Please enter a valid mobile number (10-15 digits)' },
        { status: 400 }
      );
    }

    // For login: check if user exists and is active
    if (purpose === 'login') {
      const user = await withRetry(
        () => db.user.findUnique({ where: { mobile } }),
        { context: 'SendOTP: findUser' }
      );

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'No account found with this mobile number' },
          { status: 400 }
        );
      }

      if (!user.isActive) {
        return NextResponse.json(
          { success: false, error: 'Account is deactivated. Contact support.' },
          { status: 400 }
        );
      }
    }

    // For forgot-password: check if user exists
    if (purpose === 'forgot-password') {
      const user = await withRetry(
        () => db.user.findUnique({ where: { mobile } }),
        { context: 'SendOTP: findUser(forgot)' }
      );

      if (!user) {
        return NextResponse.json(
          { success: false, error: 'No account found with this mobile number' },
          { status: 400 }
        );
      }
    }

    // For register: check if mobile is NOT already registered
    if (purpose === 'register') {
      const existingUser = await withRetry(
        () => db.user.findUnique({ where: { mobile } }),
        { context: 'SendOTP: checkMobile(register)' }
      );

      if (existingUser) {
        return NextResponse.json(
          { success: false, error: 'This mobile number is already registered. Please login instead.' },
          { status: 409 }
        );
      }
    }

    // Send OTP via SMS
    const result = await sendSMSOTP(mobile);

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your mobile number via SMS',
    });
  } catch (error: unknown) {
    console.error('Send OTP error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}
