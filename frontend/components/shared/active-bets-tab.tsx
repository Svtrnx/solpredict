"use client"

import { useState, useMemo, useCallback, act } from "react"
import Link from "next/link"

import { useWallet } from "@solana/wallet-adapter-react"
import { Connection } from "@solana/web3.js"

import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { prepareClaimTx } from "@/lib/services/market/marketService"
import { signAndSendBase64Tx } from "@/lib/solana/signAndSend"
import { showToast } from "@/components/shared/show-toast"
import { Card, CardContent } from "@/components/ui/card"
import type { BetData as Bet } from "@/lib/types/bet"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

import {
  ExternalLink,
  Clock,
  TrendingUp,
  TrendingDown,
  Activity,
  XCircle,
  CheckCircle,
  RotateCcw,
  Sparkles,
  AlertCircle,
  ChevronDown,
  Shuffle,
} from "lucide-react"

const FEE_BPS = 100 // 1.00%
const RESOLVER_BPS = 5 // 0.05%

type ActiveBetsTabProps = {
  activeBets: Bet[]
  isOwner: boolean
}

function getBetUrgency(endDate?: string | null) {
  if (!endDate) return "normal" as const
  const end = new Date(endDate).getTime()
  const now = Date.now()
  const diffMs = end - now
  const diffHours = diffMs / (1000 * 60 * 60)
  if (diffMs <= 0) return "urgent" as const
  if (diffHours <= 24) return "warning" as const
  return "normal" as const
}

function clamp01(x: number | null | undefined) {
  if (x == null || !Number.isFinite(x)) return 0.5
  return Math.max(0, Math.min(1, x))
}

function pYesForDisplay(bet: Bet): number | null {
  if (bet.priceYes != null) return clamp01(bet.priceYes)
  if (bet.currentPrice == null) return null
  return bet.side === "yes" ? clamp01(bet.currentPrice) : clamp01(1 - bet.currentPrice)
}

function pSideForMath(bet: Bet): number | null {
  if (bet.currentPrice != null) return clamp01(bet.currentPrice)
  const pYes = pYesForDisplay(bet)
  if (pYes == null) return null
  return bet.side === "yes" ? pYes : 1 - pYes
}

function projectIfResolvedNow(bet: Bet) {
  const amount = bet.amount
  const pSide = pSideForMath(bet)
  if (pSide == null) {
    return { win: null as number | null, loss: -amount }
  }
  const EPS = 1e-6
  const pSafe = Math.min(Math.max(pSide, EPS), 1 - EPS)

  const totalFees = (FEE_BPS + RESOLVER_BPS) / 10_000 // 1.05%
  const netIfWin = (amount * (1 - totalFees)) / pSafe
  const lossIfLose = -amount
  return { win: netIfWin, loss: lossIfLose }
}

function projectMixedPosition(bet: Bet) {
  // For mixed positions, we assume the amount is split between YES and NO
  // The actual split would need to come from backend, but we'll estimate 50/50
  const pYes = pYesForDisplay(bet)
  if (pYes == null) {
    return { yesWin: null, noWin: null, totalExposure: bet.amount }
  }

  const EPS = 1e-6
  const pYesSafe = Math.min(Math.max(pYes, EPS), 1 - EPS)
  const pNoSafe = 1 - pYesSafe

  const totalFees = (FEE_BPS + RESOLVER_BPS) / 10_000
  const halfAmount = bet.amount / 2 // Assuming 50/50 split

  const yesWinPayout = (halfAmount * (1 - totalFees)) / pYesSafe
  const noWinPayout = (halfAmount * (1 - totalFees)) / pNoSafe

  return {
    yesWin: yesWinPayout - halfAmount, // Net profit if YES wins
    noWin: noWinPayout - halfAmount, // Net profit if NO wins
    totalExposure: bet.amount,
  }
}

function buildClaimInfo(bet: Bet) {
  const isVoid = bet.marketOutcome === "void"
  const amount = bet.amount

  if (isVoid) {
    return {
      isVoid: true,
      grossAmount: amount,
      marketFee: 0,
      resolverFee: 0,
      netAmount: amount,
    }
  }

  const net = bet.payout ?? 0
  const totalFeeRate = (FEE_BPS + RESOLVER_BPS) / 10_000 // 0.0105
  const gross = net / (1 - totalFeeRate)
  const marketFee = gross * (FEE_BPS / 10_000)
  const resolverFee = gross * (RESOLVER_BPS / 10_000)

  return {
    isVoid: false,
    grossAmount: gross,
    marketFee,
    resolverFee,
    netAmount: net,
  }
}

export function ActiveBetsTab({ activeBets, isOwner }: ActiveBetsTabProps) {
  const wallet = useWallet()
  const connection = useMemo(() => new Connection("https://api.devnet.solana.com", "processed"), [])

  const [claiming, setClaiming] = useState<string | null>(null)
  const [openBreakdown, setOpenBreakdown] = useState<string | null>(null)

  const sortedBets = [...activeBets].sort((a, b) => {
    const da = new Date(a.endDate ?? 0).getTime()
    const db = new Date(b.endDate ?? 0).getTime()
    return da - db
  })

  const handleClaim = useCallback(
    async (marketPda: string) => {
      if (!wallet.publicKey) {
        showToast("danger", "Connect wallet first.")
        return
      }
      try {
        setClaiming(marketPda)
        const prep = await prepareClaimTx({ market_pda: marketPda })
        if (!prep?.tx_base64) {
          showToast("danger", "Server didn't return a transaction to sign.")
          return
        }
        const sig = await signAndSendBase64Tx(prep.tx_base64, wallet, connection)
        showToast("success", `Transaction sent: ${sig} | Bet claimed!`)
      } catch (e: any) {
        showToast("danger", e?.message || "Claim failed")
      } finally {
        setClaiming(null)
      }
    },
    [wallet, connection],
  )

  return (
    <div className="grid gap-3">
      {sortedBets.map((bet) => {
        const urgency = getBetUrgency(bet.endDate || null)
        const isVoid = bet.marketOutcome === "void"
        const isSettledNeedingClaim = !!bet.needsClaim
        const isMixed = bet.side === "mixed"

        const claimInfo = isSettledNeedingClaim ? buildClaimInfo(bet) : null
        const scenarios = !isSettledNeedingClaim && !isMixed ? projectIfResolvedNow(bet) : null
        const mixedScenarios = !isSettledNeedingClaim && isMixed ? projectMixedPosition(bet) : null

        const pYes = pYesForDisplay(bet)

        return (
          <Card
            key={bet.id}
            className={`border backdrop-blur-sm hover:shadow-lg transition-all duration-300 overflow-hidden group ${
              isSettledNeedingClaim
                ? isVoid
                  ? "border-amber-500/40 bg-gradient-to-br from-amber-500/5 via-card/80 to-card/80 shadow-amber-500/10"
                  : "border-emerald-500/40 bg-gradient-to-br from-emerald-500/5 via-card/80 to-card/80 shadow-emerald-500/10"
                : "border-border/50 bg-card/50 hover:border-border/80"
            }`}
          >
            <CardContent className="p-0">
              {isSettledNeedingClaim && (
                <div
                  className={`${
                    isVoid
                      ? "bg-gradient-to-r from-amber-500/20 via-amber-400/15 to-orange-500/20 border-b border-amber-500/30"
                      : "bg-gradient-to-r from-emerald-500/20 via-emerald-400/15 to-teal-500/20 border-b border-emerald-500/30"
                  } px-3 py-1.5`}
                >
                  <div className="flex items-center justify-between">
                    <div
                      className={`flex items-center gap-2 text-xs ${isVoid ? "text-amber-300" : "text-emerald-300"}`}
                    >
                      {isVoid ? (
                        <>
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span className="font-bold tracking-wide">MARKET VOIDED — REFUND READY</span>
                        </>
                      ) : bet.marketOutcome === "yes" ? (
                        <>
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span className="font-bold tracking-wide">YES WON — READY TO CLAIM</span>
                        </>
                      ) : bet.marketOutcome === "no" ? (
                        <>
                          <XCircle className="w-3.5 h-3.5" />
                          <span className="font-bold tracking-wide">NO WON — READY TO CLAIM</span>
                        </>
                      ) : (
                        <>
                          <Sparkles className="w-3.5 h-3.5" />
                          <span className="font-bold tracking-wide">READY TO CLAIM</span>
                        </>
                      )}
                    </div>

                    <div className={`text-xs font-bold ${isVoid ? "text-amber-400" : "text-emerald-400"}`}>
                      {(bet.payout ?? 0).toLocaleString("en-US", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      USDC
                    </div>
                  </div>
                </div>
              )}

              {!isSettledNeedingClaim && urgency === "urgent" && (
                <div className="bg-gradient-to-r from-orange-500/20 via-rose-500/15 to-rose-500/20 border-b border-orange-500/30 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs text-orange-300">
                    <AlertCircle className="w-3.5 h-3.5" />
                    <span className="font-bold tracking-wide">AWAITING RESOLVE</span>
                  </div>
                </div>
              )}
              {!isSettledNeedingClaim && urgency === "warning" && (
                <div className="bg-gradient-to-r from-yellow-500/10 via-amber-500/8 to-amber-500/10 border-b border-yellow-500/20 px-3 py-1.5">
                  <div className="flex items-center gap-2 text-xs text-yellow-300">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-semibold tracking-wide">Less than 24h remaining</span>
                  </div>
                </div>
              )}

              <div className="p-3">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold mb-2 text-balance leading-tight line-clamp-2">{bet.title}</h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      {isMixed ? (
                        <Badge
                          variant="outline"
                          className="bg-gradient-to-r from-emerald-500/15 via-purple-500/15 to-rose-500/15 text-purple-300 border-purple-500/40 font-bold text-[10px] px-2 py-0.5 tracking-wider"
                        >
                          <Shuffle className="w-3 h-3 mr-1" />
                          MIXED
                        </Badge>
                      ) : (
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
                      )}
                      <span className="text-[12px] text-muted-foreground font-mono font-semibold">
                        {bet.amount} USDC
                      </span>

                      {/* {!isVoid && pYes != null && (
                        <>
                          <span className="text-[12px] text-muted-foreground">·</span>
                          <div className="flex items-center gap-1">
                            <Activity className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[12px] text-blue-400 font-semibold">$123.2</span>
                          </div>
                        </>
                      )} */}
                    </div>
                  </div>
                </div>

                {!isVoid && pYes != null && (
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                      Current odds
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge
                        variant="outline"
                        className="text-[11px] bg-emerald-500/10 text-emerald-300 border-emerald-500/30 font-bold px-1.5 py-0"
                      >
                        YES {Math.round(pYes * 100)}%
                      </Badge>
                      <span className="text-[12px] text-muted-foreground">·</span>
                      <Badge
                        variant="outline"
                        className="text-[11px] bg-rose-500/10 text-rose-300 border-rose-500/30 font-bold px-1.5 py-0"
                      >
                        NO {Math.round((1 - pYes) * 100)}%
                      </Badge>
                    </div>
                  </div>
                )}
                {isSettledNeedingClaim && claimInfo && (
                  <Collapsible
                    open={openBreakdown === bet.id}
                    onOpenChange={(open) => setOpenBreakdown(open ? bet.id : null)}
                    className="mb-3"
                  >
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className={`w-full h-7 text-[11px] cursor-pointer font-bold uppercase tracking-widest ${
                          isVoid ? "text-amber-300 hover:text-amber-200" : "text-emerald-300 hover:text-emerald-200"
                        } hover:bg-accent/30`}
                      >
                        <span>{isVoid ? "View Refund Details" : "View Fee Breakdown"}</span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 ml-1 transition-transform ${
                            openBreakdown === bet.id ? "rotate-180" : ""
                          }`}
                        />
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="pt-2">
                      <div
                        className={`p-2.5 rounded-lg border ${
                          isVoid ? "bg-amber-500/10 border-amber-500/20" : "bg-emerald-500/10 border-emerald-500/20"
                        }`}
                      >
                        {isVoid ? (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Original Deposit</span>
                              <span className="font-bold text-foreground">{claimInfo.grossAmount.toFixed(2)} USDC</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-emerald-300">No Fees Applied</span>
                              <span className="font-bold text-emerald-400">100% Refund</span>
                            </div>
                            <div className="pt-1.5 mt-1.5 border-t border-amber-500/20 flex items-center justify-between text-[11px]">
                              <span className="font-bold text-amber-300">Total Refund</span>
                              <span className="font-black text-amber-400">{claimInfo.netAmount.toFixed(2)} USDC</span>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Gross Payout</span>
                              <span className="font-bold text-foreground">{claimInfo.grossAmount.toFixed(2)} USDC</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Market Fee (1%)</span>
                              <span className="font-bold text-rose-400">-{claimInfo.marketFee.toFixed(2)} USDC</span>
                            </div>
                            <div className="flex items-center justify-between text-[11px]">
                              <span className="text-muted-foreground">Resolver Fee (0.05%)</span>
                              <span className="font-bold text-rose-400">-{claimInfo.resolverFee.toFixed(2)} USDC</span>
                            </div>
                            <div className="pt-1.5 mt-1.5 border-t border-emerald-500/20 flex items-center justify-between text-[11px]">
                              <span className="font-bold text-emerald-300">Net Claimable</span>
                              <span className="font-black text-emerald-400">{claimInfo.netAmount.toFixed(2)} USDC</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {!isVoid && isMixed && mixedScenarios && (
                  <div className="mb-3 p-2.5 rounded-lg bg-gradient-to-br from-purple-500/10 via-muted/30 to-purple-500/10 border border-purple-500/20">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Shuffle className="w-3 h-3 text-purple-400" />
                        <span className="text-[10px] text-purple-300 uppercase tracking-widest font-bold">
                          Hedged Position
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          If YES wins
                        </span>
                        <span className="font-bold text-emerald-400">
                          {mixedScenarios.yesWin == null ? (
                            "—"
                          ) : (
                            <>
                              {mixedScenarios.yesWin >= 0 ? "+" : ""}
                              {mixedScenarios.yesWin.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              USDC <span className="text-[9px] text-emerald-400/60">(net)</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          If NO wins
                        </span>
                        <span className="font-bold text-rose-400">
                          {mixedScenarios.noWin == null ? (
                            "—"
                          ) : (
                            <>
                              {mixedScenarios.noWin >= 0 ? "+" : ""}
                              {mixedScenarios.noWin.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              USDC <span className="text-[9px] text-rose-400/60">(net)</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="pt-1.5 mt-1.5 border-t border-purple-500/20 flex items-center justify-between text-[11px]">
                        <span className="text-purple-300 font-semibold">Total Exposure</span>
                        <span className="font-bold text-purple-400">
                          {mixedScenarios.totalExposure.toFixed(2)} USDC
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                {!isVoid && scenarios && (
                  <div className="mb-3 p-2.5 rounded-lg bg-muted/30 border border-border/30">
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-emerald-400" />
                          If your side wins
                        </span>
                        <span className="font-bold text-emerald-400">
                          {scenarios.win == null ? (
                            "—"
                          ) : (
                            <>
                              +
                              {scenarios.win.toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })}{" "}
                              USDC <span className="text-[9px] text-emerald-400/60">(net)</span>
                            </>
                          )}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-[12px]">
                        <span className="text-muted-foreground flex items-center gap-1">
                          <TrendingDown className="w-3 h-3 text-rose-400" />
                          If your side loses
                        </span>
                        <span className="font-bold text-rose-400">
                          −
                          {Math.abs(scenarios.loss).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })}{" "}
                          USDC
                        </span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-2.5 border-t border-border/50">
                  <div className="flex items-center gap-1.5 text-[12px] text-muted-foreground font-medium">
                    <Clock className="w-3 h-3" />
                    <span>
                      {new Date(bet.endDate ?? 0).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {isSettledNeedingClaim && isOwner && (
                      <Button
                        style={{ width: 130 }}
                        size="lg"
                        disabled={claiming === bet.marketPda}
                        onClick={() => handleClaim(bet.marketPda)}
                        className={`${
                          isVoid
                            ? "bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 shadow-amber-500/20 hover:shadow-amber-500/30"
                            : "bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 shadow-emerald-500/20 hover:shadow-emerald-500/30"
                        } text-black font-bold h-7 text-[11px] px-3 shadow-lg transition-all cursor-pointer`}
                      >
                        {isVoid ? (
                          <>
                            <RotateCcw className="w-3 h-3 mr-1" />
                            {claiming === bet.marketPda ? "Claiming..." : "Claim Refund"}
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-3 h-3 mr-1" />
                            {claiming === bet.marketPda ? "Claiming..." : "Claim"}
                          </>
                        )}
                      </Button>
                    )}
                    <Link href={`/market/${bet.marketPda}`}>
                      <Button
                        style={{ width: 130 }}
                        variant="outline"
                        size="lg"
                        className="bg-transparent cursor-pointer hover:bg-accent/50 border-border/50 hover:border-border h-7 text-[11px] px-2.5 font-semibold width-[20px]"
                      >
                        <ExternalLink className="w-3 h-3 mr-1" />
                        Market
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
