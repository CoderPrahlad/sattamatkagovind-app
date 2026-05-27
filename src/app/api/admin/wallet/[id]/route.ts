import { db, withRetry } from '@/lib/db';
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

  const { status, adminNote } = body as Record<string, unknown>;

  if (!status || (status !== 'approved' && status !== 'rejected')) {
    return apiError('Status must be "approved" or "rejected"');
  }

  // 1. FAST READ (Outside Transaction)
  const transaction = await db.walletTransaction.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          mobile: true,
          referredBy: true,
          referralBonusClaimed: true,
        },
      },
    },
  });

  if (!transaction) return apiError('Transaction not found', 404);
  if (transaction.status !== 'pending') return apiError('Transaction is already processed', 400);

  // 2. PRE-FETCH REFERRAL CONFIGS (Parallel fetching for speed)
  let giveBonus = false;
  let finalBonus = 0;
  let bonusPercentage = 10;
  let bonusMaxAmount = 50;
  let referrer: { id: string; name: string; isActive: boolean } | null = null;

  if (
    transaction.type === 'deposit' &&
    status === 'approved' &&
    transaction.user.referredBy &&
    !transaction.user.referralBonusClaimed
  ) {
    const [bonusEnabledReq, bonusPctReq, bonusMaxReq, referrerReq] = await Promise.all([
      db.gameConfig.findUnique({ where: { key: 'referral_bonus_enabled' } }),
      db.gameConfig.findUnique({ where: { key: 'referral_bonus_percentage' } }),
      db.gameConfig.findUnique({ where: { key: 'referral_bonus_max_amount' } }),
      db.user.findUnique({
        where: { id: transaction.user.referredBy },
        select: { id: true, name: true, isActive: true },
      }),
    ]);

    if (bonusEnabledReq && bonusEnabledReq.value === 'true' && referrerReq?.isActive) {
      bonusPercentage = bonusPctReq ? parseFloat(bonusPctReq.value) || 0 : 10;
      bonusMaxAmount = bonusMaxReq ? parseFloat(bonusMaxReq.value) || 0 : 50;
      referrer = referrerReq;

      if (bonusPercentage > 0 && bonusMaxAmount > 0) {
        const calculatedBonus = (transaction.amount * bonusPercentage) / 100;
        finalBonus = Math.round(Math.min(calculatedBonus, bonusMaxAmount) * 100) / 100;
        if (finalBonus > 0) giveBonus = true;
      }
    }
  }

  const updateData: Record<string, unknown> = { status };
  if (adminNote) {
    updateData.adminNote = sanitizeText(String(adminNote));
  }

  // 3. ARRAY-BASED SEQUENTIAL TRANSACTION (Lightning Fast, No Timeouts)
  const queries = [];

  if (transaction.type === 'deposit' && status === 'approved') {
    // Approve Deposit
    queries.push(
      db.user.update({
        where: { id: transaction.userId },
        data: { balance: { increment: transaction.amount } },
      })
    );

    // Referral Bonus Logic
    if (giveBonus && referrer) {
      queries.push(
        db.user.update({
          where: { id: referrer.id },
          data: { balance: { increment: finalBonus } },
        })
      );
      queries.push(
        db.walletTransaction.create({
          data: {
            userId: referrer.id,
            type: 'deposit',
            amount: finalBonus,
            status: 'approved',
            adminNote: `Referral bonus: ${transaction.user.name} (${transaction.user.mobile}) did 1st recharge of ₹${transaction.amount}. ${bonusPercentage}% = ₹${finalBonus}`,
          },
        })
      );
      queries.push(
        db.user.update({
          where: { id: transaction.userId },
          data: { referralBonusClaimed: true },
        })
      );
    }
  }

  if (transaction.type === 'withdrawal' && status === 'rejected') {
    // Reject Withdrawal (Refund)
    queries.push(
      db.user.update({
        where: { id: transaction.userId },
        data: { balance: { increment: Math.abs(transaction.amount) } },
      })
    );
  }

  // Final Update to the main transaction
  queries.push(
    db.walletTransaction.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            mobile: true,
            bankDetail: {
              select: {
                accountHolder: true,
                accountNumber: true,
                ifscCode: true,
                bankName: true,
                upiId: true,
              },
            },
          },
        },
      },
    })
  );

  // Execute all queries in one single batch!
  const results = await withRetry(() => db.$transaction(queries), { 
    context: 'Admin: walletApproval', 
    maxRetries: 3 
  });
  
  // The last query result is our updated wallet transaction
  const updated = results[results.length - 1];

  // Build response message
  let message = `Transaction ${status} successfully`;
  if (giveBonus && referrer) {
    message += `. ₹${finalBonus} referral bonus given to ${referrer.name}`;
    logger.info('Referral', `₹${finalBonus} bonus given to ${referrer.name} for referring ${transaction.user.name}`);
  }

  logger.info('AdminWallet', `Transaction ${id} ${String(status)} by admin ${admin.userId}`);
  return apiSuccess(updated, message, 200);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });