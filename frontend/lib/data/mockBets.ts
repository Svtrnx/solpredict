import type { BetData } from "@/lib/types/market"

export const generateActiveBets = (count: number): BetData[] => {
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

  return Array.from({ length: count }, (_, i) => ({
    id: `active-${i + 1}`,
    question: questions[i % questions.length],
    side: Math.random() > 0.5 ? "YES" : ("NO" as "YES" | "NO"),
    amount: `${(Math.random() * 50 + 5).toFixed(1)} SOL`,
    currentPrice: Math.random() * 0.8 + 0.1,
    entryPrice: Math.random() * 0.8 + 0.1,
    pnl: `${Math.random() > 0.5 ? "+" : "-"}${(Math.random() * 50 + 5).toFixed(1)}%`,
    pnlAmount: `${Math.random() > 0.5 ? "+" : "-"}${(Math.random() * 10 + 1).toFixed(2)} SOL`,
    timeLeft: ["2 days", "1 week", "3 days", "5 hours", "2 months", "1 month"][Math.floor(Math.random() * 6)],
    status: Math.random() > 0.5 ? "winning" : ("losing" as "winning" | "losing"),
    trend: Math.random() > 0.5 ? "up" : ("down" as "up" | "down"),
  }))
}

export const generateHistoryBets = (count: number): BetData[] => {
  const questions = [
    "Will Tesla stock hit $300 in Q4 2024?",
    "Will inflation drop below 2% in 2024?",
    "Will OpenAI release GPT-5 in 2024?",
    "Will Bitcoin reach $80k by end of 2024?",
    "Will Apple announce VR headset in 2024?",
    "Will Twitter rebrand to X succeed?",
    "Will ChatGPT Plus reach 10M subscribers?",
    "Will Zoom stock recover to $150 in 2024?",
    "Will TikTok get banned in the US in 2024?",
    "Will SpaceX go public in 2024?",
  ]

  return Array.from({ length: count }, (_, i) => ({
    id: `history-${i + 1}`,
    question: questions[i % questions.length],
    side: Math.random() > 0.5 ? "YES" : ("NO" as "YES" | "NO"),
    amount: `${(Math.random() * 30 + 5).toFixed(1)} SOL`,
    result: Math.random() > 0.4 ? "WON" : ("LOST" as "WON" | "LOST"),
    payout: Math.random() > 0.4 ? `${(Math.random() * 50 + 10).toFixed(1)} SOL` : "0 SOL",
    pnl: Math.random() > 0.4 ? `+${(Math.random() * 150 + 10).toFixed(1)}%` : "-100%",
    resolvedDate: ["Dec 15, 2024", "Dec 10, 2024", "Nov 28, 2024", "Nov 20, 2024", "Nov 15, 2024"][
      Math.floor(Math.random() * 5)
    ],
  }))
}
