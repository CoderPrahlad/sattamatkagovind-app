import { NextResponse } from 'next/server';

export async function POST() {
  try {
    // Token-based auth: the client handles logout by clearing localStorage.
    // Server-side token remains valid until 2-hour expiry (stateless design).
    // This endpoint exists for the client to have a successful logout handshake.
    return NextResponse.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error: unknown) {
    console.error('Logout error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to logout' },
      { status: 500 }
    );
  }
}
