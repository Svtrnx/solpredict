import { Award, Star, Target, Shield, Crown, Trophy, DollarSign, Zap } from "lucide-react"

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
  icon: any 
}

export const getAchievements = async (): Promise<Achievement[]> => {

  return [
    {
      id: "1",
      name: "First Prediction",
      description: "Made your first prediction",
      detailedDescription:
        "Welcome to the world of prediction markets! This badge commemorates your very first prediction on our platform.",
      rarity: "Common",
      earned: true,
      gradient: "from-gray-400 to-gray-600",
      unlockedBy: "89.2%",
      earnedDate: "March 15, 2024",
      nftId: "FP001",
      icon: Star,
    },
    {
      id: "2",
      name: "Streak Master",
      description: "Won 5 predictions in a row",
      detailedDescription:
        "Consistency is key! You've demonstrated exceptional skill by winning 5 consecutive predictions.",
      rarity: "Rare",
      earned: true,
      gradient: "from-blue-400 to-purple-600",
      unlockedBy: "23.7%",
      earnedDate: "April 2, 2024",
      nftId: "SM042",
      icon: Target,
    },
    {
      id: "3",
      name: "Diamond Hands",
      description: "Held a position for 30+ days",
      detailedDescription:
        "True conviction! You held your position for over 30 days, showing unwavering belief in your prediction.",
      rarity: "Epic",
      earned: true,
      gradient: "from-purple-400 to-pink-600",
      unlockedBy: "12.3%",
      earnedDate: "May 18, 2024",
      nftId: "DH189",
      icon: Shield,
    },
    {
      id: "4",
      name: "AI Challenger",
      description: "Beat AI prediction 10 times",
      detailedDescription: "Human intuition triumphs! You've successfully outperformed our AI predictions 10 times.",
      rarity: "Legendary",
      earned: true,
      gradient: "from-yellow-400 to-orange-600",
      unlockedBy: "4.8%",
      earnedDate: "June 10, 2024",
      nftId: "AC256",
      icon: Award,
    },
    {
      id: "5",
      name: "Volume King",
      description: "Trade over $100k volume",
      detailedDescription:
        "The ultimate trader! Achieve over $100,000 in total trading volume to unlock this prestigious badge.",
      rarity: "Mythic",
      earned: false,
      gradient: "from-cyan-400 to-blue-600",
      unlockedBy: "1.2%",
      earnedDate: null,
      nftId: "VK999",
      icon: DollarSign,
    },
    {
      id: "6",
      name: "Perfect Prophet",
      description: "Achieve 100% win rate with 20+ bets",
      detailedDescription: "Legendary status! Maintain a perfect 100% win rate across 20 or more predictions.",
      rarity: "Mythic",
      earned: false,
      gradient: "from-green-400 to-emerald-600",
      unlockedBy: "0.3%",
      earnedDate: null,
      nftId: "PP777",
      icon: Crown,
    },
    {
      id: "7",
      name: "Speed Trader",
      description: "Complete 10 trades in one day",
      detailedDescription:
        "Lightning fast! You've completed 10 trades in a single day, showing incredible market activity.",
      rarity: "Rare",
      earned: false,
      gradient: "from-orange-400 to-red-600",
      unlockedBy: "15.8%",
      earnedDate: null,
      nftId: "ST158",
      icon: Zap,
    },
    {
      id: "8",
      name: "Market Maker",
      description: "Create 5 prediction markets",
      detailedDescription:
        "Community builder! You've created 5 prediction markets, contributing to the platform's growth.",
      rarity: "Epic",
      earned: false,
      gradient: "from-teal-400 to-cyan-600",
      unlockedBy: "8.4%",
      earnedDate: null,
      nftId: "MM084",
      icon: Trophy,
    },
  ]
}

export const getEarnedAchievements = async (): Promise<Achievement[]> => {
  const allAchievements = await getAchievements()
  return allAchievements.filter((achievement) => achievement.earned)
}
