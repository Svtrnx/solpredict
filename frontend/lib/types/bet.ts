
import { z } from "zod";


export const BetDataSchema = z.object({
  id: z.string(),
  title: z.string(),
  marketPda: z.string(),

  side: z.enum(["yes", "no", "mixed"]),

  amount: z.coerce.number(),
  currentPrice: z.coerce.number().nullable().optional(),
  priceYes: z.coerce.number().nullable().optional(),
  entryPrice: z.coerce.number().nullable().optional(),

  endDate: z.string().nullable().optional(),

  result: z.enum(["won", "lost", "void"]).nullable().optional(),
  payout: z.coerce.number().nullable().optional(),
  resolvedDate: z.string().nullable().optional(),

  marketOutcome: z.enum(["yes", "no", "void"]).nullable().optional(),
  needsClaim: z.boolean().nullable().optional(),
});

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

export type BetData = z.infer<typeof BetDataSchema>

export type BetsKind = "active" | "history";

export const BetsResponseSchema = z.object({
  ok: z.boolean(),
  items: z.array(BetDataSchema),
  nextCursor: z.string().nullable().optional(),
})
export type BetsResponse = z.infer<typeof BetsResponseSchema>


