import { z } from "zod";

export interface MarketFilters {
  category: string
  status: "all" | "active" | "resolved"
  sortBy: "volume" | "newest" | "ending" | "trending"
  search: string
}

export type CreateMarketResponse = {
  ok: boolean
  marketId: string
  tx: string
  message: string
}

export const BetDataSchema = z.object({
  id: z.string(),
  question: z.string(),
  side: z.enum(["YES", "NO"]),
  amount: z.string(),
  currentPrice: z.number().optional(),
  entryPrice: z.number().optional(),
  pnl: z.string(),
  pnlAmount: z.string().optional(),
  timeLeft: z.string().optional(),
  status: z.enum(["winning", "losing"]).optional(),
  trend: z.enum(["up", "down"]).optional(),
  result: z.enum(["WON", "LOST"]).optional(),
  payout: z.string().optional(),
  resolvedDate: z.string().optional(),
})
export type BetData = z.infer<typeof BetDataSchema>

export const CreateMarketSchema = z.object({
  marketType: z.string(),
  category: z.string(),
  endDate: z.date().optional(),
  initialLiquidity: z.coerce.number(),
  feedId: z.string(),
  symbol: z.string(),
  comparator: z.string(),
  threshold: z.coerce.number(),
  lowerBound: z.coerce.number(),
  upperBound: z.coerce.number(),
  initialSide: z.string(),
})
export type CreateMarketFormData = z.infer<typeof CreateMarketSchema>

export const RawCreateRespSchema = z.object({
  ok: z.boolean(),
  marketId: z.string(),
  message: z.string().optional(),
  tx: z.string().optional(),
  createTx: z.string().optional(),
  placeBetTx: z.string().optional(),
})
type RawCreateResp = z.infer<typeof RawCreateRespSchema>

export const ListMarketSchema = z.object({
  id: z.union([z.string(), z.number()]),
  title: z.string(),
  marketPda: z.string(),
  category: z.string(),
  totalVolume: z.number(),
  participants: z.number(),
  yesPrice: z.number(),
  noPrice: z.number(),
  endDate: z.string(),
})
export type ListMarket = z.infer<typeof ListMarketSchema>

export const MarketResponseSchema = z.object({
  ok: z.boolean(),
  items: z.array(ListMarketSchema),
  nextCursor: z.string().nullable().optional(),
})
export type MarketResponse = z.infer<typeof MarketResponseSchema>

export const MarketSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  yesPrice: z.number(),
  noPrice: z.number(),
  totalVolume: z.number(),
  participants: z.number(),
  liquidity: z.number(),
  endDate: z.string(),
  category: z.string(),
  creator: z.string(),
  settler: z.string().optional().nullable(),
  status: z.enum(["open", "locked", "settled", "void"]),
});
export type Market = z.infer<typeof MarketSchema>;