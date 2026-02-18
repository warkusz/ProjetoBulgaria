import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/config — public endpoint for card visibility (no auth needed)
export async function GET() {
    const config = await prisma.dashboardConfig.findMany({
        orderBy: { displayOrder: 'asc' },
    })
    return NextResponse.json(config)
}
