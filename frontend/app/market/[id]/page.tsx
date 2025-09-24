"use client"

import { useState, useEffect, useMemo, useCallback } from "react"

import { useWallet } from "@solana/wallet-adapter-react"
import { useParams, useRouter } from "next/navigation"
import { Connection } from "@solana/web3.js"

import { Tooltip as Tooltip_, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ShimmerSkeleton, PulseSkeleton } from "@/components/ui/skeleton"
import { SlidingNumber } from "@/components/ui/sliding-number"
import { DualProgress } from "@/components/ui/dual-progress"
import { CustomButton } from "@/components/ui/custom-button"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { Tooltip, Area, AreaChart, CartesianGrid, XAxis, YAxis, ResponsiveContainer } from "recharts"
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bot,
  Clock,
  DollarSign,
  Droplets,
  TrendingUp,
  Users,
  Copy, 
  User, 
  Check,
  ArrowRight
} from "lucide-react"

import { AIVsHumansSkeleton, ChartSkeleton, InsightsSkeleton, CountdownSkeleton, PriceCardSkeleton, BettingCardSkeleton } from "./skeletons"
import { prepareBet, confirmBet } from "@/lib/services/bet/betsService"
import {cn, fmtCents, fmtCompact, fmtPercent, diff } from "@/lib/utils"
import { getMarket } from "@/lib/services/market/marketService"
import { signAndSendBase64Tx } from "@/lib/solana/signAndSend"
import { showToast } from "@/components/shared/show-toast"
import { useMobile } from "@/hooks/use-mobile"
import { Market, TimeLeft } from "@/lib/types"
import { useAppSelector } from "@/lib/hooks"

interface PayoutCalculation {
  shares: number
  potentialPayout: number
  profit: number
}

type ChartPoint = {
  timestamp: string;   
  ts: number;          
  ai: number;
  community: number;
  volume: number;
  participants: number;
};

type TooltipProps = {
  active?: boolean;
  label?: number | string;
  payload?: Array<{
    value: number;
    name: string;
    payload: ChartPoint;
  }>;
};

function CountdownTimer({ endAt }: { endAt: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => diff(endAt));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(diff(endAt)), 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return (
    <Card className="glass glow">
      <CardContent className="pt-6">
        <div className="flex flex-col sm:flex-row items-center justify-center space-y-4 sm:space-y-0 sm:space-x-8">
          <div className="flex items-center space-x-2 text-muted-foreground">
            <Clock className="w-5 h-5" />
            <span className="text-sm sm:text-base">Time Remaining:</span>
          </div>
          <div className="flex space-x-2 sm:space-x-4">
            {Object.entries(timeLeft).map(([unit, value]) => (
              <div key={unit} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold gradient-text tabular-nums">
                  {/* {value.toString().padStart(2, "0")} */}
                  <SlidingNumber value={value} padStart /> 
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground capitalize">{unit}</div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const PriceCard = ({
  side,
  price,
  isYes,
  className,
}: {
  side: string
  price: number
  isYes: boolean
  className?: string
}) => (
  <Card className={`glass relative overflow-hidden ${className}`}>
    <div
      className={`absolute inset-0 bg-gradient-to-br ${isYes ? "from-green-500/10 via-transparent to-green-600/5" : "from-red-500/10 via-transparent to-red-600/5"}`}
    ></div>
    <CardHeader className="relative z-10">
      <CardTitle className="flex items-center justify-between">
        <span className={`${isYes ? "text-green-400" : "text-red-400"} font-bold`}>{side}</span>
        <TrendingUp className={`w-5 h-5 ${isYes ? "text-green-400" : "text-red-400 rotate-180"}`} />
      </CardTitle>
    </CardHeader>
    <CardContent className="relative z-10 text-center space-y-4">
      <div
        className={`text-5xl font-bold ${isYes ? "text-green-400" : "text-red-400"} drop-shadow-[0_0_15px_rgba(${isYes ? "34,197,94" : "239,68,68"},0.6)]`}
      >
        {fmtCents(price)}
      </div>
      <div className="text-sm text-muted-foreground">Current Price</div>
      <div className={`text-xs ${isYes ? "text-green-400/80" : "text-red-400/80"} font-medium`}>
        {fmtPercent(price, 1)} probability
      </div>
    </CardContent>
  </Card>
)

export default function MarketPage() {
  const isMobile = useMobile()
  const router = useRouter()
  const { isAuthorized } = useAppSelector((state) => state.wallet)
  const { id: raw } = useParams<{ id: string | string[] }>();
  const market_pda = Array.isArray(raw) ? raw[0] : raw ?? "";

  const [betAmount, setBetAmount] = useState("")
  const [selectedSide, setSelectedSide] = useState<"yes" | "no" | null>(null)
  const [isPlacingBet, setIsPlacingBet] = useState(false)
  
  const walletBalance = useAppSelector(s => s.wallet.balance)
  const numericBalance = walletBalance ?? 0

  const [isLoading, setIsLoading] = useState(true)
  
  const [market, setMarket] = useState<Market | null>(null);
  const [error, setError]   = useState<string | null>(null);

  const [copied, setCopied] = useState(false)

  const quickAmounts = [1, 5, 50, 100]

  const calcCpmImpact = (amount: number, price: number, L: number) => {
    if (L <= 0) return 0;
    const sensitivity = price * (1 - price);
    return Math.min(0.5, (amount / Math.max(L, 1)) * (1 / Math.max(sensitivity, 0.05)));
  };

  const calculatePriceImpact = useCallback((amount: number, side: "yes" | "no") => {
    const p = side === "yes" ? market?.yesPrice ?? 0.5 : market?.noPrice ?? 0.5;
    return calcCpmImpact(amount, p, market?.liquidity ?? 0);
  }, [market]);

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
  const priceImpact = useMemo(
    () => (betAmount && selectedSide && market ? calculatePriceImpact(Number.parseFloat(betAmount), selectedSide) : 0),
    [betAmount, selectedSide, calculatePriceImpact, market],
  )

  const wallet = useWallet()
  const connection = useMemo(() => new Connection("https://api.devnet.solana.com", "processed"), [])

  const handleBet = useCallback(async () => {
    if (!selectedSide || !betAmount || !market) return;

    try {
      setIsPlacingBet(true);

      const amount = Number.parseFloat(String(betAmount).replace(",", "."));
      if (!Number.isFinite(amount) || amount <= 0) {
        showToast("danger", "Enter a valid amount");
        return;
      }
      if (amount > numericBalance) {
        showToast("danger", "Insufficient balance");
        return;
      }

      // prepare (unsigned tx)
      const prep = await prepareBet({
        market_pda: market_pda,
        side: selectedSide,
        amount_ui: amount,
      });

      if (!prep?.tx_base64) {
        showToast("danger", "Server didn't return a transaction to sign.");
        return;
      }

      // sign & send
      const sig = await signAndSendBase64Tx(prep.tx_base64, wallet, connection);
      showToast("success", `Transaction sent: ${sig}`);

      // confirm
      try {
        await confirmBet({
          market_pda: market_pda,
          side: selectedSide,
          amount_ui: amount,
          signature: sig,
        });
      } catch (e) {
        console.warn("confirm failed", e);
      }

      setBetAmount("");
      setSelectedSide(null);
      showToast("success", "Bet placed!");

      const fresh = await getMarket(market_pda);
      setMarket(fresh);
    } catch (err: any) {
      const msg = String(err?.message ?? err);
      if (/blockhash/i.test(msg)) {
        showToast("danger", "Transaction expired. Please try again.");
      } else {
        showToast("danger", "Failed to place bet.");
      }
      console.error(err);
    } finally {
      setIsPlacingBet(false);
    }
  }, [selectedSide, betAmount, market, numericBalance, wallet, connection, market_pda]);

  useEffect(() => {
    let alive = true;
      (async () => {
        try {
          setIsLoading(true);
          setError(null);
          const data = await getMarket(market_pda);
          if (alive) setMarket(data);
        } catch (e: any) {
          if (alive) setError(e?.message ?? "Failed to load market");
        } finally {
          if (alive) setIsLoading(false);
        }
      })();
      return () => { alive = false; };
  }, [market_pda]);

  // const handleBet = useCallback(async () => {
  //   if (!selectedSide || !betAmount) return
  //   setIsPlacingBet(true)

  //   console.log(`Betting ${betAmount} SOL on ${selectedSide.toUpperCase()}`)
  //   setIsPlacingBet(false)
  //   setBetAmount("")
  //   setSelectedSide(null)
  // }, [selectedSide, betAmount])

  const handleQuickAmount = useCallback((amount: number) => {
    setBetAmount(amount.toString())
  }, [])

  const predictionHistory = useMemo<ChartPoint[]>(
    () => [
      // Day 1 (2025-01-01)
      { timestamp: "2025-01-01T00:00:00Z", ts: Date.parse("2025-01-01T00:00:00Z"), ai: 45, community: 52, volume: 125000, participants: 890 },
      { timestamp: "2025-01-01T03:00:00Z", ts: Date.parse("2025-01-01T03:00:00Z"), ai: 47, community: 54, volume: 132000, participants: 905 },
      { timestamp: "2025-01-01T06:00:00Z", ts: Date.parse("2025-01-01T06:00:00Z"), ai: 48, community: 58, volume: 145000, participants: 920 },
      { timestamp: "2025-01-01T09:00:00Z", ts: Date.parse("2025-01-01T09:00:00Z"), ai: 50, community: 61, volume: 156000, participants: 935 },
      { timestamp: "2025-01-01T12:00:00Z", ts: Date.parse("2025-01-01T12:00:00Z"), ai: 52, community: 65, volume: 167000, participants: 950 },
      { timestamp: "2025-01-01T15:00:00Z", ts: Date.parse("2025-01-01T15:00:00Z"), ai: 54, community: 68, volume: 178000, participants: 965 },
      { timestamp: "2025-01-01T18:00:00Z", ts: Date.parse("2025-01-01T18:00:00Z"), ai: 56, community: 70, volume: 189000, participants: 980 },
      { timestamp: "2025-01-01T21:00:00Z", ts: Date.parse("2025-01-01T21:00:00Z"), ai: 58, community: 72, volume: 201000, participants: 995 },

      // Day 2 (2025-01-02)
      { timestamp: "2025-01-02T00:00:00Z", ts: Date.parse("2025-01-02T00:00:00Z"), ai: 60, community: 74, volume: 215000, participants: 1010 },
      { timestamp: "2025-01-02T03:00:00Z", ts: Date.parse("2025-01-02T03:00:00Z"), ai: 61, community: 76, volume: 228000, participants: 1025 },
      { timestamp: "2025-01-02T06:00:00Z", ts: Date.parse("2025-01-02T06:00:00Z"), ai: 62, community: 78, volume: 241000, participants: 1040 },
      { timestamp: "2025-01-02T09:00:00Z", ts: Date.parse("2025-01-02T09:00:00Z"), ai: 64, community: 79, volume: 254000, participants: 1055 },
      { timestamp: "2025-01-02T12:00:00Z", ts: Date.parse("2025-01-02T12:00:00Z"), ai: 65, community: 80, volume: 267000, participants: 1070 },
      { timestamp: "2025-01-02T15:00:00Z", ts: Date.parse("2025-01-02T15:00:00Z"), ai: 66, community: 81, volume: 280000, participants: 1085 },
      { timestamp: "2025-01-02T18:00:00Z", ts: Date.parse("2025-01-02T18:00:00Z"), ai: 67, community: 82, volume: 293000, participants: 1100 },
      { timestamp: "2025-01-02T21:00:00Z", ts: Date.parse("2025-01-02T21:00:00Z"), ai: 67, community: 82, volume: 306000, participants: 1115 },
    ],
    []
  );

  const df = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit" });
  const nf = new Intl.NumberFormat("en-US");

  const CustomTooltip: React.FC<TooltipProps> = ({ active, payload, label }) => {
    if (!active || !payload || payload.length === 0) return null;

    const d = payload[0].payload;
    const ts = typeof label === "number" ? label : d.ts;
    const time = df.format(new Date(ts));

    return (
      <div className="bg-background/95 backdrop-blur-sm p-4 rounded-lg border border-accent/30 shadow-xl">
        <p className="font-semibold text-foreground mb-2">
          {time}
        </p>

        <div className="space-y-1">
          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-cyan-400 rounded-full shadow-lg shadow-cyan-400/50" />
              <span className="text-sm text-muted-foreground">AI Prediction:</span>
            </div>
            <span className="text-sm font-medium text-cyan-400">{d.ai}%</span>
          </div>

          <div className="flex items-center justify-between space-x-4">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-green-400 rounded-full shadow-lg shadow-green-400/50" />
              <span className="text-sm text-muted-foreground">Community:</span>
            </div>
            <span className="text-sm font-medium text-green-400">{d.community}%</span>
          </div>

          <div className="border-t border-accent/20 pt-2 mt-2">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Volume:</span>
              <span>${nf.format(d.volume)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Participants:</span>
              <span>{nf.format(d.participants)}</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={`min-h-screen bg-background relative overflow-hidden ${isMobile ? "pt-40" : "pt-24"}`}>
        <div className="absolute inset-0 radial-glow"></div>
        <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <PulseSkeleton className="h-5 w-16 rounded-full" />
              <PulseSkeleton className="h-5 w-12 rounded-full" delay={100} />
            </div>

            <div className="space-y-3">
              <ShimmerSkeleton className="h-10 w-full max-w-4xl" />
              <ShimmerSkeleton className="h-10 w-3/4 max-w-3xl" />
            </div>

            <div className="space-y-2">
              <PulseSkeleton className="h-5 w-full max-w-4xl" delay={200} />
              <PulseSkeleton className="h-5 w-5/6 max-w-3xl" delay={300} />
              <PulseSkeleton className="h-5 w-2/3 max-w-2xl" delay={400} />
            </div>
          </div>

          <CountdownSkeleton />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <PriceCardSkeleton isYes={true} />
                <PriceCardSkeleton isYes={false} />
              </div>

              <div className="flex justify-center">
                <ShimmerSkeleton className="h-3 w-full max-w-md rounded-full" />
              </div>

              {isAuthorized && <BettingCardSkeleton />}

              <ChartSkeleton />
            </div>

            <div className="space-y-6">
              <InsightsSkeleton />
              <AIVsHumansSkeleton />
            </div>
          </div>

          <div className="flex justify-center items-center py-8">
            <div className="flex items-center gap-3 text-muted-foreground">
              <div className="w-5 h-5 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
              <span className="text-sm">Loading market details...</span>
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
    );
  }

  const handleBlur = () => {
    const n = parseFloat(betAmount.replace(",", "."))
    if (!Number.isFinite(n) || n <= 0) return setBetAmount("")
    const clamped = Math.min(n, numericBalance)
    setBetAmount(clamped.toFixed(2))
  }

  const statusLabel = { open: "Active", locked: "Locked", settled: "Settled", void: "Void" }[market.status];
  const canPlace =
    !!selectedSide &&
    !!betAmount &&
    Number.parseFloat(betAmount) <= numericBalance &&
    !isPlacingBet;
    
  return (
    <div className={`min-h-screen bg-background relative overflow-hidden ${isMobile ? "pt-40" : "pt-24"}`}>
      <div className="absolute inset-0 radial-glow"></div>
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Badge variant="secondary" className="bg-purple-600/20 text-purple-500 border-purple-500/30">
              {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
            </Badge>
            <Badge variant="outline" className="glass">
              <Clock className="w-3 h-3 mr-1" />
              {statusLabel}
            </Badge>
          </div>

          <h1 className="text-4xl md:text-5xl font-bold gradient-text leading-tight">{market.title}</h1>
          <p className="text-lg text-muted-foreground max-w-4xl">{market.description}</p>
        </div>

        <CountdownTimer endAt={market.endDate} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <PriceCard side="YES" price={market.yesPrice} isYes={true} className="glow-green" />
              <PriceCard side="NO" price={market.noPrice} isYes={false} className="glow" />
            </div>

            <div className="flex justify-center">
              <DualProgress
                yesValue={market.yesPrice * 100}
                noValue={market.noPrice * 100}
                className="h-3 w-full max-w-md"
              />
            </div>

            {isAuthorized && market.status == "open" && (
              <Card className="glass glow-cyan">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Place Your Bet</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <Button
                      variant={selectedSide === "yes" ? "default" : "outline"}
                      className={`h-16 text-lg cursor-pointer transition-all duration-300 ${
                        selectedSide === "yes"
                          ? "bg-emerald-600/80 hover:bg-emerald-800 text-white glow-green scale-105"
                          : "glass hover:bg-emerald-600/20 hover:border-emerald-500/50"
                      }`}
                      onClick={() => setSelectedSide("yes")}
                    >
                      <TrendingUp className="w-5 h-5 mr-2" />
                      Buy YES
                    </Button>
                    <Button
                      variant={selectedSide === "no" ? "default" : "outline"}
                      className={`h-16 text-lg cursor-pointer transition-all duration-300 ${
                        selectedSide === "no"
                          ? "bg-rose-600/80 hover:bg-rose-800 text-white glow scale-105"
                          : "glass hover:bg-rose-600/20 hover:border-rose-500/50"
                      }`}
                      onClick={() => setSelectedSide("no")}
                    >
                      <TrendingUp className="w-5 h-5 mr-2 rotate-180" />
                      Buy NO
                    </Button>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bet-amount">Amount (USDC)</Label>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setBetAmount(numericBalance.toFixed(2))}
                        className="text-xs text-muted-foreground hover:text-foreground"
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
                      // onChange={(e) => onAmountChange(e.target.value)}
                      onChange={(e) => setBetAmount(e.target.value)}
                      className="glass text-lg h-12"
                      min="0"
                      max={numericBalance}
                      step="0.01"
                      onBlur={handleBlur}
                    />

                    <div className="flex space-x-2">
                      {quickAmounts.map((amount) => (
                        <Button
                          key={amount}
                          variant="outline"
                          size="sm"
                          onClick={() => handleQuickAmount(amount)}
                          className="glass cursor-pointer hover:bg-accent/20 flex-1"
                          disabled={amount > numericBalance}
                        >
                          {amount} USDC
                        </Button>
                      ))}
                    </div>

                    {betAmount && Number.parseFloat(betAmount) > numericBalance && (
                      <div className="flex items-center space-x-2 text-red-400 text-sm">
                        <AlertTriangle className="w-4 h-4" />
                        <span>Insufficient balance</span>
                      </div>
                    )}
                  </div>

                  {selectedSide && betAmount && payout && Number.parseFloat(betAmount) <= numericBalance && (
                    <div className="glass p-6 rounded-lg space-y-4 border border-accent/20 bg-transparent">
                      <h4 className="font-semibold text-lg">Order Summary</h4>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Side:</span>
                            <span
                              className={`font-semibold ${selectedSide === "yes" ? "text-green-400" : "text-red-400"}`}
                            >
                              {selectedSide.toUpperCase()}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Amount:</span>
                            <span className="font-semibold">{betAmount} SOL</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Price:</span>
                            <span className="font-semibold">
                              {selectedSide === "yes"
                                ? (market.yesPrice * 100).toFixed(0)
                                : (market.noPrice * 100).toFixed(0)}
                              ¢
                            </span>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Shares:</span>
                            <span className="font-semibold">{payout.shares.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Payout:</span>
                            <span className="font-semibold text-green-400">
                              {payout.potentialPayout.toFixed(2)} SOL
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Max Profit:</span>
                            <span className="font-semibold gradient-text">+{payout.profit.toFixed(2)} SOL</span>
                          </div>
                        </div>
                      </div>

                      {priceImpact > 0.05 && (
                        <div className="flex items-center space-x-2 text-yellow-400 text-sm bg-yellow-400/10 p-3 rounded-lg">
                          <AlertTriangle className="w-4 h-4" />
                          <span>High price impact: {(priceImpact * 100).toFixed(1)}%</span>
                        </div>
                      )}
                    </div>
                  )}
                  <CustomButton
                    onClick={handleBet}
                    disabled={!canPlace}
                    variant="expandIcon"
                    Icon={ArrowRight}
                    iconPlacement="right"
                    className={cn(
                      "h-fit w-full h-14 cursor-pointer rounded-lg bg-accent text-foreground hover:bg-accent/95",
                    )}
                  >
                     {isPlacingBet ? (
                      <div className="flex items-center space-x-2">
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                        <span>Placing Bet...</span>
                      </div>
                    ) : (
                      <>
                        <DollarSign className="w-5 h-5 mr-2" />
                        Place Bet
                      </>
                    )}
                  </CustomButton>
                </CardContent>
              </Card>
            )}

            <Card className="glass glow relative overflow-hidden">
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Activity className="w-5 h-5 text-primary" />
                    <span>Prediction Trends Over Time</span>
                  </div>
                  <Badge variant="outline" className="glass text-xs">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2"></div>
                    Live Data
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="relative z-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-center space-x-8">
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-cyan-500 rounded-full"></div>
                      <span className="text-sm font-medium text-muted-foreground">AI Prediction</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
                      <span className="text-sm font-medium text-muted-foreground">Community Sentiment</span>
                    </div>
                  </div>

                  <div className="h-80 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={predictionHistory} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                        <defs>
                          <linearGradient id="aiGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#06b6d4" stopOpacity={0.05} />
                          </linearGradient>
                          <linearGradient id="communityGradient" x1="0" y1="0" x2="0" y2="1" gradientUnits="userSpaceOnUse">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.35} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.05} />
                          </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.2)" horizontal vertical={false} />

                        <XAxis
                          type="number"
                          dataKey="ts"
                          scale="time"
                          domain={["dataMin", "dataMax"]}
                          tickFormatter={(v) => df.format(new Date(v))}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(148,163,184)", fontSize: 12 }}
                          dy={10}
                        />

                        <YAxis
                          domain={[40, 90]}
                          axisLine={false}
                          tickLine={false}
                          tick={{ fill: "rgb(148,163,184)", fontSize: 12 }}
                          tickFormatter={(value) => `${value}%`}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        <Area
                          type="monotone"
                          dataKey="ai"
                          stroke="#06b6d4"
                          strokeWidth={2.5}
                          fill="url(#aiGradient)"
                          fillOpacity={1}
                          baseValue="dataMin"
                          isAnimationActive={true}     
                          dot={{ fill: "#06b6d4", stroke: "#0891b2", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#06b6d4", stroke: "#0891b2", strokeWidth: 2 }}
                        />

                        <Area
                          type="monotone"
                          dataKey="community"
                          stroke="#10b981"
                          strokeWidth={2.5}
                          fill="url(#communityGradient)"
                          fillOpacity={1}
                          baseValue="dataMin"
                          isAnimationActive={true}
                          dot={{ fill: "#10b981", stroke: "#059669", strokeWidth: 2, r: 4 }}
                          activeDot={{ r: 6, fill: "#10b981", stroke: "#059669", strokeWidth: 2 }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>

                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="glass p-4 rounded-lg text-center">
                      <div className="text-lg font-semibold text-cyan-500 mb-1">+22%</div>
                      <div className="text-xs text-muted-foreground">AI Confidence Growth</div>
                    </div>
                    <div className="glass p-4 rounded-lg text-center">
                      <div className="text-lg font-semibold text-emerald-500 mb-1">+30%</div>
                      <div className="text-xs text-muted-foreground">Community Growth</div>
                    </div>
                    <div className="glass p-4 rounded-lg text-center">
                      <div className="text-lg font-semibold text-slate-400 mb-1">15%</div>
                      <div className="text-xs text-muted-foreground">Sentiment Gap</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card className="glass glow">
              <CardHeader>
                <CardTitle>Market Insights</CardTitle>
              </CardHeader>
              <CardContent>
                <Tabs defaultValue="stats" className="w-full">
                  <TabsList className="grid w-full grid-cols-3 glass">
                    <TabsTrigger value="stats" className="flex items-center space-x-1 cursor-pointer">
                      <BarChart3 className="w-4 h-4" />
                      <span>Stats</span>
                    </TabsTrigger>
                    <TabsTrigger value="ai" className="flex items-center space-x-1 cursor-pointer">
                      <Bot className="w-4 h-4" />
                      <span>AI</span>
                    </TabsTrigger>
                    <TabsTrigger value="community" className="flex items-center space-x-1 cursor-pointer">
                      <Users className="w-4 h-4" />
                      <span>Community</span>
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="stats" className="space-y-4 mt-4">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Total Volume</span>
                      <span className="font-semibold">${fmtCompact(market.totalVolume)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Participants</span>
                      <span className="font-semibold flex items-center">
                        <Users className="w-4 h-4 mr-1" />
                        {new Intl.NumberFormat('en-US').format(market.participants)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Liquidity</span>
                      <span className="font-semibold flex items-center">
                        <Droplets className="w-4 h-4 mr-1" />
                        ${fmtCompact(market.liquidity)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Creator</span>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip_>
                           <TooltipTrigger asChild>
                            <span className="font-mono text-sm cursor-pointer hover:underline">
                              {market.creator.length > 10
                                ? `${market.creator.slice(0, 10)}...${market.creator.slice(-10)}`
                                : market.creator}
                            </span>
                           </TooltipTrigger>
                           <TooltipContent className="p-2 bg-card border border-border">
                              <div className="flex flex-col gap-2 min-w-[200px]">
                                <div className="flex gap-2">
                                  <Button variant="outline" size="sm" onClick={() => {navigator.clipboard.writeText(market.creator); setCopied(true); setTimeout(() => setCopied(false), 2000)}} className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent">
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
                                  <Button variant="outline" size="sm" onClick={() => router.push(`/profile/${market.creator}`)} className="flex-1 h-8 text-xs cursor-pointer bg-background hover:bg-accent">
                                    <User className="w-3 h-3 mr-1" />
                                    Profile
                                  </Button>
                                </div>
                              </div>
                            </TooltipContent>
                        </Tooltip_>
                      </TooltipProvider>

                    </div>
                  </TabsContent>

                  <TabsContent value="ai" className="space-y-4 mt-4">
                    <div className="text-center space-y-3">
                      <div className="text-3xl font-bold gradient-text">67%</div>
                      <div className="text-sm text-muted-foreground">Confidence: YES</div>
                      <div className="glass p-3 rounded-lg">
                        <p className="text-sm text-muted-foreground">
                          AI analysis based on historical Bitcoin patterns, market cycles, and adoption trends suggests
                          strong probability of reaching $100K.
                        </p>
                      </div>
                      <div className="flex items-center justify-center space-x-2 text-xs text-muted-foreground">
                        <Activity className="w-3 h-3" />
                        <span>Updated 2 hours ago</span>
                      </div>
                    </div>
                  </TabsContent>

                  <TabsContent value="community" className="space-y-4 mt-4">
                    <div className="space-y-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold gradient-text">82%</div>
                        <div className="text-sm text-muted-foreground">Bullish Sentiment</div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-green-400">Bullish (Yes)</span>
                          <span>82%</span>
                        </div>
                        <div className="w-full bg-muted/20 rounded-full h-2">
                          <div className="bg-green-400 h-2 rounded-full" style={{ width: "82%" }}></div>
                        </div>

                        <div className="flex justify-between text-sm">
                          <span className="text-red-400">Bearish (No)</span>
                          <span>18%</span>
                        </div>
                        <div className="w-full bg-muted/20 rounded-full h-2">
                          <div className="bg-red-400 h-2 rounded-full" style={{ width: "18%" }}></div>
                        </div>
                      </div>
                    </div>
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>

            <Card className="glass glow-cyan">
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Bot className="w-5 h-5 text-cyan-400" />
                  <span>AI vs Humans</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <Bot className="w-4 h-4 text-cyan-400" />
                      <span className="text-sm font-medium">AI Prediction</span>
                    </div>
                    <div className="text-2xl font-bold text-cyan-400">67%</div>
                    <div className="text-xs text-muted-foreground">YES</div>
                  </div>

                  <div className="text-center space-y-2">
                    <div className="flex items-center justify-center space-x-2">
                      <Users className="w-4 h-4 text-green-400" />
                      <span className="text-sm font-medium">Community</span>
                    </div>
                    <div className="text-2xl font-bold text-green-400">82%</div>
                    <div className="text-xs text-muted-foreground">YES</div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Prediction Alignment</span>
                    <span className="text-green-400 font-medium">+15% more bullish</span>
                  </div>

                  <div className="relative">
                    <div className="flex space-x-1 h-8 rounded-lg overflow-hidden bg-muted/20">
                      <div className="bg-cyan-400/80 flex-1 flex items-center justify-center text-xs font-medium text-white">
                        AI: 67%
                      </div>
                      <div className="bg-green-400/80 flex-1 flex items-center justify-center text-xs font-medium text-white">
                        Humans: 82%
                      </div>
                    </div>
                  </div>

                  <div className="glass p-3 rounded-lg">
                    <p className="text-xs text-muted-foreground">
                      Community sentiment is slightly more optimistic than AI analysis, suggesting strong retail
                      confidence in Bitcoin's potential.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
