"use client"

import Link from "next/link"
import { useState, useEffect, useMemo, useCallback } from "react"

import { useWallet } from "@solana/wallet-adapter-react"
import { useParams, useRouter } from "next/navigation"
import { Connection } from "@solana/web3.js"

import { Tooltip as Tooltip_, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { RecentBets } from "@/components/market/recent-bets"
import { ShimmerSkeleton } from "@/components/ui/skeleton"
import PythChart from "@/components/pyth-price-chart"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { AlertTriangle, BarChart3, Clock, DollarSign, Users, Copy, User, Check, Info, Lock } from "lucide-react"

import { RecentBetsSkeleton, ChartSkeleton, PriceCardSkeleton, BettingCardSkeleton, InfoBarSkeleton } from "./skeletons"
import { openStepper, startStep, completeStep } from "@/lib/features/resolutionStepperSlice"
import { ResolutionStepper } from "@/components/resolution-stepper"
import { getMarket } from "@/lib/services/market/marketService"
import { signAndSendBase64Tx } from "@/lib/solana/signAndSend"
import { useAppSelector, useAppDispatch } from "@/lib/hooks"
import { cn, fmtCents, fmtCompact, diff } from "@/lib/utils"
import { prepareBet } from "@/lib/services/bet/betsService"
import { showToast } from "@/components/shared/show-toast"
import type { Market, TimeLeft } from "@/lib/types"
import { useMobile } from "@/hooks/use-mobile"

import { resolveMarketWithPyth } from "@/lib/features/market/resolve"

interface PayoutCalculation {
  shares: number
  potentialPayout: number
  profit: number
}

function CountdownTimer({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => diff(endAt))

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(diff(endAt)), 1000)
    return () => clearInterval(id)
  }, [endAt])

  return (
    <div className="flex items-center space-x-2">
      {Object.entries(timeLeft).map(([unit, value]) => (
        <div key={unit} className="flex items-center space-x-1">
          <span className="text-sm font-semibold tabular-nums">
            <SlidingNumber value={value} padStart />
          </span>
          <span className="text-xs text-muted-foreground">{unit.slice(0, 1)}</span>
        </div>
      ))}
    </div>
  )
}

const PriceCard = ({
  side,
  price,
  volume,
  isYes,
  className,
  onClick,
  disabled,
}: {
  side: string
  price: number
  volume: number
  isYes: boolean
  className?: string
  onClick?: () => void
  disabled?: boolean
}) => (
  <Card
    onClick={disabled ? undefined : onClick}
    className={cn(
      "glass relative overflow-hidden transition-all duration-200 border-2",
      !disabled && "hover:scale-[1.01] cursor-pointer",
      !disabled && (isYes ? "hover:border-emerald-500/40" : "hover:border-rose-500/40"),
      disabled && "opacity-60 cursor-not-allowed",
      className,
    )}
  >
    <div
      className={cn(
        "absolute inset-0 pointer-events-none",
        isYes
          ? "bg-gradient-to-br from-emerald-500/[0.03] via-transparent to-transparent"
          : "bg-gradient-to-br from-rose-500/[0.03] via-transparent to-transparent",
      )}
    />

    <CardContent className="relative p-3 space-y-2">
      <div className="flex items-center justify-between">
        <Badge
          variant="outline"
          className={cn(
            "text-xs font-bold uppercase tracking-wider px-2.5 py-0.5 shadow-sm backdrop-blur-sm",
            isYes
              ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-400"
              : "bg-rose-500/10 border-rose-500/40 text-rose-400",
          )}
        >
          {side}
        </Badge>
        <span className="text-[10px] uppercase tracking-widest text-muted-foreground/40 font-semibold">
          Share Price
        </span>
      </div>

      <div className="text-center py-2">
        <div className="text-3xl font-bold tabular-nums tracking-tight bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text">
          {fmtCents(price)}
        </div>
        <div className="text-[10px] text-muted-foreground/50 uppercase tracking-wider mt-0.5 font-medium">
          per share
        </div>
      </div>

      <div className="glass rounded-lg p-2 border border-border/40 bg-gradient-to-br from-accent/5 via-transparent to-purple-500/5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <div className="p-1 rounded bg-purple-500/10">
              <BarChart3 className="w-3 h-3 text-purple-400" />
            </div>
            <span className="text-xs text-muted-foreground/70 font-medium">Side Volume</span>
          </div>
          <span className="text-sm font-bold tabular-nums bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            {fmtCompact(volume)} USDC
          </span>
        </div>
      </div>
    </CardContent>
  </Card>
)

export default function MarketPage() {
  const dispatch = useAppDispatch()

  const isMobile = useMobile()
  const router = useRouter()
  const { isAuthorized } = useAppSelector((state) => state.wallet)
  const { id: raw } = useParams<{ id: string | string[] }>()
  const market_pda = Array.isArray(raw) ? raw[0] : (raw ?? "")

  const [betAmount, setBetAmount] = useState("")
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null)
  const [isPlacingBet, setIsPlacingBet] = useState(false)

  const walletBalance = useAppSelector((s) => s.wallet.balance)
  const numericBalance = walletBalance ?? 0

  const [isLoading, setIsLoading] = useState(true)

  const [market, setMarket] = useState<Market | null>(null)
  const [error, setError] = useState<string | null>(null)

  const [copied, setCopied] = useState(false)

  const quickAmounts = [1, 5, 50, 100]

  const calculatePayout = useCallback((): PayoutCalculation | null => {
    if (!betAmount || !selectedSide || !market) return null
    const amount = Number.parseFloat(betAmount)
    const price = selectedSide === "yes" ? market.yesPrice : market.noPrice
    const shares = amount / price
    const potentialPayout = shares * 1
    const profit = potentialPayout - amount
    return { shares, potentialPayout, profit }
  }, [betAmount, selectedSide, market])

  const payout = calculatePayout()

  const wallet = useWallet()
  const connection = useMemo(() => new Connection("https://api.devnet.solana.com", "processed"), [])
  type ResolveStepId = "post:init" | "post:write" | "resolve"

  const fetchMarketData = useCallback(async () => {
    try {
      const data = await getMarket(market_pda)
      setMarket(data)
    } catch (e: any) {
      console.error("Failed to refresh market data:", e)
    }
  }, [market_pda])

  async function handleResolve() {
    try {
      const idxOf: Record<ResolveStepId, number> = {
        "post:init": 0,
        "post:write": 1,
        resolve: 2,
      }

      await resolveMarketWithPyth({
        connection,
        walletAdapter: wallet,
        marketPda: market_pda,
        closeUpdateAccounts: true,
        onProgress: (e) => {
          if (e.kind === "start") {
            const stepIndex = idxOf[e.step]
            dispatch(startStep(stepIndex))
          } else if (e.kind === "success") {
            const stepIndex = idxOf[e.step]
            if (e.step === "post:write") {
              dispatch(completeStep({ stepIndex: 0, status: "success" }))
              dispatch(completeStep({ stepIndex: 1, status: "success" }))
              return
            }
            dispatch(completeStep({ stepIndex, status: "success" }))
          } else if (e.kind === "warning") {
            const stepIndex = idxOf[e.step]
            dispatch(
              completeStep({
                stepIndex,
                status: "warning",
                message: e.message,
              }),
            )
          } else if (e.kind === "error") {
            const stepIndex = idxOf[e.step]
            dispatch(
              completeStep({
                stepIndex,
                status: "error",
                message: e.error,
              }),
            )
          }
        },
      })

      console.log("Market resolution completed")

      setTimeout(() => {
        fetchMarketData()
      }, 2200)
    } catch (err: any) {
      console.error("Failed to resolve market:", err)
    }
  }

  const handleBet = useCallback(async () => {
    if (!selectedSide || !betAmount || !market) return

    try {
      setIsPlacingBet(true)

      const amount = Number.parseFloat(String(betAmount).replace(",", "."))
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast("danger", "Enter a valid amount")
        return
      }
      if (amount > numericBalance) {
        showToast("danger", "Insufficient balance")
        return
      }

      const prep = await prepareBet({
        market_pda: market_pda,
        side: selectedSide,
        amount_ui: amount,
      })

      if (!prep?.tx_base64) {
        showToast("danger", "Server didn't return a transaction to sign.")
        return
      }

      const sig = await signAndSendBase64Tx(prep.tx_base64, wallet, connection)
      showToast("success", `Transaction sent: ${sig} | Bet placed!`)

      setBetAmount("")
      setSelectedSide(null)

      setTimeout(() => {
        fetchMarketData()
      }, 2200)
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (/blockhash/i.test(msg)) {
        showToast("danger", "Transaction expired. Please try again.")
      } else {
        showToast("danger", "Failed to place bet.")
      }
      console.error(err)
    } finally {
      setIsPlacingBet(false)
    }
  }, [selectedSide, betAmount, market, numericBalance, wallet, connection, market_pda, fetchMarketData])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        setIsLoading(true)
        setError(null)
        const data = await getMarket(market_pda)
        if (alive) setMarket(data)
      } catch (e: any) {
        if (alive) setError(e?.message ?? "Failed to load market")
      } finally {
        if (alive) setIsLoading(false)
      }
    })()
    return () => {
      alive = false
    }
  }, [market_pda])

  useEffect(() => {
    const intervalId = setInterval(() => {
      fetchMarketData()
    }, 30000) // 30 seconds

    return () => {
      clearInterval(intervalId)
    }
  }, [fetchMarketData])

  const handleQuickAmount = useCallback((amount: number) => {
    setBetAmount(amount.toString())
  }, [])

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-background relative overflow-hidden ${isMobile ? "pt-40" : "pt-24"}`}>
        <div className="absolute inset-0 radial-glow"></div>

        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <div className="space-y-4">
            {/* Title skeleton */}
            <div className="space-y-3">
              <ShimmerSkeleton className="h-10 w-full max-w-4xl" />
              <ShimmerSkeleton className="h-10 w-3/4 max-w-3xl" />
            </div>

            <InfoBarSkeleton />

            {/* Price cards grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <PriceCardSkeleton isYes={true} />
              <PriceCardSkeleton isYes={false} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              <div className="lg:col-span-2 space-y-6">
                <ChartSkeleton />
              </div>

              <div className="space-y-6">
                <BettingCardSkeleton />
                <RecentBetsSkeleton />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !market) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass p-6 rounded-xl border">
          <p className="text-red-400 font-medium mb-2">Failed to load market</p>
          <p className="text-muted-foreground text-sm">{error ?? "Unknown error"}</p>
        </div>
      </div>
    )
  }

  const handleBlur = () => {
    const n = Number.parseFloat(betAmount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) return setBetAmount("")
    const clamped = Math.min(n, numericBalance)
    setBetAmount(clamped.toFixed(2))
  }

  const statusLabel = { open: "Active", locked: "Locked", settled: "Settled", void: "Void" }[market.status]
  const canPlace = !!selectedSide && !!betAmount && Number.parseFloat(betAmount) <= numericBalance && !isPlacingBet

  const isLocked = market?.status === "locked"
  const hasEnded = new Date(market.endDate) <= new Date()
  const canResolve = hasEnded && (market.status === "open" || market.status === "locked")
  const isVoid = market?.status === "void"
  const isSettled = market?.status === "settled"

  const handleCopy = async (address: string) => {
    try {
      await navigator.clipboard.writeText(address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className={`min-h-screen bg-background relative overflow-hidden ${isMobile ? "pt-40" : "pt-24"}`}>
      <div className="absolute inset-0 radial-glow"></div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold gradient-text leading-tight animate-fade-in-up animate-spring">
            {market.title}
          </h1>

          <div className="glass p-4 rounded-xl border border-accent/30 animate-fade-in-up animation-delay-100 animate-staggered">
            <div className="flex flex-wrap items-center gap-4 text-sm">
              <div className="flex items-center space-x-2">
                <Badge variant="secondary" className="bg-purple-600/20 text-purple-500 border-purple-500/30">
                  {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
                </Badge>
                <Badge variant="outline" className="glass">
                  <Clock className="w-3 h-3 mr-1" />
                  {statusLabel}
                </Badge>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block"></div>

              <div className="flex items-center space-x-2 text-muted-foreground">
                <User className="w-4 h-4" />
                <span className="text-xs">Creator:</span>
                <TooltipProvider delayDuration={100}>
                  <Tooltip_>
                    <TooltipTrigger asChild>
                      <span className="font-mono text-xs cursor-pointer hover:text-foreground transition-colors">
                        {market.creator.slice(0, 6)}...{market.creator.slice(-4)}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent className="p-2 bg-card border border-border">
                      <div className="flex flex-col gap-2 min-w-[200px]">
                        <div className="flex gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              handleCopy(market.creator)
                            }}
                            className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                          >
                            {copied ? (
                              <>
                                <Check className="w-3 h-3 mr-1" />
                                Copied
                              </>
                            ) : (
                              <>
                                <Copy className="w-3 h-3 mr-1" />
                                Copy
                              </>
                            )}
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                          >
                            <Link href={`/profile/${market.creator}`} target="_blank" rel="noopener noreferrer">
                              <User className="w-3 h-3 mr-1" />
                              Profile
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip_>
                </TooltipProvider>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block"></div>

              <div className="flex items-center space-x-4 text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-4 h-4" />
                  <span className="text-xs font-semibold text-foreground">
                    {fmtCompact(market.totalVolume)} <span className="text-[#737171] text-[10px] ml-0.5">USDC</span>
                  </span>
                </div>
                <div className="flex items-center space-x-1">
                  <Users className="w-4 h-4" />
                  <span className="text-xs font-semibold text-foreground">
                    {new Intl.NumberFormat("en-US").format(market.participants)}
                  </span>
                </div>
              </div>

              <div className="h-4 w-px bg-border hidden sm:block"></div>

              <div className="flex items-center space-x-2 text-muted-foreground">
                <Clock className="w-4 h-4" />
                <CountdownTimer endAt={market.endDate} />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="animate-slide-left animation-delay-150">
              <PriceCard
                side="YES"
                price={market.yesPrice}
                volume={market.yesTotalVolume}
                isYes={true}
                className="glow-green"
                onClick={() => setSelectedSide(selectedSide === "yes" ? null : "yes")}
                disabled={isLocked}
              />
            </div>
            <div className="animate-slide-right animation-delay-150">
              <PriceCard
                side="NO"
                price={market.noPrice}
                volume={market.noTotalVolume}
                isYes={false}
                className="glow"
                onClick={() => setSelectedSide(selectedSide === "no" ? null : "no")}
                disabled={isLocked}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 space-y-6 animate-fade-in animation-delay-250">
              <PythChart symbol={market.symbol} feedId={market.feedId} />
            </div>

            <div className="space-y-6 animate-fade-in-up animation-delay-300">
              {isVoid && (
                <Card className="glass border-2 border-orange-500/30">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-gradient-to-br from-orange-500/20 to-orange-600/20 border-2 border-orange-500/40 shadow-lg shadow-orange-500/20">
                        <AlertTriangle className="w-8 h-8 text-orange-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold text-orange-400">Market Voided</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          This market has been voided and cancelled. All bets placed on this market will be refunded to
                          participants.
                        </p>
                      </div>
                      <div className="glass p-4 rounded-lg border border-orange-500/30 w-full bg-gradient-to-br from-orange-500/5 via-transparent to-transparent">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Volume</span>
                            <span className="text-lg font-bold text-foreground">
                              {fmtCompact(market.totalVolume)} USDC
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground/70">
                            Will be refunded to {market.participants} participants
                          </div>
                        </div>
                      </div>
                      {market.settler && (
                        <div className="glass p-3 rounded-lg border border-border/40 w-full">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Voided by</span>
                            <TooltipProvider delayDuration={100}>
                              <Tooltip_>
                                <TooltipTrigger asChild>
                                  <span className="font-mono text-xs cursor-pointer hover:text-[#a9a9a9] transition-colors">
                                    {market.settler.slice(0, 11)}...{market.settler.slice(-9)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent className="p-2 bg-card border border-border">
                                  <div className="flex flex-col gap-2 min-w-[200px]">
                                    <div className="flex gap-2">
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          handleCopy(market.settler ? market.settler : "")
                                        }}
                                        className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                                      >
                                        {copied ? (
                                          <>
                                            <Check className="w-3 h-3 mr-1" />
                                            Copied
                                          </>
                                        ) : (
                                          <>
                                            <Copy className="w-3 h-3 mr-1" />
                                            Copy
                                          </>
                                        )}
                                      </Button>
                                      <Button
                                        asChild
                                        variant="outline"
                                        size="sm"
                                        className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                                      >
                                        <Link
                                          href={`/profile/${market.settler}`}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                        >
                                          <User className="w-3 h-3 mr-1" />
                                          Profile
                                        </Link>
                                      </Button>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip_>
                            </TooltipProvider>
                          </div>
                        </div>
                      )}
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline" className="bg-orange-500/10 border-orange-500/30 text-orange-400">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Void
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isSettled && (
                <Card className="glass border-2 border-emerald-500/30">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-gradient-to-br from-emerald-500/20 to-emerald-600/20 border-2 border-emerald-500/40 shadow-lg shadow-emerald-500/20">
                        <Check className="w-8 h-8 text-emerald-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold gradient-text">Market Settled</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          This market has been resolved. Winners can claim their payouts.
                        </p>
                      </div>
                      <div className="glass p-4 rounded-lg border border-emerald-500/30 w-full bg-gradient-to-br from-emerald-500/5 via-transparent to-transparent">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-muted-foreground">Winning Side</span>
                            <Badge
                              className={cn(
                                "text-sm font-bold",
                                market.yesPrice === 1
                                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                  : "bg-rose-500/20 text-rose-400 border-rose-500/30",
                              )}
                            >
                              {market.yesPrice === 1 ? "YES" : "NO"}
                            </Badge>
                          </div>
                          <div className="h-px bg-border/50"></div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Total Volume</span>
                            <span className="text-lg font-bold text-foreground">
                              {fmtCompact(market.totalVolume)} USDC
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Participants</span>
                            <span className="font-semibold text-foreground">{market.participants}</span>
                          </div>
                        </div>
                      </div>
                      {market.settler && (
                        <div className="glass p-3 rounded-lg border border-border/40 w-full">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Resolved by</span>
                            <span className="text-xs font-mono text-foreground">
                              <TooltipProvider delayDuration={100}>
                                <Tooltip_>
                                  <TooltipTrigger asChild>
                                    <span className="font-mono text-xs cursor-pointer hover:text-[#a9a9a9] transition-colors">
                                      {market.settler.slice(0, 11)}...{market.settler.slice(-9)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent className="p-2 bg-card border border-border">
                                    <div className="flex flex-col gap-2 min-w-[200px]">
                                      <div className="flex gap-2">
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          onClick={() => {
                                            handleCopy(market.settler ? market.settler : "")
                                          }}
                                          className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                                        >
                                          {copied ? (
                                            <>
                                              <Check className="w-3 h-3 mr-1" />
                                              Copied
                                            </>
                                          ) : (
                                            <>
                                              <Copy className="w-3 h-3 mr-1" />
                                              Copy
                                            </>
                                          )}
                                        </Button>
                                        <Button
                                          asChild
                                          variant="outline"
                                          size="sm"
                                          className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent"
                                        >
                                          <Link
                                            href={`/profile/${market.settler}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                          >
                                            <User className="w-3 h-3 mr-1" />
                                            Profile
                                          </Link>
                                        </Button>
                                      </div>
                                    </div>
                                  </TooltipContent>
                                </Tooltip_>
                              </TooltipProvider>
                            </span>
                          </div>
                        </div>
                      )}
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Resolved at</span>
                          <span className="text-xs font-mono text-foreground">
                            {new Date(market.endDate).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      {isAuthorized && (
                        <Button
                          onClick={() => (window.location.href = "/dashboard")}
                          className="w-full h-11 text-sm font-bold cursor-pointer bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 shadow-lg shadow-emerald-500/20"
                        >
                          Claim Winnings
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isAuthorized && canResolve && (
                <Card className="glass border-2 border-purple-500/30">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/40 shadow-lg shadow-purple-500/20">
                        <DollarSign className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold gradient-text">Earn Resolver Fee</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          This market has ended and needs to be resolved. Connect your wallet to resolve this market and
                          earn the resolver fee.
                        </p>
                      </div>
                      <div className="glass p-4 rounded-lg border border-purple-500/30 w-full bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Resolver Fee</span>
                            <span className="text-2xl font-bold text-purple-400">
                              {(market.totalVolume * 0.0005).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground/70">0.05% of total volume</div>
                        </div>
                      </div>
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ended</span>
                          <span className="text-xs font-mono text-foreground">
                            {new Date(market.endDate).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button className="w-full h-11 text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20">
                        Connect Wallet to Resolve
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {!isAuthorized && isLocked && !canResolve && (
                <Card className="glass border-2 border-border/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-purple-500/10 border-2 border-purple-500/30">
                        <Lock className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Market Locked</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          This market is currently locked and not accepting new bets. Connect your wallet to view more
                          details and participate in future markets.
                        </p>
                      </div>
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        </div>
                      </div>
                      <Button className="w-full h-11 text-sm font-bold bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20">
                        Connect Wallet
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isAuthorized && canResolve && (
                <Card className="glass border-2 border-purple-500/30">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-2 border-purple-500/40 shadow-lg shadow-purple-500/20">
                        <Clock className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold gradient-text">Market Ended</h3>
                        <p className="text-sm text-muted-foreground max-sm">
                          This market has reached its end date and is ready to be resolved. Click the button below to
                          resolve the market based on the oracle data.
                        </p>
                      </div>
                      <div className="glass p-4 rounded-lg border border-purple-500/30 w-full bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
                        <div className="space-y-2">
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Resolver Fee</span>
                            <span className="text-2xl font-bold text-purple-400">
                              {(market.totalVolume * 0.0005).toFixed(2)}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground/70">You'll earn 0.05% of total volume</div>
                        </div>
                      </div>
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Ended</span>
                          <span className="text-xs font-mono text-foreground">
                            {new Date(market.endDate).toLocaleString()}
                          </span>
                        </div>
                      </div>
                      <Button
                        onClick={() => dispatch(openStepper())}
                        className="w-full h-11 text-sm font-bold cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                      >
                        Resolve Market
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isAuthorized && isLocked && !canResolve && (
                <Card className="glass border-2 border-border/50">
                  <CardContent className="p-6">
                    <div className="flex flex-col items-center justify-center space-y-4 text-center">
                      <div className="p-4 rounded-full bg-purple-500/10 border-2 border-purple-500/30">
                        <Lock className="w-8 h-8 text-purple-400" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-bold">Market Locked</h3>
                        <p className="text-sm text-muted-foreground max-w-sm">
                          This market is currently locked and not accepting new bets. The market will be resolved soon
                          based on the outcome.
                        </p>
                      </div>
                      <div className="glass p-3 rounded-lg border border-border/40 w-full">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Status</span>
                          <Badge variant="outline" className="bg-purple-500/10 border-purple-500/30 text-purple-400">
                            <Lock className="w-3 h-3 mr-1" />
                            Locked
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {isAuthorized && market.status === "open" && !canResolve && (
                <Card className="glass border-2 border-border/50">
                  <CardHeader className="pb-3 border-b border-border/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
                    <CardTitle className="flex items-center justify-between text-lg">
                      <span className="font-bold">Place Your Bet</span>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>Balance:</span>
                        <span className="font-semibold text-foreground">{numericBalance.toFixed(2)} USDC</span>
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">
                        Select Side
                      </Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          className={cn(
                            "h-12 font-semibold cursor-pointer transition-all duration-200 border-2",
                            selectedSide === "yes"
                              ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400 shadow-sm"
                              : "glass hover:border-emerald-500/30",
                          )}
                          onClick={() => setSelectedSide(selectedSide === "yes" ? null : "yes")}
                        >
                          YES
                        </Button>
                        <Button
                          variant="outline"
                          className={cn(
                            "h-12 font-semibold cursor-pointer transition-all duration-200 border-2",
                            selectedSide === "no"
                              ? "border-rose-500/50 bg-rose-500/10 text-rose-400 shadow-sm"
                              : "glass hover:border-rose-500/30",
                          )}
                          onClick={() => setSelectedSide(selectedSide === "no" ? null : "no")}
                        >
                          NO
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor="bet-amount"
                          className="text-xs text-muted-foreground uppercase tracking-wider font-semibold"
                        >
                          Amount (USDC)
                        </Label>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setBetAmount(numericBalance.toFixed(2))}
                          className="text-xs text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 h-6 px-2 cursor-pointer"
                        >
                          MAX
                        </Button>
                      </div>

                      <Input
                        id="bet-amount"
                        type="number"
                        inputMode="decimal"
                        placeholder="0.00"
                        value={betAmount}
                        onChange={(e) => setBetAmount(e.target.value)}
                        className="glass text-2xl h-14 text-center font-bold border-2 focus:border-purple-500/50"
                        min="0"
                        max={numericBalance}
                        step="0.01"
                        onBlur={handleBlur}
                      />

                      <div className="grid grid-cols-4 gap-2">
                        {quickAmounts.map((amount) => (
                          <Button
                            key={amount}
                            variant="outline"
                            size="sm"
                            onClick={() => handleQuickAmount(amount)}
                            className="glass cursor-pointer hover:bg-purple-500/10 hover:border-purple-500/50 h-9 font-medium text-sm"
                            disabled={amount > numericBalance}
                          >
                            {amount}
                          </Button>
                        ))}
                      </div>

                      {betAmount && Number.parseFloat(betAmount) > numericBalance && (
                        <div className="flex items-center space-x-2 text-red-400 text-xs bg-red-500/10 p-2.5 rounded-lg border border-red-500/20">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          <span>Insufficient balance</span>
                        </div>
                      )}
                    </div>

                    {selectedSide && betAmount && payout && Number.parseFloat(betAmount) <= numericBalance && (
                      <div className="glass p-4 rounded-lg space-y-3 border border-border/40">
                        <div className="flex items-center justify-between pb-2 border-b border-border/30">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            Order Summary
                          </span>
                          <Badge
                            className={cn(
                              "text-xs font-bold",
                              selectedSide === "yes"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : "bg-rose-500/20 text-rose-400 border-rose-500/30",
                            )}
                          >
                            {selectedSide.toUpperCase()}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Shares</span>
                              <TooltipProvider delayDuration={100}>
                                <Tooltip_>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    sideOffset={5}
                                    className="bg-background border border-border p-3 max-w-xs z-50"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold">Formula:</p>
                                      <p className="text-xs font-mono">shares ≈ Amount / Price</p>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        {betAmount} /{" "}
                                        {(selectedSide === "yes" ? market.yesPrice : market.noPrice).toFixed(2)} ={" "}
                                        {payout.shares.toFixed(2)}
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip_>
                              </TooltipProvider>
                            </div>
                            <span className="font-semibold">{payout.shares.toFixed(2)}</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Price</span>
                            <span className="font-semibold">
                              {selectedSide === "yes"
                                ? (market.yesPrice * 100).toFixed(0)
                                : (market.noPrice * 100).toFixed(0)}
                              ¢
                            </span>
                          </div>

                          <div className="h-px bg-border/50 my-1"></div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Max Payout</span>
                              <TooltipProvider delayDuration={100}>
                                <Tooltip_>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    sideOffset={5}
                                    className="bg-background border border-border p-3 max-w-xs z-50"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold">Formula:</p>
                                      <p className="text-xs font-mono">max_payout = shares × 1 USDC</p>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        {payout.shares.toFixed(2)} × 1 = {payout.potentialPayout.toFixed(2)} USDC
                                      </p>
                                      <p className="text-xs text-muted-foreground/70 mt-2">
                                        If your side wins, each share pays out 1 USDC
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip_>
                              </TooltipProvider>
                            </div>
                            <span className="font-bold text-green-400">{payout.potentialPayout.toFixed(2)} USDC</span>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="flex items-center gap-1.5">
                              <span className="text-muted-foreground">Profit</span>
                              <TooltipProvider delayDuration={100}>
                                <Tooltip_>
                                  <TooltipTrigger asChild>
                                    <Info className="w-3.5 h-3.5 text-muted-foreground/50 hover:text-muted-foreground cursor-help" />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="left"
                                    sideOffset={5}
                                    className="bg-background border border-border p-3 max-w-xs z-50"
                                  >
                                    <div className="space-y-1">
                                      <p className="text-xs font-semibold">Formula:</p>
                                      <p className="text-xs font-mono">profit = max_payout - Amount</p>
                                      <p className="text-xs text-muted-foreground mt-2">
                                        {payout.potentialPayout.toFixed(2)} - {betAmount} = {payout.profit.toFixed(2)}{" "}
                                        USDC
                                      </p>
                                      <p className="text-xs text-muted-foreground/70 mt-2">
                                        Your gross profit if you win
                                      </p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip_>
                              </TooltipProvider>
                            </div>
                            <span className="font-bold text-purple-400">+{payout.profit.toFixed(2)} USDC</span>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button
                      onClick={handleBet}
                      disabled={!canPlace}
                      className="w-full h-11 text-sm font-bold cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-purple-500/20"
                    >
                      {isPlacingBet ? "Placing Bet..." : "Place Bet"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              <RecentBets marketPda={market_pda} />
              <ResolutionStepper onStartResolving={handleResolve} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
