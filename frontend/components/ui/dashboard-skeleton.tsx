import { Skeleton, ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"

export function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>
      {/* <div
        style={{ zIndex: 0 }}
        className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse [animation-duration:6s]"
      ></div> */}
      {/* <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div> */}

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User Profile Card */}
          <Card className="glass glow relative overflow-hidden">
            {/* <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div> */}
            <CardContent className="pt-6 relative z-10">
              <div className="flex flex-col items-center space-y-4">
                <div className="relative">
                  <ShimmerSkeleton className="w-24 h-24 rounded-full bg-gradient-to-r border" />
                  <PulseSkeleton
                    className="absolute -bottom-2 -right-2 w-12 h-6 rounded-full bg-gradient-to-r from-zink-400 to-dark-500"
                    delay={200}
                  />
                </div>

                <div className="text-center space-y-3 w-full">
                  <div className="flex items-center space-x-2 justify-center">
                    <PulseSkeleton className="h-4 w-28" delay={300} />
                    <PulseSkeleton className="h-6 w-6 rounded" delay={400} />
                  </div>

                  <ShimmerSkeleton className="h-8 w-36 mx-auto rounded-full bg-gradient-to-r border" />

                  <div className="w-full space-y-3">
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <PulseSkeleton className="h-3 w-24" delay={500} />
                        <PulseSkeleton className="h-3 w-20" delay={600} />
                      </div>
                      <div className="relative">
                        <Skeleton className="h-3 w-full rounded-full bg-gray-800/50" />
                        <ShimmerSkeleton className="absolute inset-0 h-3 rounded-full" />
                      </div>
                    </div>

                    <div className="bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3 border border-orange-500/30 relative overflow-hidden">
                      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-400/10 to-transparent animate-pulse"></div>
                      <div className="flex items-center justify-center space-x-3 relative z-10">
                        <div className="flex items-center space-x-2">
                          <PulseSkeleton className="w-3 h-3 rounded-full bg-orange-400/30" delay={700} />
                          <PulseSkeleton className="w-5 h-5 rounded-full bg-orange-400/20" delay={750} />
                        </div>
                        <PulseSkeleton className="h-6 w-8 bg-orange-400/30" delay={800} />
                        <PulseSkeleton className="h-4 w-20 bg-orange-300/20" delay={850} />
                        <PulseSkeleton className="w-6 h-6 rounded-full bg-orange-400/30" delay={900} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-center space-y-2">
                    <div className="flex items-center space-x-2">
                      <PulseSkeleton className="h-3 w-24" delay={950} />
                      <div className="flex -space-x-1">
                        {[...Array(4)].map((_, i) => (
                          <ShimmerSkeleton key={i} className="w-6 h-6 rounded-full border-2 border-background" />
                        ))}
                      </div>
                    </div>
                    <PulseSkeleton className="h-3 w-36" delay={1000} />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Stats Card */}
          <Card className="glass glow-cyan relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10"></div>
            <CardContent className="pt-6 relative z-10">
              <div className="space-y-6">
                <div className="text-center pb-4 border-b border-white/10">
                  <ShimmerSkeleton className="h-8 w-28 mx-auto mb-2" />
                  <PulseSkeleton className="h-4 w-24 mx-auto" delay={200} />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div
                      key={i}
                      className="bg-white/5 rounded-lg p-4 border border-white/10 hover:border-white/20 transition-all duration-300 relative overflow-hidden"
                    >
                      <div
                        className={`absolute inset-0 bg-gradient-to-br ${
                          i === 0
                            ? "from-green-500/5 to-emerald-500/5"
                            : i === 1
                              ? "from-yellow-500/5 to-orange-500/5"
                              : i === 2
                                ? "from-purple-500/5 to-pink-500/5"
                                : "from-cyan-500/5 to-blue-500/5"
                        }`}
                      ></div>
                      <div className="relative z-10">
                        <div className="flex items-center space-x-2 mb-3">
                          <ShimmerSkeleton
                            className={`w-8 h-8 rounded-full ${
                              i === 0
                                ? "bg-green-500/20"
                                : i === 1
                                  ? "bg-yellow-500/20"
                                  : i === 2
                                    ? "bg-purple-500/20"
                                    : "bg-cyan-500/20"
                            }`}
                          />
                          <PulseSkeleton className="h-3 w-16" delay={i * 100} />
                        </div>
                        <div className="space-y-2">
                          <div className="flex items-baseline space-x-2">
                            <ShimmerSkeleton className="h-6 w-20" />
                            <PulseSkeleton className="h-3 w-12" delay={i * 100 + 50} />
                          </div>
                          <div className="relative">
                            <Skeleton className="h-2 w-full rounded-full bg-gray-800/50" />
                            <div
                              className={`absolute inset-0 h-2 rounded-full bg-gradient-to-r ${
                                i === 0
                                  ? "from-green-400/30 to-emerald-500/30"
                                  : i === 1
                                    ? "from-yellow-400/30 to-orange-500/30"
                                    : i === 2
                                      ? "from-purple-400/30 to-pink-500/30"
                                      : "from-cyan-400/30 to-blue-500/30"
                              } animate-pulse`}
                              style={{ width: `${60 + i * 10}%` }}
                            ></div>
                          </div>
                          <PulseSkeleton className="h-3 w-24" delay={i * 100 + 100} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <div className="glass rounded-lg p-1 inline-flex space-x-1 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-pulse"></div>
            {["Active Bets", "History", "Achievements"].map((_, i) => (
              <div key={i} className="px-4 py-2 rounded-md relative">
                <ShimmerSkeleton className={`h-4 ${i === 0 ? "w-20" : i === 1 ? "w-16" : "w-24"}`} />
                {i === 0 && <div className="absolute inset-0 bg-purple-500/10 rounded-md animate-pulse"></div>}
              </div>
            ))}
          </div>

          {/* Content Skeleton */}
          <ProfileActiveBetsSkeleton />
        </div>
      </div>
    </div>
  )
}


export function ProfileActiveBetsSkeleton() {
  return (
    <div className="space-y-4">
      {[...Array(8)].map((_, i) => (
        <Card key={i} className="glass glow relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/5 via-transparent to-cyan-500/5"></div>
          <CardContent className="pt-6 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2 space-y-3">
                <ShimmerSkeleton className="h-5 w-full" />
                <div className="flex items-center space-x-2">
                  <PulseSkeleton
                    className="h-6 w-16 rounded-full bg-emerald-500/20 border border-emerald-500/30"
                    delay={i * 200}
                  />
                  <PulseSkeleton
                    className="h-6 w-16 rounded-full bg-red-500/20 border border-red-500/30"
                    delay={i * 200 + 100}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <PulseSkeleton className="h-6 w-12 rounded-full bg-purple-500/20" delay={i * 200 + 200} />
                  <PulseSkeleton className="h-4 w-20" delay={i * 200 + 300} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between">
                  <PulseSkeleton className="h-3 w-8" delay={i * 200 + 400} />
                  <PulseSkeleton className="h-4 w-16" delay={i * 200 + 500} />
                </div>
                <div className="flex justify-between">
                  <PulseSkeleton className="h-3 w-12" delay={i * 200 + 600} />
                  <PulseSkeleton className="h-4 w-20" delay={i * 200 + 700} />
                </div>
                <div className="relative">
                  <Skeleton className="h-2 w-full rounded-full bg-gray-800/50" />
                  <div
                    className="absolute inset-0 h-2 rounded-full bg-gradient-to-r from-green-400/30 to-purple-500/30 animate-pulse"
                    style={{ width: `${40 + i * 20}%` }}
                  ></div>
                </div>
              </div>

              <div className="flex flex-col space-y-2">
                <PulseSkeleton className="h-4 w-16" delay={i * 200 + 800} />
                <ShimmerSkeleton className="h-8 w-full rounded border border-white/10 mt-1" />
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}