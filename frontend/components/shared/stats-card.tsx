"use client"

import { Card, CardContent } from "@/components/ui/card"
import { TrendingUp, Trophy, Target, DollarSign, BarChart3 } from "lucide-react"

interface StatsCardProps {
  stats: {
    points: number
    winRate: number
    winRateChange: number | string
    rank: number
    rankChange: number
    totalVolume: string | number
    activeBets: number
    totalBets: number
  }
}

export function StatsCard({ stats }: StatsCardProps) {
  const formatVolume = (volume: string | number) => {
    if (typeof volume === "string") return volume
    const numericVolume = typeof volume === "number" && !isNaN(volume) ? volume : 0
    const solAmount = (numericVolume / 100).toFixed(1)
    const usdAmount = (numericVolume * 0.4).toLocaleString() // Assuming 1 SOL = $40, so volume/100 * 40 = volume * 0.4
    return (
      <span>
        {solAmount} SOL <span className="text-muted-foreground/70">(${usdAmount})</span>
      </span>
    )
  }

  const formatWinRateChange = (change: number | string) => {
    if (typeof change === "string") return change
    return `+${change}`
  }

  return (
    <Card className="glass glow-cyan relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/10 via-transparent to-purple-500/10"></div>
      <CardContent className="pt-6 relative z-10">
        <div className="space-y-6">
          <div className="text-center pb-4 border-b border-white/10">
            <h3 className="text-2xl font-bold gradient-text mb-1">{stats.points.toLocaleString()}</h3>
            <p className="text-sm text-muted-foreground">Total Points</p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gradient-to-br from-green-500/10 to-emerald-500/10 rounded-lg p-4 border border-green-500/20 hover:border-green-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-green-500/20 rounded-full flex items-center justify-center">
                  <Target className="w-4 h-4 text-green-400" />
                </div>
                <span className="text-sm text-muted-foreground">Win Rate</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-green-400">{stats.winRate}%</span>
                  <span className="text-xs text-green-400 font-medium">
                    {formatWinRateChange(stats.winRateChange)}% WoW
                  </span>
                </div>
                <div className="w-full bg-gray-800/50 rounded-full h-2">
                  <div
                    className="bg-gradient-to-r from-green-400 to-emerald-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{ width: `${stats.winRate}%` }}
                  ></div>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 rounded-lg p-4 border border-yellow-500/20 hover:border-yellow-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-yellow-500/20 rounded-full flex items-center justify-center">
                  <Trophy className="w-4 h-4 text-yellow-400" />
                </div>
                <span className="text-sm text-muted-foreground">Global Rank</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-baseline space-x-2">
                  <span className="text-2xl font-bold text-yellow-400">#{stats.rank}</span>
                  <span className="text-xs text-green-400 font-medium flex items-center">
                    <TrendingUp className="w-3 h-3 mr-1" />+{Math.abs(stats.rankChange)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">Top 1% of predictors</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-lg p-4 border border-purple-500/20 hover:border-purple-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-purple-500/20 rounded-full flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-purple-400" />
                </div>
                <span className="text-sm text-muted-foreground">Volume</span>
              </div>
              <div className="space-y-1">
                <div className="text-xl font-bold text-purple-400">{formatVolume(stats.totalVolume)} SOL</div>
                <div className="text-xs text-muted-foreground">Total traded</div>
              </div>
            </div>

            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 rounded-lg p-4 border border-cyan-500/20 hover:border-cyan-500/40 transition-all duration-300">
              <div className="flex items-center space-x-2 mb-2">
                <div className="w-8 h-8 bg-cyan-500/20 rounded-full flex items-center justify-center">
                  <BarChart3 className="w-4 h-4 text-cyan-400" />
                </div>
                <span className="text-sm text-muted-foreground">Active Bets</span>
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline space-x-2">
                  <span className="text-xl font-bold text-cyan-400">{stats.activeBets}</span>
                  <span className="text-sm text-muted-foreground">/ {stats.totalBets}</span>
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
