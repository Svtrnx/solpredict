"use client"

import Link from "next/link"
import { useRef, useMemo } from "react"
import {
  Users,
  Brain,
  Zap,
  Shield,
  DollarSign,
  ArrowRight,
  Clock,
  ArrowUpRight,
  TrendingUp,
  Hourglass,
  Ban,
} from "lucide-react"

import { RadixAccordion } from "@/components/animate-ui/demo/components/radix/accordion"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button as ShineButton } from "@/components/ui/shine-button"
import { FooterComponent } from "@/components/footer/footer"
import { GitHubButton } from "@/components/ui/button-01"
import { TextEffect } from "@/components/TextAnimation"
import { Marquee } from "@/components/ui/marquee"
import { motion, useInView } from "framer-motion"
import Features from "@/components/features"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { useMarketsQuery } from "@/hooks/useMarketsQuery"
import type { ListMarket } from "@/lib/types/market"

export default function LandingPage() {
  const heroRef = useRef(null)
  const marketsRef = useRef(null)
  const faqRef = useRef(null)
  const communityRef = useRef(null)

  const isHeroInView = useInView(heroRef, { once: true, amount: 0.2 })
  const isMarketsInView = useInView(marketsRef, { once: true, amount: 0.1 })
  const isFaqInView = useInView(faqRef, { once: true, amount: 0.2 })
  const isCommunityInView = useInView(communityRef, { once: true, amount: 0.3 })

  const { data, isLoading } = useMarketsQuery({
    category: "All",
    sort: "volume",
    pageSize: 10,
    status: ["active", "awaiting_resolve"],
  })

  const markets = useMemo(() => (data ? data.pages.flatMap((p) => p.items) : []), [data])

  const firstRow = markets.slice(0, Math.ceil(markets.length / 2))
  const secondRow = markets.slice(Math.ceil(markets.length / 2))

  const MarketCard = ({ market }: { market: ListMarket }) => {

    const timeUntilEnd = new Date(market.endDate).getTime() - Date.now()
    const isLocked = market.status === "awaiting_resolve" && timeUntilEnd < 24 * 60 * 60 * 1000 && timeUntilEnd > 0
    const displayStatus = isLocked ? "locked" : market.status
    const isSettled = market.status.startsWith("settled") || market.status === "void"

    const timeLeft = useMemo(() => {
      const now = Date.now()
      const end = new Date(market.endDate).getTime()
      const diff = end - now
      const days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)))
      if (days > 30) {
        const months = Math.floor(days / 30)
        return `${months} ${months === 1 ? "month" : "months"}`
      }
      return `${days} ${days === 1 ? "day" : "days"}`
    }, [market.endDate])

    const formatVolume = (num: number): string => {
      if (num < 100_000) {
        return num.toLocaleString("en-US")
      }
      return new Intl.NumberFormat("en", {
        notation: "compact",
        maximumFractionDigits: 1,
      }).format(num)
    }

    const probability = Math.round(market.yesPrice * 100)

    const statusConfig = {
      active: {
        label: "Active",
        icon: TrendingUp,
        className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
        dotColor: "bg-emerald-400",
      },
      awaiting_resolve: {
        label: "Awaiting Resolve",
        icon: Hourglass,
        className: "bg-amber-500/10 text-amber-400 border-amber-500/20",
        dotColor: "bg-amber-400",
      },
      locked: {
        label: "Locked",
        icon: Ban,
        className: "bg-orange-500/10 text-orange-400 border-orange-500/20",
        dotColor: "bg-orange-400",
      },
    }

    const config = statusConfig[displayStatus as keyof typeof statusConfig] || statusConfig.active
    const StatusIcon = config.icon

    return (
      <Link href={`/market/${market.marketPda}`}>
        <Card className="relative bg-gradient-to-br from-black/40 via-black/30 to-black/20 backdrop-blur-md border border-white/[0.08] hover:border-white/20 hover:shadow-xl hover:shadow-black/20 transition-all duration-500 cursor-pointer overflow-hidden w-80 h-[340px] flex-shrink-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 hover:opacity-100 transition-opacity duration-500" />
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-2 mb-3">
              <Badge
                variant="secondary"
                className="bg-white/5 text-gray-300 border-white/10 font-medium text-xs px-2.5 py-1 hover:bg-white/10 transition-colors"
              >
                {market.category.charAt(0).toUpperCase() + market.category.slice(1)}
              </Badge>
              <ArrowUpRight className="h-4 w-4 text-gray-500 transition-all duration-200" />
            </div>

            <CardTitle className="text-white text-base leading-snug mb-3 line-clamp-2 font-semibold">
              {market.title}
            </CardTitle>

            <div className="flex items-center justify-between">
              <Badge
                variant="outline"
                className={`${config.className} flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium border transition-colors duration-200`}
              >
                <span className={`${config.dotColor} h-1.5 w-1.5 rounded-full`} />
                <StatusIcon className="h-3.5 w-3.5" />
                {config.label}
              </Badge>
              <div className="flex items-center text-gray-400 text-xs font-medium">
                <Clock className="h-3.5 w-3.5 mr-1.5" />
                {timeLeft}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {!isSettled && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-emerald-400">{probability}%</span>
                  <span className="text-rose-400">{100 - probability}%</span>
                </div>
                <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 bg-emerald-500 rounded-full transition-all duration-300"
                    style={{ width: `${probability}%` }}
                  />
                  <div
                    className="absolute inset-y-0 right-0 bg-rose-500 rounded-full transition-all duration-300"
                    style={{ width: `${100 - probability}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-lg p-3 hover:bg-emerald-500/10 transition-colors">
                <div className="text-emerald-400/70 text-[10px] font-bold mb-0.5 tracking-wider uppercase">Yes</div>
                <div className="text-white text-lg font-bold">{(market.yesPrice * 100).toFixed(0)}¢</div>
              </div>
              <div className="bg-rose-500/5 border border-rose-500/20 rounded-lg p-3 hover:bg-rose-500/10 transition-colors">
                <div className="text-rose-400/70 text-[10px] font-bold mb-0.5 tracking-wider uppercase">No</div>
                <div className="text-white text-lg font-bold">{(market.noPrice * 100).toFixed(0)}¢</div>
              </div>
            </div>

            <div className="flex items-center justify-between pt-2 border-t border-white/5">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="bg-white/5 rounded-md p-1.5">
                  <DollarSign className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">
                  {formatVolume(market.totalVolume)} <span className="text-[10px]">USDC</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <div className="bg-white/5 rounded-md p-1.5">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="font-medium">{new Intl.NumberFormat("en-US").format(market.participants)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="z-0 min-h-screen bg-background relative overflow-hidden">
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>

      <div className="z-0 absolute inset-0 radial-glow"></div>
      <div className="neon-grid"></div>
      <div className="neon-globe"></div>

      <section ref={heroRef} className="relative z-10 text-center py-20 px-6 pt-40 md:pt-24">
        <div className="max-w-4xl mx-auto">
          <motion.h1
            className="text-6xl md:text-7xl font-bold mb-6 leading-tight text-balance"
            initial={{ opacity: 0, y: 50 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <span className="text-white">Bet on the Future.</span>
            <br />
            <span className="text-white">The Market </span>
            <span className="text-purple-400 animated-slogan">Never Lies</span>
            <span className="text-white">.</span>
          </motion.h1>

          <motion.h2
            className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto text-pretty leading-relaxed"
            initial={{ opacity: 0, y: 30 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
          >
            A decentralized prediction market where the future has a price — powered by{" "}
            <span className="text-purple-400 font-semibold">
              <TextEffect
                key={"Solana blockchain"}
                delay={0.2}
                per="char"
                preset="blur"
                className="inline-block whitespace-nowrap align-baseline"
              >
                Solana blockchain.
              </TextEffect>
            </span>
          </motion.h2>

          <motion.div
            className="flex items-center justify-center gap-2 mb-8"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isHeroInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            <Badge className="bg-green-600/20 text-green-400 border-green-600/30 text-sm px-3 py-1 hover:bg-green-600/30 transition-colors">
              <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse"></div>
              Live on Devnet
            </Badge>
            <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30 text-sm px-3 py-1 hover:bg-purple-600/30 transition-colors">
              <Zap className="w-3 h-3 mr-1" />
              Solana Powered
            </Badge>
            <Badge
              className="text-sm px-3 py-1 transition-colors"
              style={{
                backgroundColor: "#af50f620",
                color: "#af50f6",
                borderColor: "#af50f630",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#af50f630"
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "#af50f620"
              }}
            >
              <img src="/pyth.svg" alt="Phantom" className="w-2.7 h-3 mr-1" />
              Pyth Oracle
            </Badge>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 text-sm text-gray-400"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
          >
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Shield className="w-4 h-4 text-green-400" />
              <span>Blockchain Secured</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Zap className="w-4 h-4 text-yellow-400" />
              <span>Sub-second Transactions</span>
            </div>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <Brain className="w-4 h-4 text-purple-400" />
              <span>User friendly</span>
            </div>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
            initial={{ opacity: 0, y: 20 }}
            animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.6, delay: 0.8, ease: "easeOut" }}
          >
            <Link href="/markets">
              <ShineButton
                variant="ghost"
                className="hover:bg-background cursor-pointer dark:hover:border-t-border bg-muted group mx-auto flex w-fit items-center gap-4 rounded-full border p-1 pl-4 shadow-md shadow-black/5 transition-all duration-300 dark:border-t-white/5 dark:shadow-zinc-950"
                effect="shineHover"
              >
                <h1 className="text-sm font-extrabold tracking-tight text-center mr-7 ml-7">
                  <span className="text-white font-mono">Predict the Future.</span>
                  <span className="ml-0 mx-2 font-mono"> Earn Now</span>
                </h1>
                <span className="dark:border-background block h-4 w-0.5 border-l bg-white dark:bg-zinc-700"></span>
                <div className="bg-background group-hover:bg-muted size-6 overflow-hidden rounded-full duration-500 mr-2">
                  <div className="flex w-12 -translate-x-1/2 duration-500 ease-in-out group-hover:translate-x-0">
                    <span className="flex size-6">
                      <ArrowRight className="m-auto size-3" />
                    </span>
                    <span className="flex size-6">
                      <ArrowRight className="m-auto size-3" />
                    </span>
                  </div>
                </div>
              </ShineButton>
            </Link>
          </motion.div>
        </div>
      </section>

      <Features />

      <section ref={marketsRef} className="relative z-10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div
            className="text-center mb-12"
            initial={{ opacity: 0, y: 30 }}
            animate={isMarketsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            <h2
              className={cn(
                "via-foreground mb-8 bg-gradient-to-b from-zinc-800 to-zinc-700 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]",
              )}
            >
              Live Prediction Markets
            </h2>
            <p className="text-lg text-muted-foreground mb-6">Real-time markets across crypto</p>
          </motion.div>

          {isLoading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-400">Loading markets...</div>
            </div>
          ) : markets.length > 0 ? (
            <motion.div
              className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl"
              style={{
                WebkitMaskImage:
                  "linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,.08) 32px, rgba(0,0,0,.3) 64px, rgba(0,0,0,.6) 96px, rgba(0,0,0,1) 144px, rgba(0,0,0,1) calc(100% - 144px), rgba(0,0,0,.6) calc(100% - 96px), rgba(0,0,0,.3) calc(100% - 64px), rgba(0,0,0,.08) calc(100% - 32px), rgba(0,0,0,0) 100%)",
                maskImage:
                  "linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,.08) 32px, rgba(0,0,0,.3) 64px, rgba(0,0,0,.6) 96px, rgba(0,0,0,1) 144px, rgba(0,0,0,1) calc(100% - 144px), rgba(0,0,0,.6) calc(100% - 96px), rgba(0,0,0,.3) calc(100% - 64px), rgba(0,0,0,.08) calc(100% - 32px), rgba(0,0,0,0) 100%)",
              }}
              initial={{ opacity: 0, y: 30 }}
              animate={isMarketsInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
              transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
            >
              <Marquee pauseOnHover className="[--duration:20s] mb-4">
                {firstRow.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </Marquee>

              <Marquee reverse pauseOnHover className="[--duration:20s]">
                {secondRow.map((market) => (
                  <MarketCard key={market.id} market={market} />
                ))}
              </Marquee>
            </motion.div>
          ) : (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-400">No active markets available</div>
            </div>
          )}
        </div>
      </section>

      <section ref={faqRef} style={{ zIndex: 100, display: "flex" }}>
        <motion.div
          style={{ width: "100%", justifyContent: "center" }}
          className="z-100 flex mx-auto"
          initial={{ opacity: 0, y: 50 }}
          animate={isFaqInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <RadixAccordion />
        </motion.div>
      </section>

      <section ref={communityRef} style={{ zIndex: 100, display: "flex" }} className="mt-30">
        <div style={{ width: "100%" }} className="z-100 grid mx-auto items-center justify-center place-items-center">
          <motion.h2
            className={cn(
              "via-foreground font-darker mb-8 bg-gradient-to-b from-zinc-800 to-zinc-700 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]",
            )}
            initial={{ opacity: 0, y: 30 }}
            animate={isCommunityInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            Community channels
          </motion.h2>
          <motion.div
            className="justify-self-center"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={isCommunityInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            <GitHubButton />
          </motion.div>
        </div>
      </section>

      <section className="relative z-10 py-20 px-6 mt-20">
        <FooterComponent />
      </section>
    </div>
  )
}
