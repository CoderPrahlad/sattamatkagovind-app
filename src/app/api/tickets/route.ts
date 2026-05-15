import { apiHandler, apiSuccess, apiError } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

export const POST = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const body = await request.json();
  const { subject, message, type } = body;

  if (!subject || !message) {
    return apiError('Subject and message are required');
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

  return apiSuccess(ticket, 'Ticket created successfully');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'ticketCreate' });

export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);

  const tickets = await db.supportTicket.findMany({
    where: { userId: session.userId },
    orderBy: { createdAt: 'desc' },
  });

  return apiSuccess(tickets);
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'ticketList' });
