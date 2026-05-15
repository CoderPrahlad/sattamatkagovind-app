import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { verifyPassword, createAuthToken, excludePassword, rehashIfNeeded } from '@/lib/auth';

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

    // Validate mobile format
    if (!/^\d{10,15}$/.test(mobile)) {
      return NextResponse.json(
        { success: false, error: 'Mobile must be 10-15 digits' },
        { status: 400 }
      );
    }

    // Find user by mobile - with retry for SQLite busy/locked errors
    const user = await withRetry(
      () => db.user.findUnique({ where: { mobile } }),
      { context: 'Login: findUser' }
    );

    if (!user) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile or password' },
        { status: 401 }
      );
    }

    // Check if user is active
    if (!user.isActive) {
      return NextResponse.json(
        { success: false, error: 'Account is deactivated. Contact support.' },
        { status: 403 }
      );
    }

    // Verify password (now async - supports bcrypt)
    const passwordValid = await verifyPassword(password, user.password);
    if (!passwordValid) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile or password' },
        { status: 401 }
      );
    }

    // Auto-migrate legacy password hashes to bcrypt (fire-and-forget)
    rehashIfNeeded(user.id, password, user.password).catch(() => {});

    // Create self-contained auth token
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
    console.error('Login error:', error);
    return NextResponse.json(
      { success: false, error: 'Login failed. Please check your credentials.' },
      { status: 500 }
    );
  }
}
