
import { z } from "zod";


export const BetDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  marketPda: z.string(),

  side: z.enum(["yes", "no"]),

  amount: z.coerce.number(),
  currentPrice: z.coerce.number().nullable().optional(),
  entryPrice: z.coerce.number().nullable().optional(),

  pnl: z.coerce.number(),
  pnlAmount: z.coerce.number().nullable().optional(),

  endDate: z.string().nullable().optional(),

  status: z.enum(["winning", "losing"]).nullable().optional(),
  trend: z.enum(["up", "down"]).nullable().optional(),
  result: z.enum(["won", "lost"]).nullable().optional(),

  payout: z.coerce.number().nullable().optional(),
  resolvedDate: z.string().nullable().optional(),
})

export type BetData = z.infer<typeof BetDataSchema>

export type BetsKind = "active" | "history";

export const BetsResponseSchema = z.object({
  ok: z.boolean(),
  items: z.array(BetDataSchema),
  nextCursor: z.string().nullable().optional(),
})
export type BetsResponse = z.infer<typeof BetsResponseSchema>


