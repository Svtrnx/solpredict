"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { Copy,Crown, Shield, Star, Target} from "lucide-react"

import { getAchievements, type Achievement } from "@/lib/achievements-data"
import { useAppSelector } from "@/lib/hooks"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { WalletAuthorizationGuard } from "@/components/wallet-authorization-guard"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton"
import { ActiveBetsTab } from "@/components/shared/active-bets-tab"
import { HistoryBetsTab } from "@/components/shared/history-tab"
import AchievementIcons from "@/components/ui/achievement-icons"
import { StatsCard } from "@/components/shared/stats-card"
import { TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"



interface UserData {
  address: string
  displayAddress: string
  totalVolume: string
  winRate: number
  winRateChange: string
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
}

interface BetData {
  id: string
  question: string
  side: "YES" | "NO"
  amount: number
  currentPrice?: number
  entryPrice?: number
  pnl: string
  pnlAmount?: string
  timeLeft?: string
  status?: "winning" | "losing"
  trend?: "up" | "down"
  result?: "WON" | "LOST"
  payout?: string
  resolvedDate?: string
}

const getLevelInfo = (points: number) => {
  if (points >= 10000)
    return { level: "Singularity", color: "from-purple-400 to-pink-600", nextLevel: null, nextThreshold: null }
  if (points >= 5000)
    return { level: "Oracle", color: "from-blue-400 to-purple-600", nextLevel: "Singularity", nextThreshold: 10000 }
  if (points >= 1000)
    return { level: "Prophet", color: "from-green-400 to-blue-600", nextLevel: "Oracle", nextThreshold: 5000 }
  if (points >= 0)
    return { level: "Forecaster", color: "from-yellow-400 to-orange-600", nextLevel: "Prophet", nextThreshold: 1000 }
  return { level: "Observer", color: "from-gray-400 to-gray-600", nextLevel: "Forecaster", nextThreshold: 1000 }
}

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

interface PaginationState {
  currentPage: number
  totalPages: number
  itemsPerPage: number
  totalItems: number
}

const fetchPaginatedBets = async (
  type: "active" | "history",
  page: number,
  itemsPerPage = 5,
): Promise<{ data: BetData[]; totalItems: number; totalPages: number }> => {

  // Mock data
  const generateActiveBets = (count: number): BetData[] => {
    const questions = [
      "Will BTC hit $100k by 2026?",
      "Will Solana reach $500 in 2025?",
      "Will AI replace 50% of jobs by 2030?",
      "Will Tesla stock hit $300 in Q4 2024?",
      "Will inflation drop below 2% in 2024?",
      "Will OpenAI release GPT-5 in 2024?",
      "Will Ethereum reach $5000 by end of 2025?",
      "Will Apple stock hit $250 in 2025?",
      "Will unemployment rate drop below 3% in 2025?",
      "Will Netflix subscriber count reach 300M by 2025?",
      "Will Meta stock recover to $400 by 2025?",
      "Will Google stock hit $200 in 2025?",
      "Will Microsoft reach $500 per share in 2025?",
      "Will Amazon stock hit $200 by end of 2025?",
      "Will NVIDIA maintain above $800 in 2025?",
    ]

    return Array.from({ length: count }, (_, i) => ({
      id: `active-${i + 1}`,
      question: questions[i % questions.length],
      side: Math.random() > 0.5 ? "YES" : ("NO" as "YES" | "NO"),
      amount: Number((Math.random() * 50 + 5).toFixed(1)),
      currentPrice: Math.random() * 0.8 + 0.1,
      entryPrice: Math.random() * 0.8 + 0.1,
      pnl: `${Math.random() > 0.5 ? "+" : "-"}${(Math.random() * 50 + 5).toFixed(1)}%`,
      pnlAmount: `${Math.random() > 0.5 ? "+" : "-"}${(Math.random() * 10 + 1).toFixed(2)} SOL`,
      timeLeft: ["2 days", "1 week", "3 days", "5 hours", "2 months", "1 month"][Math.floor(Math.random() * 6)],
      status: Math.random() > 0.5 ? "winning" : ("losing" as "winning" | "losing"),
      trend: Math.random() > 0.5 ? "up" : ("down" as "up" | "down"),
    }))
  }

  const generateHistoryBets = (count: number): BetData[] => {
    const questions = [
      "Will Tesla stock hit $300 in Q4 2024?",
      "Will inflation drop below 2% in 2024?",
      "Will OpenAI release GPT-5 in 2024?",
      "Will Bitcoin reach $80k by end of 2024?",
      "Will Apple announce VR headset in 2024?",
      "Will Twitter rebrand to X succeed?",
      "Will ChatGPT Plus reach 10M subscribers?",
      "Will Zoom stock recover to $150 in 2024?",
      "Will TikTok get banned in the US in 2024?",
      "Will SpaceX go public in 2024?",
      "Will Coinbase stock hit $200 in 2024?",
      "Will AMD stock outperform Intel in 2024?",
      "Will Disney+ reach 200M subscribers?",
      "Will Uber become profitable in 2024?",
      "Will Airbnb stock hit $200 in 2024?",
    ]

    return Array.from({ length: count }, (_, i) => ({
      id: `history-${i + 1}`,
      question: questions[i % questions.length],
      side: Math.random() > 0.5 ? "YES" : ("NO" as "YES" | "NO"),
      amount: Number((Math.random() * 30 + 5).toFixed(1)),
      result: Math.random() > 0.4 ? "WON" : ("LOST" as "WON" | "LOST"),
      payout: Math.random() > 0.4 ? `${(Math.random() * 50 + 10).toFixed(1)} SOL` : "0 SOL",
      pnl: Math.random() > 0.4 ? `+${(Math.random() * 150 + 10).toFixed(1)}%` : "-100%",
      resolvedDate: ["Dec 15, 2024", "Dec 10, 2024", "Nov 28, 2024", "Nov 20, 2024", "Nov 15, 2024"][
        Math.floor(Math.random() * 5)
      ],
    }))
  }

  const allData = type === "active" ? generateActiveBets(47) : generateHistoryBets(63)
  const totalItems = allData.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (page - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const data = allData.slice(startIndex, endIndex)

  return { data, totalItems, totalPages }
}

export default function DashboardPage() {
  const { address } = useAppSelector((state) => state.wallet)

  const [copiedAddress, setCopiedAddress] = useState(false)
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState({
    achievements: true,
    dashboard: true,
    userData: true,
    bets: true,
  })

  const [activeBets, setActiveBets] = useState<BetData[]>([])
  const [historyBets, setHistoryBets] = useState<BetData[]>([])
  const [activePagination, setActivePagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 5,
    totalItems: 0,
  })
  const [historyPagination, setHistoryPagination] = useState<PaginationState>({
    currentPage: 1,
    totalPages: 1,
    itemsPerPage: 5,
    totalItems: 0,
  })
  const [loadingBets, setLoadingBets] = useState(false)

  const [user, setUser] = useState<UserData>({
    address: address || "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM",
    displayAddress: address ? `${address.slice(0, 20)}...${address.slice(-20)}`: "",
    totalVolume: "320",
    winRate: 73.2,
    winRateChange: "+3.2",
    rankChange: -5,
    totalBets: 156,
    activeBets: 12,
    rank: 47,
    level: "Prophet",
    points: 7500,
    streak: 8,
    joinDate: "March 2024",
  })

  useEffect(() => {
    if (address) {
      setUser((prev) => ({
        ...prev,
        address,
        displayAddress: `${address.slice(0, 20)}...${address.slice(-20)}`,
      }));
    }
  }, [address]);

  const [activeTab, setActiveTab] = useState("active")
  const [historyLoaded, setHistoryLoaded] = useState(false)

  const loadBets = useCallback(async (type: "active" | "history", page: number) => {
    setLoadingBets(true)
    try {
      const result = await fetchPaginatedBets(type, page, 5)

      if (type === "active") {
        setActiveBets(result.data)
        setActivePagination((prev) => ({
          ...prev,
          currentPage: page,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
        }))
      } else {
        setHistoryBets(result.data)
        setHistoryPagination((prev) => ({
          ...prev,
          currentPage: page,
          totalPages: result.totalPages,
          totalItems: result.totalItems,
        }))
      }
    } catch (error) {
      console.error(`Failed to load ${type} bets:`, error)
    } finally {
      setLoadingBets(false)
    }
  }, [])

  useEffect(() => {
    loadBets("active", 1)
    loadBets("history", 1)
  }, [loadBets])

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const allAchievements = await getAchievements()
        setAchievements(allAchievements)
      } catch (error) {
        console.error("Failed to load achievements:", error)
      } finally {
        setLoading((prev) => ({ ...prev, achievements: false }))
      }
    }

    loadAchievements()
  }, [])

  useEffect(() => {
    if (address) {
      setLoading((prev) => ({ ...prev, dashboard: true, userData: true, bets: true }))
      setLoading({
        achievements: loading.achievements,
        dashboard: false,
        userData: false,
        bets: false,
      })
    }
  }, [address])

  const copyAddress = () => {
    navigator.clipboard.writeText(user.address)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const getXPProgress = () => {
    const levelInfo = getLevelInfo(user.points)
    if (!levelInfo.nextThreshold) return { current: user.points, max: user.points, percentage: 100 }

    let previousThreshold = 0
    if (levelInfo.nextThreshold === 10000) previousThreshold = 5000
    else if (levelInfo.nextThreshold === 5000) previousThreshold = 1000
    else if (levelInfo.nextThreshold === 1000) previousThreshold = 0

    const current = user.points - previousThreshold
    const max = levelInfo.nextThreshold - previousThreshold
    const percentage = (current / max) * 100

    return { current, max, percentage }
  }

  const PaginationComponent = ({
    pagination,
    onPageChange,
    type,
  }: {
    pagination: PaginationState
    onPageChange: (page: number) => void
    type: string
  }) => {
    if (pagination.totalPages <= 1) return null

    const getVisiblePages = () => {
      const { currentPage, totalPages } = pagination
      const pages: (number | "ellipsis")[] = []

      if (totalPages <= 7) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i)
        }
      } else {
        pages.push(1)

        if (currentPage > 3) {
          pages.push("ellipsis")
        }

        const start = Math.max(2, currentPage - 1)
        const end = Math.min(totalPages - 1, currentPage + 1)

        for (let i = start; i <= end; i++) {
          pages.push(i)
        }

        if (currentPage < totalPages - 2) {
          pages.push("ellipsis")
        }

        pages.push(totalPages)
      }

      return pages
    }

    return (
      <div className="flex flex-col items-center space-y-4 mt-6">
        <div className="text-sm text-muted-foreground">
          Showing {(pagination.currentPage - 1) * pagination.itemsPerPage + 1} to{" "}
          {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems}{" "}
          {type}
        </div>

        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                onClick={() => onPageChange(pagination.currentPage - 1)}
                className={pagination.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
              />
            </PaginationItem>

            {getVisiblePages().map((page, index) => (
              <PaginationItem key={index}>
                {page === "ellipsis" ? (
                  <PaginationEllipsis />
                ) : (
                  <PaginationLink
                    onClick={() => onPageChange(page)}
                    isActive={page === pagination.currentPage}
                    className="cursor-pointer"
                  >
                    {page}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}

            <PaginationItem>
              <PaginationNext
                onClick={() => onPageChange(pagination.currentPage + 1)}
                className={
                  pagination.currentPage === pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                }
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    )
  }

  const sortedActiveBets = useMemo(() => {
    return [...activeBets].sort((a, b) => {
      const getTimeInHours = (timeLeft: string) => {
        const timeStr = timeLeft.toLowerCase()
        if (timeStr.includes("hour")) return Number.parseInt(timeStr)
        if (timeStr.includes("day")) return Number.parseInt(timeStr) * 24
        if (timeStr.includes("week")) return Number.parseInt(timeStr) * 24 * 7
        if (timeStr.includes("month")) return Number.parseInt(timeStr) * 24 * 30
        return Number.MAX_SAFE_INTEGER
      }
      return getTimeInHours(a.timeLeft!) - getTimeInHours(b.timeLeft!)
    })
  }, [activeBets])

  const levelInfo = getLevelInfo(user.points)
  const xpProgress = getXPProgress()

  const handleTabChange = (value: string) => {
    setActiveTab(value)
    if (value === "history" && !historyLoaded) {
      setLoadingBets(true)
      loadBets("history", 1).then(() => {
        setHistoryLoaded(true)
      })
    }
  }

  if (loading.dashboard) {
    return (
      <WalletAuthorizationGuard>
        <DashboardSkeleton />
      </WalletAuthorizationGuard>
    )
  }

  return (
    <WalletAuthorizationGuard>
      <TooltipProvider>
        <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
          <div className="absolute inset-0 radial-glow"></div>
          <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse [animation-duration:6s]"></div>
          <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

          <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* User Profile Card */}
              <Card className="glass glow relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div>
                <CardContent className="pt-6 relative z-10">
                  <div className="flex flex-col items-center space-y-4">
                    <div className="relative">
                      <Avatar className="w-24 h-24">
                        <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt="Kelly King" />
                        <AvatarFallback>KK</AvatarFallback>
                      </Avatar>
                      <Badge variant="secondary" className="border-background absolute -bottom-0.5 left-full min-w-5 -translate-x-8 px-2">
                        #{user.rank}
                      </Badge>
                    </div>

                    <div className="text-center space-y-3 w-full">
                      <div className="flex items-center ml-8 space-x-2 justify-center">
                        <span className="font-mono text-sm">{user.displayAddress}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={copyAddress}
                          className="h-6 w-6 p-0 hover:bg-white/10"
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
                            Oracle
                        </Badge>


                        {user.rank <= 10 && (
                          <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                            <Crown className="w-3 h-3 text-white" />
                          </div>
                        )}
                      </div>

                      <div className="w-full space-y-3">
                        {levelInfo.nextLevel && (
                          <div className="space-y-2">
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-muted-foreground">
                                {xpProgress.current.toLocaleString()}/{xpProgress.max.toLocaleString()} XP
                              </span>
                              <span className="text-accent font-medium">→ {levelInfo.nextLevel}</span>
                            </div>
                            <div className="relative">
                              <Progress value={xpProgress.percentage} className="h-3 bg-gray-800/50" />
                              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50 rounded-full"></div>
                            </div>
                          </div>
                        )}

                        <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3 border border-orange-500/30 glow">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                            <Target className="w-5 h-5 text-orange-400" />
                          </div>
                          <span className="text-lg font-bold text-orange-400">{user.streak}</span>
                          <span className="text-sm text-orange-300">Win Streak</span>
                          <div className="text-lg animate-pulse">🔥</div>
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
              <StatsCard stats={user} />
            </div>

            <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
              <TabsList className="glass">
                <TabsTrigger className="cursor-pointer" value="active">Active Bets</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="history">History</TabsTrigger>
                <TabsTrigger className="cursor-pointer" value="achievements">Achievements</TabsTrigger>
              </TabsList>

              <TabsContent value="active" className="space-y-4">
                {loadingBets ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
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
                              <div className="h-8 bg-muted rounded w-full"></div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <>
                    <ActiveBetsTab activeBets={sortedActiveBets} />

                    <PaginationComponent
                      pagination={activePagination}
                      onPageChange={(page) => loadBets("active", page)}
                      type="active bets"
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="history" className="space-y-4">
                {loadingBets ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
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
                ) : (
                  <>
                    <HistoryBetsTab historyBets={historyBets} />
                    <PaginationComponent
                      pagination={historyPagination}
                      onPageChange={(page) => loadBets("history", page)}
                      type="history bets"
                    />
                  </>
                )}
              </TabsContent>

              <TabsContent value="achievements" className="space-y-6">
                <div className="text-center mb-8">
                  <h2 className="text-3xl font-bold gradient-text mb-2">Achievement Gallery</h2>
                  <p className="text-muted-foreground">Collect badges and NFTs as you master the art of prediction</p>
                </div>

                {loading.achievements ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[...Array(6)].map((_, i) => (
                      <Card key={i} className="glass animate-pulse">
                        <CardContent className="pt-6 text-center">
                          <div className="w-20 h-20 rounded-full mx-auto mb-4 bg-muted"></div>
                          <div className="h-4 bg-muted rounded mb-2"></div>
                          <div className="h-3 bg-muted rounded mb-2"></div>
                          <div className="h-6 bg-muted rounded"></div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {achievements.map((badge) => {
                      const IconComponent = badge.icon
                      return (
                        <Dialog key={badge.id}>
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
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </TooltipProvider>
    </WalletAuthorizationGuard>
  )
}
