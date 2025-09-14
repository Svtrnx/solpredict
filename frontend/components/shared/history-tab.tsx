"use client"

import Link from "next/link"

import { ExternalLink, Clock, TrendingUp, TrendingDown } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export type Bet = {
  id: string
  question: string
  side: "YES" | "NO"
  amount: number
  currentPrice?: number
  entryPrice?: number
  pnl: string
  pnlAmount?: string
  timeLeft?: string
  status?: "winning" | "losing"
  trend?: "up" | "down"
  result?: "WON" | "LOST"
  payout?: string
  resolvedDate?: string
}

type HistoryBetsTabProps = {
  historyBets: Bet[]
}

export function HistoryBetsTab({ historyBets }: HistoryBetsTabProps) {
  return (
    <div className="grid gap-4">
      {historyBets.map((bet) => (
        <Card key={bet.id} className="glass glow">
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <h3 className="font-semibold mb-2">{bet.question}</h3>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={bet.side === "YES" ? "secondary" : "destructive"}
                    className={
                      bet.side === "YES" ? "bg-purple-500/20 text-purple-400 border-purple-500/30" : ""
                    }
                  >
                    {bet.side}
                  </Badge>
                  <span className="text-sm text-muted-foreground">{bet.amount}</span>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Result</span>
                  <Badge
                    variant={bet.result === "WON" ? "secondary" : "destructive"}
                    className={
                      bet.result === "WON"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                        : "bg-rose-500/20 text-rose-400 border-rose-500/30"
                    }
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
                  <span
                    className={`font-semibold ${bet.pnl.startsWith("+") ? "text-emerald-400" : "text-rose-400"}`}
                  >
                    {bet.pnl}
                  </span>
                </div>
              </div>

              <div className="text-sm text-muted-foreground">Resolved: {bet.resolvedDate}</div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}