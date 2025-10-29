import { z } from "zod";

export const Base58Pubkey = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{32,44}$/);
export const Base64Str    = z.string().regex(/^[A-Za-z0-9+/]+={0,2}$/).min(1);
export const Hex32With0x  = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
export const Base58Signature = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{64,100}$/);
export const Hex64LowerSchema = z.string().regex(/^[0-9a-f]{64}$/, "must be a 64-char lowercase hex string")

export type Hex64Lower = z.infer<typeof Hex64LowerSchema>

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

export type MarketsListParams = {
  limit?: number
  cursor?: string | null
  category?: string
  q?: string
  sort?: "volume" | "participants" | "ending"
  signal?: AbortSignal
  status?: string
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
  feedId: z.string(""),
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
  feedId: z.string(""),
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

export const MarketCategorySchema = z.enum(["politics", "war"])
export type MarketCategory = z.infer<typeof MarketCategorySchema>

export const AiValidateStartReqSchema = z.object({
  query: z.string().trim().min(1, "query is empty").max(80, "query must be ≤ 80 characters"),
  category: MarketCategorySchema,
})
export type AiValidateStartReq = z.infer<typeof AiValidateStartReqSchema>

export const AiValidateStartRespSchema = z.object({
  ok: z.boolean(),
  hash: Hex64LowerSchema,
})
export type AiValidateStartResp = z.infer<typeof AiValidateStartRespSchema>

export const AiJobMetaSchema = z.object({
  query: z.string(),
  category: MarketCategorySchema,
  created_at_utc: z.number().int(),
})
export type AiJobMeta = z.infer<typeof AiJobMetaSchema>

export const MarketProposalSchema = z.object({
  id: z.string(),
  shortText: z.string(),
  topic: z.string(),
  description: z.string(),
  criteria: z.string(),
  end_time_utc: z.string(),
  accepted_sources: z.array(z.string()),
})
export type MarketProposal = z.infer<typeof MarketProposalSchema>

export const AiValidateDataSchema = z
  .object({
    accept: z.boolean(),
    reason: z.string().optional(),
    proposals: z.array(MarketProposalSchema).optional(),
  })
  .passthrough()
export type AiValidateData = z.infer<typeof AiValidateDataSchema>

export const AiValidateExpiredSchema = z.object({
  status: z.literal("expired"),
})
export type AiValidateExpired = z.infer<typeof AiValidateExpiredSchema>

export const AiValidatePendingSchema = z.object({
  status: z.literal("pending"),
  meta: AiJobMetaSchema,
})
export type AiValidatePending = z.infer<typeof AiValidatePendingSchema>

export const AiValidateErrorSchema = z.object({
  status: z.literal("error"),
  error: z.string(),
  meta: AiJobMetaSchema,
})
export type AiValidateError = z.infer<typeof AiValidateErrorSchema>

export const AiValidateRejectedSchema = z.object({
  status: z.literal("rejected"),
  reason: z.string().min(1),
  meta: AiJobMetaSchema,
})
export type AiValidateRejected = z.infer<typeof AiValidateRejectedSchema>

export const AiValidateReadySchema = z.object({
  status: z.literal("ready"),
  data: AiValidateDataSchema,
  meta: AiJobMetaSchema,
})
export type AiValidateReady = z.infer<typeof AiValidateReadySchema>

export const AiValidateResultSchema = z.union([
  AiValidateExpiredSchema,
  AiValidatePendingSchema,
  AiValidateErrorSchema,
  AiValidateRejectedSchema,
  AiValidateReadySchema,
])
export type AiValidateResult = z.infer<typeof AiValidateResultSchema>

export const AiValidateSelectReqSchema = z.object({
  hash: Hex64LowerSchema,
  id: z.string().length(12, "id must be exactly 12 hex characters"),
})
export type AiValidateSelectReq = z.infer<typeof AiValidateSelectReqSchema>

export const AiValidateSelectRespSchema = z.object({
  ok: z.boolean(),
  market_id: z.string(),
  create_tx: z.string(),
  chosen: MarketProposalSchema,
  message: z.string(),
})
export type AiValidateSelectResp = z.infer<typeof AiValidateSelectRespSchema>