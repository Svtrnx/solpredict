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
      "SolPredict is a decentralized prediction market built on the Solana blockchain. It allows users to create, trade, and resolve markets on real-world events with full transparency, instant transactions, and on-chain payouts.",
  },
  {
    title: "How is it different from other markets?",
    content:
      "SolPredict stands out through decentralization, speed, and gamification. Built on Solana, it delivers lightning-fast transactions and full self-custody with no intermediaries. Beyond trading, users can climb ranks, earn achievements, and compete on leaderboards — making predictions fun, transparent, and rewarding.",
  },
  {
    title: "How can I earn on SolPredict?",
    content:
      "Any user who resolves a market earns 0.05% of the total market pool as a resolver reward. You can also earn by accurately predicting outcomes or by creating markets that attract participants — every action on SolPredict is designed to reward engagement and transparency.",
  },
  {
    title: "How does SolPredict work?",
    content:
      "Users buy YES/NO shares on outcomes, and their funds are locked in an on-chain escrow until resolution. When the event resolves via Pyth oracle data, winners receive automatic payouts from the pooled escrow. It's fully non-custodial and fast thanks to Solana.",
  },
  {
    title: "Why trust SolPredict?",
    content:
      "SolPredict runs fully on-chain using smart contracts audited for transparency. All funds remain in escrow, results come from Pyth's verified data feeds, and no centralized entity can alter outcomes.",
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
        Features
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
