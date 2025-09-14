import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

const MarketCardSkeleton = ({ index = 0 }: { index?: number }) => (
  <Card className="glass glow relative overflow-hidden">
    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 via-transparent to-cyan-500/5"></div>
    <CardHeader className="pb-3 relative z-10">
      <div className="flex items-start justify-between mb-2">
        <PulseSkeleton className="h-5 w-16 rounded-full" delay={index * 50} />
        <PulseSkeleton className="h-4 w-8" delay={index * 50 + 100} />
      </div>
      <ShimmerSkeleton className="h-6 w-full mb-2" />
      <PulseSkeleton className="h-4 w-3/4" delay={index * 50 + 200} />
    </CardHeader>
    <CardContent className="space-y-4 relative z-10">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-green-400/10 to-transparent animate-pulse"></div>
          <PulseSkeleton className="h-3 w-6 mb-1 bg-green-400/30" delay={index * 50 + 300} />
          <ShimmerSkeleton className="h-5 w-12 bg-green-400/20" />
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-400/10 to-transparent animate-pulse"></div>
          <PulseSkeleton className="h-3 w-6 mb-1 bg-red-400/30" delay={index * 50 + 350} />
          <ShimmerSkeleton className="h-5 w-12 bg-red-400/20" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="h-4 w-4 rounded-full" delay={index * 50 + 400} />
          <PulseSkeleton className="h-4 w-16" delay={index * 50 + 450} />
        </div>
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="h-4 w-4 rounded-full" delay={index * 50 + 500} />
          <PulseSkeleton className="h-4 w-12" delay={index * 50 + 550} />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="h-4 w-4 rounded-full" delay={index * 50 + 600} />
          <PulseSkeleton className="h-4 w-20" delay={index * 50 + 650} />
        </div>
        <div className="flex items-center space-x-1">
          <PulseSkeleton className="h-3 w-3 rounded-full" delay={index * 50 + 700} />
          <PulseSkeleton className="h-4 w-10" delay={index * 50 + 750} />
        </div>
      </div>
    </CardContent>
  </Card>
)

export default function Loading() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>

      <div className="absolute inset-0 radial-glow"></div>
      <div className="neon-grid"></div>
      <div className="neon-globe"></div>

      <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/5 rounded-full blur-3xl animate-pulse delay-2000"></div>

      <div className="relative z-10 pt-24 pb-12 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12">
            <ShimmerSkeleton className="h-12 w-80 mx-auto mb-4" />
            <div className="space-y-2">
              <PulseSkeleton className="h-5 w-96 mx-auto" delay={200} />
              <PulseSkeleton className="h-5 w-80 mx-auto" delay={300} />
            </div>
          </div>

          <div className="glass rounded-2xl p-6 mb-8 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between relative z-10">
              <div className="flex-1 relative">
                <PulseSkeleton className="w-6 h-6 absolute left-3 top-1/2 transform -translate-y-1/2 rounded-full" />
                <ShimmerSkeleton className="h-10 w-full pl-10 rounded-md" />
              </div>

              <div className="flex gap-4">
                <ShimmerSkeleton className="h-10 w-40 rounded-md" />
                <ShimmerSkeleton className="h-10 w-40 rounded-md" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {Array.from({ length: 15 }).map((_, index) => (
              <MarketCardSkeleton key={index} index={index} />
            ))}
          </div>

          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <span>Loading prediction markets...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
