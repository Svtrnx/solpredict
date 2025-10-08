"use client"

import { useState, useEffect } from "react"

import Link from "next/link"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
  Award,
  ChevronDown,
  ChevronUp,
  Crown,
  Minus,
  Star,
  Target,
  Trophy,
  TrendingUp,
  User,
} from "lucide-react"


export default function LeaderboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState("all-time")
  const [isLoading, setIsLoading] = useState(true)
  const [leaderboardData, setLeaderboardData] = useState<any>(null)

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true)

      const mockData = {
        "all-time": [
          {
            rank: 1,
            prevRank: 1,
            address: "9WzD...AWWM",
            winRate: 89.2,
            totalBets: 342,
            volume: 127450,
            streak: 23,
            level: "Singularity",
            points: 15420,
            change: "same",
          },
          {
            rank: 2,
            prevRank: 3,
            address: "7Hj9...XY2K",
            winRate: 87.8,
            totalBets: 298,
            volume: "$98,230",
            streak: 18,
            level: "Oracle",
            levelColor: "from-green-400 to-green-500",
            points: 14890,
            change: "up",
          },
          {
            rank: 3,
            prevRank: 2,
            address: "5Kl2...MN8P",
            winRate: 86.5,
            totalBets: 445,
            volume: "$156,780",
            streak: 12,
            level: "Oracle",
            levelColor: "from-green-400 to-green-500",
            points: 14230,
            change: "down",
          },
          {
            rank: 4,
            prevRank: 4,
            address: "3Qw8...RT5L",
            username: "FutureSeeker",
            winRate: 84.3,
            totalBets: 267,
            volume: "$89,340",
            streak: 15,
            level: "Prophet",
            levelColor: "from-purple-500 to-purple-600",
            points: 13560,
            change: "same",
          },
        ],
        monthly: [
          {
            rank: 1,
            prevRank: 2,
            address: "7Hj9...XY2K",
            username: "DiamondHands",
            winRate: 92.1,
            totalBets: 45,
            volume: "$23,450",
            streak: 18,
            level: "Oracle",
            levelColor: "from-green-400 to-green-500",
            points: 2890,
            change: "up",
          },
        ],
        weekly: [
          {
            rank: 1,
            prevRank: 3,
            address: "1Pk7...HJ4M",
            username: "BetWizard",
            winRate: 95.0,
            totalBets: 12,
            volume: "$8,450",
            streak: 8,
            level: "Forecaster",
            levelColor: "from-cyan-400 to-cyan-500",
            points: 890,
            change: "up",
          },
        ],
      }

      setLeaderboardData(mockData)
      setIsLoading(false)
    }

    fetchLeaderboardData()
  }, [selectedPeriod])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Crown className="w-6 h-6 text-yellow-400" />
      case 2:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
      case 3:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
      default:
        return <span className="text-lg font-bold text-muted-foreground">#{rank}</span>
    }
  }

  const getChangeIcon = (change: string) => {
    switch (change) {
      case "up":
        return <ChevronUp className="w-4 h-4 text-accent" />
      case "down":
        return <ChevronDown className="w-4 h-4 text-destructive" />
      default:
        return <Minus className="w-4 h-4 text-muted-foreground" />
    }
  }

  const getRankBadgeColor = (level: string) => {
    switch (level) {
      case "Observer":
        return "bg-[#5B5B75] text-white"
      case "Forecaster":
        return "bg-[#40aacb] text-white"
      case "Prophet":
        return "bg-[#7C3AED] text-white"
      case "Oracle":
        return "bg-gradient-to-r from-[#894DEF] to-[#00FFA3] text-white"
      case "Singularity":
        return "bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400 text-white"
      default:
        return "bg-gradient-to-r from-gray-400 to-gray-600"
    }
  }

  const topThree = leaderboardData ? leaderboardData[selectedPeriod].slice(0, 3) : []
  const restOfLeaderboard = leaderboardData ? leaderboardData[selectedPeriod].slice(3) : []

  const renderTopThreeSkeleton = () => (
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

  const renderLeaderboardSkeleton = () => (
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

  const renderLevelSystemSkeleton = () => (
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

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>
      {/* <div
        style={{ zIndex: 0 }}
        className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse [animation-duration:6s]"
      ></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div> */}
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold gradient-text">Leaderboard</h1>
          <p className="text-xl text-muted-foreground">Compete with the best predictors in the galaxy</p>
        </div>
        <div className="flex justify-center">
          <Tabs value={selectedPeriod} onValueChange={setSelectedPeriod} className="w-full max-w-md">
            <TabsList className="glass w-full">
              <TabsTrigger value="all-time" className="flex-1">
                All Time
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex-1">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex-1">
                Weekly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        {isLoading ? (
          renderTopThreeSkeleton()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {topThree.map((user: any, index: any) => (
              <Card
                key={user.rank}
                className={`glass transition-all duration-300 transform hover:scale-105 relative ${
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
                      <Avatar className="w-20 h-20 mx-auto glow">
                        <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt={user.address} />
                        <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white text-lg font-bold">
                          {user.address.slice(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {index === 0 && (
                        <div className="absolute -top-2 -right-2 w-10 h-10 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse shadow-lg">
                          <Crown className="w-5 h-5 text-white" />
                        </div>
                      )}
                      {index === 1 && (
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-r from-gray-400 to-gray-600 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-sm">2</span>
                        </div>
                      )}
                      {index === 2 && (
                        <div className="absolute -top-1 -right-1 w-8 h-8 bg-gradient-to-r from-amber-500 to-amber-700 rounded-full flex items-center justify-center shadow-lg">
                          <span className="text-white font-bold text-sm">3</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <h3 className="text-xl font-bold mb-1">{user.address}</h3>
                  <Badge
                    variant="outline"
                    className={`mb-4 ${getRankBadgeColor(user.level)} border-transparent text-xs px-2 py-1`}
                  >
                    <Star className="w-3 h-3 mr-1" />
                    {user.level}
                  </Badge>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Points</span>
                      <span className="font-semibold gradient-text">{user.points.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Win Rate</span>
                      <span className="font-semibold gradient-text">{user.winRate}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Volume</span>
                      <span className="font-semibold">{user.volume}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Streak</span>
                      <span className="font-semibold flex items-center">
                        <Target className="w-3 h-3 mr-1" />
                        {user.streak}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
        {isLoading ? (
          renderLeaderboardSkeleton()
        ) : (
          <Card className="glass glow">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="w-5 h-5" />
                <span>Top Predictors</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {restOfLeaderboard.map((user: any) => (
                  <div key={user.rank} className="glass rounded-lg hover:glow-cyan transition-all duration-300">
                    <div className="hidden md:flex items-center justify-between p-4">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          <div className="w-8 h-8 flex items-center justify-center">{getRankIcon(user.rank)}</div>
                          {getChangeIcon(user.change)}
                        </div>
                        <div className="flex items-center space-x-3">
                          <Avatar className="w-10 h-10">
                            <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt={user.address} />
                            <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white text-sm font-bold">
                              {user.address.slice(0, 2).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="font-semibold font-mono">{user.address}</div>
                          </div>
                        </div>
                        <Badge variant="outline" className={`${getRankBadgeColor(user.level)} border-transparent`}>
                          {user.level}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-8 text-sm">
                        <div className="text-center">
                          <div className="font-semibold gradient-text">{user.winRate}%</div>
                          <div className="text-muted-foreground">Win Rate</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{user.totalBets}</div>
                          <div className="text-muted-foreground">Bets</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold">{user.volume}</div>
                          <div className="text-muted-foreground">Volume</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold flex items-center justify-center">
                            <Target className="w-3 h-3 mr-1" />
                            {user.streak}
                          </div>
                          <div className="text-muted-foreground">Streak</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold gradient-text">{user.points.toLocaleString()}</div>
                          <div className="text-muted-foreground">Points</div>
                        </div>
                      </div>
                    </div>
                    <div className="md:hidden p-3 space-y-2">
                      <div className="flex items-center space-x-2">
                        <div className="flex items-center space-x-1">
                          <div className="w-6 h-6 flex items-center justify-center text-sm">
                            {getRankIcon(user.rank)}
                          </div>
                          {getChangeIcon(user.change)}
                        </div>
                        <Avatar className="w-8 h-8">
                          <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt={user.address} />
                          <AvatarFallback className="bg-gradient-to-r from-purple-400 to-pink-400 text-white text-xs font-bold">
                            {user.address.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-sm truncate font-mono">{user.address}</div>
                        </div>
                        <Badge
                          variant="outline"
                          className={`${getRankBadgeColor(user.level)} border-transparent text-xs px-1 py-0.5 shrink-0`}
                        >
                          {user.level}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-center text-xs">
                        <div className="bg-background/50 rounded p-1.5">
                          <div className="font-semibold gradient-text">{user.winRate}%</div>
                          <div className="text-xs text-muted-foreground">Win Rate</div>
                        </div>
                        <div className="bg-background/50 rounded p-1.5">
                          <div className="font-semibold">{user.totalBets}</div>
                          <div className="text-xs text-muted-foreground">Bets</div>
                        </div>
                        <div className="bg-background/50 rounded p-1.5">
                          <div className="font-semibold gradient-text">{user.points.toLocaleString()}</div>
                          <div className="text-xs text-muted-foreground">Points</div>
                        </div>
                        <div className="bg-background/50 rounded p-1.5">
                          <div className="font-semibold flex items-center justify-center">
                            <Target className="w-2 h-2 mr-1" />
                            {user.streak}
                          </div>
                          <div className="text-xs text-muted-foreground">Streak</div>
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-xs text-muted-foreground">Volume: </span>
                        <span className="text-xs font-semibold text-foreground">{user.volume}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        {isLoading ? (
          renderLevelSystemSkeleton()
        ) : (
          <Card className="glass glow">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Award className="w-5 h-5" />
                <span>Level System</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                {[
                  { name: "Observer", color: "bg-[#5B5B75]", requirement: "0+ points" },
                  { name: "Forecaster", color: "bg-[#40aacb]", requirement: "1,000+ points" },
                  { name: "Prophet", color: "bg-[#7C3AED]", requirement: "5,000+ points" },
                  {
                    name: "Oracle",
                    color: "bg-gradient-to-r from-[#894DEF] to-[#00FFA3]",
                    requirement: "10,000+ points",
                  },
                  {
                    name: "Singularity",
                    color: "bg-gradient-to-r from-purple-400 via-pink-400 to-cyan-400",
                    requirement: "15,000+ points",
                  },
                ].map((level) => (
                  <div key={level.name} className="text-center space-y-2">
                    <div className={`w-12 h-12 rounded-full mx-auto ${level.color} glow`}></div>
                    <div className="font-semibold">{level.name}</div>
                    <div className="text-xs text-muted-foreground">{level.requirement}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
        <Card className="glass glow-cyan text-center">
          <CardContent className="pt-8 pb-8">
            <h2 className="text-3xl font-bold gradient-text mb-4">Ready to Climb the Ranks?</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Start making predictions and compete with the best in the galaxy
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4 px-4">
              <Link href="/" className="w-full sm:w-auto">
                <Button
                  size="lg"
                  className="w-full sm:w-auto gradient-bg text-white glow hover:glow-green transition-all duration-300 transform hover:scale-105"
                >
                  <TrendingUp className="w-5 h-5 mr-2" />
                  Start Predicting
                </Button>
              </Link>
              <Link href="/dashboard" className="w-full sm:w-auto">
                <Button variant="outline" size="lg" className="w-full sm:w-auto glass hover:glow bg-transparent">
                  <User className="w-5 h-5 mr-2" />
                  View Profile
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
