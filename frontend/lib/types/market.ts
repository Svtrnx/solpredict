export interface Market {
  id: string
  question: string
  description: string
  category: string
  endDate: string
  totalVolume: string
  yesPrice: number
  noPrice: number
  yesShares: number
  noShares: number
  status: "active" | "resolved" | "closed"
  result?: "YES" | "NO"
  createdBy: string
  tags: string[]
  liquidity: string
  participants: number
  trending?: boolean
  featured?: boolean
}

export interface BetData {
  id: string
  question: string
  side: "YES" | "NO"
  amount: string
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

export interface MarketFilters {
  category: string
  status: "all" | "active" | "resolved"
  sortBy: "volume" | "newest" | "ending" | "trending"
  search: string
}

export type CreateMarketFormData = {
  marketType: string
  category: string
  endDate?: Date
  initialLiquidity: number
  feedId: string
  symbol: string
  comparator: string
  threshold: number
  lowerBound: number
  upperBound: number
  initialSide: string
}

export interface getMarket {
  id: string | number
  title: string | ""
  category: string
  totalVolume: number
  participants: number
  yesPrice: number
  noPrice: number
  endDate: string
}