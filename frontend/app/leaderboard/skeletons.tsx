"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"

import { Award, Trophy } from "lucide-react"


export const renderTopThreeSkeleton = () => (
	<div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
		{[0, 1, 2].map((index) => (
		<Card
			key={index}
			className={`glass transition-all duration-300 ${
			index === 0
				? "glow order-2 md:order-2"
				: index === 1
				? "glow-cyan order-1 md:order-1"
				: "glow-green order-3 md:order-3"
			}`}
		>
			<CardContent className="pt-8 text-center">
			<div className="relative mb-4">
				<div className="relative">
				<ShimmerSkeleton className="w-20 h-20 rounded-full mx-auto" />
				{index === 0 && (
					<div className="absolute -top-2 -right-2 w-10 h-10 rounded-full">
					<PulseSkeleton className="w-10 h-10 rounded-full" delay={100} />
					</div>
				)}
				{(index === 1 || index === 2) && (
					<div className="absolute -top-1 -right-1 w-8 h-8 rounded-full">
					<PulseSkeleton className="w-8 h-8 rounded-full" delay={150} />
					</div>
				)}
				</div>
			</div>
			<PulseSkeleton className="h-6 w-28 mx-auto mb-1" delay={index * 150} />
			<div className="mb-4">
				<PulseSkeleton className="h-6 w-20 mx-auto rounded-full" delay={index * 150 + 100} />
			</div>
			<div className="space-y-3">
				{[
				{ label: "Points", width: "w-16" },
				{ label: "Win Rate", width: "w-12" },
				{ label: "Volume", width: "w-14" },
				{ label: "Streak", width: "w-8" },
				].map((stat, statIndex) => (
				<div key={statIndex} className="flex justify-between items-center">
					<PulseSkeleton className="h-4 w-16" delay={index * 150 + statIndex * 75} />
					<PulseSkeleton className={`h-4 ${stat.width}`} delay={index * 150 + statIndex * 75 + 50} />
				</div>
				))}
			</div>
			</CardContent>
		</Card>
		))}
	</div>
)

export const renderLeaderboardSkeleton = () => (
	<Card className="glass glow">
		<CardHeader>
		<CardTitle className="flex items-center space-x-2">
			<Trophy className="w-5 h-5" />
			<span>Top Predictors</span>
		</CardTitle>
		</CardHeader>
		<CardContent>
		<div className="space-y-3">
			{Array.from({ length: 7 }).map((_, index) => (
			<div key={index} className="glass rounded-lg">
				<div className="hidden md:flex items-center justify-between p-4">
				<div className="flex items-center space-x-4">
					<div className="flex items-center space-x-2">
					<PulseSkeleton className="w-8 h-8 rounded" delay={index * 120} />
					<PulseSkeleton className="w-4 h-4 rounded" delay={index * 120 + 50} />
					</div>
					<div className="flex items-center space-x-3">
					<ShimmerSkeleton className="w-10 h-10 rounded-full" />
					<PulseSkeleton className="h-5 w-32" delay={index * 120 + 100} />
					</div>
					<PulseSkeleton className="h-6 w-20 rounded-full" delay={index * 120 + 150} />
				</div>
				<div className="flex items-center space-x-8">
					{[
					{ width: "w-12", label: "Win Rate" },
					{ width: "w-8", label: "Bets" },
					{ width: "w-16", label: "Volume" },
					{ width: "w-6", label: "Streak" },
					{ width: "w-14", label: "Points" },
					].map((stat, statIndex) => (
					<div key={statIndex} className="text-center">
						<PulseSkeleton
						className={`h-5 ${stat.width} mx-auto mb-1`}
						delay={index * 120 + statIndex * 30}
						/>
						<PulseSkeleton className="h-3 w-12 mx-auto" delay={index * 120 + statIndex * 30 + 15} />
					</div>
					))}
				</div>
				</div>
				<div className="md:hidden p-3 space-y-3">
				<div className="flex items-center space-x-2">
					<div className="flex items-center space-x-1">
					<PulseSkeleton className="w-6 h-6 rounded" delay={index * 120} />
					<PulseSkeleton className="w-4 h-4 rounded" delay={index * 120 + 25} />
					</div>
					<ShimmerSkeleton className="w-8 h-8 rounded-full" />
					<div className="flex-1">
					<PulseSkeleton className="h-4 w-24" delay={index * 120 + 50} />
					</div>
					<PulseSkeleton className="h-5 w-16 rounded-full" delay={index * 120 + 75} />
				</div>
				<div className="grid grid-cols-2 gap-2">
					{[
					{ width: "w-10", label: "Win Rate" },
					{ width: "w-8", label: "Bets" },
					{ width: "w-12", label: "Points" },
					{ width: "w-6", label: "Streak" },
					].map((stat, statIndex) => (
					<div key={statIndex} className="bg-background/50 rounded p-2 text-center">
						<PulseSkeleton
						className={`h-4 ${stat.width} mx-auto mb-1`}
						delay={index * 120 + statIndex * 40}
						/>
						<PulseSkeleton className="h-3 w-12 mx-auto" delay={index * 120 + statIndex * 40 + 20} />
					</div>
					))}
				</div>
				<div className="text-center">
					<PulseSkeleton className="h-3 w-24 mx-auto" delay={index * 120 + 200} />
				</div>
				</div>
			</div>
			))}
		</div>
		</CardContent>
	</Card>
)

export const renderLevelSystemSkeleton = () => (
	<Card className="glass glow">
		<CardHeader>
		<CardTitle className="flex items-center space-x-2">
			<Award className="w-5 h-5" />
			<span>Level System</span>
		</CardTitle>
		</CardHeader>
		<CardContent>
		<div className="grid grid-cols-2 md:grid-cols-5 gap-4">
			{Array.from({ length: 5 }).map((_, index) => (
			<div key={index} className="text-center space-y-2">
				<div className="relative mx-auto w-12 h-12">
				<ShimmerSkeleton className="w-12 h-12 rounded-full mx-auto" />
				<div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse"></div>
				</div>
				<div className="space-y-2">
				<PulseSkeleton className="h-5 w-20 mx-auto" delay={index * 100} />
				<PulseSkeleton className="h-3 w-24 mx-auto" delay={index * 100 + 50} />
				</div>
			</div>
			))}
		</div>
		</CardContent>
	</Card>
)