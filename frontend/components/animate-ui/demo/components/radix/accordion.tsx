"use client"

import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/animate-ui/components/radix/accordion"
import { motion, useInView } from "framer-motion"
import { cn } from "@/lib/utils"
import { useRef } from "react"

const ITEMS = [
  {
    title: "What is SolPredict",
    content:
      "SolPredict is a decentralized prediction market built on Solana with a hybrid dual-oracle resolution system. It combines AI oracle for custom events and Pyth Network for price feeds, allowing users to create, trade, and resolve markets on real-world events with full transparency, instant transactions, and on-chain payouts.",
  },
  {
    title: "What is the Dual Oracle System?",
    content:
      "SolPredict uses two oracle types: AI Oracle for resolving custom events like politics, sports, and world events through cryptographic attestation; and Pyth Oracle for price-based markets using real-time verified price feeds. This hybrid approach ensures trustless resolution for any type of prediction market.",
  },
  {
    title: "How is it different from other markets?",
    content:
      "SolPredict stands out with its unique AI-powered resolution system for custom events, combined with Pyth Network for price feeds. Built on Solana, it delivers lightning-fast transactions, full self-custody, and supports multi-outcome markets (2-5 outcomes). Users can also climb ranks, earn achievements, and compete on leaderboards — making predictions fun, transparent, and rewarding.",
  },
  {
    title: "How can I earn on SolPredict?",
    content:
      "Any user who resolves a market earns 0.1% of the total market pool as a resolver reward. You can also earn by accurately predicting outcomes or by creating markets that attract participants — every action on SolPredict is designed to reward engagement and transparency.",
  },
  {
    title: "How does resolution work?",
    content:
      "Markets resolve through our dual-oracle system: Pyth-based markets automatically resolve using verified price data from Pyth Network, while AI-based markets resolve through our AI oracle which analyzes the event outcome and provides cryptographic attestation. Both methods ensure trustless, transparent resolution with automatic on-chain payouts to winners.",
  },
  {
    title: "Why trust SolPredict?",
    content:
      "SolPredict runs fully on-chain using smart contracts with transparent logic. All funds remain in escrow, Pyth markets use verified price feeds, and AI markets use cryptographically signed attestations. No centralized entity can alter outcomes, and all resolutions are verifiable on-chain.",
  },
]

type RadixAccordionProps = {
  multiple?: boolean
  collapsible?: boolean
  keepRendered?: boolean
  showArrow?: boolean
}

export const RadixAccordion = ({
  multiple = false,
  collapsible = true,
  keepRendered = false,
  showArrow = true,
}: RadixAccordionProps) => {
  const ref = useRef(null)
  const isInView = useInView(ref, { once: true, amount: 0.2 })

  return (
    <div className="grid mt-20 max-w-[800px] w-full" ref={ref}>
      <motion.h2
        className={cn(
          "via-foreground mb-8 bg-gradient-to-b from-zinc-800 to-zinc-700 bg-clip-text text-center text-4xl font-semibold tracking-tighter text-transparent md:text-[54px] md:leading-[60px]",
        )}
        initial={{ opacity: 0, y: 50 }}
        animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        Frequently Asked Questions
      </motion.h2>
      <Accordion
        type={multiple ? "multiple" : "single"}
        collapsible={collapsible}
        className="max-w-[800px] w-full space-y-2"
      >
        {ITEMS.map((item, index) => (
          <motion.div
            key={index}
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -30 }}
            transition={{
              duration: 0.5,
              delay: 0.2 + index * 0.1,
              ease: "easeOut",
            }}
          >
            <AccordionItem className="rounded-md border! glass" value={`item-${index + 1}`}>
              <AccordionTrigger className="px-5" showArrow={showArrow}>
                {item.title}
              </AccordionTrigger>
              <AccordionContent className="text-muted-foreground px-5" keepRendered={keepRendered}>
                {item.content}
              </AccordionContent>
            </AccordionItem>
          </motion.div>
        ))}
      </Accordion>
    </div>
  )
}
