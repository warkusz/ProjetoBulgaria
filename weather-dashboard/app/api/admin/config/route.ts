import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/auth'

// GET /api/admin/config — get all card configs
export async function GET() {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const config = await prisma.dashboardConfig.findMany({
        orderBy: { displayOrder: 'asc' },
    })
    return NextResponse.json(config)
}

// PUT /api/admin/config — update card visibility
export async function PUT(req: Request) {
    const session = await auth()
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const updates: { cardKey: string; isVisible: boolean }[] = await req.json()

    const results = await Promise.all(
        updates.map((u) =>
            prisma.dashboardConfig.update({
                where: { cardKey: u.cardKey },
                data: { isVisible: u.isVisible },
            })
        )
    )
    return NextResponse.json(results)
}
