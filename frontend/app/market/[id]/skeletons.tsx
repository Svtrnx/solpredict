import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"

export const CountdownSkeleton = () => (
  <Card className="glass glow">
	<CardContent className="pt-6">
	  <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
		<div className="flex items-center space-x-2">
		  <PulseSkeleton className="w-5 h-5 rounded-full" />
		  <PulseSkeleton className="h-4 w-32" delay={100} />
		</div>
		<div className="flex space-x-2 sm:space-x-4">
		  {Array.from({ length: 4 }).map((_, index) => (
			<div key={index} className="text-center">
			  <ShimmerSkeleton className="h-8 w-12 mb-2" />
			  <PulseSkeleton className="h-3 w-12" delay={index * 50} />
			</div>
		  ))}
		</div>
	  </div>
	</CardContent>
  </Card>
)

export const PriceCardSkeleton = ({ isYes }: { isYes: boolean }) => (
  <Card className={`glass relative overflow-hidden ${isYes ? "glow-green" : "glow"}`}>
	<div
	  className={`absolute inset-0 bg-gradient-to-br ${
		isYes ? "from-green-500/10 via-transparent to-green-600/5" : "from-red-500/10 via-transparent to-red-600/5"
	  }`}
	></div>
	<CardHeader className="relative z-10">
	  <div className="flex items-center justify-between">
		<PulseSkeleton className="h-6 w-8" />
		<PulseSkeleton className="w-5 h-5 rounded-full" delay={100} />
	  </div>
	</CardHeader>
	<CardContent className="relative z-10 text-center space-y-4">
	  <ShimmerSkeleton className="h-12 w-20 mx-auto" />
	  <PulseSkeleton className="h-4 w-24 mx-auto" delay={200} />
	  <PulseSkeleton className="h-3 w-20 mx-auto" delay={300} />
	</CardContent>
  </Card>
)

export const BettingCardSkeleton = () => (
  <Card className="glass glow-cyan">
	<CardHeader>
	  <div className="flex items-center justify-between">
		<PulseSkeleton className="h-6 w-32" />
		<div className="flex items-center space-x-2">
		  <PulseSkeleton className="w-4 h-4 rounded-full" />
		  <PulseSkeleton className="h-4 w-20" delay={100} />
		</div>
	  </div>
	</CardHeader>
	<CardContent className="space-y-6">
	  <div className="grid grid-cols-2 gap-4">
		<ShimmerSkeleton className="h-16 rounded-lg" />
		<ShimmerSkeleton className="h-16 rounded-lg" />
	  </div>

	  <div className="space-y-4">
		<div className="flex items-center justify-between">
		  <PulseSkeleton className="h-4 w-24" />
		  <PulseSkeleton className="h-4 w-8" delay={100} />
		</div>
		<ShimmerSkeleton className="h-12 rounded-lg" />
		<div className="flex space-x-2">
		  {Array.from({ length: 4 }).map((_, index) => (
			<PulseSkeleton key={index} className="h-8 flex-1" delay={index * 50} />
		  ))}
		</div>
	  </div>

	  <ShimmerSkeleton className="h-14 w-full rounded-lg" />
	</CardContent>
  </Card>
)

export const ChartSkeleton = () => (
  <Card className="glass glow relative overflow-hidden">
	<CardHeader className="relative z-10">
	  <div className="flex items-center justify-between">
		<div className="flex items-center space-x-2">
		  <PulseSkeleton className="w-5 h-5 rounded-full" />
		  <PulseSkeleton className="h-6 w-48" delay={100} />
		</div>
		<PulseSkeleton className="h-5 w-20 rounded-full" delay={200} />
	  </div>
	</CardHeader>
	<CardContent className="relative z-10">
	  <div className="space-y-6">
		<div className="flex items-center justify-center space-x-8">
		  <div className="flex items-center space-x-2">
			<PulseSkeleton className="w-3 h-3 rounded-full" />
			<PulseSkeleton className="h-4 w-24" delay={50} />
		  </div>
		  <div className="flex items-center space-x-2">
			<PulseSkeleton className="w-3 h-3 rounded-full" />
			<PulseSkeleton className="h-4 w-32" delay={100} />
		  </div>
		</div>

		<div className="h-80 w-full relative overflow-hidden rounded-lg bg-white/5">
		  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent animate-shimmer"></div>
		  <div className="absolute bottom-4 left-4 right-4 top-4">
			<div className="absolute left-0 top-0 bottom-0 flex flex-col justify-between">
			  {Array.from({ length: 5 }).map((_, index) => (
				<PulseSkeleton key={index} className="h-3 w-8" delay={index * 30} />
			  ))}
			</div>
			<div className="absolute bottom-0 left-8 right-0 flex justify-between">
			  {Array.from({ length: 8 }).map((_, index) => (
				<PulseSkeleton key={index} className="h-3 w-8" delay={index * 40} />
			  ))}
			</div>
			<div className="absolute left-8 right-4 top-4 bottom-8">
			  <svg className="w-full h-full opacity-30">
				<defs>
				  <linearGradient id="skeletonGradient1" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="transparent" />
					<stop offset="50%" stopColor="rgba(6, 182, 212, 0.3)" />
					<stop offset="100%" stopColor="transparent" />
				  </linearGradient>
				  <linearGradient id="skeletonGradient2" x1="0%" y1="0%" x2="100%" y2="0%">
					<stop offset="0%" stopColor="transparent" />
					<stop offset="50%" stopColor="rgba(16, 185, 129, 0.3)" />
					<stop offset="100%" stopColor="transparent" />
				  </linearGradient>
				</defs>
				<path
				  d="M0,60 Q50,40 100,50 T200,45 T300,35"
				  stroke="url(#skeletonGradient1)"
				  strokeWidth="2"
				  fill="none"
				  className="animate-pulse"
				/>
				<path
				  d="M0,80 Q50,70 100,65 T200,55 T300,45"
				  stroke="url(#skeletonGradient2)"
				  strokeWidth="2"
				  fill="none"
				  className="animate-pulse"
				  style={{ animationDelay: "0.5s" }}
				/>
			  </svg>
			</div>
		  </div>
		</div>

		<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
		  {Array.from({ length: 3 }).map((_, index) => (
			<div key={index} className="glass p-4 rounded-lg text-center">
			  <ShimmerSkeleton className="h-6 w-12 mx-auto mb-1" />
			  <PulseSkeleton className="h-3 w-20 mx-auto" delay={index * 100} />
			</div>
		  ))}
		</div>
	  </div>
	</CardContent>
  </Card>
)

export const InsightsSkeleton = () => (
  <Card className="glass glow">
	<CardHeader>
	  <PulseSkeleton className="h-6 w-32" />
	</CardHeader>
	<CardContent>
	  <div className="space-y-4">
		<div className="grid grid-cols-3 gap-2 glass rounded-lg p-1">
		  {Array.from({ length: 3 }).map((_, index) => (
			<PulseSkeleton key={index} className="h-8 rounded-md" delay={index * 50} />
		  ))}
		</div>

		<div className="space-y-4 mt-4">
		  {Array.from({ length: 4 }).map((_, index) => (
			<div key={index} className="flex justify-between">
			  <PulseSkeleton className="h-4 w-24" delay={index * 50} />
			  <PulseSkeleton className="h-4 w-16" delay={index * 50 + 100} />
			</div>
		  ))}
		</div>
	  </div>
	</CardContent>
  </Card>
)

export const AIVsHumansSkeleton = () => (
  <Card className="glass glow-cyan">
    <CardHeader>
      <div className="flex items-center space-x-2">
        <PulseSkeleton className="w-5 h-5 rounded-full" />
        <PulseSkeleton className="h-6 w-24" delay={100} />
      </div>
    </CardHeader>
    <CardContent className="space-y-6">
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
        <div className="glass p-3 rounded-lg">
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