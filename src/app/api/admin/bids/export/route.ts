import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { getTodayIST } from '@/lib/time';

export async function GET(request: Request) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const gameId = searchParams.get('gameId');
    const userId = searchParams.get('userId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const targetDate = searchParams.get('targetDate');
    const format = searchParams.get('format') || 'csv';

    const where: Record<string, unknown> = {};

    if (status) where.status = status;
    if (gameId) where.gameId = gameId;
    if (userId) where.userId = userId;
    if (targetDate) where.targetDate = targetDate;

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        (where.createdAt as Record<string, unknown>).gte = new Date(dateFrom);
      }
      if (dateTo) {
        (where.createdAt as Record<string, unknown>).lte = new Date(dateTo);
      }
    }

    const bids = await db.bid.findMany({
      where,
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
        game: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    if (!bids || bids.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No bids found matching the given filters' },
        { status: 404 }
      );
    }

    // Compute today for bid type labeling
    const today = getTodayIST();

    const headers = [
      'S.No',
      'User Name',
      'Mobile',
      'Game',
      'Bid Type',
      'Number',
      'Amount (₹)',
      'Status',
      'Win Amount (₹)',
      'Target Date',
      'Bid For',
      'Placed On',
      'Bank Name',
      'Account Holder',
      'Account Number',
      'IFSC Code',
      'UPI ID',
    ];

    const rows = bids.map((bid, index) => {
      const bidFor = bid.targetDate === today ? 'Today' : bid.targetDate > today ? 'Next Day' : 'Past';
      const bd = bid.user.bankDetail;
      return [
        index + 1,
        bid.user.name || '',
        bid.user.mobile || '',
        bid.game?.name || '',
        bid.bidType || '',
        bid.number || '',
        bid.amount || 0,
        bid.status || '',
        bid.winAmount || 0,
        bid.targetDate || today,
        bidFor,
        bid.createdAt ? new Date(bid.createdAt).toLocaleString('en-IN') : '',
        bd?.bankName || '',
        bd?.accountHolder || '',
        bd?.accountNumber || '',
        bd?.ifscCode || '',
        bd?.upiId || '',
      ];
    });

    // Try importing xlsx - fallback to CSV if not available
    let XLSX: typeof import('xlsx') | null = null;
    try {
      XLSX = await import('xlsx');
    } catch {
      // xlsx not available, will use CSV
    }

    if (format === 'xlsx' && XLSX) {
      try {
        const wsData = [headers, ...rows];
        const ws = XLSX.utils.aoa_to_sheet(wsData);

        ws['!cols'] = [
          { wch: 6 },   // S.No
          { wch: 18 },  // User Name
          { wch: 14 },  // Mobile
          { wch: 16 },  // Game
          { wch: 10 },  // Bid Type
          { wch: 10 },  // Number
          { wch: 12 },  // Amount
          { wch: 10 },  // Status
          { wch: 14 },  // Win Amount
          { wch: 14 },  // Target Date
          { wch: 10 },  // Bid For
          { wch: 20 },  // Placed On
          { wch: 16 },  // Bank Name
          { wch: 18 },  // Account Holder
          { wch: 18 },  // Account Number
          { wch: 14 },  // IFSC Code
          { wch: 20 },  // UPI ID
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Bids Export');

        const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

        return new NextResponse(buf, {
          headers: {
            'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition':
              'attachment; filename=bids_export_' +
              new Date().toISOString().slice(0, 10) +
              '.xlsx',
          },
        });
      } catch (xlsxError) {
        console.error('XLSX generation failed, falling back to CSV:', xlsxError);
        // Fall through to CSV
      }
    }

    // CSV export (default)
    const csvRows = bids.map((bid, index) => {
      const bidFor = bid.targetDate === today ? 'Today' : bid.targetDate > today ? 'Next Day' : 'Past';
      const bd = bid.user.bankDetail;
      return [
        (index + 1).toString(),
        bid.user.name || '',
        bid.user.mobile || '',
        bid.game?.name || '',
        bid.bidType || '',
        bid.number || '',
        (bid.amount || 0).toString(),
        bid.status || '',
        (bid.winAmount || 0).toString(),
        bid.targetDate || today,
        bidFor,
        bid.createdAt ? bid.createdAt.toISOString() : '',
        bd?.bankName || '',
        bd?.accountHolder || '',
        bd?.accountNumber || '',
        bd?.ifscCode || '',
        bd?.upiId || '',
      ];
    });

    const csvContent = [
      headers.join(','),
      ...csvRows.map((row) =>
        row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename=bids_export_' +
          new Date().toISOString().slice(0, 10) +
          '.csv',
      },
    });
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return NextResponse.json(
        { success: false, error: authError.message },
        { status: authError.statusCode }
      );
    }
    console.error('Admin bids export error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to export bids. Please try again.' },
      { status: 500 }
    );
  }
}
