"use client"

import { useState } from "react"
import Link from "next/link"

import {
  ExternalLink,
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  RotateCcw,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  DollarSign,
  Target,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import type { BetData as Bet } from "@/lib/types/bet"

type HistoryBetsTabProps = {
  historyBets: Bet[]
}

function calculatePnL(bet: Bet): number {
  if (bet.result === "void") {
    return 0
  }
  const payout = bet.payout ?? 0
  const amount = bet.amount
  return payout - amount
}

function calculateROI(bet: Bet): number {
  if (bet.result === "void") {
    return 0
  }
  const pnl = calculatePnL(bet)
  return (pnl / bet.amount) * 100
}

function getPriceMovement(bet: Bet): { change: number; percentage: number } | null {
  if (!bet.entryPrice || !bet.currentPrice) return null
  const change = bet.currentPrice - bet.entryPrice
  const percentage = (change / bet.entryPrice) * 100
  return { change, percentage }
}

export function HistoryBetsTab({ historyBets }: HistoryBetsTabProps) {
  const [openDetails, setOpenDetails] = useState<string | null>(null)

  const sortedBets = [...historyBets].sort((a, b) => {
    const dateA = new Date(a.resolvedDate ?? 0).getTime()
    const dateB = new Date(b.resolvedDate ?? 0).getTime()
    return dateB - dateA
  })

  return (
    <div className="grid gap-3">
      {sortedBets.map((bet) => {
        const pnl = calculatePnL(bet)
        const roi = calculateROI(bet)
        const priceMovement = getPriceMovement(bet)
        const isWon = bet.result === "won"
        const isVoid = bet.result === "void"
        const isLost = bet.result === "lost"

        const displayAmount = isVoid ? bet.amount : pnl

        return (
          <Card
            key={bet.id}
            className={`border backdrop-blur-sm hover:shadow-lg transition-all duration-300 overflow-hidden group ${
              isWon
                ? "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card/80 to-card/80 shadow-emerald-500/10"
                : isVoid
                  ? "border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card/80 to-card/80 shadow-amber-500/10"
                  : "border-rose-500/40 bg-gradient-to-br from-rose-500/5 via-card/80 to-card/80 shadow-rose-500/10"
            }`}
          >
            <CardContent className="p-0">
              <div
                className={`${
                  isWon
                    ? "bg-gradient-to-r from-emerald-500/20 via-emerald-400/15 to-teal-500/20 border-b border-emerald-500/30"
                    : isVoid
                      ? "bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-orange-500/20 border-b border-amber-500/30"
                      : "bg-gradient-to-r from-rose-500/20 via-rose-400/15 to-red-500/20 border-b border-rose-500/30"
                } px-3 py-1.5`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex items-center gap-2 text-xs ${
                      isWon ? "text-emerald-300" : isVoid ? "text-amber-300" : "text-rose-300"
                    }`}
                  >
                    {isWon ? (
                      <>
                        <Trophy className="w-3.5 h-3.5" />
                        <span className="font-bold tracking-wide">WON</span>
                      </>
                    ) : isVoid ? (
                      <>
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span className="font-bold tracking-wide">VOIDED</span>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-3.5 h-3.5" />
                        <span className="font-bold tracking-wide">LOST</span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <div
                      className={`flex items-center gap-1 text-xs font-bold ${
                        isWon ? "text-emerald-400" : isVoid ? "text-amber-400" : "text-rose-400"
                      }`}
                    >
                      {isWon ? (
                        <ArrowUpRight className="w-3.5 h-3.5" />
                      ) : isLost ? (
                        <ArrowDownRight className="w-3.5 h-3.5" />
                      ) : null}
                      <span>
                        {isWon ? "+" : ""}
                        {displayAmount.toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        USDC
                      </span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`${
                        isWon
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                          : isVoid
                            ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                            : "bg-rose-500/20 text-rose-300 border-rose-500/40"
                      } font-bold text-[10px] px-1.5 py-0`}
                    >
                      {isWon ? "+" : ""}
                      {roi.toFixed(1)}%
                    </Badge>
                  </div>
                </div>
              </div>

              <div className="p-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold mb-2 text-balance leading-tight line-clamp-2">{bet.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge
                        variant="outline"
                        className={`${
                          bet.side === "yes"
                            ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                            : "bg-rose-500/15 text-rose-300 border-rose-500/40"
                        } font-bold text-[10px] px-2 py-0.5 tracking-wider`}
                      >
                        {bet.side.toUpperCase()}
                      </Badge>
                      <span className="text-[12px] text-muted-foreground font-mono font-semibold">
                        {bet.amount} USDC
                      </span>

                      {bet.marketOutcome && (
                        <>
                          <span className="text-[12px] text-muted-foreground">·</span>
                          <div className="flex items-center gap-1">
                            <Target className="w-3 h-3 text-blue-400" />
                            <span className="text-[11px] text-blue-400 font-semibold uppercase">
                              {bet.marketOutcome} won
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* {priceMovement && !isVoid && (
                  <div className="mb-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Entry Price</span>
                        <span className="font-bold text-foreground font-mono">${bet.entryPrice?.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground">Final Price</span>
                        <span className="font-bold text-foreground font-mono">${bet.currentPrice?.toFixed(3)}</span>
                      </div>
                      <div className="flex items-center justify-between text-[12px] pt-1 border-t border-border/30">
                        <span className="text-muted-foreground">Price Movement</span>
                        <div
                          className={`flex items-center gap-1 font-bold ${
                            priceMovement.change > 0
                              ? "text-emerald-400"
                              : priceMovement.change < 0
                                ? "text-rose-400"
                                : "text-muted-foreground"
                          }`}
                        >
                          {priceMovement.change > 0 ? (
                            <TrendingUp className="w-3 h-3" />
                          ) : priceMovement.change < 0 ? (
                            <TrendingDown className="w-3 h-3" />
                          ) : null}
                          <span>
                            {priceMovement.change > 0 ? "+" : ""}
                            {priceMovement.percentage.toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )} */}

                <Collapsible
                  open={openDetails === bet.id}
                  onOpenChange={(open) => setOpenDetails(open ? bet.id : null)}
                  className="mb-3"
                >
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className={`w-full h-7 text-[11px] cursor-pointer font-bold uppercase tracking-widest ${
                        isWon
                          ? "text-emerald-300 hover:text-emerald-200"
                          : isVoid
                            ? "text-amber-300 hover:text-amber-200"
                            : "text-rose-300 hover:text-rose-200"
                      } hover:bg-accent/30`}
                    >
                      <span>View Payout Details</span>
                      <ChevronDown
                        className={`w-3.5 h-3.5 ml-1 transition-transform ${
                          openDetails === bet.id ? "rotate-180" : ""
                        }`}
                      />
                    </Button>
                  </CollapsibleTrigger>

                  <CollapsibleContent className="pt-2">
                    <div
                      className={`p-2.5 rounded-lg border ${
                        isWon
                          ? "bg-emerald-500/10 border-emerald-500/20"
                          : isVoid
                            ? "bg-amber-500/10 border-amber-500/20"
                            : "bg-rose-500/10 border-rose-500/20"
                      }`}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            Bet Amount
                          </span>
                          <span className="font-bold text-foreground">{bet.amount.toFixed(2)} USDC</span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Payout Received</span>
                          <span className="font-bold text-foreground">{(bet.payout ?? 0).toFixed(2)} USDC</span>
                        </div>
                        <div className="pt-1.5 mt-1.5 border-t border-border/30 flex items-center justify-between text-[11px]">
                          <span
                            className={`font-bold ${
                              isWon ? "text-emerald-300" : isVoid ? "text-amber-300" : "text-rose-300"
                            }`}
                          >
                            Net Profit/Loss
                          </span>
                          <span
                            className={`font-black ${
                              pnl > 0 ? "text-emerald-400" : pnl < 0 ? "text-rose-400" : "text-amber-400"
                            }`}
                          >
                            {pnl > 0 ? "+" : ""}
                            {pnl.toFixed(2)} USDC
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground">Return on Investment</span>
                          <span
                            className={`font-bold ${
                              roi > 0 ? "text-emerald-400" : roi < 0 ? "text-rose-400" : "text-amber-400"
                            }`}
                          >
                            {roi > 0 ? "+" : ""}
                            {roi.toFixed(2)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  </CollapsibleContent>
                </Collapsible>

                <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium">
                    <Calendar className="w-3 h-3" />
                    <span>
                      {bet.resolvedDate
                        ? new Date(bet.resolvedDate).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "Unknown"}
                    </span>
                  </div>

                  <Link href={`/market/${bet.marketPda}`}>
                    <Button
                      style={{width: 130}}
                      variant="outline"
                      size="sm"
                      className="bg-transparent cursor-pointer hover:bg-accent/50 border-border/50 hover:border-border h-7 text-[11px] px-2.5 font-semibold"
                    >
                      <ExternalLink className="w-3 h-3 mr-1" />
                      Market
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
