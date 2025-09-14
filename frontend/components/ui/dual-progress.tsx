"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface DualProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  yesValue: number
  noValue: number
}

const DualProgress = React.forwardRef<HTMLDivElement, DualProgressProps>(
  ({ className, yesValue, noValue, ...props }, ref) => {
    const total = yesValue + noValue
    const yesPercentage = total > 0 ? (yesValue / total) * 100 : 0
    const noPercentage = total > 0 ? (noValue / total) * 100 : 0

    return (
      <div
        ref={ref}
        className={cn("relative h-4 w-full overflow-hidden rounded-full bg-zinc-800", className)}
        {...props}
      >
        <div className="flex h-full w-full">
          <div className="h-full transition-all bg-emerald-400" style={{ width: `${yesPercentage}%` }} />
          <div className="h-full bg-rose-500 transition-all" style={{ width: `${noPercentage}%` }} />
        </div>
      </div>
    )
  },
)
DualProgress.displayName = "DualProgress"

export { DualProgress }
