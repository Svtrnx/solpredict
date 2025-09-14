"use client"

interface AnimatedPnLBarProps {
  pnl: string
  trend: "up" | "down"
}

export function AnimatedPnLBar({ pnl, trend }: AnimatedPnLBarProps) {
  const percentage = Math.abs(Number.parseFloat(pnl.replace(/[+\-%]/g, "")))
  const normalizedPercentage = Math.min(percentage, 100)

  return (
    <div className="relative w-full h-2 bg-gray-800/50 rounded-full overflow-hidden">
      <div
        className={`h-full transition-all duration-1000 ease-out ${
          trend === "up"
            ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
            : "bg-gradient-to-r from-rose-500 to-rose-600"
        }`}
        style={{ width: `${normalizedPercentage}%` }}
      >
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
      </div>
    </div>
  )
}
