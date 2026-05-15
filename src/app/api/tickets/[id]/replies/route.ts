import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET: Get all replies for a ticket (ticket owner or admin only)
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    // Find ticket
    const ticket = await db.supportTicket.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Only ticket owner or admin can view replies
    if (ticket.userId !== session.userId && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const replies = await db.ticketReply.findMany({
      where: { ticketId: id },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      success: true,
      data: replies,
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Ticket replies fetch error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch ticket replies' },
      { status: 500 }
    );
  }
}

// POST: Add reply to ticket (user or admin)
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message || !message.trim()) {
      return NextResponse.json(
        { success: false, error: 'Message is required' },
        { status: 400 }
      );
    }

    // Find ticket
    const ticket = await db.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Only ticket owner or admin can reply
    if (ticket.userId !== session.userId && session.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Access denied' },
        { status: 403 }
      );
    }

    const isAdmin = session.role === 'admin';

    // Create reply and optionally update ticket status
    const reply = await db.$transaction(async (tx) => {
      const newReply = await tx.ticketReply.create({
        data: {
          ticketId: id,
          message: message.trim(),
          isAdmin,
        },
      });

      // If admin replies, update ticket status to in_progress if it was open
      if (isAdmin && ticket.status === 'open') {
        await tx.supportTicket.update({
          where: { id },
          data: { status: 'in_progress' },
        });
      }

      // If user replies, move back to in_progress
      if (!isAdmin && ticket.status === 'resolved') {
        await tx.supportTicket.update({
          where: { id },
          data: { status: 'in_progress' },
        });
      }

      return newReply;
    });

    return NextResponse.json({
      success: true,
      data: reply,
      message: 'Reply added successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Ticket reply create error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to add reply' },
      { status: 500 }
    );
  }
}
