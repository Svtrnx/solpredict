
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

// --- prepare ---
export const PrepareBetSchema = z.object({
  market_pda: z.string().min(32).max(64),
  side: z.enum(["yes", "no"]),
  amount_ui: z.number().positive().min(0.000001),
});

export type PrepareBetPayload = z.infer<typeof PrepareBetSchema>;

export const PrepareBetResponseSchema = z.object({
  ok: z.boolean(),
  tx_base64: z.string(),
});

// --- confirm ---
export const ConfirmBetSchema = PrepareBetSchema.extend({
  signature: z.string().min(80).max(120),
});

export type ConfirmBetPayload = z.infer<typeof ConfirmBetSchema>;

export const ConfirmBetResponseSchema = z.object({
  ok: z.boolean(),
  market_id: z.string().uuid(),
  bet_id: z.number(),
  signature: z.string(),
});


export type BetData = z.infer<typeof BetDataSchema>

export type BetsKind = "active" | "history";

export const BetsResponseSchema = z.object({
  ok: z.boolean(),
  items: z.array(BetDataSchema),
  nextCursor: z.string().nullable().optional(),
})
export type BetsResponse = z.infer<typeof BetsResponseSchema>


