"use client"

import { useMemo, useState } from "react"

import { Copy, Shield, Star, Flame, TrendingUp, History, Trophy } from "lucide-react"
import type { Achievement } from "@/lib/achievements-data"
import { useBetsQuery } from "@/hooks/useBetsQuery"
import { motion } from "framer-motion"

import { DashboardSkeleton, ProfileActiveBetsSkeleton } from "@/components/ui/dashboard-skeleton"
import { ActiveBetsTab } from "@/components/shared/active-bets-tab"
import { HistoryBetsTab } from "@/components/shared/history-tab"
import AchievementIcons from "@/components/ui/achievement-icons"
import { StatsCard } from "@/components/shared/stats-card"

import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { TIERS } from "@/lib/constants/profile"
import { Badge } from "@/components/ui/badge"
import { getLevelColor } from "@/lib/utils"

// -------------------- Types --------------------

export type PublicProfile = {
  address: string
  totalVolume: number
  winRate: number
  winRateChange: number
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
  displayAddress?: string
  wallet?: string
}

export type PrivateOverview = PublicProfile & {}

// -------------------- Helpers --------------------

const getRarityColor = (rarity: string) => {
  const colors = {
    Common: "text-gray-400",
    Rare: "text-blue-400",
    Epic: "text-purple-400",
    Legendary: "text-yellow-400",
    Mythic: "text-cyan-400",
  }
  return colors[rarity as keyof typeof colors] || "text-gray-400"
}

const getStreakStyle = (streak: number) => {
  if (streak >= 10) return "border-orange-500/30 bg-orange-500/5"
  if (streak >= 5) return "border-amber-500/30 bg-amber-500/5"
  return "border-border bg-muted/30"
}

function getLevelInfoByPoints(points: number) {
  const idx = TIERS.findIndex((t) => points < t.max) === -1 ? TIERS.length - 1 : TIERS.findIndex((t) => points < t.max)

  const tier = TIERS[idx]
  const next = TIERS[idx + 1]

  return {
    level: tier.name,
    color: getLevelColor(tier.name),
    lowerBound: tier.min,
    upperBound: tier.max,
    nextLevel: next?.name ?? null,
  }
}

const getStreakIconColor = (streak: number) => {
  if (streak >= 10) return "text-orange-500"
  if (streak >= 5) return "text-amber-500"
  return "text-muted-foreground"
}
// -------------------- Component --------------------

export default function ProfileScreen({
  wallet,
  isOwner,
  publicData,
  privateData,
}: {
  wallet: string | undefined
  isOwner: boolean
  publicData: PublicProfile | null
  privateData: PrivateOverview | null
}) {
  const user = privateData ?? publicData
  const activeQ = useBetsQuery({ wallet, kind: "active", pageSize: 10 })
  const historyQ = useBetsQuery({ wallet, kind: "history", pageSize: 10 })

  const activeItems = useMemo(() => activeQ.data?.pages.flatMap((p: any) => p.items) ?? [], [activeQ.data])
  const historyItems = useMemo(() => historyQ.data?.pages.flatMap((p: any) => p.items) ?? [], [historyQ.data])

  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [activeTab, setActiveTab] = useState<"active" | "history" | "achievements">("active")
  const [copiedAddress, setCopiedAddress] = useState(false)

  function LoadMoreButton({ query }: { query: ReturnType<typeof useBetsQuery> }) {
    if (!query.hasNextPage) return null
    return (
      <div className="flex justify-center mt-4">
        <Button
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
          variant="secondary"
          className="min-w-[160px]"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      </div>
    )
  }
  const sortedActiveBets = useMemo(() => {
    const getTimeInHours = (endDate?: string | null) => {
      if (!endDate) return Number.MAX_SAFE_INTEGER
      const s = endDate.toLowerCase()

      if (s.endsWith("h")) return Number.parseInt(s) || Number.MAX_SAFE_INTEGER
      if (s.endsWith("d")) return (Number.parseInt(s) || 0) * 24
      if (s.endsWith("w")) return (Number.parseInt(s) || 0) * 24 * 7
      if (s.endsWith("m")) return (Number.parseInt(s) || 0) * 24 * 30

      const t = Date.parse(endDate)
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : (t - Date.now()) / 36e5
    }

    return [...activeItems].sort((a, b) => getTimeInHours(a.endDate) - getTimeInHours(b.endDate))
  }, [activeItems])

  const levelInfo = getLevelInfoByPoints(user?.points ?? 0)
  const xpProgress = (() => {
    const points = user?.points ?? 0
    const { lowerBound, upperBound } = levelInfo

    const current = Math.max(0, Math.min(points, upperBound) - lowerBound)

    const isCapped = upperBound === Number.POSITIVE_INFINITY
    const max = isCapped ? current : upperBound - lowerBound
    const percentage = isCapped ? 100 : max > 0 ? (current / max) * 100 : 0

    return { current, max, percentage, isCapped }
  })()

  const copyAddress = () => {
    if (!user?.address) return
    navigator.clipboard.writeText(user.address)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  if (!user) {
    return <DashboardSkeleton />
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
        <div className="absolute inset-0 radial-glow"></div>

        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              <Card className="glass glow relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div>
                <CardContent className="pt-6 relative z-10">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt="User" />
                        <AvatarFallback>U</AvatarFallback>
                      </Avatar>
                      <Badge
                        variant="secondary"
                        className="border-background absolute -bottom-0.5 left-full min-w-5 -translate-x-8 px-2"
                      >
                        #{user.rank}
                      </Badge>
                    </div>

                    <div className="text-center space-y-3 w-full">
                      <div className="flex items-center ml-8 space-x-2 justify-center">
                        <span
                          onClick={copyAddress}
                          className="cursor-pointer font-mono text-sm hover:text-[#a9a9a9] transition-colors"
                        >
                          {user.address}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyAddress}
                          className="cursor-pointer h-6 w-6 p-0 hover:bg-white/10"
                        >
                          {copiedAddress ? (
                            <span className="text-xs text-accent">✓</span>
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                        </Button>
                      </div>

                      <div className="relative">
                        <Badge
                          className="
                            inline-flex items-center gap-1.5 rounded-full
                            border border-white/20 bg-white/[0.05] backdrop-blur
                            text-white/[0.90]
                            px-2.5 py-1 text-sm font-medium
                            shadow-[0_4px_20px_-8px_rgba(124,58,237,0.35)]
                            ring-1 ring-inset ring-purple-500/20
                            transition-colors duration-200
                            hover:bg-white/[0.055] hover:text-white/[0.93]
                            hover:ring-purple-500/[0.24] hover:border-white/[0.12]"
                        >
                          <Star className="w-3.5 h-3.5 text-purple-300" />
                          {user.level}
                        </Badge>
                      </div>

                      <div className="w-full space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {xpProgress.current.toLocaleString()}/
                              {xpProgress.isCapped ? "MAX" : xpProgress.max.toLocaleString()} XP
                            </span>
                            <span className="text-accent font-medium">
                              {levelInfo.nextLevel ? `→ ${levelInfo.nextLevel}` : "MAX"}
                            </span>
                          </div>
                          <div className="relative">
                            <Progress value={xpProgress.percentage} className="h-3 bg-gray-800/50" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50 rounded-full"></div>
                          </div>
                        </div>

                        <div
                          className={`flex items-center justify-between text-sm rounded-md px-4 py-2.5 border transition-all duration-300 ${getStreakStyle(user.streak)}`}
                        >
                          <span className="text-muted-foreground font-medium">Win Streak</span>
                          <div className="flex items-center gap-2.5">
                            <div className="relative">
                              <Flame className={`w-4 h-4 ${getStreakIconColor(user.streak)} transition-colors`} />
                              {user.streak >= 5 && (
                                <div
                                  className={`absolute inset-0 ${getStreakIconColor(user.streak)} opacity-20 blur-sm`}
                                >
                                  <Flame className="w-4 h-4" />
                                </div>
                              )}
                            </div>
                            <span className="text-foreground font-bold tabular-nums text-base">{user.streak}</span>
                            {user.streak >= 10 && (
                              <Badge
                                variant="secondary"
                                className="ml-1 px-1.5 py-0 text-[10px] font-bold border-orange-500/30 bg-orange-500/10 text-orange-600"
                              >
                                HOT
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col items-center space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className="text-xs text-muted-foreground">Achievements</span>
                          <AchievementIcons />
                        </div>
                        <p className="text-sm text-muted-foreground">Member since {user.joinDate}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 }}
            >
              <StatsCard stats={user} />
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
          >
            <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
              <TabsList className="glass">
                <TabsTrigger className="cursor-pointer" value="active">
                  Active Bets
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="history">
                  History
                </TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="achievements">
                  Achievements
                </TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {activeQ.isLoading && activeItems.length === 0 ? (
                  <ProfileActiveBetsSkeleton />
                ) : sortedActiveBets.length === 0 ? (
                  <Empty className="glass border-dashed">
                    <EmptyHeader>
                      <EmptyMedia>
                        <TrendingUp className="h-12 w-12 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>No Active Bets</EmptyTitle>
                      <EmptyDescription>
                        {isOwner
                          ? "You don't have any active bets yet. Start placing bets to see them here."
                          : "This user doesn't have any active bets at the moment."}
                      </EmptyDescription>
                    </EmptyHeader>
                    {isOwner && (
                      <EmptyContent>
                        <Button className="cursor-pointer">
                          <TrendingUp className="w-4 h-4" />
                          Explore Markets
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                ) : (
                  <>
                    <ActiveBetsTab activeBets={sortedActiveBets} isOwner={isOwner} />
                    <LoadMoreButton query={activeQ} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {historyQ.isLoading && historyItems.length === 0 ? (
                  <div className="space-y-4">
                    {[...Array(8)].map((_, i) => (
                      <Card key={i} className="glass animate-pulse">
                        <CardContent className="pt-6">
                          <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                            <div className="lg:col-span-2 space-y-2">
                              <div className="h-4 bg-muted rounded w-3/4"></div>
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded w-full"></div>
                              <div className="h-3 bg-muted rounded w-2/3"></div>
                            </div>
                            <div className="space-y-2">
                              <div className="h-3 bg-muted rounded w-1/2"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : historyItems.length === 0 ? (
                  <Empty className="glass border-dashed">
                    <EmptyHeader>
                      <EmptyMedia>
                        <History className="h-12 w-12 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>No Bet History</EmptyTitle>
                      <EmptyDescription>
                        {isOwner
                          ? "Your completed bets will appear here once they're resolved."
                          : "This user hasn't completed any bets yet."}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                ) : (
                  <>
                    <HistoryBetsTab historyBets={historyItems} />
                    <LoadMoreButton query={historyQ} />
                  </>
                )}
              </TabsContent>

              <TabsContent value="achievements" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4 }}
                  className="text-center mb-8"
                >
                  <h2 className="text-3xl font-bold gradient-text mb-2">Achievement Gallery</h2>
                  <p className="text-muted-foreground">Collect badges and NFTs as you master the art of prediction</p>
                </motion.div>

                {achievements.length === 0 ? (
                  <Empty className="glass border-dashed">
                    <EmptyHeader>
                      <EmptyMedia>
                        <Trophy className="h-12 w-12 text-muted-foreground" />
                      </EmptyMedia>
                      <EmptyTitle>No Achievements Yet</EmptyTitle>
                      <EmptyDescription>
                        {isOwner
                          ? "Start placing bets and winning to unlock exclusive achievement badges and NFTs."
                          : "This user hasn't unlocked any achievements yet."}
                      </EmptyDescription>
                    </EmptyHeader>
                    {isOwner && (
                      <EmptyContent>
                        <Button variant="outline">
                          <Trophy className="w-4 h-4" />
                          View All Achievements
                        </Button>
                      </EmptyContent>
                    )}
                  </Empty>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements.map((badge, index) => {
                      const IconComponent = badge.icon
                      return (
                        <motion.div
                          key={badge.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.5, delay: index * 0.05 }}
                        >
                          <Dialog>
                            <DialogTrigger asChild>
                              <Card
                                className={`glass transition-all duration-300 cursor-pointer group ${
                                  badge.earned
                                    ? "glow hover:glow-cyan transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20"
                                    : "opacity-50 hover:opacity-75"
                                }`}
                              >
                                <CardContent className="pt-6 text-center relative">
                                  {badge.earned && (
                                    <div className="absolute top-2 right-2">
                                      <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded-full border border-purple-500/30">
                                        <Shield className="w-3 h-3 text-purple-400" />
                                        <span className="text-xs text-purple-400 font-medium">NFT</span>
                                      </div>
                                    </div>
                                  )}

                                  <div
                                    className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center relative ${
                                      badge.earned ? `bg-gradient-to-r ${badge.gradient} glow` : "bg-muted"
                                    }`}
                                  >
                                    {badge.earned ? (
                                      <IconComponent className="w-10 h-10 text-white relative z-10" />
                                    ) : (
                                      <IconComponent className="w-10 h-10 text-muted-foreground" />
                                    )}
                                  </div>

                                  <h3 className="font-semibold mb-1 group-hover:text-cyan-400 transition-colors duration-300">
                                    {badge.name}
                                  </h3>
                                  <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                                  <Badge
                                    variant="outline"
                                    className={`${
                                      badge.earned
                                        ? `bg-gradient-to-r ${badge.gradient} text-white border-transparent`
                                        : "glass"
                                    }`}
                                  >
                                    <Star className="w-3 h-3 mr-1" />
                                    {badge.rarity}
                                  </Badge>
                                </CardContent>
                              </Card>
                            </DialogTrigger>

                            <DialogContent className="glass max-w-md mx-auto">
                              <DialogHeader>
                                <DialogTitle className="text-center">
                                  <div className="flex flex-col items-center space-y-4">
                                    <div
                                      className={`w-24 h-24 rounded-full flex items-center justify-center relative ${
                                        badge.earned ? `bg-gradient-to-r ${badge.gradient} glow` : "bg-muted"
                                      }`}
                                    >
                                      {badge.earned ? (
                                        <IconComponent className="w-12 h-12 text-white" />
                                      ) : (
                                        <IconComponent className="w-12 h-12 text-muted-foreground" />
                                      )}
                                      {badge.earned && (
                                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                                      )}
                                    </div>
                                    <div className="space-y-2">
                                      <h3 className="text-xl font-bold">{badge.name}</h3>
                                      <Badge
                                        variant="outline"
                                        className={`${getRarityColor(badge.rarity)} border-current`}
                                      >
                                        <Star className="w-3 h-3 mr-1" />
                                        {badge.rarity}
                                      </Badge>
                                    </div>
                                  </div>
                                </DialogTitle>
                              </DialogHeader>

                              <div className="space-y-4 text-center">
                                <p className="text-muted-foreground">{badge.detailedDescription}</p>

                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">Unlocked by</div>
                                    <div className="font-semibold text-accent">{badge.unlockedBy} of players</div>
                                  </div>
                                  <div className="space-y-1">
                                    <div className="text-muted-foreground">NFT ID</div>
                                    <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">{badge.nftId}</div>
                                  </div>
                                </div>

                                {badge.earned && badge.earnedDate && (
                                  <div className="pt-2 border-t border-muted">
                                    <div className="text-sm text-muted-foreground">Earned on</div>
                                    <div className="font-semibold text-accent">{badge.earnedDate}</div>
                                  </div>
                                )}

                                {!badge.earned && (
                                  <div className="pt-2 border-t border-muted">
                                    <div className="text-sm text-muted-foreground">Status</div>
                                    <div className="font-semibold text-yellow-400">Not yet unlocked</div>
                                  </div>
                                )}
                              </div>
                            </DialogContent>
                          </Dialog>
                        </motion.div>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </motion.div>
        </div>
      </div>
    </TooltipProvider>
  )
}
