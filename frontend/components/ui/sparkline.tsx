"use client"

interface SparklineProps {
  trend: "up" | "down"
  points?: number[]
}

export function Sparkline({ trend, points = [20, 35, 25, 45, 30, 55, 40, 60] }: SparklineProps) {
  const width = 60
  const height = 20
  const max = Math.max(...points)
  const min = Math.min(...points)
  const range = max - min || 1

  const pathData = points
    .map((point, index) => {
      const x = (index / (points.length - 1)) * width
      const y = height - ((point - min) / range) * height
      return `${index === 0 ? "M" : "L"} ${x} ${y}`
    })
    .join(" ")

  return (
    <svg width={width} height={height} className="inline-block">
      <path
        d={pathData}
        fill="none"
        stroke={trend === "up" ? "#10b981" : "#ef4444"}
        strokeWidth="1.5"
        className="opacity-80"
      />
    </svg>
  )
}
