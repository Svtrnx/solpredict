"use client"

import Link from "next/link"

import { ExternalLink, Clock, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type Bet = {
  id: string
  question: string
  side: "yes" | "no"
  amount: number
  currentPrice?: number
  entryPrice?: number
  pnl: number
  pnlAmount?: string
  timeLeft?: string
  status?: "winning" | "losing"
  trend?: "up" | "down"
  result?: "won" | "lost"
  payout?: number
  resolvedDate?: string
}

type ActiveBetsTabProps = {
  activeBets: Bet[]
}

function getBetUrgency(timeLeft: string) {
  const timeStr = timeLeft.toLowerCase()
  if (timeStr.includes("hour")) {
    const hours = Number.parseInt(timeStr)
    if (hours <= 24) return "critical"
    if (hours <= 24) return "urgent"
  }
  if (timeStr.includes("day")) {
    const days = Number.parseInt(timeStr)
    if (days <= 1) return "warning"
  }
  return "normal"
}

function getUrgencyStyles(urgency: string) {
  switch (urgency) {
    case "critical":
    case "urgent":
      return {
        cardClass: "border-2 border-orange-500/50 shadow-md shadow-orange-500/20",
        timeClass: "text-orange-400 font-semibold",
      }
    case "warning":
      return {
        cardClass: "border border-yellow-500/40 shadow-sm shadow-yellow-500/15",
        timeClass: "text-yellow-400 font-medium",
      }
    default:
      return { cardClass: "", timeClass: "text-muted-foreground" }
  }
}

function AnimatedPnLBar({ pnlAmount, amount, className }: { pnlAmount: string | number; amount: number; className?: string }) {
  function parseNumberLoose(v: string | number): number {
    if (typeof v === "number") return v
    const cleaned = v.replace(/[^\d\.\-,+]/g, "").replace(",", ".")
    const n = parseFloat(cleaned)
    return Number.isFinite(n) ? n : 0
  }
  const pnl = parseNumberLoose(pnlAmount)
  const isProfit = pnl > 0
  const isLoss = pnl < 0
  const rawPct = amount > 0 ? (Math.abs(pnl) / amount) * 100 : 0
  const normalizedPercentage = Math.max(0, Math.min(100, rawPct))
  const colorClass = isProfit
    ? "bg-gradient-to-r from-emerald-400 to-emerald-500"
    : isLoss
    ? "bg-gradient-to-r from-rose-500 to-rose-600"
    : "bg-gradient-to-r from-zinc-400 to-zinc-500"

  return (
    <div className={`relative w-full h-2 bg-gray-800/50 rounded-full overflow-hidden ${className ?? ""}`}>
      <div className={`h-full transition-all duration-1000 ease-out ${colorClass}`} style={{ width: `${normalizedPercentage}%` }}>
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse" />
      </div>
    </div>
  )
}

export function ActiveBetsTab({ activeBets }: ActiveBetsTabProps) {
  return (
    <div className="grid gap-4">
      {activeBets.map((bet) => {
        const urgency = getBetUrgency(bet.timeLeft!)
        const urgencyStyles = getUrgencyStyles(urgency)

        return (
          <Card key={bet.id} className={`glass glow hover:glow-cyan transition-all duration-300 ${urgencyStyles.cardClass}`}>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                <div className="lg:col-span-2">
                  <h3 className="font-semibold mb-2">{bet.question}</h3>
                  <div className="flex items-center space-x-2 mb-2">
                    <div className="flex items-center space-x-1">
                      <Badge variant="outline" className="text-xs px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                        YES {Math.round((bet.currentPrice ?? 0) * 100)}%
                      </Badge>
                      <Badge variant="outline" className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 border-red-500/30">
                        NO {Math.round((1 - (bet.currentPrice ?? 0)) * 100)}%
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Badge
                      variant={bet.side === "yes" ? "secondary" : "destructive"}
                      className={
                        bet.side === "no"
                          ? "bg-purple-500/20 text-purple-400 border-purple-500/30"
                          : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                      }
                    >
                      {bet.side}
                    </Badge>
                    <span className="text-sm text-muted-foreground">{bet.amount} SOL</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">P&L</span>
                    <div className="flex items-center space-x-1">
                      {bet.trend === "up" ? (
                        <TrendingUp className="w-3 h-3 text-emerald-400" />
                      ) : (
                        <TrendingDown className="w-3 h-3 text-rose-400" />
                      )}
                      <span className={`font-semibold ${bet.pnl ? "text-emerald-400" : "text-rose-400"}`}>{bet.pnl}</span>
                    </div>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span className={`font-semibold ${bet.pnlAmount?.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>
                      {bet.pnlAmount}
                    </span>
                  </div>
                  <AnimatedPnLBar pnlAmount={bet.pnlAmount!} amount={bet.amount!} />
                </div>

                <div className="flex flex-col">
                  <div className={`text-sm flex items-center ${urgencyStyles.timeClass}`}>
                    <Clock className={`w-3 h-3 mr-1 ${urgency === "critical" ? "animate-pulse" : ""}`} />
                    {bet.timeLeft}
                  </div>
                  <Link href={`/market/${bet.id}`} className="mt-2">
                    <Button variant="outline" size="sm" className="glass hover:glow bg-transparent cursor-pointer">
                      <ExternalLink className="w-3 h-3 mr-1" />
                      View Market
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}