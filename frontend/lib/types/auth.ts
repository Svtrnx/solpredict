import { z } from "zod"

export const MeSchema = z.object({
  id: z.string(),
  walletAddress: z.string(),
  walletId: z.string(),
  chain: z.string(),
  exp: z.coerce.number(),
})
export type Me = z.infer<typeof MeSchema>

export type SessionStatus = "loading" | "authenticated" | "unauthenticated";
