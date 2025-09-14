export const MARKET_CATEGORIES = [
  "All",
  "Crypto",
  "Sports",
  "Politics",
  "Technology",
  "Entertainment",
  "Economics",
  "Science",
  "Other",
] as const

export type MarketCategory = (typeof MARKET_CATEGORIES)[number]
