import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET: Get all replies for a ticket (ticket owner or admin only)
export const GET = apiHandler(async (request, context) => {
  const session = await requireAuth(request);
  const { id } = await context!.params;

  // Find ticket
  const ticket = await db.supportTicket.findUnique({
    where: { id },
    select: { userId: true },
  });

  if (!ticket) {
    return apiError('Ticket not found', 404);
  }

  // Only ticket owner or admin can view replies
  if (ticket.userId !== session.userId && session.role !== 'admin') {
    return apiError('Access denied', 403);
  }

  const replies = await db.ticketReply.findMany({
    where: { ticketId: id },
    orderBy: { createdAt: 'asc' },
  });

  return apiSuccess(replies);
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'ticketRepliesGet' });

// POST: Add reply to ticket (user or admin)
export const POST = apiHandler(async (request, context) => {
  const session = await requireAuth(request);
  const { id } = await context!.params;
  const body = await request.json();
  const { message } = body;

  if (!message || !message.trim()) {
    return apiError('Message is required');
  }

  // Find ticket
  const ticket = await db.supportTicket.findUnique({
    where: { id },
  });

  if (!ticket) {
    return apiError('Ticket not found', 404);
  }

  // Only ticket owner or admin can reply
  if (ticket.userId !== session.userId && session.role !== 'admin') {
    return apiError('Access denied', 403);
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

  return apiSuccess(reply, 'Reply added successfully');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'ticketReplyCreate' });
