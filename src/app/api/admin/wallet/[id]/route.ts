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
        // User ke balance mein add karo (deposit bucket — winning nahi)
        await tx.user.update({
          where: { id: transaction.userId },
          data: { balance: { increment: transaction.amount } },
        });

        // === REFERRAL BONUS LOGIC ===
        // Referrer hai toh bonus do — first deposit 10%, baad mein 5% lifetime
        if (transaction.user.referredBy) {
          const referrer = await tx.user.findUnique({
            where: { id: transaction.user.referredBy },
            select: { id: true, name: true, isActive: true },
          });

          if (referrer && referrer.isActive) {
            const isFirstDeposit = !transaction.user.referralBonusClaimed;

            // First deposit → 10%, baad mein → 5%
            const bonusPercentage = isFirstDeposit ? 10 : 5;
            const bonusAmount = Math.round((transaction.amount * bonusPercentage) / 100 * 100) / 100;

            if (bonusAmount > 0) {
              // Referrer ko referralBalance mein bonus do (withdraw nahi hoga, sirf bet mein)
              await tx.user.update({
                where: { id: referrer.id },
                data: {
                  balance: { increment: bonusAmount },
                  referralBalance: { increment: bonusAmount },
                },
              });

              await tx.walletTransaction.create({
                data: {
                  userId: referrer.id,
                  type: 'deposit',
                  amount: bonusAmount,
                  status: 'approved',
                  adminNote: `Referral bonus: ${transaction.user.name} (${transaction.user.mobile}) ne ₹${transaction.amount} deposit kiya. ${bonusPercentage}% = ₹${bonusAmount} (${isFirstDeposit ? '1st deposit' : 'repeat deposit'})`,
                },
              });

              // First deposit flag set karo
              if (isFirstDeposit) {
                await tx.user.update({
                  where: { id: transaction.userId },
                  data: { referralBonusClaimed: true },
                });
              }

              referralBonusResult = {
                bonusGiven: true,
                bonusAmount,
                referrerName: referrer.name,
                isFirstDeposit,
              };

              logger.info('Referral',
                `₹${bonusAmount} (${bonusPercentage}%) bonus → ${referrer.name} for ${isFirstDeposit ? 'first' : 'repeat'} deposit by ${transaction.user.name}`
              );
            }
          }
        }
      }

      // ── DEPOSIT REJECT ───────────────────────────────────────────
      // Balance add nahi hua tha, kuch refund nahi karna

      // ── WITHDRAWAL APPROVE ───────────────────────────────────────
      // Balance already deduct ho chuka tha request ke waqt, kuch change nahi

      // ── WITHDRAWAL REJECT ────────────────────────────────────────
      // Refund karo — winningAmount + balance dono wapas
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
  if (referralBonusResult?.bonusGiven) {
    message += `. ₹${referralBonusResult.bonusAmount} referral bonus (${referralBonusResult.isFirstDeposit ? '10% first deposit' : '5% repeat'}) given to ${referralBonusResult.referrerName}`;
  }

  logger.info('AdminWallet', `Transaction ${id} ${String(status)} by admin ${admin.userId}`);
  return apiSuccess(result, message, 200);
}, { rateLimit: RATE_LIMITS.ADMIN_GENERAL });