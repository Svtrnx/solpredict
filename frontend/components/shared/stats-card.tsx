"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, TrendingDown, Trophy, Target, DollarSign, BarChart3 } from "lucide-react"

interface StatsCardProps {
  stats: {
    points: number | null
    winRate: number | null
    winRateChange: number | string | null
    rank: number | null
    rankChange: number | null
    totalVolume: string | number | null
    activeBets: number | null
    totalBets: number | null
  } | null
}

export function StatsCard({ stats }: StatsCardProps) {
  const points = stats?.points ?? 0
  const winRate = clampPercent(stats?.winRate, 1)
  const rank = stats?.rank ?? 0
  const rankChange = stats?.rankChange ?? 0
  const totalVolume = clampPercent(Number(stats?.totalVolume ?? 0), 1);
  const activeBets = stats?.activeBets ?? 0
  const totalBets = stats?.totalBets ?? 0
  const winRateChange = normalizeChange(stats?.winRateChange, 1)

  function clampPercent(v: number | null | undefined, decimals = 0) {
    const n = typeof v === "number" && !Number.isNaN(v) ? v : 0;
    const clamped = Math.min(100, Math.max(0, n));
    const m = 10 ** decimals;
    return Math.round(clamped * m) / m;
  }

  function normalizeChange(val: number | string | null | undefined, decimals = 1) {
    let n = Number(val);
    if (!Number.isFinite(n)) n = 0;
    const m = 10 ** decimals;
    const rounded = Math.round(n * m) / m;
    return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(decimals)}`;
  }

  const rankImproved = rankChange < 0
  const RankTrendIcon = rankImproved ? TrendingUp : TrendingDown
  const rankTrendColor = rankImproved ? "text-green-400" : "text-red-400"
  const rankTrendText = `${rankImproved ? "" : "+"}${Math.abs(rankChange)}`

  return (
    <Card className="glass glow-cyan relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10"></div>
      <CardContent className="pt-6 relative z-10">
        <div className="space-y-6">
          <div className="text-center pb-4 border-b border-white/10">
            <h3 className="text-2xl font-bold gradient-text mb-1">{points.toLocaleString()}</h3>
            <p className="text-sm text-muted-foreground">Total Points</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Win Rate */}
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20 hover:border-green-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-green-400">{winRate}%</span>
                  <span className="text-xs text-green-400 font-medium">
                    {winRateChange}% WoW
                  </span>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${winRate}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Global Rank */}
            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-sm text-muted-foreground">Global Rank</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-yellow-400">#{rank}</span>
                  <span className={`text-xs font-medium flex items-center ${rankTrendColor}`}>
                    <RankTrendIcon className="w-3 h-3 mr-1" />
                    {rankTrendText}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Top of predictors</div>
              </div>
            </div>

            {/* Volume */}
            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm text-muted-foreground">Volume</span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold text-purple-400">
                  {totalVolume} USDC
                </div>
                <div className="text-xs text-muted-foreground">Total traded</div>
              </div>
            </div>

            {/* Active Bets */}
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-sm text-muted-foreground">Active Bets</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline space-x-2">
                  <span className="text-xl font-bold text-cyan-400">{activeBets}</span>
                  <span className="text-sm text-muted-foreground">/ {totalBets}</span>
                </div>
                <div className="text-xs text-muted-foreground">Total bets</div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
