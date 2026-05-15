import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { hashPassword, createAuthToken, excludePassword } from '@/lib/auth';
import { verifyOTPAttempt } from '@/lib/otp';
import crypto from 'crypto';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, mobile, password, referralCode: referralCodeInput, otp } = body;
    console.log('[Register] Request received:', { name, mobile, hasPassword: !!password, hasOtp: !!otp, referralCode: referralCodeInput });

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

    // Look up OTP from database
    let otpEntry;
    try {
      otpEntry = await db.otpEntry.findFirst({
        where: { mobile, purpose: 'sms' },
        orderBy: { createdAt: 'desc' },
      });
    } catch (dbError) {
      console.error('[Register] Database error looking up OTP:', dbError);
      return NextResponse.json(
        { success: false, error: 'Verification failed. Please try again.' },
        { status: 400 }
      );
    }

    if (!otpEntry) {
      console.log('[Register] No OTP found for mobile:', mobile);
      return NextResponse.json(
        { success: false, error: 'No OTP found. Please request a new OTP.' },
        { status: 400 }
      );
    }

    console.log('[Register] OTP entry found:', { id: otpEntry.id, storedOtp: otpEntry.otp, enteredOtp: otp, expiresAt: otpEntry.expiresAt, verified: otpEntry.verified });

    // Verify OTP using attempt tracking
    const otpResult = verifyOTPAttempt(mobile, otp, otpEntry.otp, otpEntry.expiresAt);
    if (!otpResult.valid) {
      console.log('[Register] OTP verification failed:', otpResult.error);
      // If too many failed attempts, delete the OTP entry
      if (otpResult.error?.includes('Too many failed attempts')) {
        try { await db.otpEntry.delete({ where: { id: otpEntry.id } }); } catch {}
      }
      return NextResponse.json(
        { success: false, error: otpResult.error || 'Invalid OTP. Please verify your mobile number.' },
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

    // Check if mobile already exists (double-check after OTP verification)
    const existingUser = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'Register: checkMobile' }
    );

    if (existingUser) {
      console.log('[Register] Mobile already registered:', mobile);
      return NextResponse.json(
        { success: false, error: 'Mobile number already registered' },
        { status: 400 }
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
    console.log('[Register] Creating user for mobile:', mobile);
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
    console.log('[Register] User created successfully:', user.id);

    // Clear OTP after successful registration
    try {
      await db.otpEntry.deleteMany({ where: { mobile, purpose: 'sms' } });
    } catch {}

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
    console.error('[Register] Registration error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to register';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
