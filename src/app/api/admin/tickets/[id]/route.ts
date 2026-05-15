import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const { status, adminReply, reply } = body;

    const ticket = await db.supportTicket.findUnique({
      where: { id },
    });

    if (!ticket) {
      return NextResponse.json(
        { success: false, error: 'Ticket not found' },
        { status: 404 }
      );
    }

    // Validate status if provided
    if (status && !['open', 'in_progress', 'resolved'].includes(status)) {
      return NextResponse.json(
        { success: false, error: 'Status must be "open", "in_progress", or "resolved"' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (status) updateData.status = status;
    if (adminReply !== undefined) updateData.adminReply = adminReply;

    const updatedTicket = await db.$transaction(async (tx) => {
      // Update ticket
      const updated = await tx.supportTicket.update({
        where: { id },
        data: updateData,
        include: {
          replies: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      // If reply field is provided, also create a TicketReply
      if (reply && reply.trim()) {
        await tx.ticketReply.create({
          data: {
            ticketId: id,
            message: reply.trim(),
            isAdmin: true,
          },
        });

        // If status was open, auto-move to in_progress
        if (ticket.status === 'open' && !status) {
          await tx.supportTicket.update({
            where: { id },
            data: { status: 'in_progress' },
          });
          updated.status = 'in_progress';
        }
      }

      return updated;
    });

    return NextResponse.json({
      success: true,
      data: updatedTicket,
      message: 'Ticket updated successfully',
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin ticket update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update ticket' },
      { status: 500 }
    );
  }
}
