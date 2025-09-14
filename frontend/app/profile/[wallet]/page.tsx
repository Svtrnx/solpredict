"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { useParams } from "next/navigation"
import Link from "next/link"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton"
import { ActiveBetsTab } from "@/components/shared/active-bets-tab"
import { HistoryBetsTab } from "@/components/shared/history-tab"
import { Card, CardContent } from "@/components/ui/card"
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

import { UserProfileCard } from "@/components/shared/user-profile-card"
import { StatsCard } from "@/components/shared/stats-card"


interface UserData {
  address: string
  displayAddress: string
  wallet: string
  totalVolume: string
  joinDate: string
  level: string
  points: number
  winRate: number
  winRateChange: number
  rank: number
  rankChange: number
  volume: number
  activeBets: number
  totalBets: number
  streak: number
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
      pnlAmount: `${Math.random() > 0.5 ? "+" : "-"}${(Math.random() * 10 + 1).toFixed(2)}`,
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

export default function UserProfilePage() {
  const params = useParams()
  const walletAddress = params.wallet as string
  const [userData, setUserData] = useState<UserData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("active")
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
        setHistoryLoaded(true)
      }
    } catch (error) {
      console.error(`Failed to load ${type} bets:`, error)
    } finally {
      setLoadingBets(false)
    }
  }, [])
  
  useEffect(() => {
    const fetchUserData = async () => {
      setIsLoading(true)

      const mockUserData: UserData = {
        address: walletAddress,
        displayAddress: walletAddress ? `${walletAddress.slice(0, 20)}...${walletAddress.slice(-20)}`: "",
        wallet: walletAddress,
        totalVolume: "320",
        joinDate: "March 2024",
        points: 7500,
        winRate: 73.2,
        winRateChange: 3.2,
        level: "Prophet",
        rank: 47,
        rankChange: 5,
        volume: 4589200,
        activeBets: 12,
        totalBets: 156,
        streak: 8,
      }

      setUserData(mockUserData)
      setIsLoading(false)

      loadBets("active", 1)
    }

    fetchUserData()
  }, [walletAddress, loadBets])

  const handleTabChange = async (value: string) => {
    setActiveTab(value)
    if (value === "history" && !historyLoaded) {
      loadBets("history", 1)
    }
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

  if (isLoading) {
    return <DashboardSkeleton />
  }

  if (!userData) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="glass glow p-8 text-center">
          <h2 className="text-2xl font-bold mb-4">User Not Found</h2>
          <p className="text-muted-foreground mb-6">
            The wallet address you're looking for doesn't exist or hasn't made any predictions yet.
          </p>
          <Link href="/markets">
            <Button>Browse Markets</Button>
          </Link>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse [animation-duration:6s]"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <UserProfileCard user={userData} showLevel={true} showXPProgress={false} />

          <StatsCard stats={userData} />
        </div>

        <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
          <TabsList className="glass">
            <TabsTrigger className="cursor-pointer" value="active">Active Bets</TabsTrigger>
            <TabsTrigger className="cursor-pointer" value="history">History</TabsTrigger>
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
        </Tabs>
      </div>
    </div>
  )
}
