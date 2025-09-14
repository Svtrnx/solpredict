import type { LucideIcon } from "lucide-react"

export interface UserData {
  address: string
  displayAddress: string
  totalVolume: string | number
  winRate: number
  winRateChange: string | number
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
  wallet?: string
}

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
