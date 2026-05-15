import { apiHandler, apiSuccess } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';

// GET: Return current user's bank detail
export const GET = apiHandler(async (request) => {
  const session = await requireAuth(request);

  const bankDetail = await db.bankDetail.findUnique({
    where: { userId: session.userId },
  });

  return apiSuccess(bankDetail || {});
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'bankDetailGet' });

// PUT: Upsert bank detail for authenticated user
export const PUT = apiHandler(async (request) => {
  const session = await requireAuth(request);
  const body = await request.json();
  const { accountHolder, accountNumber, ifscCode, bankName, upiId } = body;

  const bankDetail = await db.bankDetail.upsert({
    where: { userId: session.userId },
    update: {
      accountHolder: accountHolder || undefined,
      accountNumber: accountNumber || undefined,
      ifscCode: ifscCode || undefined,
      bankName: bankName || undefined,
      upiId: upiId || undefined,
    },
    create: {
      userId: session.userId,
      accountHolder: accountHolder || null,
      accountNumber: accountNumber || null,
      ifscCode: ifscCode || null,
      bankName: bankName || null,
      upiId: upiId || null,
    },
  });

  return apiSuccess(bankDetail, 'Bank detail saved successfully');
}, { rateLimit: RATE_LIMITS.GENERAL, rateLimitSuffix: 'bankDetailPut' });
