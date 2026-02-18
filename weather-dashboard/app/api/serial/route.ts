// app/api/serial/route.ts
// Server-Sent Events endpoint — reads ESP32 serial port and streams parsed weather data
// Uses a module-level singleton so only one SerialPort is ever opened

import { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ── Types ─────────────────────────────────────────────────────────────────────
interface WeatherData {
    windDirection: number
    windSpeedMph: number
    windSpeedMs: number
    windGustMph: number
    windGustMs: number
    tempF: number
    tempC: number
    rain1hIn: number
    rain1hMm: number
    rain24hIn: number
    rain24hMm: number
    humidity: number
    pressureMbar: number
    pressureInhg: number
    rawString: string
    checksum: string
    timestamp: string
}

// ── Parser ────────────────────────────────────────────────────────────────────
function parseWeatherString(raw: string): WeatherData | null {
    let data = raw.trim()

    // main.cpp outputs "[RAW] c090s000g003t076r000p010h42b09971*31"
    // Strip the prefix if present
    if (data.startsWith('[RAW]')) {
        data = data.substring(5).trim()
    }

    if (data.length < 36 || data[0] !== 'c' || !data.includes('*')) return null

    const ei = (start: number, len: number) =>
        parseInt(data.substring(start, start + len), 10)

    const windDir = ei(1, 3)
    const windSpeedRaw = ei(5, 3)
    const windGustRaw = ei(9, 3)
    const tempFRaw = ei(13, 3)
    const rain1hRaw = ei(17, 3)
    const rain24hRaw = ei(21, 3)
    const humidity = ei(25, 2)
    const pressureRaw = ei(28, 5)
    const checksumPos = data.indexOf('*')
    const checksum = checksumPos !== -1 ? data.substring(checksumPos + 1) : ''

    const windSpeedMph = windSpeedRaw
    const windSpeedMs = parseFloat((windSpeedMph * 0.44704).toFixed(2))
    const windGustMph = windGustRaw
    const windGustMs = parseFloat((windGustMph * 0.44704).toFixed(2))
    const tempF = tempFRaw
    const tempC = parseFloat(((tempF - 32) * 5 / 9).toFixed(1))
    const rain1hIn = parseFloat((rain1hRaw * 0.01).toFixed(2))
    const rain1hMm = parseFloat((rain1hIn * 25.4).toFixed(1))
    const rain24hIn = parseFloat((rain24hRaw * 0.01).toFixed(2))
    const rain24hMm = parseFloat((rain24hIn * 25.4).toFixed(1))
    const pressureMbar = parseFloat((pressureRaw / 10).toFixed(1))
    const pressureInhg = parseFloat((pressureMbar * 0.02953).toFixed(2))

    return {
        windDirection: windDir,
        windSpeedMph, windSpeedMs,
        windGustMph, windGustMs,
        tempF, tempC,
        rain1hIn, rain1hMm,
        rain24hIn, rain24hMm,
        humidity,
        pressureMbar, pressureInhg,
        rawString: data,
        checksum,
        timestamp: new Date().toISOString(),
    }
}

// ── Singleton serial port ─────────────────────────────────────────────────────
// Stored on globalThis so it survives Next.js hot reloads
const g = globalThis as typeof globalThis & {
    _weatherListeners?: Set<(data: WeatherData) => void>
    _portOpen?: boolean
    _portRetryTimer?: ReturnType<typeof setTimeout>
    _detectedPort?: string
}

if (!g._weatherListeners) g._weatherListeners = new Set()
if (g._portOpen === undefined) g._portOpen = false

async function openSerialPort(retryDelay = 3000) {
    if (g._portOpen) return

    try {
        const { SerialPort } = await import('serialport')
        const { ReadlineParser } = await import('@serialport/parser-readline')

        const portPath: string = await (async () => {
            // 1. Explicit override via env var takes priority
            if (process.env.SERIAL_PORT) {
                console.log(`[serial] Using SERIAL_PORT env: ${process.env.SERIAL_PORT}`)
                return process.env.SERIAL_PORT
            }

            // 2. Auto-detect: find the first USB serial device
            // On macOS prefer cu.* (call-up) over tty.* — tty.* blocks until carrier
            const ports = (await SerialPort.list()).sort((a, b) => {
                const aCu = a.path.includes('/cu.') ? 0 : 1
                const bCu = b.path.includes('/cu.') ? 0 : 1
                return aCu - bCu
            })
            console.log('[serial] Available ports:', ports.map(p => p.path).join(', ') || '(none)')

            // Common USB-serial chip identifiers in the path name
            const usbPatterns = [
                /usbmodem/i,
                /usbserial/i,
                /SLAB_USBtoUART/i,
                /ch340/i,
                /CP210/i,
                /FTDI/i,
                /Arduino/i,
            ]

            // Try matching by friendly name/manufacturer first, then path
            const match =
                ports.find(p =>
                    usbPatterns.some(rx => rx.test(p.path)) ||
                    (p.manufacturer && /arduino|espressif|silicon labs|ftdi|ch34/i.test(p.manufacturer))
                )

            if (match) {
                console.log(`[serial] Auto-detected port: ${match.path} (${match.manufacturer || 'unknown manufacturer'})`)
                return match.path
            }

            // 3. Hard fallback in case nothing matches (preserves old behaviour)
            const fallback = '/dev/cu.usbmodem1101'
            console.warn(`[serial] No USB port found – falling back to ${fallback}`)
            return fallback
        })()

        const baudRate = parseInt(process.env.SERIAL_BAUD || '9600')
        g._detectedPort = portPath
        const port = new SerialPort({ path: portPath, baudRate })
        // Use \r\n delimiter — ESP32 sends CRLF line endings
        const parser = port.pipe(new ReadlineParser({ delimiter: '\r\n' }))



        port.on('open', () => {
            g._portOpen = true
            console.log(`[serial] Opened ${portPath} at ${baudRate} baud`)
        })

        parser.on('data', async (line: string) => {
            const weather = parseWeatherString(line)
            if (!weather) return

            // Broadcast to all SSE clients
            g._weatherListeners!.forEach((cb) => {
                try { cb(weather) } catch { g._weatherListeners!.delete(cb) }
            })

            // Save to DB (fire and forget)
            try {
                const { prisma } = await import('@/lib/prisma')
                await prisma.weatherReading.create({
                    data: {
                        windDirection: weather.windDirection,
                        windSpeedMph: weather.windSpeedMph,
                        windSpeedMs: weather.windSpeedMs,
                        windGustMph: weather.windGustMph,
                        windGustMs: weather.windGustMs,
                        tempF: weather.tempF,
                        tempC: weather.tempC,
                        rain1hIn: weather.rain1hIn,
                        rain1hMm: weather.rain1hMm,
                        rain24hIn: weather.rain24hIn,
                        rain24hMm: weather.rain24hMm,
                        humidity: weather.humidity,
                        pressureMbar: weather.pressureMbar,
                        pressureInhg: weather.pressureInhg,
                        rawString: weather.rawString,
                        checksum: weather.checksum,
                    },
                })

                // Prune old data: Keep last 24 hours
                // optimal for performance: run cleanup ~1% of the time
                if (Math.random() < 0.01) {
                    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000)
                    await prisma.weatherReading.deleteMany({
                        where: { recordedAt: { lt: cutoff } },
                    }).catch(err => console.error('[serial] Prune error:', err))
                }
            } catch (dbErr) {
                console.error('[serial] DB save error:', dbErr)
            }
        })

        port.on('error', (err: Error) => {
            g._portOpen = false
            if (err.message.includes('Cannot lock port') || err.message.includes('Resource temporarily unavailable')) {
                console.warn(`[serial] Port busy — another app (Serial Monitor?) is using it. Retrying in ${retryDelay / 1000}s...`)
            } else {
                console.error('[serial] Port error:', err.message)
            }
            // Retry with backoff (max 30s)
            const nextDelay = Math.min(retryDelay * 1.5, 30000)
            g._portRetryTimer = setTimeout(() => openSerialPort(nextDelay), retryDelay)
        })

        port.on('close', () => {
            g._portOpen = false
            console.log('[serial] Port closed — retrying in 5s...')
            g._portRetryTimer = setTimeout(() => openSerialPort(5000), 5000)
        })

    } catch (err) {
        g._portOpen = false
        const nextDelay = Math.min(retryDelay * 1.5, 30000)
        console.error('[serial] Failed to open port:', (err as Error).message, `— retrying in ${retryDelay / 1000}s`)
        g._portRetryTimer = setTimeout(() => openSerialPort(nextDelay), retryDelay)
    }
}

// Start trying to open the port immediately
openSerialPort()

// ── SSE Handler ───────────────────────────────────────────────────────────────
export async function GET(_req: NextRequest) {
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
        start(controller) {
            const send = (event: string, data: string) => {
                try {
                    controller.enqueue(encoder.encode(`event: ${event}\ndata: ${data}\n\n`))
                } catch {
                    // client disconnected
                }
            }

            // Send initial status
            send('status', JSON.stringify({
                portOpen: g._portOpen,
                detectedPort: g._detectedPort ?? null,
                baudRate: parseInt(process.env.SERIAL_BAUD || '115200'),
            }))

            const listener = (data: WeatherData) => {
                send('weather', JSON.stringify(data))
            }

            g._weatherListeners!.add(listener)

            // Heartbeat every 15s
            const heartbeat = setInterval(() => {
                try {
                    controller.enqueue(encoder.encode(': heartbeat\n\n'))
                } catch {
                    clearInterval(heartbeat)
                    g._weatherListeners!.delete(listener)
                }
            }, 15000)

            // Cleanup on disconnect
            _req.signal.addEventListener('abort', () => {
                clearInterval(heartbeat)
                g._weatherListeners!.delete(listener)
            })
        },
    })

    return new Response(stream, {
        headers: {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        },
    })
}
