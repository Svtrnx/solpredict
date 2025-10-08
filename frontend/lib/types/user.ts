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

export const LeaderboardPeriodSchema = z.enum(["all-time", "monthly", "weekly"]);
export const LeaderboardChangeSchema = z.enum(["up", "down", "same", "new"]);

export const LeaderboardItemSchema = z.object({
  rank: z.number(),
  prevRank: z.number(),
  address: z.string(),
  winRate: z.number(),
  totalBets: z.number().int(),
  volume: z.number(),
  streak: z.number().int(),
  level: z.string(),
  points: z.number().int(),
  change: LeaderboardChangeSchema,   // "up" | "down" | "same" | "new"
});

export const LeaderboardResponseSchema = z.object({
  period: LeaderboardPeriodSchema,
  items: z.array(LeaderboardItemSchema),
});
export type LeaderboardPeriod = z.infer<typeof LeaderboardPeriodSchema>;