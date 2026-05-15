import { NextResponse } from 'next/server';
import { db, withRetry } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin(request);
    const { id } = await params;
    const body = await request.json();
    const { status, adminNote } = body;

    if (!status || (status !== 'approved' && status !== 'rejected')) {
      return NextResponse.json(
        { success: false, error: 'Status must be "approved" or "rejected"' },
        { status: 400 }
      );
    }

    let referralBonusResult: { bonusGiven: boolean; bonusAmount: number; referrerName: string } | null = null;

    // Use withRetry for SQLITE_BUSY contention under load
    const result = await withRetry(
      () => db.$transaction(async (tx) => {
        // READ inside transaction to prevent TOCTOU race condition
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

        if (!transaction) {
          throw new Error('NOT_FOUND');
        }

        // Check status INSIDE the transaction — prevents double-spend race condition
        if (transaction.status !== 'pending') {
          throw new Error('ALREADY_PROCESSED');
        }

        // Approve deposit: add amount to user balance
        if (transaction.type === 'deposit' && status === 'approved') {
          await tx.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: transaction.amount } },
          });

          // === REFERRAL BONUS LOGIC ===
          // Give bonus to the REFERRER when the referred user's FIRST deposit is approved
          // Bonus = percentage% of recharge amount, capped at max_amount
          if (
            transaction.user.referredBy &&
            !transaction.user.referralBonusClaimed
          ) {
            // Check if referral bonus is enabled
            const bonusEnabled = await tx.gameConfig.findUnique({
              where: { key: 'referral_bonus_enabled' },
            });
            if (bonusEnabled && bonusEnabled.value === 'true') {
              // Get percentage (e.g. 10 = 10%)
              const bonusPctConfig = await tx.gameConfig.findUnique({
                where: { key: 'referral_bonus_percentage' },
              });
              const bonusPercentage = bonusPctConfig
                ? parseFloat(bonusPctConfig.value) || 0
                : 10;

              // Get max cap (e.g. 50 = ₹50)
              const bonusMaxConfig = await tx.gameConfig.findUnique({
                where: { key: 'referral_bonus_max_amount' },
              });
              const bonusMaxAmount = bonusMaxConfig
                ? parseFloat(bonusMaxConfig.value) || 0
                : 50;

              if (bonusPercentage > 0 && bonusMaxAmount > 0) {
                // Calculate bonus: percentage of recharge amount, capped at max
                const calculatedBonus = (transaction.amount * bonusPercentage) / 100;
                const bonusAmount = Math.min(calculatedBonus, bonusMaxAmount);
                // Round to 2 decimal places
                const finalBonus = Math.round(bonusAmount * 100) / 100;

                if (finalBonus > 0) {
                  // Find the referrer
                  const referrer = await tx.user.findUnique({
                    where: { id: transaction.user.referredBy },
                    select: { id: true, name: true, balance: true, isActive: true },
                  });

                  if (referrer && referrer.isActive) {
                    // Add bonus to referrer's balance
                    await tx.user.update({
                      where: { id: referrer.id },
                      data: { balance: { increment: finalBonus } },
                    });

                    // Create a bonus transaction record for the referrer
                    await tx.walletTransaction.create({
                      data: {
                        userId: referrer.id,
                        type: 'deposit',
                        amount: finalBonus,
                        status: 'approved',
                        adminNote: `Referral bonus: ${transaction.user.name} (${transaction.user.mobile}) did 1st recharge of ₹${transaction.amount}. ${bonusPercentage}% = ₹${finalBonus}`,
                      },
                    });

                    // Mark that the bonus has been claimed for this referral
                    await tx.user.update({
                      where: { id: transaction.userId },
                      data: { referralBonusClaimed: true },
                    });

                    referralBonusResult = {
                      bonusGiven: true,
                      bonusAmount: finalBonus,
                      referrerName: referrer.name,
                    };

                    console.log(
                      `[Referral] ₹${finalBonus} bonus (${bonusPercentage}% of ₹${transaction.amount}, max ₹${bonusMaxAmount}) given to ${referrer.name} (${referrer.id}) for referring ${transaction.user.name}`
                    );
                  }
                }
              }
            }
          }
        }

        // Reject withdrawal: refund amount to user balance
        if (transaction.type === 'withdrawal' && status === 'rejected') {
          await tx.user.update({
            where: { id: transaction.userId },
            data: { balance: { increment: Math.abs(transaction.amount) } },
          });
        }

        // Build update data
        const updateData: Record<string, unknown> = { status };
        if (adminNote) {
          updateData.adminNote = adminNote;
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
      }),
      { context: 'Admin: walletApproval', maxRetries: 3, baseDelay: 300 }
    );

    // Build response message
    let message = `Transaction ${status} successfully`;
    if (referralBonusResult?.bonusGiven) {
      message += `. ₹${referralBonusResult.bonusAmount} referral bonus given to ${referralBonusResult.referrerName} (referrer)`;
    }

    return NextResponse.json({
      success: true,
      data: result,
      message,
      referralBonus: referralBonusResult,
    });
  } catch (error: unknown) {
    // Handle specific error cases
    if (error instanceof Error) {
      if (error.message === 'NOT_FOUND') {
        return NextResponse.json(
          { success: false, error: 'Transaction not found' },
          { status: 404 }
        );
      }
      if (error.message === 'ALREADY_PROCESSED') {
        return NextResponse.json(
          { success: false, error: 'Transaction is already processed' },
          { status: 400 }
        );
      }
    }

    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin wallet update error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update transaction' },
      { status: 500 }
    );
  }
}
