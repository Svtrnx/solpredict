import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

export const PriceCardSkeleton = ({ isYes }: { isYes: boolean }) => (
  <Card className={cn("glass relative overflow-hidden border-2", isYes ? "glow-green" : "glow")}>
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        isYes
          ? "bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-transparent"
          : "bg-gradient-to-br from-rose-500/[0.03] via-transparent to-transparent",
      )}
    />
    <CardContent className="relative p-3 space-y-2">
      <div className="flex items-center justify-between">
        <PulseSkeleton className="h-6 w-12 rounded-full" />
        <PulseSkeleton className="h-3 w-16" delay={100} />
      </div>

      <div className="text-center py-2">
        <ShimmerSkeleton className="h-9 w-20 mx-auto mb-1" />
        <PulseSkeleton className="h-3 w-16 mx-auto" delay={200} />
      </div>

      <div className="glass rounded-lg p-2 border border-border/40">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <PulseSkeleton className="w-3 h-3 rounded" />
            <PulseSkeleton className="h-3 w-16" delay={100} />
          </div>
          <PulseSkeleton className="h-4 w-20" delay={200} />
        </div>
      </div>
    </CardContent>
  </Card>
)

export const ChartSkeleton = () => (
  <Card className="w-full border-0 shadow-lg">
    <CardHeader className="space-y-3.5 pb-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-baseline gap-1.5">
            <PulseSkeleton className="h-4 w-16" />
            <span className="text-xs text-muted-foreground font-medium">/</span>
            <PulseSkeleton className="h-3 w-12" delay={50} />
          </div>
          <div className="h-3.5 w-px bg-border" />
          <PulseSkeleton className="h-4 w-28" delay={100} />
        </div>
        <div className="flex items-center gap-1.5">
          <PulseSkeleton className="w-1.5 h-1.5 rounded-full" delay={150} />
          <PulseSkeleton className="h-5 w-12 rounded-full" delay={200} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-end gap-2.5">
          <ShimmerSkeleton className="h-10 w-40" />
          <PulseSkeleton className="h-7 w-32 rounded-md mb-0.5" delay={100} />
        </div>
        <PulseSkeleton className="h-3 w-64" delay={200} />
      </div>

      <div className="flex items-center gap-3 pt-0.5">
        <PulseSkeleton className="h-3 w-20" />
        <div className="bg-muted/50 dark:bg-muted/30 inline-flex h-7 rounded-lg p-0.5 border border-border/50 gap-0.5">
          {["15M", "30M", "1H", "1D", "1W", "1M", "1Y"].map((_, index) => (
            <PulseSkeleton key={index} className="h-6 w-10 rounded-md" delay={index * 30} />
          ))}
        </div>
      </div>
    </CardHeader>

    <CardContent>
      <div className="h-[400px] w-full relative">
        <div className="absolute inset-0 rounded-lg bg-accent/10 overflow-hidden">
          <div className="absolute left-0 top-5 bottom-5 w-20 flex flex-col justify-between items-end pr-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <PulseSkeleton key={index} className="h-3 w-16" delay={index * 40} />
            ))}
          </div>

          <div className="absolute bottom-0 left-20 right-8 h-8 flex justify-between items-center">
            {Array.from({ length: 7 }).map((_, index) => (
              <PulseSkeleton key={index} className="h-3 w-12" delay={index * 50} />
            ))}
          </div>

          <div className="absolute left-20 right-8 top-5 bottom-8">
            <svg className="w-full h-full opacity-20">
              <defs>
                <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                  <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#grid)" />
            </svg>
          </div>

          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
        </div>
      </div>
    </CardContent>
  </Card>
)

export const PlaceBetSkeleton = () => (
  <Card className="glass border-2 border-purple-500/20">
    <CardHeader className="pb-3 border-b border-border/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
      <div className="flex items-center space-x-2">
        <PulseSkeleton className="w-5 h-5 rounded-full" />
        <PulseSkeleton className="h-6 w-24" delay={100} />
      </div>
    </CardHeader>
    <CardContent className="space-y-6 pt-4">
      <div className="grid grid-cols-2 gap-4">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="text-center space-y-2">
            <div className="flex items-center justify-center space-x-2">
              <PulseSkeleton className="w-4 h-4 rounded-full" />
              <PulseSkeleton className="h-4 w-16" delay={50} />
            </div>
            <ShimmerSkeleton className="h-8 w-12 mx-auto" />
            <PulseSkeleton className="h-3 w-8 mx-auto" delay={index * 100} />
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <PulseSkeleton className="h-4 w-32" />
          <PulseSkeleton className="h-4 w-24" delay={100} />
        </div>
        <ShimmerSkeleton className="h-8 rounded-lg" />
        <div className="glass p-3 rounded-lg border border-border/40">
          <div className="space-y-2">
            <PulseSkeleton className="h-3 w-full" />
            <PulseSkeleton className="h-3 w-4/5" delay={100} />
            <PulseSkeleton className="h-3 w-3/4" delay={200} />
          </div>
        </div>
      </div>
    </CardContent>
  </Card>
)

export const BettingCardSkeleton = () => (
  <Card className="glass border-2 border-purple-500/20">
    <CardHeader className="pb-3 border-b border-border/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
      <div className="flex items-center justify-between">
        <PulseSkeleton className="h-6 w-32" />
        <div className="flex items-center space-x-2">
          <PulseSkeleton className="w-4 h-4 rounded-full" />
          <PulseSkeleton className="h-4 w-20" delay={100} />
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-6 pt-4">
      <div className="space-y-2">
        <PulseSkeleton className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-2">
          <ShimmerSkeleton className="h-12 rounded-lg" />
          <ShimmerSkeleton className="h-12 rounded-lg" />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <PulseSkeleton className="h-3 w-24" />
          <PulseSkeleton className="h-6 w-8" delay={100} />
        </div>
        <ShimmerSkeleton className="h-14 rounded-lg" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <PulseSkeleton key={index} className="h-9 rounded-lg" delay={index * 50} />
          ))}
        </div>
      </div>

      <div className="glass p-4 rounded-lg space-y-3 border border-border/40">
        <div className="flex items-center justify-between pb-2 border-b border-border/30">
          <PulseSkeleton className="h-3 w-24" />
          <PulseSkeleton className="h-5 w-12 rounded-full" delay={100} />
        </div>
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="flex justify-between items-center">
              <PulseSkeleton className="h-4 w-20" delay={index * 50} />
              <PulseSkeleton className="h-4 w-16" delay={index * 50 + 100} />
            </div>
          ))}
        </div>
      </div>

      <ShimmerSkeleton className="h-11 w-full rounded-lg" />
    </CardContent>
  </Card>
)

export const RecentBetsSkeleton = () => (
  <Card className="glass glow">
    <CardHeader>
      <div className="flex items-center space-x-2">
        <PulseSkeleton className="w-5 h-5 rounded-full" />
        <PulseSkeleton className="h-6 w-28" delay={50} />
      </div>
    </CardHeader>
    <CardContent className="space-y-3">
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="glass p-3 rounded-lg border border-border/40">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <PulseSkeleton className="w-2 h-2 rounded-full" delay={index * 50} />
                <PulseSkeleton className="h-3 w-24 rounded" delay={index * 50 + 25} />
              </div>
              <PulseSkeleton className="h-5 w-12 rounded-full" delay={index * 50 + 50} />
            </div>
            <div className="flex items-center justify-between">
              <PulseSkeleton className="h-3 w-16" delay={index * 50 + 75} />
              <PulseSkeleton className="h-3 w-12" delay={index * 50 + 100} />
            </div>
          </div>
        ))}
      </div>

      <div className="pt-1">
        <ShimmerSkeleton className="h-9 w-full rounded-md" />
      </div>
    </CardContent>
  </Card>
)


export const InfoBarSkeleton = () => (
  <div className="glass p-4 rounded-xl border border-accent/30">
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <div className="flex items-center space-x-2">
        <PulseSkeleton className="h-6 w-16 rounded-full" />
        <PulseSkeleton className="h-6 w-20 rounded-full" delay={50} />
      </div>

      <div className="h-4 w-px bg-border hidden sm:block"></div>

      <div className="flex items-center space-x-2">
        <PulseSkeleton className="w-4 h-4 rounded-full" delay={100} />
        <PulseSkeleton className="h-3 w-12" delay={150} />
        <PulseSkeleton className="h-3 w-20" delay={200} />
      </div>

      <div className="h-4 w-px bg-border hidden sm:block"></div>

      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="w-4 h-4 rounded-full" delay={250} />
          <PulseSkeleton className="h-3 w-16" delay={300} />
        </div>
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="w-4 h-4 rounded-full" delay={350} />
          <PulseSkeleton className="h-3 w-8" delay={400} />
        </div>
      </div>

      <div className="h-4 w-px bg-border hidden sm:block"></div>

      <div className="flex items-center space-x-2">
        <PulseSkeleton className="w-4 h-4 rounded-full" delay={450} />
        <PulseSkeleton className="h-3 w-32" delay={500} />
      </div>
    </div>
  </div>
)