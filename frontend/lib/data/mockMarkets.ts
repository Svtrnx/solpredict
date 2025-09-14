import type { Market } from "@/lib/types/market"

export const generateMockMarkets = (count: number): Market[] => {
  const questions = [
    "Will BTC hit $100k by 2026?",
    "Will Solana reach $500 in 2025?",
    "Will AI replace 50% of jobs by 2030?",
    "Will Tesla stock hit $300 in Q4 2024?",
    "Will inflation drop below 2% in 2024?",
    "Will OpenAI release GPT-5 in 2024?",
    "Will Ethereum reach $5000 by end of 2025?",
    "Will Apple stock hit $250 in 2025?",
    "Will unemployment rate drop below 3% in 2025?",
    "Will Netflix subscriber count reach 300M by 2025?",
  ]

  const categories = ["Crypto", "Technology", "Economics", "Sports", "Politics"]

  return Array.from({ length: count }, (_, i) => ({
    id: `market-${i + 1}`,
    question: questions[i % questions.length],
    description: `Detailed description for ${questions[i % questions.length]}`,
    category: categories[Math.floor(Math.random() * categories.length)],
    endDate: new Date(Date.now() + Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString(),
    totalVolume: `${(Math.random() * 100000 + 10000).toFixed(0)}`,
    yesPrice: Math.random() * 0.8 + 0.1,
    noPrice: Math.random() * 0.8 + 0.1,
    yesShares: Math.floor(Math.random() * 10000 + 1000),
    noShares: Math.floor(Math.random() * 10000 + 1000),
    status: "active" as const,
    createdBy: `user-${Math.floor(Math.random() * 100)}`,
    tags: ["prediction", "market"],
    liquidity: `${(Math.random() * 50000 + 5000).toFixed(0)}`,
    participants: Math.floor(Math.random() * 500 + 50),
    trending: Math.random() > 0.8,
    featured: Math.random() > 0.9,
  }))
}
