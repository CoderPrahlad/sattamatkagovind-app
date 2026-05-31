import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { apiHandler, apiSuccess, apiError, parseJsonBody } from '@/lib/api-utils';
import { RATE_LIMITS } from '@/lib/rate-limit';
import { sanitizeText } from '@/lib/sanitizer';
import { logger } from '@/lib/logger';

// Caching hatao taaki approval hamesha real-time update ho
export const dynamic = 'force-dynamic';

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

  let referralBonusResult: { bonusGiven: boolean; bonusAmount: number; referrerName: string; isFirstDeposit: boolean } | null = null;
  let signupBonusResult: { bonusGiven: boolean; bonusAmount: number } | null = null;

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
      if (transaction.type === 'deposit' && status === 'approved') {
        await tx.user.update({
          where: { id: transaction.userId },
          data: { balance: { increment: transaction.amount } },
        });

        // ══════════════════════════════════════════════════════════════
        // ✅ ₹50 BONUS for referred user on 1st deposit >= ₹500
        // ══════════════════════════════════════════════════════════════
        const isFirstDeposit = !transaction.user.referralBonusClaimed;

        if (isFirstDeposit && transaction.user.referredBy) {
          const bonusAmountConfig = await tx.gameConfig.findUnique({ where: { key: 'first_deposit_bonus_amount' } });
          const minDepositConfig = await tx.gameConfig.findUnique({ where: { key: 'first_deposit_min_amount' } });

          const bonusAmount = bonusAmountConfig ? parseFloat(bonusAmountConfig.value) : 50;
          const minDepositAmount = minDepositConfig ? parseFloat(minDepositConfig.value) : 500;

          if (bonusAmount > 0 && transaction.amount >= minDepositAmount) {
            await tx.user.update({
              where: { id: transaction.userId },
              data: { balance: { increment: bonusAmount } },
            });

            await tx.walletTransaction.create({
              data: {
                userId: transaction.userId,
                type: 'deposit',
                amount: bonusAmount,
                status: 'approved',
                adminNote: `First deposit bonus: ₹${bonusAmount} (deposited ₹${transaction.amount} >= ₹${minDepositAmount})`,
              },
            });

            await tx.user.update({
              where: { id: transaction.userId },
              data: { referralBonusClaimed: true },
            });

            signupBonusResult = { bonusGiven: true, bonusAmount };
            logger.info('FirstDepositBonus', `₹${bonusAmount} → ${transaction.user.name} (${transaction.user.mobile}) on 1st deposit of ₹${transaction.amount}`);
          } else if (transaction.amount < minDepositAmount) {
            logger.info('FirstDepositBonus', `Skipped for ${transaction.user.name}: deposit ₹${transaction.amount} < min ₹${minDepositAmount}.`);
          }
        } else if (isFirstDeposit && !transaction.user.referredBy) {
          await tx.user.update({
            where: { id: transaction.userId },
            data: { referralBonusClaimed: true },
          });
        }

        // ══════════════════════════════════════════════════════════════
        // ✅ REFERRAL COMMISSION: LIFETIME % on EVERY deposit
        // ══════════════════════════════════════════════════════════════
        if (transaction.user.referredBy) {
          const referrer = await tx.user.findUnique({
            where: { id: transaction.user.referredBy },
            select: { id: true, name: true, isActive: true },
          });

          if (referrer && referrer.isActive) {
            const percentConfig = await tx.gameConfig.findUnique({ where: { key: 'referral_deposit_percent' } });
            const fallbackConfig = await tx.gameConfig.findUnique({ where: { key: 'referral_bonus_percentage' } });

            const bonusPercentage = percentConfig
              ? parseFloat(percentConfig.value)
              : fallbackConfig
                ? parseFloat(fallbackConfig.value)
                : 1;

            const bonusAmount = Math.round((transaction.amount * bonusPercentage) / 100 * 100) / 100;

            if (bonusAmount > 0) {
              await tx.user.update({
                where: { id: referrer.id },
                data: {
                  // ✅ UPDATE: Referral aur Winning dono mein add hoga
                  referralBalance: { increment: bonusAmount },
                  winningAmount: { increment: bonusAmount },
                  balance: { increment: bonusAmount }, // Total balance main add
                },
              });

              await tx.walletTransaction.create({
                data: {
                  userId: referrer.id,
                  type: 'deposit',
                  amount: bonusAmount,
                  status: 'approved',
                  adminNote: `Referral commission: ${transaction.user.name} (${transaction.user.mobile}) deposited ₹${transaction.amount}. ${bonusPercentage}% = ₹${bonusAmount}`,
                },
              });

              referralBonusResult = {
                bonusGiven: true,
                bonusAmount,
                referrerName: referrer.name,
                isFirstDeposit,
              };
            }
          }
        }
      }

      // ── WITHDRAWAL REJECT ────────────────────────────────────────
      if (transaction.type === 'withdrawal' && status === 'rejected') {
        const refundAmount = Math.abs(transaction.amount);
        await tx.user.update({
          where: { id: transaction.userId },
          data: {
            winningAmount: { increment: refundAmount },
            balance: { increment: refundAmount },
          },
        });
        logger.info('AdminWallet', `Withdrawal rejected, ₹${refundAmount} refunded to ${transaction.userId}`);
      }

      // ── STATUS UPDATE ─────────────────────────────────────────────
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
  if (signupBonusResult?.bonusGiven) {
    message += `. ₹${signupBonusResult.bonusAmount} first deposit bonus given to user`;
  }
  if (referralBonusResult?.bonusGiven) {
    message += `. ₹${referralBonusResult.bonusAmount} referral commission given to ${referralBonusResult.referrerName}`;
  }

  logger.info('AdminWallet', `Transaction ${id} ${String(status)} by admin ${admin.userId}`);
  return apiSuccess(result, message, 200);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });