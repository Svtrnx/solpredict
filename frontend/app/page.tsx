"use client";

// import "@/pyth-readuint-shim";
import { useState } from "react"
import Link from "next/link"

import { TrendingUp, Users, Wallet, Brain, BarChart3, Zap, Shield, Trophy, DollarSign } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AnimatedNumber } from "@/components/AnimatedNumber"
import { DualProgress } from "@/components/ui/dual-progress"
import { TextEffect } from "@/components/TextAnimation"
import { Marquee } from "@/components/ui/marquee"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"


export default function LandingPage() {
  const [hoveredDay, setHoveredDay] = useState<number | null>(null)
  const [clickedDay, setClickedDay] = useState<number | null>(null)
  const [volume, setVolume] = useState(12.4)
  const [users, setUsers] = useState(15247)
  const [accuracy, setAccuracy] = useState(89)

  const marketData = [
    {
      day: "Mon",
      humanAccuracy: 72,
      aiAccuracy: 68,
      volume: 2.1,
      totalPredictions: 1240,
      aiChange: "+2.3%",
      communityChange: "+1.8%",
    },
    {
      day: "Tue",
      humanAccuracy: 75,
      aiAccuracy: 71,
      volume: 2.8,
      totalPredictions: 1580,
      aiChange: "+1.7%",
      communityChange: "+2.1%",
    },
    {
      day: "Wed",
      humanAccuracy: 69,
      aiAccuracy: 74,
      volume: 3.2,
      totalPredictions: 1920,
      aiChange: "-0.8%",
      communityChange: "+0.9%",
    },
    {
      day: "Thu",
      humanAccuracy: 78,
      aiAccuracy: 76,
      volume: 4.1,
      totalPredictions: 2340,
      aiChange: "+3.2%",
      communityChange: "+2.7%",
    },
    {
      day: "Fri",
      humanAccuracy: 73,
      aiAccuracy: 79,
      volume: 3.9,
      totalPredictions: 2180,
      aiChange: "+1.9%",
      communityChange: "-1.2%",
    },
    {
      day: "Sat",
      humanAccuracy: 81,
      aiAccuracy: 77,
      volume: 4.8,
      totalPredictions: 2650,
      aiChange: "+2.8%",
      communityChange: "+3.4%",
    },
    {
      day: "Sun",
      humanAccuracy: 76,
      aiAccuracy: 82,
      volume: 5.2,
      totalPredictions: 2890,
      aiChange: "+1.5%",
      communityChange: "+2.0%",
    },
  ]

  const marqueeMarkets = [
    {
      id: "btc-100k-2026",
      question: "Will BTC hit $100k by 2026?",
      yesPrice: 0.67,
      noPrice: 0.33,
      volume: "$2.4M",
      participants: 1247,
      timeLeft: "18 days",
      category: "Crypto",
      aiAccuracy: 63,
      humanAccuracy: 58,
    },
    {
      id: "solana-500-2025",
      question: "Will Solana reach $500 in 2025?",
      yesPrice: 0.42,
      noPrice: 0.58,
      volume: "$1.8M",
      participants: 892,
      timeLeft: "45 days",
      category: "Crypto",
      aiAccuracy: 71,
      humanAccuracy: 45,
    },
    {
      id: "ai-jobs-2030",
      question: "Will AI replace 50% of jobs by 2030?",
      yesPrice: 0.23,
      noPrice: 0.77,
      volume: "$3.1M",
      participants: 2156,
      timeLeft: "2 months",
      category: "AI",
      aiAccuracy: 78,
      humanAccuracy: 82,
    },
    {
      id: "tesla-1000-2025",
      question: "Will Tesla stock hit $1000 by end of 2025?",
      yesPrice: 0.34,
      noPrice: 0.66,
      volume: "$1.2M",
      participants: 743,
      timeLeft: "8 months",
      category: "Stocks",
      aiAccuracy: 45,
      humanAccuracy: 52,
    },
    {
      id: "world-cup-2026",
      question: "Will Brazil win the 2026 World Cup?",
      yesPrice: 0.18,
      noPrice: 0.82,
      volume: "$950K",
      participants: 1834,
      timeLeft: "1.5 years",
      category: "Sports",
      aiAccuracy: 22,
      humanAccuracy: 28,
    },
    {
      id: "mars-landing-2030",
      question: "Will humans land on Mars by 2030?",
      yesPrice: 0.15,
      noPrice: 0.85,
      volume: "$2.8M",
      participants: 3421,
      timeLeft: "5 years",
      category: "Space",
      aiAccuracy: 12,
      humanAccuracy: 18,
    },
    {
      id: "eth-5000-2025",
      question: "Will Ethereum reach $5000 in 2025?",
      yesPrice: 0.56,
      noPrice: 0.44,
      volume: "$1.9M",
      participants: 1567,
      timeLeft: "11 months",
      category: "Crypto",
      aiAccuracy: 58,
      humanAccuracy: 61,
    },
    {
      id: "climate-target-2030",
      question: "Will global CO2 emissions drop 50% by 2030?",
      yesPrice: 0.08,
      noPrice: 0.92,
      volume: "$1.1M",
      participants: 2234,
      timeLeft: "5 years",
      category: "Environment",
      aiAccuracy: 5,
      humanAccuracy: 12,
    },
    {
      id: "apple-4-trillion",
      question: "Will Apple reach $4 trillion market cap in 2025?",
      yesPrice: 0.73,
      noPrice: 0.27,
      volume: "$1.6M",
      participants: 987,
      timeLeft: "10 months",
      category: "Stocks",
      aiAccuracy: 76,
      humanAccuracy: 69,
    },
    {
      id: "quantum-computer-2027",
      question: "Will quantum computers break RSA encryption by 2027?",
      yesPrice: 0.29,
      noPrice: 0.71,
      volume: "$2.2M",
      participants: 1876,
      timeLeft: "2 years",
      category: "Technology",
      aiAccuracy: 31,
      humanAccuracy: 25,
    },
  ]

  const firstRow = marqueeMarkets.slice(0, 5)
  const secondRow = marqueeMarkets.slice(5, 10)

  const MarketCard = ({ market }: { market: (typeof marqueeMarkets)[0] }) => {
    const getCategoryColor = (category: string) => {
      switch (category) {
        case "Crypto":
          return "bg-purple-600/20 text-purple-400 border-purple-600/30"
        case "AI":
          return "bg-cyan-600/20 text-cyan-400 border-cyan-600/30"
        case "Sports":
          return "bg-green-600/20 text-green-400 border-green-600/30"
        case "Stocks":
          return "bg-blue-600/20 text-blue-400 border-blue-600/30"
        case "Space":
          return "bg-indigo-600/20 text-indigo-400 border-indigo-600/30"
        case "Environment":
          return "bg-emerald-600/20 text-emerald-400 border-emerald-600/30"
        case "Technology":
          return "bg-orange-600/20 text-orange-400 border-orange-600/30"
        default:
          return "bg-gray-600/20 text-gray-400 border-gray-600/30"
      }
    }

    return (
      <Link href={`/market/${market.id}`}>
        <Card className="glass glow w-80 h-64 flex-shrink-0 transition-all duration-300 hover:border-purple-500/50 cursor-pointer group border-white/10">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start mb-2">
              <Badge className={getCategoryColor(market.category)}>{market.category}</Badge>
              <span className="text-xs text-muted-foreground">{market.timeLeft}</span>
            </div>
            <CardTitle className="text-sm leading-tight line-clamp-2 group-hover:text-purple-300 transition-colors">
              {market.question}
            </CardTitle>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="text-cyan-400">AI {market.aiAccuracy}%</span>
              <span className="text-purple-400">Humans {market.humanAccuracy}%</span>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <div className="text-center">
                  <div className="text-lg font-bold text-emerald-400">{(market.yesPrice * 100).toFixed(0)}¢</div>
                  <div className="text-xs text-muted-foreground">YES</div>
                </div>
                <div className="text-center">
                  <div className="text-lg font-bold text-red-400">{(market.noPrice * 100).toFixed(0)}¢</div>
                  <div className="text-xs text-muted-foreground">NO</div>
                </div>
              </div>

              <DualProgress yesValue={market.yesPrice * 100} noValue={market.noPrice * 100} className="h-1.5" />

              <div className="flex justify-between text-xs text-muted-foreground">
                <span className="flex items-center">
                  <Users className="w-3 h-3 mr-1" />
                  {new Intl.NumberFormat('en-US').format(market.participants)}
                </span>
                <span className="flex items-center">
                  <DollarSign className="w-3 h-3 mr-1" />
                  {market.volume}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>
      <div className="floating-orb"></div>

      <div className="absolute inset-0 radial-glow"></div>
      <div className="neon-grid"></div>
      <div className="neon-globe"></div>

      <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl animate-pulse delay-1000"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-400/5 rounded-full blur-3xl animate-pulse delay-2000"></div>

      <section className="relative z-10 text-center py-20 px-6 pt-40 md:pt-24">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-6xl md:text-7xl font-bold mb-6 leading-tight text-balance animate-on-load animate-fade-in-up">
            <span className="text-white">Bet on the Future.</span>
            <br />
            <span className="text-white">The Market </span>
            <span className="text-purple-400 animated-slogan">Never Lies</span>
            <span className="text-white">.</span>
          </h1>
          <h2 className="text-xl md:text-2xl text-gray-300 mb-4 max-w-3xl mx-auto text-pretty leading-relaxed animate-on-load animate-fade-in-up animate-delay-200">
            A decentralized prediction market where the future has a price — powered by{" "}
            <span className="text-purple-400 font-semibold"><TextEffect key={"Solana blockchain"} delay={0.2} per="char" preset="blur" className="inline-block whitespace-nowrap align-baseline">Solana blockchain.</TextEffect></span>
          </h2>
          <div className="flex items-center justify-center gap-2 mb-8 animate-on-load animate-fade-in-up animate-delay-400">
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
              <img src="/phantom-icon.svg" alt="Phantom" className="w-3 h-3 mr-1" />
              Phantom Wallet
            </Badge>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 text-sm text-gray-400 animate-on-load animate-fade-in-up animate-delay-600">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-green-400" />
              <span>$
              <AnimatedNumber
                key={`volume-${volume}`}
                value={volume || 0}
                springOptions={{
                  bounce: 0,
                  duration: 3000,
                }}
                startFromZero={true}
              />
              M Total Volume</span>
            </div>
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-blue-400" />
              <span>
                <AnimatedNumber
                  key={`users-${users}`}
                  value={users || 0}
                  springOptions={{
                    bounce: 0,
                    duration: 3000,
                  }}
                  startFromZero={true}
                /> Active Users</span>
            </div>
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-yellow-400" />
              <span>
                <AnimatedNumber
                  key={`accuracy-${accuracy}`}
                  value={accuracy || 0}
                  springOptions={{
                    bounce: 0,
                    duration: 3000,
                  }}
                  startFromZero={true}
                />
              % Avg Accuracy</span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center animate-on-load animate-fade-in-up animate-delay-800">
            <Link href="/markets">
              <Button
                size="lg"
                className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white text-lg px-12 py-6 shadow-lg shadow-purple-500/25 transition-all duration-300 transform hover:scale-102 hover:shadow-purple-500/30 group"
              >
                <Wallet className="w-5 h-5 mr-2 group-hover:rotate-6 transition-transform" />
                Start Predicting
              </Button>
            </Link>
            <Link href="/markets">
              <Button
                size="lg"
                variant="outline"
                className="border-gray-600 text-gray-300 hover:text-white hover:bg-gray-800/50 text-lg px-12 py-6 transition-all duration-300 bg-transparent hover:border-gray-500 hover:scale-102 group animate-on-load animate-fade-in-up animate-delay-600"
              >
                <BarChart3 className="w-5 h-5 mr-2 group-hover:scale-105 transition-transform" />
                Browse Markets
              </Button>
            </Link>
          </div>

          <div className="flex items-center justify-center gap-8 mt-8 pt-8 border-t border-gray-800/50 animate-on-load animate-fade-in-up animate-delay-1000">
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
              <span>AI-Powered Insights</span>
            </div>
          </div>
        </div>
      </section>

      {/* Market Intelligence Section */}
      <section className="relative z-10 py-12 px-6 pt-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12 animate-on-load animate-slide-in-top animate-delay-200">
            <h2 className="text-4xl font-bold gradient-text mb-4">Market Intelligence</h2>
            <p className="text-lg text-muted-foreground">Real-time insights from the prediction economy</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <Card className="glass glow-cyan lg:col-span-2 relative overflow-visible animate-on-load animate-fade-in-left animate-delay-400">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div>
              <div className="absolute inset-0 bg-gradient-to-t from-purple-500/5 to-transparent"></div>
              <CardHeader className="relative z-10">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Weekly Trends
                </CardTitle>
                <p className="text-sm text-muted-foreground">7-day performance comparison</p>
              </CardHeader>
              <CardContent className="relative z-10 overflow-visible">
                <div className="h-48 flex items-end justify-between gap-2 mb-4 relative overflow-visible">
                  {marketData.map((day, index) => (
                    <div
                      key={index}
                      className="flex-1 flex flex-col items-center relative cursor-pointer transition-all duration-300"
                      onMouseEnter={() => setHoveredDay(index)}
                      onMouseLeave={() => setHoveredDay(null)}
                      onClick={() => setClickedDay(clickedDay === index ? null : index)}
                    >
                      <div
                        className={`absolute bottom-full mb-2 bg-gray-900/95 backdrop-blur-sm border border-gray-700/50 rounded-lg p-3 shadow-xl z-[9999] min-w-[180px] transition-all duration-300 ease-out pointer-events-none ${
                          hoveredDay === index || clickedDay === index
                            ? "opacity-100 translate-y-0 scale-100"
                            : "opacity-0 translate-y-2 scale-95"
                        }`}
                        style={{
                          left: index < 2 ? "0" : index > 4 ? "auto" : "50%",
                          right: index > 4 ? "0" : "auto",
                          transform: index >= 2 && index <= 4 ? "translateX(-50%)" : "none",
                        }}
                      >
                        <div className="text-xs space-y-1">
                          <div className="font-semibold text-white mb-2">{day.day}</div>
                          <div className="flex justify-between">
                            <span className="text-purple-400">Humans:</span>
                            <span className="text-white">{day.humanAccuracy}%</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-cyan-400">AI:</span>
                            <span className="text-white">{day.aiAccuracy}%</span>
                          </div>
                          <div className="border-t border-gray-700/50 pt-1 mt-2">
                            <div className="flex justify-between">
                              <span className="text-gray-400">Volume:</span>
                              <span className="text-white">${day.volume}M</span>
                            </div>
                          </div>
                        </div>
                        <div
                          className={`absolute top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-900/95 transition-all duration-300 z-[9999] ${
                            hoveredDay === index || clickedDay === index ? "opacity-100" : "opacity-0"
                          }`}
                          style={{
                            left: index < 2 ? "20px" : index > 4 ? "auto" : "50%",
                            right: index > 4 ? "20px" : "auto",
                            transform: index >= 2 && index <= 4 ? "translateX(-50%)" : "none",
                          }}
                        ></div>
                      </div>

                      <div className="w-full flex flex-col gap-1 mb-2">
                        <div
                          className={`w-full bg-gradient-to-t from-purple-600 via-purple-500 to-purple-400 rounded-sm transition-all duration-300 ease-out animate-on-load animate-chart-bar ${
                            hoveredDay === index || clickedDay === index
                              ? "shadow-lg shadow-purple-500/50 scale-105 drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]"
                              : "drop-shadow-[0_0_4px_rgba(168,85,247,0.2)]"
                          }`}
                          style={{
                            height: `${(day.humanAccuracy / 100) * 120}px`,
                            animationDelay: `${600 + index * 100}ms`,
                          }}
                        ></div>
                        <div
                          className={`w-full bg-gradient-to-t from-cyan-600 via-cyan-500 to-cyan-400 rounded-sm transition-all duration-300 ease-out animate-on-load animate-chart-bar ${
                            hoveredDay === index || clickedDay === index
                              ? "shadow-lg shadow-cyan-500/50 scale-105 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)]"
                              : "drop-shadow-[0_0_4px_rgba(34,211,238,0.2)]"
                          }`}
                          style={{
                            height: `${(day.aiAccuracy / 100) * 120}px`,
                            animationDelay: `${650 + index * 100}ms`,
                          }}
                        ></div>
                      </div>
                      <span
                        className={`text-xs transition-all duration-300 ${
                          hoveredDay === index || clickedDay === index
                            ? "text-white font-semibold"
                            : "text-muted-foreground"
                        }`}
                      >
                        {day.day}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 pt-6 border-t border-gray-800/50">
                  <div className="text-center">
                    <div className="text-sm text-muted-foreground">
                      <span className="text-purple-400 font-medium">Humans +1.8% WoW</span>
                      <span className="mx-2">•</span>
                      <span className="text-cyan-400 font-medium">AI –0.6% WoW</span>
                      <span className="mx-2">•</span>
                      <span className="text-green-400 font-medium">Week Volume +15.3%</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-6">
              <Card className="glass glow animate-on-load animate-fade-in-right animate-delay-600">
                <CardHeader className="pb-3">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-400" />
                    Live Metrics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">24h Volume</span>
                    <span className="font-semibold text-green-400">$5.2M</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Active Markets</span>
                    <span className="font-semibold">247</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Total Predictions</span>
                    <span className="font-semibold">2.1M</span>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass glow-green animate-on-load animate-fade-in-right animate-delay-800">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Brain className="w-4 h-4 text-purple-400" />
                      AI vs Human Accuracy
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">Human Accuracy</span>
                        <span className="font-semibold text-purple-400">76.2%</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-purple-600 to-purple-400 rounded-full"
                          style={{ width: "76.2%" }}
                        ></div>
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="text-muted-foreground">AI Accuracy</span>
                        <span className="font-semibold text-cyan-400">74.8%</span>
                      </div>
                      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full"
                          style={{ width: "74.8%" }}
                        ></div>
                      </div>
                    </div>
                    <div className="pt-2 text-center">
                      <Badge className="bg-purple-600/20 text-purple-400 border-purple-600/30">Humans Leading</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Live Prediction Markets */}
      <section className="relative z-10 py-16 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 animate-on-load animate-slide-in-top animate-delay-200">
            <h2 className="text-4xl font-bold gradient-text mb-4">Live Prediction Markets</h2>
            <p className="text-lg text-muted-foreground mb-6">Real-time markets across crypto, AI, sports, and more</p>
          </div>
          <div
            className="relative flex w-full flex-col items-center justify-center overflow-hidden rounded-2xl"
            style={{
              WebkitMaskImage:
                "linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,.08) 32px, rgba(0,0,0,.3) 64px, rgba(0,0,0,.6) 96px, rgba(0,0,0,1) 144px, rgba(0,0,0,1) calc(100% - 144px), rgba(0,0,0,.6) calc(100% - 96px), rgba(0,0,0,.3) calc(100% - 64px), rgba(0,0,0,.08) calc(100% - 32px), rgba(0,0,0,0) 100%)",
              maskImage:
                "linear-gradient(to right, rgba(0,0,0,0) 0, rgba(0,0,0,.08) 32px, rgba(0,0,0,.3) 64px, rgba(0,0,0,.6) 96px, rgba(0,0,0,1) 144px, rgba(0,0,0,1) calc(100% - 144px), rgba(0,0,0,.6) calc(100% - 96px), rgba(0,0,0,.3) calc(100% - 64px), rgba(0,0,0,.08) calc(100% - 32px), rgba(0,0,0,0) 100%)",
            }}
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
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 py-20 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="glass glow-cyan animate-on-load animate-bounce-in animate-delay-400">
            <CardContent className="pt-12 pb-12">
              <h2 className="text-4xl font-bold gradient-text mb-4">Ready to Predict the Future?</h2>
              <p className="text-lg text-muted-foreground mb-8">
                Join thousands of predictors and start earning rewards today
              </p>
              <Button
                size="lg"
                className="gradient-bg text-white text-lg px-12 py-6 glow hover:glow-green transition-all duration-300 transform hover:scale-105"
              >
                <Wallet className="w-5 h-5 mr-2" />
                Get Started Now
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  )
}
