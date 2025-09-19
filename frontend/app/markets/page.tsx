"use client"

import { useState, useEffect, useCallback, useRef, useMemo } from "react"

import Link from "next/link"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"

import {
  Search,
  TrendingUp,
  Clock,
  Users,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
} from "lucide-react"

import { getMarketsList } from "@/lib/services/market/marketService"
import { useScrollPagination } from "@/hooks/use-scroll-pagination"
import { getMarket } from "@/lib/types"

interface LoadingState {
  initial: boolean
  more: boolean
}

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

const MarketCard = ({ market, index, renderKey }: { market: getMarket; index: number; renderKey: number }) => (
  <Link key={`${renderKey}-${market.id}-${index}`} href={`/market/${market.id}`}>
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
            {market.category}
          </Badge>
          <div className="flex items-center text-gray-400 text-sm">
            <Clock className="h-4 w-4 mr-1" />
            {market.endDate}
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
            <div className="text-white font-bold">${(market.yesPrice * 100).toFixed(0)}¢</div>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
            <div className="text-red-400 text-xs font-medium mb-1">NO</div>
            <div className="text-white font-bold">${(market.noPrice * 100).toFixed(0)}¢</div>
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

const mockMarkets: getMarket[] = [
  {
    id: 1,
    title: "Will Bitcoin reach $100,000 by end of 2024?",
    category: "Crypto",
    totalVolume: 2000,
    participants: 1247,
    yesPrice: 0.67,
    noPrice: 0.33,
    endDate: "Dec 31, 2024",
  },
  {
    id: 2,
    title: "Will Tesla stock hit $300 before Q2 2024?",
    category: "Stocks",
    totalVolume: 89000,
    participants: 892,
    yesPrice: 0.42,
    noPrice: 0.58,
    endDate: "Jun 30, 2024",
  },
  {
    id: 3,
    title: "Will AI replace 50% of jobs by 2030?",
    category: "Technology",
    totalVolume: 180000,
    participants: 2156,
    yesPrice: 0.73,
    noPrice: 0.27,
    endDate: "Dec 31, 2030",
  },
  {
    id: 4,
    title: "Will SpaceX land on Mars by 2026?",
    category: "Space",
    totalVolume: 83333,
    participants: 3421,
    yesPrice: 0.35,
    noPrice: 0.65,
    endDate: "Dec 31, 2026",
  },
  {
    id: 5,
    title: "Will the Fed cut rates below 2% in 2024?",
    category: "Economics",
    totalVolume: 123323,
    participants: 756,
    yesPrice: 0.28,
    noPrice: 0.72,
    endDate: "Dec 31, 2024",
  },
  {
    id: 6,
    title: "Will renewable energy exceed 50% of US grid by 2025?",
    category: "Environment",
    totalVolume: 84917,
    participants: 432,
    yesPrice: 0.61,
    noPrice: 0.39,
    endDate: "Dec 31, 2025",
  },
  {
    id: 7,
    title: "Will Manchester City win the Premier League 2024?",
    category: "Sports",
    totalVolume: 15000,
    participants: 1834,
    yesPrice: 0.78,
    noPrice: 0.22,
    endDate: "May 19, 2024",
  },
  {
    id: 8,
    title: "Will Trump win the 2024 US Presidential Election?",
    category: "Politics",
    totalVolume: 47000,
    participants: 5672,
    yesPrice: 0.52,
    noPrice: 0.48,
    endDate: "Nov 5, 2024",
  },
  {
    id: 9,
    title: "Will Ethereum reach $5,000 by end of 2024?",
    category: "Crypto",
    totalVolume: 70000,
    participants: 2341,
    yesPrice: 0.44,
    noPrice: 0.56,
    endDate: "Dec 31, 2024",
  },
  {
    id: 10,
    title: "Will Apple release AR glasses in 2024?",
    category: "Technology",
    totalVolume: 90000,
    participants: 1456,
    yesPrice: 0.31,
    noPrice: 0.69,
    endDate: "Dec 31, 2024",
  },
]

const categories = ["All", "Crypto"]

function useStableRef<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

export default function MarketsPage() {
  const cursorRef = useRef<string|null>(null)

  const [searchTerm, setSearchTerm] = useState("")
  const [selectedCategory, setSelectedCategory] = useState("All")
  const [sortBy, setSortBy] = useState("volume")
  const [markets, setMarkets] = useState<getMarket[]>([])
  const [loading, setLoading] = useState<LoadingState>({ initial: true, more: false })
  const [currentPage, setCurrentPage] = useState(1)
  const [hasNextPage, setHasNextPage] = useState(true)
  const [renderKey, setRenderKey] = useState(0)

  const requestIdRef = useRef(0)
  const mountedRef = useRef(true)

  const ITEMS_PER_PAGE = 15;
  const hasNextPageRef = useStableRef(hasNextPage);


  const fetchMarkets = useCallback(
    async (page: number, isReset = false) => {
      if (!isReset && (!hasNextPageRef.current || loading.more)) return;
      const requestId = ++requestIdRef.current;

      if (isReset) {
        setLoading((p) => ({ ...p, initial: true }));
        setCurrentPage(1);
        setHasNextPage(true);
      } else {
        setLoading((p) => ({ ...p, more: true }));
      }

      try {
        const params = new URLSearchParams();
        params.set("limit", String(ITEMS_PER_PAGE));
        if (!isReset && hasNextPage && cursorRef.current) params.set("cursor", cursorRef.current);
        if (selectedCategory !== "All") params.set("category", selectedCategory);

        // const res = await fetch(`/v1/markets?${params.toString()}`);
        const json = await getMarketsList();
        // const json = await res.json() as { ok: boolean; items: getMarket[]; nextCursor?: string };

        if (requestId !== requestIdRef.current || !mountedRef.current) return;

        if (isReset) setMarkets(json.items);
        else setMarkets((prev) => [...prev, ...json.items]);

        cursorRef.current = json.nextCursor ?? null;
        setHasNextPage(!!json.nextCursor);
        setCurrentPage(page);
      } catch (e) {
        console.error(e);
      } finally {
        if (requestId === requestIdRef.current && mountedRef.current) {
          setLoading({ initial: false, more: false });
        }
      }
    },
    [selectedCategory]
  );

  useEffect(() => {
    setRenderKey((prev) => prev + 1)
    setMarkets([])
    setLoading({ initial: true, more: false })
    setHasNextPage(true)
    setCurrentPage(1)

    window.scrollTo(0, 0)
    fetchMarkets(1, true)
  }, [selectedCategory, searchTerm, sortBy, fetchMarkets])

  const loadMore = useCallback(() => {
    if (!loading.more && hasNextPage && !loading.initial) {
      fetchMarkets(currentPage + 1, false)
    }
  }, [currentPage, loading, hasNextPage, fetchMarkets])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useScrollPagination({
    hasNextPage,
    isLoading: loading.more,
    fetchNextPage: loadMore,
    threshold: 300,
  })

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
                  disabled={loading.initial}
                />
              </div>

              <div className="flex gap-4">
                <Select value={selectedCategory} onValueChange={setSelectedCategory} disabled={loading.initial}>
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

                <Select value={sortBy} onValueChange={setSortBy} disabled={loading.initial}>
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
            {loading.initial
              ? Array.from({ length: 15 }).map((_, index) => (
                  <MarketCardSkeleton key={`skeleton-${renderKey}-${index}`} />
                ))
              : markets.map((market, index) => (
                  <MarketCard key={`market-${market.id}`} market={market} index={index} renderKey={renderKey} />
                ))}
          </div>

          {!loading.initial && loading.more && (
            <div className="flex justify-center items-center py-8">
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Loading more markets...</span>
              </div>
            </div>
          )}

          {!loading.initial && markets.length === 0 && (
            <div className="text-center py-12">
              <div className="text-gray-400 text-lg mb-4">No markets found</div>
              <p className="text-gray-500">Try adjusting your search or filters</p>
            </div>
          )}

          {!loading.initial && !hasNextPage && markets.length > 0 && (
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
