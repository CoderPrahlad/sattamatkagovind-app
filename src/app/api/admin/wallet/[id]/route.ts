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

        // ── SIGNUP BONUS (1st deposit par) ──────────────────
        const isFirstDeposit = !transaction.user.referralBonusClaimed;

        if (isFirstDeposit) {
          const signupBonusConfig = await tx.gameConfig.findUnique({ where: { key: 'signup_bonus' } });
          const signupBonus = signupBonusConfig ? parseFloat(signupBonusConfig.value) : 50;

          if (signupBonus > 0) {
            await tx.user.update({
              where: { id: transaction.userId },
              data: { balance: { increment: signupBonus } },
            });

            await tx.walletTransaction.create({
              data: {
                userId: transaction.userId,
                type: 'deposit',
                amount: signupBonus,
                status: 'approved',
                adminNote: `Signup bonus: ₹${signupBonus} (1st deposit)`,
              },
            });

            await tx.user.update({
              where: { id: transaction.userId },
              data: { referralBonusClaimed: true },
            });

            signupBonusResult = { bonusGiven: true, bonusAmount: signupBonus };
            logger.info('SignupBonus', `₹${signupBonus} → ${transaction.user.name} (${transaction.user.mobile}) on 1st deposit`);
          }
        }

        // ── REFERRAL COMMISSION → REFERRER KE WINNING AMOUNT ──
        if (transaction.user.referredBy) {
          logger.info('Referral', `User ${transaction.user.name} (${transaction.user.mobile}) has referredBy=${transaction.user.referredBy}`);

          const referrer = await tx.user.findUnique({
            where: { id: transaction.user.referredBy },
            select: { id: true, name: true, isActive: true },
          });

          if (referrer && referrer.isActive) {
            // NEW keys first, fallback to OLD key for compatibility
            const firstPercentConfig = await tx.gameConfig.findUnique({ where: { key: 'referral_first_deposit_percent' } });
            const subsequentPercentConfig = await tx.gameConfig.findUnique({ where: { key: 'referral_subsequent_deposit_percent' } });
            const fallbackConfig = await tx.gameConfig.findUnique({ where: { key: 'referral_bonus_percentage' } });
            const fallbackVal = fallbackConfig ? parseFloat(fallbackConfig.value) : null;

            const firstPercent = firstPercentConfig ? parseFloat(firstPercentConfig.value) : (fallbackVal ?? 10);
            const subsequentPercent = subsequentPercentConfig ? parseFloat(subsequentPercentConfig.value) : (fallbackVal ?? 5);

            const bonusPercentage = isFirstDeposit ? firstPercent : subsequentPercent;
            const bonusAmount = Math.round((transaction.amount * bonusPercentage) / 100 * 100) / 100;

            logger.info('Referral', `amount=${transaction.amount}, isFirst=${isFirstDeposit}, percent=${bonusPercentage}, bonus=${bonusAmount}, referrer=${referrer.name}`);

            if (bonusAmount > 0) {
              await tx.user.update({
                where: { id: referrer.id },
                data: {
                  winningAmount: { increment: bonusAmount },
                  balance: { increment: bonusAmount },
                },
              });

              await tx.walletTransaction.create({
                data: {
                  userId: referrer.id,
                  type: 'deposit',
                  amount: bonusAmount,
                  status: 'approved',
                  adminNote: `Referral commission: ${transaction.user.name} (${transaction.user.mobile}) deposited ₹${transaction.amount}. ${bonusPercentage}% = ₹${bonusAmount} (${isFirstDeposit ? '1st deposit' : 'repeat deposit'})`,
                },
              });

              referralBonusResult = {
                bonusGiven: true,
                bonusAmount,
                referrerName: referrer.name,
                isFirstDeposit,
              };

              logger.info('Referral',
                `✅ ₹${bonusAmount} (${bonusPercentage}%) → ${referrer.name} for ${isFirstDeposit ? 'first' : 'repeat'} deposit by ${transaction.user.name}`
              );
            }
          } else {
            logger.info('Referral', `Referrer not found or inactive. referrerId=${transaction.user.referredBy}`);
          }
        } else {
          logger.info('Referral', `No referrer for user ${transaction.user.name}. referredBy is NULL.`);
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
    message += `. ₹${signupBonusResult.bonusAmount} signup bonus given to user`;
  }
  if (referralBonusResult?.bonusGiven) {
    message += `. ₹${referralBonusResult.bonusAmount} referral commission (${referralBonusResult.isFirstDeposit ? 'first deposit' : 'repeat deposit'}) given to ${referralBonusResult.referrerName}`;
  }

  logger.info('AdminWallet', `Transaction ${id} ${String(status)} by admin ${admin.userId}`);
  return apiSuccess(result, message, 200);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });