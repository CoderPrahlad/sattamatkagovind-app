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

  let referralBonusResult: { bonusGiven: boolean; bonusAmount: number; referrerName: string } | null = null;

  const result = await withRetry(
    () => db.$transaction(async (tx) => {
      const transaction = await tx.walletTransaction.findUnique({
        where: { id },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              mobile: true,
              referredBy: true,
              referralBonusClaimed: true,
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
      });

      if (!transaction) throw new Error('NOT_FOUND');
      if (transaction.status !== 'pending') throw new Error('ALREADY_PROCESSED');

      // ── DEPOSIT APPROVE ──────────────────────────────────────────
      // Add to balance only (not winningAmount — deposits are not winnings)
      if (transaction.type === 'deposit' && status === 'approved') {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { balance: { increment: transaction.amount } },
        });

        // === REFERRAL BONUS LOGIC ===
        if (transaction.user.referredBy && !transaction.user.referralBonusClaimed) {
          const bonusEnabled = await tx.gameConfig.findUnique({
            where: { key: 'referral_bonus_enabled' },
          });

          if (bonusEnabled && bonusEnabled.value === 'true') {
            const bonusPctConfig = await tx.gameConfig.findUnique({
              where: { key: 'referral_bonus_percentage' },
            });
            const bonusPercentage = bonusPctConfig ? parseFloat(bonusPctConfig.value) || 0 : 10;

            const bonusMaxConfig = await tx.gameConfig.findUnique({
              where: { key: 'referral_bonus_max_amount' },
            });
            const bonusMaxAmount = bonusMaxConfig ? parseFloat(bonusMaxConfig.value) || 0 : 50;

            if (bonusPercentage > 0 && bonusMaxAmount > 0) {
              const calculatedBonus = (transaction.amount * bonusPercentage) / 100;
              const bonusAmount = Math.min(calculatedBonus, bonusMaxAmount);
              const finalBonus = Math.round(bonusAmount * 100) / 100;

              if (finalBonus > 0) {
                const referrer = await tx.user.findUnique({
                  where: { id: transaction.user.referredBy },
                  select: { id: true, name: true, balance: true, isActive: true },
                });

                if (referrer && referrer.isActive) {
                  // ✅ Referral bonus → balance + referralBalance both
                  await tx.user.update({
                    where: { id: referrer.id },
                    data: {
                      balance: { increment: finalBonus },
                      referralBalance: { increment: finalBonus },
                    },
                  });

                  await tx.walletTransaction.create({
                    data: {
                      userId: referrer.id,
                      type: 'deposit',
                      amount: finalBonus,
                      status: 'approved',
                      adminNote: `Referral bonus: ${transaction.user.name} (${transaction.user.mobile}) did 1st recharge of ₹${transaction.amount}. ${bonusPercentage}% = ₹${finalBonus}`,
                    },
                  });

                  await tx.user.update({
                    where: { id: transaction.userId },
                    data: { referralBonusClaimed: true },
                  });

                  referralBonusResult = {
                    bonusGiven: true,
                    bonusAmount: finalBonus,
                    referrerName: referrer.name,
                  };

                  logger.info('Referral', `₹${finalBonus} bonus given to ${referrer.name} for referring ${transaction.user.name}`);
                }
              }
            }
          }
        }
      }

      // ── DEPOSIT REJECT ───────────────────────────────────────────
      // Deposit was not yet added (added only on approve), so nothing to refund
      // Just update status to rejected

      // ── WITHDRAWAL APPROVE ───────────────────────────────────────
      // Balance was already deducted when user placed the request.
      // Just update status to approved — no balance change needed.

      // ── WITHDRAWAL REJECT ────────────────────────────────────────
      // Refund winningAmount + balance because they were deducted immediately on request
      if (transaction.type === 'withdrawal' && status === 'rejected') {
        const refundAmount = Math.abs(transaction.amount);
        await tx.user.update({
          where: { id: transaction.userId },
          data: {
            winningAmount: { increment: refundAmount },
            balance: { increment: refundAmount },
          },
        });
        logger.info('AdminWallet', `Withdrawal rejected, ₹${refundAmount} refunded to user ${transaction.userId}`);
      }

      // ── UPDATE STATUS ─────────────────────────────────────────────
      const updateData: Record<string, unknown> = { status };
      if (adminNote) {
        updateData.adminNote = sanitizeText(String(adminNote));
      }

      const updated = await tx.walletTransaction.update({
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
      });

      return updated;
    }, { timeout: 25000 }),
    { context: 'Admin: walletApproval', maxRetries: 2, baseDelay: 500 }
  );

  let message = `Transaction ${status} successfully`;
  if (referralBonusResult?.bonusGiven) {
    message += `. ₹${referralBonusResult.bonusAmount} referral bonus given to ${referralBonusResult.referrerName}`;
  }

  logger.info('AdminWallet', `Transaction ${id} ${String(status)} by admin ${admin.userId}`);
  return apiSuccess(result, message, 200);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });