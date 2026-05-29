import { db } from '@/lib/db'
import { NextResponse } from 'next/server'

// Sabhi requests ke liye common CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // '*' matlab kisi bhi website (localhost/subdomain) se access allow hai
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function POST(req: Request) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'unknown'
    const body = await req.json().catch(() => ({}))

    await db.appDownload.create({
      data: {
        ipAddress: ip,
        source: body.source || 'external',
      }
    })

    // Yahan corsHeaders bhejna bahut zaroori hai!
    return NextResponse.json(
      { success: true, tracked: true }, 
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500, headers: corsHeaders }
    )
  }
}

export async function GET() {
  try {
    const total = await db.appDownload.count()

    const today = await db.appDownload.count({
      where: {
        downloadedAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0))
        }
      }
    })

    return NextResponse.json(
      { success: true, data: { total, today } }, 
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message }, 
      { status: 500, headers: corsHeaders }
    )
  }
}

// ✅ CORS preflight — browser sabse pehle ise call karke permission mangta hai
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  })
}