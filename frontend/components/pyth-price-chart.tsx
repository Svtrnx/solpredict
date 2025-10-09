"use client"

import { useEffect, useId, useMemo, useRef, useState, useCallback, JSX } from "react"
import type React from "react"

import { CartesianGrid, Line, LineChart, Rectangle, ResponsiveContainer, XAxis, YAxis } from "recharts"

import { type ChartConfig, ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Badge } from "@/components/ui/badge"

type Period = "15m" | "30m" | "1h" | "1d" | "1w" | "1m" | "1y"
type TVBar = { t: number; o: number; h: number; l: number; c: number }
type Point = { ts: number; value: number }

const RANGE_MS: Record<Period, number> = {
  "15m": 15 * 60 * 1000,
  "30m": 30 * 60 * 1000,
  "1h": 60 * 60 * 1000,
  "1d": 24 * 60 * 60 * 1000,
  "1w": 7 * 24 * 60 * 60 * 1000,
  "1m": 30 * 24 * 60 * 60 * 1000,
  "1y": 364 * 24 * 60 * 60 * 1000,
}

const SSE_BATCH_SIZE: Record<Period, number> = {
  "15m": 13,
  "30m": 20,
  "1h": 40,
  "1d": 60,
  "1w": 80,
  "1m": 60,
  "1y": 100,
}

function resolutionFor(p: Period): string {
  switch (p) {
    case "15m":
      return "1"
    case "30m":
      return "1"
    case "1h":
      return "1"
    case "1d":
      return "60"
    case "1w":
      return "240"
    case "1m":
      return "D"
    case "1y":
      return "W"
  }
}

function bucketStartSec(tsMs: number, resolutionSec: number) {
  const s = Math.floor(tsMs / 1000)
  return Math.floor(s / resolutionSec) * resolutionSec
}

const CLOCK_SKEW_MS = 90_000

interface CustomCursorProps {
  fill?: string
  pointerEvents?: string
  height?: number
  points?: Array<{ x: number; y: number }>
  className?: string
}
function CustomCursor(props: CustomCursorProps) {
  const { fill, pointerEvents, height, points, className } = props
  if (!points || points.length === 0) return null
  const { x, y } = points[0]!
  return (
    <>
      <Rectangle
        x={x - 12}
        y={y}
        fill={fill}
        pointerEvents={pointerEvents}
        width={24}
        height={height}
        className={className}
        type="linear"
      />
      <Rectangle
        x={x - 1}
        y={y}
        fill={fill}
        pointerEvents={pointerEvents}
        width={1}
        height={height}
        className="recharts-tooltip-inner-cursor"
        type="linear"
      />
    </>
  )
}

const chartConfig = {
	value: { label: "Value", color: "hsl(270, 70%, 60%)" },
} satisfies ChartConfig

const TIME_PERIOD_OPTIONS: Period[] = ["15m", "30m", "1h", "1d", "1w", "1m", "1y"]

const ViewOption = ({ id, value }: { id: string; value: string }) => (
	<label className="relative z-10 inline-flex h-full min-w-8 cursor-pointer items-center justify-center px-2 whitespace-nowrap transition-colors select-none uppercase text-foreground has-data-[state=unchecked]:text-muted-foreground">
	{value}
	<RadioGroupItem id={`${id}-${value}`} value={value} className="sr-only" />
	</label>
)

interface PythChartProps {
	symbol: string,
	feedId: string
}

export default function PythChart({ symbol, feedId }: PythChartProps): JSX.Element {
	const SYMBOL = symbol
	const FEED_ID = "0x" + feedId

	const id = useId()
	const [period, setPeriod] = useState<Period>("30m")
	const [bars, setBars] = useState<TVBar[]>([])
	const [points, setPoints] = useState<Point[]>([])
	const [livePoint, setLivePoint] = useState<Point | null>(null)
	const [isLoading, setIsLoading] = useState(false)
	const [isConnected, setIsConnected] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [currentPrice, setCurrentPrice] = useState<number | null>(null)

	const allowUsd = SYMBOL.toLowerCase().includes("usd")

	const esRef = useRef<EventSource | null>(null)
	const sseCounterRef = useRef(0)

	const resSec = useMemo(() => {
		const r = resolutionFor(period)
		return r === "D" || r === "1D" ? 86400 : r === "W" || r === "1W" ? 604800 : Number(r)
	}, [period])

	const fetchHistory = useCallback(async () => {
		setIsLoading(true)
		setError(null)
		try {
		const now = Date.now()
		const from = Math.floor((now - RANGE_MS[period]) / 1000)
		const to = Math.floor((now + CLOCK_SKEW_MS) / 1000)

		const url = new URL("https://benchmarks.pyth.network/v1/shims/tradingview/history")
		url.searchParams.set("symbol", SYMBOL)
		url.searchParams.set("resolution", resolutionFor(period))
		url.searchParams.set("from", String(from))
		url.searchParams.set("to", String(to))

		const res = await fetch(url.toString())
		if (!res.ok) throw new Error(`history ${res.status}`)
		const j = (await res.json()) as {
			s: string
			t: number[]
			o: number[]
			h: number[]
			l: number[]
			c: number[]
		}
		if (j.s !== "ok") throw new Error("history not ok")

		const outBars: TVBar[] = j.t.map((sec, i) => ({
			t: sec * 1000,
			o: j.o[i],
			h: j.h[i],
			l: j.l[i],
			c: j.c[i],
		}))
		setBars(outBars)

		const initialPoints: Point[] = outBars.map((b) => ({ ts: b.t, value: b.c }))
		setPoints(initialPoints)

		if (outBars.length) setCurrentPrice(outBars[outBars.length - 1].c)
		} catch (e: any) {
		console.error(e)
		setError(e?.message ?? "Failed to load history")
		setBars([])
		setPoints([])
		setCurrentPrice(null)
		} finally {
		setIsLoading(false)
		}
	}, [period])

	useEffect(() => {
		fetchHistory()
	}, [fetchHistory])

	useEffect(() => {
		if (isLoading) return
		esRef.current?.close()

		sseCounterRef.current = 0

		const es = new EventSource(
		`https://hermes.pyth.network/v2/updates/price/stream?ids[]=${FEED_ID}&benchmarks_only=true`,
		)
		esRef.current = es

		es.onmessage = (evt) => {
		try {
			const data = JSON.parse(evt.data)
			const p = data?.parsed?.[0]?.price
			if (!p) return
			const tsRaw = Number(p.publish_time) * 1000
			const price = Number(p.price) * Math.pow(10, p.expo)

			setBars((prev) => {
			if (!prev.length) return prev
			const bucketSec = bucketStartSec(tsRaw, resSec)
			const bucketMs = bucketSec * 1000
			const last = prev[prev.length - 1]

			if (last.t === bucketMs) {
				const o = last.o
				const h = Math.max(last.h, price)
				const l = Math.min(last.l, price)
				const c = price
				const next = [...prev]
				next[next.length - 1] = { t: bucketMs, o, h, l, c }
				return next
			}

			if (bucketMs > last.t) {
				const o = prev[prev.length - 1].c
				const h = Math.max(o, price)
				const l = Math.min(o, price)
				const c = price
				return [...prev, { t: bucketMs, o, h, l, c }]
			}
			return prev
			})

			sseCounterRef.current += 1
			const batchSize = SSE_BATCH_SIZE[period]

			setLivePoint((prevLive) => {
			const lastTs = prevLive ? prevLive.ts : 0
			const ts = tsRaw <= lastTs ? lastTs + 1 : tsRaw
			return { ts, value: price }
			})

			if (sseCounterRef.current % batchSize === 0) {
			setPoints((prev) => {
				const now = Date.now()
				const windowStart = now - RANGE_MS[period]

				const lastTs = prev.length ? prev[prev.length - 1].ts : 0
				const ts = tsRaw <= lastTs ? lastTs + 1 : tsRaw

				const next = [...prev, { ts, value: price }]

				let cutIdx = 0
				while (cutIdx < next.length && next[cutIdx].ts < windowStart) cutIdx++
				const sliced = cutIdx > 0 ? next.slice(cutIdx) : next

				return sliced
			})
			}

			setCurrentPrice(price)
			setIsConnected(true)
		} catch (e) {
			console.error("SSE parse", e)
		}
		}

		es.onerror = (e) => {
		console.error("SSE error", e)
		setIsConnected(false)
		}

		return () => {
		es.close()
		}
	}, [isLoading, resSec, period])

	const formatTick = (ts: number) => {
		const d = new Date(ts)
		if (!isFinite(d.getTime())) return ""

		// For timeframes greater than 1 day, show date
		if (period === "1d" || period === "1w" || period === "1m" || period === "1y") {
		const day = String(d.getDate()).padStart(2, "0")
		const month = String(d.getMonth() + 1).padStart(2, "0")
		const year = d.getFullYear()
		return `${day}:${month}:${year}`
		}

		// For shorter timeframes, show only time in 24-hour format
		const hours = String(d.getHours()).padStart(2, "0")
		const minutes = String(d.getMinutes()).padStart(2, "0")
		return `${hours}:${minutes}`
	}

	const formatTooltipTime = (ts: number | string) => {
		const timestamp = typeof ts === "string" ? Number.parseFloat(ts) : ts

		// Check if timestamp is valid
		if (!timestamp || !isFinite(timestamp) || isNaN(timestamp)) {
		console.log("Invalid timestamp in tooltip:", ts)
		return "Invalid date"
		}

		const d = new Date(timestamp)

		// Double check the date object is valid
		if (!isFinite(d.getTime()) || isNaN(d.getTime())) {
		console.log("Invalid date object in tooltip:", timestamp, d)
		return "Invalid date"
		}

		// For timeframes greater than 1 day, show date and time
		if (period === "1d" || period === "1w" || period === "1m" || period === "1y") {
		const day = String(d.getDate()).padStart(2, "0")
		const month = String(d.getMonth() + 1).padStart(2, "0")
		const year = d.getFullYear()
		const hours = String(d.getHours()).padStart(2, "0")
		const minutes = String(d.getMinutes()).padStart(2, "0")
		return `${day}:${month}:${year} ${hours}:${minutes}`
		}

		// For shorter timeframes, show only time in 24-hour format
		const hours = String(d.getHours()).padStart(2, "0")
		const minutes = String(d.getMinutes()).padStart(2, "0")
		return `${hours}:${minutes}`
	}

	const currency = (v: number, allowUsd: boolean) => `${allowUsd ? "$" : ""}${(v as number).toFixed(2)}`

	const hasData = points.length > 0

	const chartData = useMemo(() => {
		if (!livePoint) return points
		const lastPointTs = points.length > 0 ? points[points.length - 1].ts : 0
		if (livePoint.ts > lastPointTs) {
		return [...points, livePoint]
		}
		return points
	}, [points, livePoint])

	const domainY = useMemo<[number | "auto", number | "auto"]>(() => {
		if (!hasData) return ["auto", "auto"]
		const vals = chartData.map((p) => p.value)
		const min = Math.min(...vals)
		const max = Math.max(...vals)
		const pad = (max - min) * 0.05 || 1
		return [min - pad, max + pad]
	}, [chartData, hasData])

	const change = useMemo(() => {
		if (points.length < 2) return { ch: 0, pct: 0 }
		const first = points[0].value
		const last = points[points.length - 1].value
		return { ch: last - first, pct: ((last - first) / first) * 100 }
	}, [points])

	const selectedIndex = TIME_PERIOD_OPTIONS.indexOf(period)

	return (
		<Card className="w-full border-0 shadow-lg">
		<CardHeader className="space-y-3.5 pb-4">
			<div className="flex items-center justify-between gap-4">
			<div className="flex items-center gap-3">
				<div className="flex items-baseline gap-1.5">
				<h2 className="text-sm font-bold text-foreground tracking-tight">{SYMBOL.split("/")[0]}</h2>
				<span className="text-xs text-muted-foreground font-medium">/</span>
				<span className="text-xs text-muted-foreground font-medium">{SYMBOL.split("/")[1]}</span>
				</div>
				<div className="h-3.5 w-px bg-border" />
				<CardTitle className="text-sm font-medium text-muted-foreground">Live Oracle Feed</CardTitle>
			</div>
			<div className="flex items-center gap-1.5">
				<div className={`w-1.5 h-1.5 rounded-full ${isConnected ? "bg-emerald-500 animate-pulse" : "bg-muted"}`} />
				<Badge
				variant="outline"
				className={`text-[10px] font-medium px-1.5 py-0 h-5 ${
					isConnected
					? "bg-emerald-500/5 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
					: "bg-muted/50 text-muted-foreground border-border/50"
				}`}
				>
				{isConnected ? "LIVE" : "OFFLINE"}
				</Badge>
			</div>
			</div>

			{currentPrice !== null && (
			<div className="space-y-2">
				<div className="flex items-end gap-2.5">
				<div className="text-4xl font-bold tracking-tight tabular-nums leading-none">
					{currency(currentPrice, allowUsd)}
				</div>
				{points.length > 1 && (
					<div
					className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-semibold tabular-nums leading-none mb-0.5 ${
						change.ch >= 0
						? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border border-emerald-500/20"
						: "bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20"
					}`}
					>
					<span className="text-base leading-none">{change.ch >= 0 ? "↑" : "↓"}</span>
					<div className="flex items-baseline gap-1">
						<span>{currency(Math.abs(change.ch), allowUsd)}</span>
						<span className="opacity-70 text-[10px]">
						({change.pct >= 0 ? "+" : ""}
						{change.pct.toFixed(2)}%)
						</span>
					</div>
					</div>
				)}
				</div>
				<p className="text-[11px] text-muted-foreground font-medium">
				Powered by Pyth Network • Real-time data stream
				</p>
			</div>
			)}

			<div className="flex items-center gap-3 pt-0.5">
			<span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">Timeframe</span>
			<div className="bg-muted/50 dark:bg-muted/30 inline-flex h-7 rounded-lg p-0.5 shrink-0 border border-border/50">
				<RadioGroup
				value={period}
				onValueChange={(v) => setPeriod(v as Period)}
				className="group text-[11px] after:bg-background dark:after:bg-card after:border after:border-border/50 has-focus-visible:after:border-ring has-focus-visible:after:ring-ring/50 relative inline-grid grid-cols-[repeat(7,1fr)] items-center gap-0 font-semibold after:absolute after:inset-y-0.5 after:w-1/7 after:rounded-md after:shadow-sm dark:after:shadow-none after:transition-[translate,box-shadow] after:duration-300 after:[transition-timing-function:cubic-bezier(0.16,1,0.3,1)] has-focus-visible:after:ring-[3px] [&:after]:translate-x-[calc(var(--selected-index)*100%+2px)]"
				data-state={period}
				style={
					{
					"--selected-index": selectedIndex,
					} as React.CSSProperties
				}
				>
				{TIME_PERIOD_OPTIONS.map((value) => (
					<ViewOption key={value} id={id} value={value} />
				))}
				</RadioGroup>
			</div>
			</div>
		</CardHeader>

		<CardContent>
			<div className="h-[400px] w-full relative">
			<ChartContainer
				style={{ height: "inherit", width: "100%" }}
				config={chartConfig}
				className="absolute inset-0 [&_.recharts-rectangle.recharts-tooltip-cursor]:fill-(--chart-1)/10 [&_.recharts-rectangle.recharts-tooltip-inner-cursor]:fill-(--chart-1)/25 [&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-border dark:[&_.recharts-cartesian-grid_line[stroke='#ccc']]:stroke-card [&_.recharts-cartesian-axis-line]:stroke-border dark:[&_.recharts-cartesian-axis-line]:stroke-card"
			>
				<ResponsiveContainer width="100%" height="100%">
				<LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
					<CartesianGrid strokeDasharray="3 3" />
					<XAxis
					dataKey="ts"
					type="number"
					domain={["dataMin", "dataMax"]}
					tickFormatter={(ts) => formatTick(ts as number)}
					stroke="#6b7280"
					style={{ fontSize: 12 }}
					minTickGap={50}
					/>
					<YAxis
					domain={domainY}
					axisLine={false}
					tickLine={false}
					tickFormatter={(v) => currency(v as number, allowUsd)}
					stroke="#6b7280"
					style={{ fontSize: 12 }}
					/>

					<ChartTooltip
					content={
						<ChartTooltipContent
						hideIndicator
						labelFormatter={(value, payload) => {
							if (!payload || !payload.length) return ""
							const dataPoint = payload[0]?.payload
							if (!dataPoint || !dataPoint.ts) return ""
							return formatTooltipTime(dataPoint.ts)
						}}
						formatter={(v) => currency(Number(v), allowUsd)}
						/>
					}
					cursor={<CustomCursor fill="hsl(270, 70%, 60%)" />}
					/>

					<Line
					type="linear"
					dataKey="value"
					stroke="hsl(270, 70%, 60%)"
					strokeWidth={2}
					dot={false}
					isAnimationActive={false}
					activeDot={{
						r: 5,
						fill: "hsl(270, 70%, 60%)",
						stroke: "var(--background)",
						strokeWidth: 2,
					}}
					/>
				</LineChart>
				</ResponsiveContainer>
			</ChartContainer>

			{isLoading && (
				<div className="absolute inset-0 backdrop-blur-sm bg-background/30 flex items-center justify-center z-10">
				<div className="flex flex-col items-center gap-2">
					<div className="w-6 h-6 border-2 border-purple-200 border-t-purple-600 rounded-full animate-spin" />
					<p className="text-xs text-foreground font-medium">Loading chart data...</p>
				</div>
				</div>
			)}
			</div>

			{error && <div className="mt-3 text-sm text-red-600">{error}</div>}
		</CardContent>
		</Card>
	)
}
