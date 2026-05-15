import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { verifyPassword } from '@/lib/auth';
import { sendAdminOTP, storeOTP } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { mobile, password } = body;

    if (!mobile || !password) {
      return NextResponse.json(
        { success: false, error: 'Mobile and password are required' },
        { status: 400 }
      );
    }

    if (!/^\d{10,15}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Mobile must be 10-15 digits' },
        { status: 400 }
      );
    }

    // Find user
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'AdminOTP: findUser' }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile or password' },
        { status: 401 }
      );
    }

    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated' },
        { status: 403 }
      );
    }

    if (user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied. Admin accounts only.' },
        { status: 403 }
      );
    }

    // Verify password (now async - supports bcrypt)
    if (!await verifyPassword(password, user.password)) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile or password' },
        { status: 401 }
      );
    }

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();

    // Store OTP in database
    storeOTP(mobile, otp);

    // Get admin email from env (with fallback)
    const adminEmail = process.env.ADMIN_EMAIL || 'gouravkumar10769@gmail.com';

    // Send OTP email (fire-and-forget with catch to prevent unhandled rejection / 502)
    sendAdminOTP({
      adminName: user.name,
      email: adminEmail,
      otp,
    }).catch(() => {});

    return NextResponse.json({
      success: true,
      message: 'OTP sent to admin email',
    });
  } catch (error: unknown) {
    console.error('Admin OTP request error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to send OTP. Please try again.' },
      { status: 500 }
    );
  }
}
