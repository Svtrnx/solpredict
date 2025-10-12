"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar"
import { renderTopThreeSkeleton, renderLeaderboardSkeleton, renderLevelSystemSkeleton } from "./skeletons"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { getLeaderboard } from "@/lib/services/leaderboardService"
import type { LeaderboardPeriod, LeaderboardItem } from "@/lib/types"
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
  Check,
  Copy,
} from "lucide-react"

export default function LeaderboardPage() {
  const [selectedPeriod, setSelectedPeriod] = useState<LeaderboardPeriod>("all-time")
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const fetchLeaderboardData = async () => {
      setIsLoading(true)
      const resp = await getLeaderboard(selectedPeriod)
      console.log(resp.items)
      setLeaderboardData(resp.items)
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

  const topThree = leaderboardData.slice(0, 3)
  const restOfLeaderboard = leaderboardData.slice(3)

  const handleTabChange = (v: string) => {
    if (v === "all-time" || v === "monthly" || v === "weekly") {
      setSelectedPeriod(v)
    }
  }

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl animate-pulse delay-2000"></div>
      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center space-y-4"
        >
          <h1 className="text-5xl font-bold gradient-text">Leaderboard</h1>
          <p className="text-xl text-muted-foreground">Compete with the best predictors in the galaxy</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex justify-center"
        >
          <Tabs value={selectedPeriod} onValueChange={handleTabChange} className="w-full max-w-md">
            <TabsList className="glass w-full">
              <TabsTrigger value="all-time" className="flex-1 cursor-pointer">
                All Time
              </TabsTrigger>
              <TabsTrigger value="monthly" className="flex-1 cursor-pointer">
                Monthly
              </TabsTrigger>
              <TabsTrigger value="weekly" className="flex-1 cursor-pointer">
                Weekly
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </motion.div>

        {isLoading ? (
          renderTopThreeSkeleton()
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {topThree.map((user: any, index: any) => (
              <motion.div
                key={user.rank}
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 + index * 0.1 }}
              >
                <Card
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
                    <TooltipProvider delayDuration={200}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <h3 className="font-mono text-md mb-2 cursor-pointer hover:underline">
                            {user.address.length > 10
                              ? `${user.address.slice(0, 10)}...${user.address.slice(-10)}`
                              : user.address}
                          </h3>
                        </TooltipTrigger>
                        <TooltipContent className="p-2 bg-card border border-border">
                          <div className="flex flex-col gap-2 min-w-[200px]">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  handleCopy(user.address)
                                }}
                                className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                              >
                                {copied ? (
                                  <>
                                    <Check className="w-3 h-3 mr-1" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="w-3 h-3 mr-1" />
                                    Copy
                                  </>
                                )}
                              </Button>
                              <Button
                                asChild
                                variant="outline"
                                size="sm"
                                className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                              >
                                <Link href={`/profile/${user.address}`} target="_blank" rel="noopener noreferrer">
                                  <User className="w-3 h-3 mr-1" />
                                  Profile
                                </Link>
                              </Button>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
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
                        <span className="font-semibold">{user.volume.toFixed(1)}</span>
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
              </motion.div>
            ))}
          </div>
        )}

        {isLoading ? (
          renderLeaderboardSkeleton()
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.7 }}
          >
            <Card className="glass glow">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Trophy className="w-5 h-5" />
                  <span>Top Predictors</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {restOfLeaderboard.map((user: any, index: number) => (
                    <motion.div
                      key={user.rank}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.4, delay: 0.8 + index * 0.05 }}
                      className="glass rounded-lg hover:glow-cyan transition-all duration-300"
                    >
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
                    </motion.div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {isLoading ? (
          renderLevelSystemSkeleton()
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 1 }}
          >
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
          </motion.div>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
        >
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
                    className="w-full cursor-pointer sm:w-auto gradient-bg text-white glow hover:glow-green transition-all duration-300 transform hover:scale-105"
                  >
                    <TrendingUp className="w-5 h-5 mr-2" />
                    Start Predicting
                  </Button>
                </Link>
                <Link href="/dashboard" className="w-full sm:w-auto">
                  <Button
                    variant="outline"
                    size="lg"
                    className="w-full cursor-pointer sm:w-auto glass hover:glow bg-transparent"
                  >
                    <User className="w-5 h-5 mr-2" />
                    View Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}
