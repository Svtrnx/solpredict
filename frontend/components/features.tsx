"use client"

import { Suspense, useEffect, useRef, useState } from "react"
import { useTheme } from "next-themes"

import { motion, useInView } from "framer-motion"

import { FollowerPointerCard } from "./ui/following-pointer"
import { cn, generateTxPlaceholders } from "@/lib/utils"
import { MorphingText } from "./ui/morphing-text"
import { DotPattern } from "./ui/dot-pattern"
import { Ripple } from "./ui/ripple"
import Earth from "./ui/globe"

export default function Features() {
  const ref = useRef(null)
  const { theme } = useTheme()
  const isInView = useInView(ref, { once: true, amount: 0.1 })
  const [isCliHovering, setIsCliHovering] = useState(false)
  const [texts, setTexts] = useState([''])

  const [baseColor, setBaseColor] = useState<[number, number, number]>([0.7, 0.7, 0.7])
  const [glowColor, setGlowColor] = useState<[number, number, number]>([0.9, 0.9, 0.9])

  const [dark, setDark] = useState<number>(theme === "dark" ? 1 : 0)

  useEffect(() => {
    setBaseColor([0.7, 0.7, 0.7])
    setGlowColor([0.9, 0.9, 0.9])
    setDark(theme === "dark" ? 1 : 0)
    setTexts(generateTxPlaceholders(50))
  }, [theme])

  return (
    <section id="features" className="text-foreground relative overflow-hidden py-12 sm:py-24 md:py-32">
      <motion.div
        className="bg-primary absolute -top-10 left-1/2 h-18 w-52 -translate-x-1/2 rounded-full opacity-40 blur-3xl select-none"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 0.4 }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />
      <motion.div
        className="via-primary/50 absolute top-0 left-1/2 h-px -translate-x-1/2 bg-gradient-to-r from-transparent to-transparent transition-all ease-in-out"
        initial={{ width: "0%", opacity: 0 }}
        animate={{ width: "60%", opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.3, ease: "easeOut" }}
      />
      <motion.div
        ref={ref}
        initial={{ opacity: 1, y: 20 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 1, y: 20 }}
        transition={{ duration: 0.6, delay: 0 }}
        className="container mx-auto flex flex-col items-center gap-6 sm:gap-12"
      >
        <motion.h2
          className={cn(
            "via-foreground mb-8 bg-gradient-to-b from-zinc-800 to-zinc-700 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]",
          )}
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.8, delay: 0.5, ease: "easeOut" }}
        >
          Features
        </motion.h2>
        <FollowerPointerCard
          title={
            <div className="flex items-center gap-2">
              <span>✨</span>
              <span>SolPredict - Prediction Market</span>
            </div>
          }
        >
          <div className="cursor-none">
            <div className="grid grid-cols-11 gap-4 justify-center mr-3">
              <motion.div
                className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-2"
                onMouseEnter={() => setIsCliHovering(true)}
                onMouseLeave={() => setIsCliHovering(false)}
                ref={ref}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
                whileHover={{
                  scale: 1.02,
                  borderColor: "rgba(115, 115, 115, 0.6)",
                  boxShadow: "0 0 30px rgba(115, 115, 115, 0.2)",
                  transition: { duration: 0.3 },
                }}
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl leading-none font-semibold tracking-tight">
                    Multi-network and multi-currency
                  </h3>
                  <div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
                    <p className="max-w-[460px]">
                      Trade predictions across multiple blockchains with support for the most popular networks and
                      cryptocurrencies.
                    </p>
                  </div>
                </div>
                <div className="pointer-events-none flex grow items-center justify-center select-none relative">
                  <div
                    className="relative w-full h-[400px] rounded-xl overflow-hidden"
                    style={{ borderRadius: "20px" }}
                  >
                    <DotPattern
                      glow={true}
                      className={cn("[mask-image:radial-gradient(400px_circle_at_center,white,transparent)]")}
                    />
                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={isCliHovering ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: isCliHovering ? 0.5 : 0.3 }}
                    >
                      <svg width="100%" height="100%" viewBox="0 0 121 94" className="absolute">
                        <motion.path
                          d="M 60.688 1.59 L 60.688 92.449 M 60.688 92.449 L 119.368 92.449 M 60.688 92.449 L 1.414 92.449"
                          stroke="#b4b4b4ff"
                          fill="transparent"
                          strokeDasharray="2 2"
                          initial={{ pathLength: 0 }}
                          animate={isCliHovering ? { pathLength: 1 } : { pathLength: 0 }}
                          transition={{
                            duration: isCliHovering ? 2 : 0.8,
                            ease: "easeInOut",
                          }}
                        />
                      </svg>
                      <svg width="100%" height="100%" viewBox="0 0 121 94" className="absolute">
                        <motion.path
                          d="M 60.688 92.449 L 60.688 1.59 M 60.688 1.59 L 119.368 1.59 M 60.688 1.59 L 1.414 1.59"
                          stroke="rgb(180, 180, 180)"
                          fill="transparent"
                          strokeDasharray="2 2"
                          initial={{ pathLength: 0 }}
                          animate={isCliHovering ? { pathLength: 1 } : { pathLength: 0 }}
                          transition={{
                            duration: isCliHovering ? 2 : 0.8,
                            delay: isCliHovering ? 0.5 : 0,
                            ease: "easeInOut",
                          }}
                        />
                      </svg>
                    </motion.div>

                    <motion.div
                      className="absolute top-1/2 left-1/2 w-16 h-16 bg-gray-400 rounded-full blur-[74px] opacity-65 transform -translate-x-1/2 -translate-y-1/2"
                      initial={{ scale: 1 }}
                      animate={isCliHovering ? { scale: [1, 1.342, 1] } : { scale: 1 }}
                      transition={{
                        duration: 3,
                        ease: "easeInOut",
                        repeat: isCliHovering ? Number.POSITIVE_INFINITY : 0,
                        repeatType: "loop",
                      }}
                    />

                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="flex items-center gap-8">
                        <div className="flex flex-col gap-3">
                          {[
                            { name: "Solana", icon: "/images/solana.svg" },
                            { name: "Ethereum", icon: "/images/eth.svg" },
                            { name: "Bitcoin", icon: "/images/btc.svg" },
                          ].map((item, index) => (
                            <motion.div
                              key={`left-${index}`}
                              className="z-10 glass text-[#ffffffaf] rounded-md px-3 py-2 flex items-center gap-2 text-sm font-medium shadow-sm"
                              initial={{ opacity: 1, x: -20 }}
                              animate={isCliHovering ? { x: 0 } : { x: -20 }}
                              transition={{
                                duration: isCliHovering ? 0.5 : 0.3,
                                delay: isCliHovering ? index * 0.1 : 0,
                                ease: "easeOut",
                              }}
                              whileHover={{ scale: 1.05 }}
                            >
                              <div className="w-4 h-4 flex items-center justify-center font-bold">
                                <img className="w-4" src={item.icon || "/placeholder.svg"} alt={item.name} />
                              </div>
                              {item.name}
                            </motion.div>
                          ))}
                        </div>

                        {/* Center Logo */}
                        <motion.div
                          className="w-17 h-17 border rounded-lg overflow-hidden shadow-lg"
                          initial={{ opacity: 1, scale: 1 }}
                          animate={isCliHovering ? { scale: [1, 1.1, 1] } : { scale: 1 }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          whileHover={{ scale: 1.1, rotate: 5 }}
                        >
                          <img src="/logo-3.png" alt="Logo" className="w-full h-full object-cover" />
                        </motion.div>

                        <div className="flex flex-col gap-3">
                          {[
                            { name: "Polygon", icon: "/images/polygon.svg" },
                            { name: "Arbitrum", icon: "/images/arbitrum.svg" },
                            { name: "Base", icon: "/images/base.svg" },
                          ].map((item, index) => (
                            <motion.div
                              key={`right-${index}`}
                              className="z-10 glass text-[#ffffffaf] rounded-md px-3 py-2 flex items-center gap-2 text-sm font-medium shadow-sm"
                              initial={{ opacity: 1, x: 20 }}
                              animate={isCliHovering ? { x: 0 } : { x: 20 }}
                              transition={{
                                duration: isCliHovering ? 0.5 : 0.3,
                                delay: isCliHovering ? index * 0.1 : 0,
                                ease: "easeOut",
                              }}
                              whileHover={{ scale: 1.05 }}
                            >
                              <div className="w-4 h-4 flex items-center justify-center font-bold">
                                <img className="w-4" src={item.icon || "/placeholder.svg"} alt={item.name} />
                              </div>
                              {item.name}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <motion.div
                      className="absolute inset-0 flex items-center justify-center"
                      initial={{ opacity: 0 }}
                      animate={isCliHovering ? { opacity: 1 } : { opacity: 0 }}
                      transition={{ duration: isCliHovering ? 0.5 : 0.3 }}
                    >
                      <svg width="350" height="350" viewBox="0 0 350 350" className="opacity-40">
                        <motion.path
                          d="M 175 1.159 C 271.01 1.159 348.841 78.99 348.841 175 C 348.841 271.01 271.01 348.841 175 348.841 C 78.99 348.841 1.159 271.01 1.159 175 C 1.159 78.99 78.99 1.159 175 1.159 Z"
                          stroke="rgba(255, 255, 255, 0.38)"
                          strokeWidth="1.16"
                          fill="transparent"
                          strokeDasharray="4 4"
                          initial={{ pathLength: 0, rotate: 0 }}
                          animate={isCliHovering ? { pathLength: 1, rotate: 360 } : { pathLength: 0, rotate: 0 }}
                          transition={{
                            pathLength: { duration: isCliHovering ? 3 : 0.8, ease: "easeInOut" },
                            rotate: {
                              duration: 20,
                              repeat: isCliHovering ? Number.POSITIVE_INFINITY : 0,
                              ease: "linear",
                            },
                          }}
                        />
                      </svg>
                    </motion.div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-8"
                ref={ref}
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
                whileHover={{
                  scale: 1.02,
                  borderColor: "rgba(115, 115, 115, 0.6)",
                  boxShadow: "0 0 30px rgba(115, 115, 115, 0.2)",
                  transition: { duration: 0.3 },
                }}
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl leading-none font-semibold tracking-tight">Decentralization</h3>
                  <div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
                    <p className="max-w-[460px]">
                      True on-chain transparency — every bet, escrow, and payout is verifiable on Solana. Direct wallet
                      interaction — no deposits, custodial balances, or intermediaries required.
                    </p>
                  </div>
                </div>
                <div className="flex min-h-[300px] grow items-start justify-center select-none">
                  <h1 className="mt-8 text-center text-5xl leading-[100%] font-semibold sm:leading-normal lg:mt-12 lg:text-6xl">
                    <span style={{ width: "100%" }} className="">
                      <MorphingText texts={texts} />
                    </span>
                  </h1>
                  <div className="absolute top-64 z-10 flex items-center justify-center">
                    <div className="w-[400px] h-[400px]">
                      <Suspense
                        fallback={
                          <div className="bg-secondary/20 h-[400px] w-[400px] animate-pulse rounded-full"></div>
                        }
                      >
                        <Earth
                          baseColor={baseColor}
                          markerColor={[1, 0.5, 0.8]}
                          glowColor={glowColor}
                          dark={dark}
                          mapBrightness={8}
                          diffuse={1.5}
                        />
                      </Suspense>
                    </div>
                  </div>
                  <div className="absolute top-1/2 w-full translate-y-20 scale-x-[1.2] opacity-70 transition-all duration-1000 group-hover:translate-y-8 group-hover:opacity-100">
                    <div className="from-primary/50 to-primary/0 absolute left-1/2 h-[256px] w-[60%] -translate-x-1/2 scale-[2.5] rounded-[50%] bg-radial from-10% to-60% opacity-20 sm:h-[512px] dark:opacity-100"></div>
                    <div className="from-primary/30 to-primary/0 absolute left-1/2 h-[128px] w-[40%] -translate-x-1/2 scale-200 rounded-[50%] bg-radial from-10% to-60% opacity-20 sm:h-[256px] dark:opacity-100"></div>
                  </div>
                </div>
              </motion.div>

              {/* Pyth Oracle card */}
              <motion.div
                className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-2"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
                whileHover={{
                  scale: 1.02,
                  borderColor: "rgba(115, 115, 115, 0.6)",
                  boxShadow: "0 0 30px rgba(115, 115, 115, 0.2)",
                  transition: { duration: 0.3 },
                }}
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl leading-none font-semibold tracking-tight">Pyth Oracle</h3>
                  <div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
                    <p className="max-w-[460px]">
                      Powered by Pyth Oracle — delivering trusted, low-latency price updates for every market. All
                      resolutions are based on decentralized data, guaranteeing integrity and accuracy.
                    </p>
                  </div>
                </div>
                <div className="bg-background relative flex h-[500px] w-full flex-col items-center justify-center overflow-hidden rounded-lg border">
                  <p className="z-10 text-center text-5xl font-medium tracking-tighter whitespace-pre-wrap text-white">
                    <img src="/pyth.svg" alt="Pyth" className="w-15" />
                  </p>
                  <Ripple />
                </div>
              </motion.div>

              {/* Dynamic Layouts */}
              <motion.div
                className="group border-secondary/40 text-card-foreground relative col-span-12 flex flex-col overflow-hidden rounded-xl border-2 p-6 shadow-xl transition-all ease-in-out md:col-span-6 xl:col-span-6 xl:col-start-8"
                initial={{ opacity: 0, y: 30, scale: 0.95 }}
                animate={isInView ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 30, scale: 0.95 }}
                transition={{ duration: 0.6, delay: 0.5, ease: "easeOut" }}
                whileHover={{
                  scale: 1.02,
                  borderColor: "rgba(115, 115, 115, 0.6)",
                  boxShadow: "0 0 30px rgba(115, 115, 115, 0.2)",
                  transition: { duration: 0.3 },
                }}
              >
                <div className="flex flex-col gap-4">
                  <h3 className="text-2xl leading-none font-semibold tracking-tight">Resolve Markets & Earn Rewards</h3>
                  <div className="text-md text-muted-foreground flex flex-col gap-2 text-sm">
                    <p className="max-w-[460px]">
                      Be the resolver — finalize market outcomes using Pyth data and earn 0.05% of the total market pool
                      instantly.
                    </p>
                  </div>
                </div>
                <div className="flex grow items-center justify-center select-none relative min-h-[300px] p-4">
                  <div className="relative w-full max-w-sm">
                    <img
                      src="/resolve_earn.png"
                      alt="Dynamic Layout Example"
                      className="w-full h-auto rounded-lg shadow-lg"
                    />
                    {/* <div className="absolute inset-0 bg-gradient-to-t from-black/10 to-transparent rounded-lg"></div> */}
                  </div>
                </div>
              </motion.div>
            </div>
          </div>
        </FollowerPointerCard>
      </motion.div>
    </section>
  )
}
