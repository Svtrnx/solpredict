import { z } from "zod"

import type { LucideIcon } from "lucide-react"

export const UserDataSchema = z.object({
  address: z.string(),
  displayAddress: z.string().optional(),

  totalVolume: z.coerce.number(),
  winRate: z.coerce.number(),
  winRateChange: z.coerce.number(),

  rankChange: z.number(),
  totalBets: z.number(),
  activeBets: z.number(),
  rank: z.number(),

  level: z.string(),
  points: z.number(),
  streak: z.number(),

  joinDate: z.string(),
  wallet: z.string().optional(),
})
export type UserData = z.infer<typeof UserDataSchema>

export interface Achievement {
  id: string
  name: string
  description: string
  detailedDescription: string
  rarity: "Common" | "Rare" | "Epic" | "Legendary" | "Mythic"
  earned: boolean
  gradient: string
  unlockedBy: string
  earnedDate: string | null
  nftId: string
  icon: LucideIcon
}

export interface LevelInfo {
  level: string
  color: string
  nextLevel: string | null
  nextThreshold: number | null
  minPoints: string
}
