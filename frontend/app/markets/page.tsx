"use client"

import { useState, useEffect, useRef, useMemo } from "react"

import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import {
  Search,
  Clock,
  Users,
  DollarSign,
  Loader2,
} from "lucide-react"

import { useScrollPagination } from "@/hooks/use-scroll-pagination"
import { useMarketsQuery } from "@/hooks/useMarketsQuery"
import { ListMarket, type SortKey } from "@/lib/types"


const MarketCardSkeleton = () => (
  <Card className="bg-black/20 backdrop-blur-xl border-white/10">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between mb-2">
        <Skeleton className="h-5 w-16" />
        <Skeleton className="h-4 w-8" />
      </div>
      <Skeleton className="h-6 w-full mb-2" />
      <Skeleton className="h-4 w-3/4" />
    </CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
          <Skeleton className="h-3 w-6 mb-1" />
          <Skeleton className="h-5 w-12" />
        </div>
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
          <Skeleton className="h-3 w-6 mb-1" />
          <Skeleton className="h-5 w-12" />
        </div>
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-12" />
      </div>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-4 w-10" />
      </div>
    </CardContent>
  </Card>
)

function formatVolume(num: number): string {
  if (num < 100_000) {
    return num.toLocaleString("en-US");
  }

  return new Intl.NumberFormat("en", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(num);
}

const MarketCard = ({ market, index }: { market: ListMarket; index: number; }) => (
  <Link href={`/market/${market.marketPda}`}>
    <Card
      className="bg-black/20 backdrop-blur-xl border-white/10 hover:border-purple-500/50 transition-all duration-300 cursor-pointer group opacity-0 animate-fade-in"
      style={{
        animationDelay: `${(index % 15) * 50}ms`,
        animationFillMode: "forwards",
      }}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between mb-2">
          <Badge variant="secondary" className="bg-purple-500/20 text-purple-300 border-purple-500/30">
            {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
          </Badge>
          <div className="flex items-center text-gray-400 text-sm">
            <Clock className="h-4 w-4 mr-1" />
            {new Date(market.endDate).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            })}
          </div>
        </div>
        <CardTitle className="text-white text-lg leading-tight group-hover:text-purple-300 transition-colors">
          {market.title}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
            <div className="text-green-400 text-xs font-medium mb-1">YES</div>
            <div className="text-white font-bold">{(market.yesPrice * 100).toFixed(0)}¢</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400 text-xs font-medium mb-1">NO</div>
            <div className="text-white font-bold">{(market.noPrice * 100).toFixed(0)}¢</div>
          </div>
        </div>

        <div className="flex items-center justify-between text-sm text-gray-400">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
              {formatVolume(market.totalVolume)}{" "}USDC
          </div>
          <div className="flex items-center">
            <Users className="h-4 w-4 mr-1" />
            {new Intl.NumberFormat('en-US').format(market.participants)}
          </div>
        </div>

        {/* <div className="flex items-center justify-between text-sm">
          <div className="flex items-center text-gray-400">
            <Clock className="h-4 w-4 mr-1" />
            {market.endDate}
          </div>
        </div> */}
      </CardContent>
    </Card>
  </Link>
)

const categories = ["All", "Crypto"]

export default function MarketsPage() {
  const mountedRef = useRef(true)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortBy, setSortBy] = useState<SortKey>("volume")
  
  const { data, isLoading, isFetchingNextPage, fetchNextPage, hasNextPage, refetch } = useMarketsQuery({
    category: selectedCategory,
    q: searchTerm,
    sort: sortBy,
    pageSize: 15,
  })

  useScrollPagination({
    hasNextPage: !!hasNextPage,
    isLoading: !!isFetchingNextPage,
    fetchNextPage: () => fetchNextPage(),
    threshold: 300,
  })

  useEffect(() => {
    refetch()
  }, [selectedCategory, searchTerm, sortBy, refetch])
  
  const markets = useMemo(
    () => (data ? data.pages.flatMap((p) => p.items) : []),
    [data]
  )

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

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
          <div className="text-center mb-12 opacity-0 animate-fade-in-up">
            <h1 className="text-4xl md:text-6xl font-bold text-white mb-4">Prediction Markets</h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Discover and trade on the future. Make predictions on everything from crypto prices to world events.
            </p>
          </div>

          <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6 mb-8 opacity-0 animate-fade-in-up animate-delay-200">
            <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search markets..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 bg-white/5 border-white/10 text-white placeholder-gray-400"
                  disabled={isLoading}
                />
              </div>

              <div className="flex gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={isLoading}>
                  <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)} disabled={isLoading}>
                  <SelectTrigger className="w-40 bg-white/5 border-white/10 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="volume">Volume</SelectItem>
                    <SelectItem value="participants">Participants</SelectItem>
                    <SelectItem value="ending">Ending Soon</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {isLoading
              ? Array.from({ length: 15 }).map((_, index) => (
                  <MarketCardSkeleton key={`skeleton-${index}`} />
                ))
              : markets.map((market, index) => (
                  <MarketCard key={`${market.id}`} market={market} index={index} />
                ))}
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
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">No markets found</div>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          )}

          {!isLoading && !hasNextPage && markets.length > 0 && (
            <div className="text-center py-8">
              <div className="text-gray-500 text-sm">
                Showing all {markets.length} markets for "{selectedCategory}"
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
