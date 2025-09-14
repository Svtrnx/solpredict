import type React from "react"
import { cn } from "@/lib/utils"

function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("animate-pulse rounded-md bg-white/10", className)} {...props} />
}

function ShimmerSkeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-white/5",
        "before:absolute before:inset-0 before:-translate-x-full before:animate-[shimmer_2s_infinite] before:bg-gradient-to-r before:from-transparent before:via-white/10 before:to-transparent",
        className,
      )}
      {...props}
    />
  )
}

function PulseSkeleton({ className, delay = 0, ...props }: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-white/8", className)}
      style={{ animationDelay: `${delay}ms` }}
      {...props}
    />
  )
}

export { Skeleton, ShimmerSkeleton, PulseSkeleton }
