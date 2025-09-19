"use client"
// =========== DEMO! ===========
import Link from "next/link"

import { Clock, ExternalLink, TrendingDown, TrendingUp } from "lucide-react"

import { getBetUrgency, getUrgencyStyles } from "@/lib/utils/bet-urgency"
import { AnimatedPnLBar } from "@/components/ui/animated-pnl-bar"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { BetData } from "@/lib/types"


interface BetCardProps {
  bet: BetData
  type: "active" | "history"
}

const formatAmount = (amount: string) => {
  // Extract numeric value and sign
  const sign = amount.startsWith("+") ? "+" : amount.startsWith("-") ? "-" : ""
  const numericValue = Number.parseFloat(amount.replace(/[+-]/g, ""))
  const usdValue = (numericValue * 40).toFixed(0) // Assuming 1 SOL = $40 !CHANGE!

  return (
    <span>
      {sign}
      {numericValue.toFixed(2)} SOL{" "}
      <span className="text-muted-foreground/70">
        (${sign}
        {usdValue})
      </span>
    </span>
  )
}

export function BetCard({ bet, type }: BetCardProps) {
  const urgency = type === "active" && bet.timeLeft ? getBetUrgency(bet.timeLeft) : "normal"
  const urgencyStyles = getUrgencyStyles(urgency)

  return (
    <Card className={`glass glow hover:glow-cyan transition-all duration-300 ${urgencyStyles.cardClass}`}>
      <CardContent className="pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="lg:col-span-2">
            <h3 className="font-semibold mb-2">{bet.question}</h3>

            {type === "active" && bet.currentPrice && (
              <div className="flex items-center space-x-2 mb-2">
                <div className="flex items-center space-x-1">
                  <Badge
                    variant="outline"
                    className="text-xs px-2 py-0.5 bg-purple-500/10 text-purple-400 border-purple-500/30"
                  >
                    YES {Math.round(bet.currentPrice * 100)}%
                  </Badge>
                  <Badge variant="outline" className="text-xs px-2 py-0.5 bg-red-500/10 text-red-400 border-red-500/30">
                    NO {Math.round((1 - bet.currentPrice) * 100)}%
                  </Badge>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <Badge
                variant={bet.side === "YES" ? "default" : "destructive"}
                className={bet.side === "YES" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : ""}
              >
                {bet.side}
              </Badge>
              {formatAmount(bet.amount)}
            </div>
          </div>

          <div className="space-y-2">
            {type === "active" ? (
              <>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">P&L</span>
                  <div className="flex items-center space-x-1">
                    {bet.trend === "up" ? (
                      <TrendingUp className="w-3 h-3 text-emerald-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-rose-400" />
                    )}
                    <span className={`font-semibold ${bet.pnl.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>
                      {bet.pnl}
                    </span>
                  </div>
                </div>
                {bet.pnlAmount && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Amount</span>
                    <span
                      className={`font-semibold ${bet.pnlAmount.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}
                    >
                      {formatAmount(bet.pnlAmount)}
                    </span>
                  </div>
                )}
                {bet.trend && <AnimatedPnLBar pnl={bet.pnl} trend={bet.trend} />}
              </>
            ) : (
              <>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Result</span>
                  <Badge
                    variant={bet.result === "WON" ? "default" : "destructive"}
                    className={bet.result === "WON" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : ""}
                  >
                    {bet.result === "WON" ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {bet.result}
                  </Badge>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Payout</span>
                  <span className="font-semibold">{bet.payout}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">P&L</span>
                  <span className={`font-semibold ${bet.pnl.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}>
                    {bet.pnl}
                  </span>
                </div>
              </>
            )}
          </div>

          <div className="flex flex-col justify-between">
            {type === "active" ? (
              <>
                <div className={`text-sm flex items-center ${urgencyStyles.timeClass}`}>
                  <Clock className={`w-3 h-3 mr-1 ${urgency === "critical" ? "animate-pulse" : ""}`} />
                  {bet.timeLeft}
                </div>
                <Link href={`/market/${bet.id}`}>
                  <Button variant="outline" size="sm" className="glass hover:glow bg-transparent cursor-pointer">
                    <ExternalLink className="w-3 h-3 mr-1" />
                    View Market
                  </Button>
                </Link>
              </>
            ) : (
              <div className="text-sm text-muted-foreground">Resolved: {bet.resolvedDate}</div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
