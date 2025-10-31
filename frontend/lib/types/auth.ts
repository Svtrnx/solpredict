import { z } from "zod"

export const MeSchema = z.object({
  id: z.string(),
  wallet_address: z.string(),
  wallet_id: z.string(),
  chain: z.string(),
  exp: z.coerce.number(),
}).transform((data) => ({
  id: data.id,
  walletAddress: data.wallet_address,
  walletId: data.wallet_id,
  chain: data.chain,
  exp: data.exp,
}))

export type Me = z.infer<typeof MeSchema>

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";
