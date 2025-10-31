"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { motion } from "framer-motion"
import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StatusMultiSelect } from "@/components/market/status-multi-select"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import {
  Search,
  Clock,
  Users,
  DollarSign,
  Loader2,
  TrendingUp,
  Hourglass,
  CheckCircle2,
  XCircle,
  Ban,
  ArrowUpRight,
  Flame,
  Sparkles,
  Trophy,
} from "lucide-react"

import { useScrollPagination } from "@/hooks/use-scroll-pagination"
import { useMarketsQuery } from "@/hooks/useMarketsQuery"
import type { ListMarket, SortKey } from "@/lib/types/market"

export const MarketCardSkeleton = () => (
  <Card className="bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-md border border-white/[0.08] h-full">
    <CardHeader className="pb-4">
      <div className="flex items-start justify-between gap-2 mb-3">
        <Skeleton className="h-6 w-20 rounded-md bg-white/10" />
        <Skeleton className="h-4 w-4 rounded bg-white/5" />
      </div>

      <div className="space-y-2 mb-3">
        <Skeleton className="h-4 w-full bg-white/10" />
        <Skeleton className="h-4 w-4/5 bg-white/10" />
      </div>

      <div className="flex items-center justify-between">
        <Skeleton className="h-7 w-24 rounded-full bg-white/10" />
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 text-gray-600" />
          <Skeleton className="h-3 w-20 bg-white/10" />
        </div>
      </div>
    </CardHeader>

    <CardContent className="space-y-4">

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3">
          <Skeleton className="h-2.5 w-6 mb-1.5 bg-emerald-500/30" />
          <Skeleton className="h-5 w-12 bg-emerald-500/20" />
        </div>
        <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3">
          <Skeleton className="h-2.5 w-6 mb-1.5 bg-rose-500/30" />
          <Skeleton className="h-5 w-12 bg-rose-500/20" />
        </div>
      </div>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-2">
          <div className="bg-white/5 rounded-md p-1.5">
            <DollarSign className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <Skeleton className="h-3.5 w-16 bg-white/10" />
        </div>
        <div className="flex items-center gap-2">
          <div className="bg-white/5 rounded-md p-1.5">
            <Users className="h-3.5 w-3.5 text-gray-600" />
          </div>
          <Skeleton className="h-3.5 w-12 bg-white/10" />
        </div>
      </div>
    </CardContent>
  </Card>
)

const StatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    active: {
      label: "Active",
      icon: TrendingUp,
      className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
      dotColor: "bg-emerald-400",
    },
    awaiting_resolve: {
      label: "Awaiting Resolve",
      icon: Hourglass,
      className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
      dotColor: "bg-amber-400",
    },
    locked: {
      label: "Locked",
      icon: Ban,
      className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
      dotColor: "bg-orange-400",
    },
    settled_yes: {
      label: "Settled Yes",
      icon: CheckCircle2,
      className: "bg-blue-500/10 text-blue-400 border-blue-500/20",
      dotColor: "bg-blue-400",
    },
    settled_no: {
      label: "Settled No",
      icon: XCircle,
      className: "bg-rose-500/10 text-rose-400 border-rose-500/20",
      dotColor: "bg-rose-400",
    },
    void: {
      label: "Void",
      icon: Ban,
      className: "bg-gray-500/10 text-gray-400 border-gray-500/20",
      dotColor: "bg-gray-400",
    },
  }

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active
  const Icon = config.icon

  return (
    <Badge
      variant="outline"
      className={`${config.className} flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors duration-200`}
    >
      <Icon className="h-3.5 w-3.5" />
      {config.label}
    </Badge>
  )
}

const MarketCard = ({ market, index }: { market: ListMarket; index: number }) => {
  const timeUntilEnd = new Date(market.endDate).getTime() - Date.now()
  const isLocked = market.status === "awaiting_resolve" && timeUntilEnd < 24 * 60 * 60 * 1000 && timeUntilEnd > 0
  const displayStatus = isLocked ? "locked" : market.status

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: (index % 15) * 0.05,
        ease: [0.25, 0.1, 0.25, 1],
      }}
    >
      <Link href={`/market/${market.marketPda}`}>
        <Card className="relative bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-md border border-white/[0.08] hover:border-white/20 hover:shadow-xl hover:shadow-black/20 transition-all duration-500 cursor-pointer group overflow-hidden h-full">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <Badge
                variant="secondary"
                className="bg-white/5 text-gray-300 border-white/10 font-medium text-xs px-2.5 py-[3px] hover:bg-white/10 transition-colors"
              >
                {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
              </Badge>
              <ArrowUpRight className="h-4 w-4 text-gray-500 group-hover:text-gray-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all duration-200" />
            </div>

            <CardTitle className="text-white text-base leading-snug mb-3 line-clamp-2 font-semibold">
              {market.title}
            </CardTitle>

            <div className="flex items-center justify-between">
              <StatusBadge status={displayStatus} />
              <div className="flex items-center text-gray-400 text-xs font-medium">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                {new Date(market.endDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 hover:bg-emerald-500/10 transition-colors">
                <div className="text-emerald-400/70 text-[10px] font-bold mb-0.5 tracking-wider uppercase">Yes</div>
                <div className="text-white text-lg font-bold">{(market.yesPrice * 100).toFixed(0)}¢</div>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 hover:bg-rose-500/10 transition-colors">
                <div className="text-rose-400/70 text-[10px] font-bold mb-0.5 tracking-wider uppercase">No</div>
                <div className="text-white text-lg font-bold">{(market.noPrice * 100).toFixed(0)}¢</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="bg-white/5 rounded-md p-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">
                  {formatVolume(market.totalVolume)} <span className="text-[10px]">USDC</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="bg-white/5 rounded-md p-1.5">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">{new Intl.NumberFormat("en-US").format(market.participants)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    </motion.div>
  )
}

function formatVolume(num: number): string {
  if (num < 100_000) {
    return num.toLocaleString("en-US")
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num)
}

const categories = [
  { value: "All", label: "All", icon: Sparkles },
  { value: "crypto", label: "Crypto", icon: TrendingUp },
  { value: "politics", label: "Politics", icon: Users },
  { value: "war", label: "War", icon: Flame },
  { value: "finance", label: "Finance", icon: DollarSign },
  { value: "sports", label: "Sports", icon: Trophy },
]

export default function MarketsPage() {
  const mountedRef = useRef(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortBy, setSortBy] = useState<SortKey>("volume")
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(["active", "awaiting_resolve"])

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
    }, 300)

    return () => clearTimeout(timer)
  }, [searchTerm])

  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } = useMarketsQuery({
    category: selectedCategory,
    q: debouncedSearchTerm,
    sort: sortBy,
    pageSize: 15,
    status: selectedStatuses,
  })

  useScrollPagination({
    hasNextPage: !!hasNextPage,
    isLoading: !!isFetchingNextPage,
    fetchNextPage: () => fetchNextPage(),
    threshold: 300,
  })

  useEffect(() => {
    refetch()
  }, [selectedCategory, debouncedSearchTerm, sortBy, selectedStatuses, refetch])

  const allMarkets = useMemo(() => (data ? data.pages.flatMap((p) => p.items) : []), [data])

  const markets = useMemo(() => {
    if (!searchTerm.trim()) return allMarkets

    const searchLower = searchTerm.toLowerCase()
    return allMarkets.filter((market) =>
      market.title.toLowerCase().includes(searchLower) ||
      market.category.toLowerCase().includes(searchLower)
    )
  }, [allMarkets, searchTerm])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  return (
    <div className="min-h-screen bg-background">
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>

      <div className="absolute inset-0 radial-glow"></div>

      <div className="relative z-10">
        <div className="max-w-7xl mx-auto px-4 pt-24 pb-8">
          <div className="mb-8">
            <div className="flex items-center gap-3 bg-black/20 backdrop-blur-xl border border-white/[0.08] rounded-2xl p-4">
              <div className="relative w-72">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 h-4 w-4" />
                <Input
                  placeholder="Search markets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-white/[0.05] border-white/[0.08] text-white placeholder-gray-500 h-9 text-sm rounded-lg focus:bg-white/[0.08] focus:border-white/[0.15] transition-all"
                />
              </div>

              <div className="flex-1 flex items-center gap-2 overflow-x-auto scrollbar-hide">
                {categories.map((category) => {
                  const Icon = category.icon
                  const isActive = selectedCategory === category.value
                  return (
                    <button
                      key={category.value}
                      onClick={() => setSelectedCategory(category.value)}
                      disabled={isLoading}
                      className={`cursor-pointer flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
                        isActive
                          ? "bg-white text-black shadow-lg"
                          : "bg-white/[0.06] text-gray-400 hover:text-white hover:bg-white/[0.1] border border-white/[0.1]"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      <span>{category.label}</span>
                    </button>
                  )
                })}
              </div>

              <div className="flex items-center gap-2">
                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)} disabled={isLoading}>
                  <SelectTrigger className="cursor-pointer w-40 bg-white/[0.05] border-white/[0.08] text-white h-9 text-sm rounded-lg hover:bg-white/[0.08] transition-colors">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume">Top Volume</SelectItem>
                    <SelectItem value="participants">Most Traders</SelectItem>
                    <SelectItem value="ending">Ending Soon</SelectItem>
                  </SelectContent>
                </Select>

                <StatusMultiSelect value={selectedStatuses} onChange={setSelectedStatuses} disabled={isLoading} />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {isLoading
              ? Array.from({ length: 12 }).map((_, index) => <MarketCardSkeleton key={`skeleton-${index}`} />)
              : markets.map((market, index) => <MarketCard key={`${market.id}`} market={market} index={index} />)}
          </div>

          {!isLoading && isFetchingNextPage && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading more markets...</span>
              </div>
            </div>
          )}

          {!isLoading && markets.length === 0 && (
            <div className="text-center py-16">
              <div className="text-gray-400 text-lg mb-2">No markets found</div>
              <p className="text-gray-500 text-sm">Try adjusting your filters</p>
            </div>
          )}

          {!isLoading && !hasNextPage && markets.length > 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500 text-sm">Showing all {markets.length} markets</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
