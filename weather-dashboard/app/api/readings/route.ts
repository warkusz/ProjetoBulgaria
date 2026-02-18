import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/readings — last 50 readings
export async function GET() {
    try {
        const readings = await prisma.weatherReading.findMany({
            orderBy: { recordedAt: 'desc' },
            take: 50,
        })
        // Convert BigInt id → Number (MySQL BIGINT UNSIGNED returns JS BigInt)
        const safe = readings.map(r => ({ ...r, id: Number(r.id) }))
        return NextResponse.json(safe)
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
}

// POST /api/readings — save a new reading from serial parser
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const reading = await prisma.weatherReading.create({
            data: {
                windDirection: body.windDirection,
                windSpeedMph: body.windSpeedMph,
                windSpeedMs: body.windSpeedMs,
                windGustMph: body.windGustMph,
                windGustMs: body.windGustMs,
                tempF: body.tempF,
                tempC: body.tempC,
                rain1hIn: body.rain1hIn,
                rain1hMm: body.rain1hMm,
                rain24hIn: body.rain24hIn,
                rain24hMm: body.rain24hMm,
                humidity: body.humidity,
                pressureMbar: body.pressureMbar,
                pressureInhg: body.pressureInhg,
                rawString: body.rawString,
                checksum: body.checksum,
            },
        })
        return NextResponse.json(reading, { status: 201 })
    } catch (e) {
        console.error(e)
        return NextResponse.json({ error: 'DB error' }, { status: 500 })
    }
}
