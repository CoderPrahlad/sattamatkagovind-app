import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { hashPassword, createAuthToken, excludePassword } from '@/lib/auth';
import { verifyUserOTP, clearOTP } from '@/lib/otp';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, mobile, password, referralCode: referralCodeInput, otp } = body;

    // Validate required fields
    if (!name || !mobile || !password) {
      return NextResponse.json(
        { success: false, error: 'Name, mobile, and password are required' },
        { status: 400 }
      );
    }

    // OTP is required for registration
    if (!otp) {
      return NextResponse.json(
        { success: false, error: 'OTP is required to verify your mobile number' },
        { status: 400 }
      );
    }

    // Validate password strength
    if (!password || password.length < 6) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 6 characters long' },
        { status: 400 }
      );
    }

    // Validate mobile format
    if (!/^\d{10,15}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Mobile must be 10-15 digits' },
        { status: 400 }
      );
    }

    // Verify OTP first
    const otpResult = verifyUserOTP(mobile, otp);
    if (!otpResult.valid) {
      return NextResponse.json(
        { success: false, error: otpResult.error || 'Invalid OTP. Please verify your mobile number.' },
        { status: 401 }
      );
    }

    // Check if mobile already exists (double-check after OTP verification)
    const existingUser = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'Register: checkMobile' }
    );

    if (existingUser) {
      return NextResponse.json(
        { success: false, error: 'Mobile number already registered' },
        { status: 409 }
      );
    }

    // Find referrer if referral code provided
    let referredBy: string | null = null;
    if (referralCodeInput) {
      const referrer = await withRetry(
        () => db.user.findFirst({ where: { referralCode: referralCodeInput.toUpperCase() } }),
        { context: 'Register: findReferrer' }
      );
      if (referrer) {
        referredBy = referrer.id;
      }
    }

    // Create user
    const hashedPassword = await hashPassword(password);
    const user = await withRetry(
      () => db.user.create({
        data: {
          name,
          mobile,
          password: hashedPassword,
          referralCode: crypto.randomUUID().slice(0, 8).toUpperCase(),
          referredBy,
          balance: 0,
        },
      }),
      { context: 'Register: createUser' }
    );

    // Clear OTP after successful registration
    clearOTP(mobile);

    // Create self-contained auth token
    const token = createAuthToken(user.id, user.role);

    return NextResponse.json({
      success: true,
      data: {
        ...excludePassword(user),
        token,
      },
      message: 'Registration successful',
    });
  } catch (error: unknown) {
    console.error('Registration error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to register' },
      { status: 500 }
    );
  }
}
