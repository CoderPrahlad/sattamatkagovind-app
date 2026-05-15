import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();
    const { subject, message, type } = body;

    if (!subject || !message) {
      return NextResponse.json(
        { success: false, error: 'Subject and message are required' },
        { status: 400 }
      );
    }

    const validTypes = ['deposit', 'withdrawal', 'game', 'account', 'general'];
    const ticketType = validTypes.includes(type) ? type : 'general';

    const ticket = await db.supportTicket.create({
      data: {
        userId: session.userId,
        subject,
        message,
        type: ticketType,
      },
    });

    return NextResponse.json({
      success: true,
      data: ticket,
      message: 'Ticket created successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Ticket create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create ticket' },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);

    const tickets = await db.supportTicket.findMany({
      where: { userId: session.userId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      data: tickets,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Tickets fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tickets' },
      { status: 500 }
    );
  }
}
