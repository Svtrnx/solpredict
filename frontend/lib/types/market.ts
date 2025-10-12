import { z } from "zod";

export const Base58Pubkey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
export const Base64Str    = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(1);
export const Hex32With0x  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const Base58Signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,100}$/);

export interface MarketFilters {
  category: string
  status: "all" | "active" | "resolved"
  sortBy: "volume" | "newest" | "ending" | "trending"
  search: string
}
const Status = z.enum(["active","awaiting_resolve","settled_yes","settled_no","void"]);

export type CreateMarketResponse = {
  ok: boolean
  marketPda: string
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
  status: Status,
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
  symbol: z.string(),
  feedId: z.string(),
  yesPrice: z.number(),
  noPrice: z.number(),
  totalVolume: z.number(),
  yesTotalVolume: z.number(),
  noTotalVolume: z.number(),
  participants: z.number(),
  endDate: z.string(),
  category: z.string(),
  creator: z.string(),
  settler: z.string().optional().nullable(),
  status: z.enum(["open", "locked", "settled", "void"]),
});
export type Market = z.infer<typeof MarketSchema>;

export interface TimeLeft {
  days: number
  hours: number
  minutes: number
  seconds: number
}

export const SORTS = ["volume", "participants", "ending"] as const
export type SortKey = typeof SORTS[number]

export const ResolveIxRequestSchema = z.object({
  market_pda: Base58Pubkey,
});
export type ResolveIxRequest = z.infer<typeof ResolveIxRequestSchema>;

export const IxAccountMetaJsonSchema = z.object({
  pubkey: Base58Pubkey,
  is_signer: z.boolean(),
  is_writable: z.boolean(),
});
export type IxAccountMetaJson = z.infer<typeof IxAccountMetaJsonSchema>;

export const IxJsonSchema = z.object({
  program_id: Base58Pubkey,
  accounts: z.array(IxAccountMetaJsonSchema).min(1),
  data_b64: Base64Str,
});
export type IxJson = z.infer<typeof IxJsonSchema>;

export const ResolveIxBundleSchema = z.object({
  ok: z.boolean(),
  market_id: Base58Pubkey,
  end_ts: z.number().int().nonnegative(),
  feed_id_hex: Hex32With0x,
  price_update_index: z.number().int().nonnegative(),
  instructions: z.array(IxJsonSchema).min(1),
  message: z.string().min(1),
});
export type ResolveIxBundle = z.infer<typeof ResolveIxBundleSchema>;


export const PrepareClaimSchema = z.object({
  market_pda: z.string().min(32).max(64),
});
export type PrepareClaimPayload = z.infer<typeof PrepareClaimSchema>;

export const PrepareClaimResponseSchema = z.object({
  ok: z.boolean(),
  tx_base64: z.string(),
});
export type PrepareClaimResponse = z.infer<typeof PrepareClaimResponseSchema>;