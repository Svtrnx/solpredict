export function calculatePayout(amount: number, odds: number): number {
  return amount * odds
}

export function calculatePriceImpact(shares: number, totalShares: number): number {
  return (shares / totalShares) * 100
}

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0
  return (wins / total) * 100
}

export function getBetUrgency(timeLeft: string): "critical" | "urgent" | "warning" | "normal" {
  const timeStr = timeLeft.toLowerCase()

  if (timeStr.includes("hour")) {
    const hours = Number.parseInt(timeStr)
    if (hours <= 24) return "critical"
    if (hours <= 72) return "urgent"
  }

  if (timeStr.includes("day")) {
    const days = Number.parseInt(timeStr)
    if (days <= 1) return "critical"
    if (days <= 3) return "urgent"
    if (days <= 7) return "warning"
  }

  return "normal"
}

export function getLevelInfo(points: number) {
  if (points >= 10000)
    return { level: "Singularity", color: "from-purple-400 to-pink-600", nextLevel: null, nextThreshold: null }
  if (points >= 5000)
    return { level: "Oracle", color: "from-blue-400 to-purple-600", nextLevel: "Singularity", nextThreshold: 10000 }
  if (points >= 1000)
    return { level: "Prophet", color: "from-green-400 to-blue-600", nextLevel: "Oracle", nextThreshold: 5000 }
  if (points >= 0)
    return { level: "Forecaster", color: "from-yellow-400 to-orange-600", nextLevel: "Prophet", nextThreshold: 1000 }
  return { level: "Observer", color: "from-gray-400 to-gray-600", nextLevel: "Forecaster", nextThreshold: 1000 }
}
