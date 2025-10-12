"use client"

import Link from "next/link"
import { useRef } from "react"
import { ArrowUpRight, Github } from "lucide-react"
import { Component } from "../ui/etheral-shadow"
import { Button } from "@/components/ui/button"
import { motion, useInView } from "framer-motion"

export function FooterComponent() {
  const ctaRef = useRef(null)
  const footerLinksRef = useRef(null)
  const isCtaInView = useInView(ctaRef, { once: true, amount: 0.3 })
  const isFooterLinksInView = useInView(footerLinksRef, { once: true, amount: 0.2 })

  return (
    <footer className="bg-muted/10 rounded-3xl border border-input p-2 w-full">
      <motion.footer
        ref={ctaRef}
        className="w-full h-[20rem] border rounded-2xl overflow-hidden relative"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={isCtaInView ? { opacity: 1, scale: 1 } : { opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <Component
          color="rgba(128, 128, 128, 1)"
          animation={{ scale: 100, speed: 90 }}
          noise={{ opacity: 1, scale: 1.2 }}
          sizing="fill"
        />
        <div className="absolute right-40 top-10 hidden xl:flex size-64 p-4 rounded-4xl backdrop-blur-xs">
          <img src="/images/fig-4.svg" alt="Black fig" className="pointer-events-none select-none animate-float" />
        </div>
        <div className="relative z-10 flex flex-col items-start justify-center h-full px-8 md:px-16 lg:px-24">
          <motion.h2
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-4 max-w-3xl font-darker"
            initial={{ opacity: 0, y: 30 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.2, ease: "easeOut" }}
          >
            Join the SolPredict community
          </motion.h2>
          <motion.p
            className="text-lg md:text-2xl text-white/80 mb-8 max-w-2xl font-darker"
            initial={{ opacity: 0, y: 30 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.4, ease: "easeOut" }}
          >
            Follow our updates, explore open-source code, and be part of the decentralized prediction market ecosystem.
          </motion.p>
          <motion.div
            className="flex flex-wrap gap-4"
            initial={{ opacity: 0, y: 30 }}
            animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
            transition={{ duration: 0.6, delay: 0.6, ease: "easeOut" }}
          >
            <Link href="/markets" target="_blank" className="flex flex-col h-full">
              <Button size="lg" className="cursor-pointer bg-white text-black hover:bg-white/90 font-medium">
                Get Started
                <ArrowUpRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="https://github.com/Svtrnx/solpredict" target="_blank" className="flex flex-col h-full">
              <Button
                size="lg"
                variant="outline"
                className="border-white/20 cursor-pointer bg-white/5 text-white hover:bg-white/10 font-medium backdrop-blur-sm"
              >
                Github
                <Github className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </motion.div>
        </div>
      </motion.footer>

      <div ref={footerLinksRef} className="backdrop-blur-sm rounded-xl p-8 md:p-12 lg:p-16 mt-2">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          <motion.div
            className="lg:col-span-1"
            initial={{ opacity: 0, y: 20 }}
            animate={isFooterLinksInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
            transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
          >
            <div className="flex items-center gap-3 mb-4">
              <img className="w-6" src="/logo.png" alt="logo" />
              <span className="text-xl font-bold text-white">Prediction Market</span>
            </div>
            <p className="text-sm text-white/60 mb-6 max-w-xs">
              Open-source platform for decentralized prediction markets.
            </p>
            <div className="flex gap-4">
              <a
                href="https://github.com/Svtrnx/solpredict"
                className="text-white/60 hover:text-white transition-colors"
              >
                <Github className="h-5 w-5" />
              </a>
            </div>
          </motion.div>

          {[
            {
              title: "Platform",
              links: [
                { href: "/markets", label: "Markets" },
                { href: "/create", label: "Create Market" },
                { href: "/leaderboard", label: "Leaderboard" },
                { href: "/dashboard", label: "Dashboard" },
              ],
            },
            {
              title: "Resources",
              links: [{ href: "https://www.pyth.network/", label: "Pyth Oracle" }],
            },
            {
              title: "Community",
              links: [{ href: "https://github.com/Svtrnx/solpredict", label: "GitHub" }],
            },
          ].map((section, sectionIndex) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={isFooterLinksInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
              transition={{ duration: 0.5, delay: 0.2 + sectionIndex * 0.1, ease: "easeOut" }}
            >
              <h3 className="text-white font-semibold mb-4">{section.title}</h3>
              <ul className="space-y-3">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className="text-white/60 hover:text-white transition-colors text-sm">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
        <motion.div
          className="mt-12 pt-8 border-t border-white/10"
          initial={{ opacity: 0 }}
          animate={isFooterLinksInView ? { opacity: 1 } : { opacity: 0 }}
          transition={{ duration: 0.5, delay: 0.6, ease: "easeOut" }}
        >
          <p className="text-sm text-white/40 text-center">
            © 2025 SolPredict. Built on Solana. Open-source and community-driven.
          </p>
        </motion.div>
      </div>
    </footer>
  )
}
