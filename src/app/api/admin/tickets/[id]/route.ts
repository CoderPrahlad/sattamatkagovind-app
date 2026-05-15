import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

export const PUT = apiHandler(async (request, context) => {
  const admin = await requireAdmin(request);
  const params = await context!.params;
  const id = params.id;

  const { data: body, error: parseError } = await parseJsonBody(request);
  if (parseError) return parseError;

  const { status, adminReply, reply } = body as Record<string, unknown>;

  const ticket = await db.supportTicket.findUnique({
    where: { id },
  });

  if (!ticket) {
    return apiError('Ticket not found', 404);
  }

  // Validate status if provided
  if (status && !['open', 'in_progress', 'resolved'].includes(String(status))) {
    return apiError('Status must be "open", "in_progress", or "resolved"');
  }

  // Build update data
  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = String(status);
  if (adminReply !== undefined) updateData.adminReply = sanitizeText(String(adminReply));

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
    if (reply && String(reply).trim()) {
      await tx.ticketReply.create({
        data: {
          ticketId: id,
          message: sanitizeText(String(reply)),
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

  logger.info('AdminTickets', `Ticket ${id} updated by admin ${admin.userId}`, { status, hasReply: !!reply });
  return apiSuccess(updatedTicket, 'Ticket updated successfully');
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });
