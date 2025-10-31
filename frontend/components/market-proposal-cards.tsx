"use client"
import { useState } from "react"
import type React from "react"

import { openStepper, setStepStatus, setMarketPda } from "@/lib/features/marketCreationStepperSlice"
import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, Calendar, FileText, Shield } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"
import type { MarketProposal } from "@/lib/types/market"
import { useWallet } from "@solana/wallet-adapter-react"
import { Connection } from "@solana/web3.js"
import { aiValidateSelect } from "@/lib/services/market/marketService"
import { signAndSendBase64TxV2 } from "@/lib/solana/signAndSend"
import { showToast } from "@/components/shared/show-toast"
import { useAppDispatch } from "@/lib/hooks"

interface MarketProposalCardsProps {
  proposals: MarketProposal[]
  onSelect: (proposal: MarketProposal) => void
  validationHash: string
}

function formatDate(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffTime = date.getTime() - now.getTime()
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

  const formattedDate = date.toLocaleDateString("en-US", {
    timeZoneName: "short",
    minute: "2-digit",
    hour: "2-digit",
    hourCycle: "h24",
    month: "short",
    day: "numeric",
    year: "numeric",
  })

  if (diffDays < 0) {
    return `${formattedDate} (Expired)`
  } else if (diffDays === 0) {
    return `${formattedDate} (Today)`
  } else if (diffDays === 1) {
    return `${formattedDate} (Tomorrow)`
  } else if (diffDays <= 7) {
    return `${formattedDate} (${diffDays} days)`
  } else {
    return formattedDate
  }
}

function getFaviconUrl(domain: string): string {
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
}

function highlightYesNo(text: string): React.ReactNode {
  const cleanedText = text.replace(/^(The market resolves to (Yes|No) if:?\s*)/i, "")
  const parts = cleanedText.split(/\b(Yes|No)\b/g)

  return parts.map((part, index) => {
    if (part === "Yes") {
      return (
        <span key={index} className="text-emerald-400 font-semibold">
          Yes
        </span>
      )
    } else if (part === "No") {
      return (
        <span key={index} className="text-rose-400 font-semibold">
          No
        </span>
      )
    }
    return part
  })
}

export function MarketProposalCards({ proposals, onSelect, validationHash }: MarketProposalCardsProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const wallet = useWallet()
  const connection = new Connection("https://api.devnet.solana.com", "processed")
  const dispatch = useAppDispatch()

  const handleCardClick = (proposal: MarketProposal) => {
    const isCurrentlyExpanded = expandedId === proposal.id
    setExpandedId(isCurrentlyExpanded ? null : proposal.id)
    if (!isCurrentlyExpanded) {
      setSelectedId(proposal.id)
    }
  }

  const handleConfirm = async () => {
    const selected = proposals.find((p) => p.id === selectedId)
    if (!selected) return

    if (!wallet.publicKey) {
      showToast("danger", "Please connect your wallet first!")
      return
    }

    if (isSubmitting) return
    setIsSubmitting(true)

    try {
      console.log("validationHash", validationHash)
      console.log("selected.id", selected.id)
      const response = await aiValidateSelect({
        hash: validationHash,
        id: selected.id,
        // hash: "5d42357f39ef12d193dfd5b7a9eb7e9d8da5c47d0a23f46eab8cc02d9405fb6c",
        // id: "f4dee67fd21e",
      })
      console.log('response', response)
      if (!response.ok) {
        showToast("danger", response.message || "Failed to validate selection")
        return
      }

      dispatch(openStepper())
      dispatch(setStepStatus({ step: 0, status: "active" }))

      const txResult = await signAndSendBase64TxV2(response.create_tx, wallet, connection)

      if (txResult.status === "error") {
        dispatch(
          setStepStatus({
            step: 0,
            status: "error",
            message: `Transaction signing failed. ${txResult.message}`,
          }),
        )
        showToast("danger", `Transaction failed: ${txResult.message}`)
        return
      } else if (txResult.status === "warning") {
        if (response.market_id) {
          dispatch(setMarketPda(response.market_id))
        }
        dispatch(
          setStepStatus({
            step: 0,
            status: "warning",
            message: `Simulation warning. ${txResult.message}`,
          }),
        )
        showToast("warning", `Transaction warning: ${txResult.message}`)
        return
      }

      if (response.market_id) {
        dispatch(setMarketPda(response.market_id))
      }

      dispatch(
        setStepStatus({
          step: 0,
          status: "success",
        }),
      )
      showToast("success", "Market created successfully!")

      onSelect(selected)
    } catch (error) {
      console.error("Market creation error:", error)
      dispatch(
        setStepStatus({
          step: 0,
          status: "error",
          message: "An unexpected error occurred. Please try again.",
        }),
      )
      showToast("danger", "Failed to create market. Please try again.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white/90">Select a Market Proposal</h3>
          <p className="text-sm text-white/50 mt-1">Choose one of the AI-generated market questions</p>
        </div>
      </div>

      <div className="space-y-3">
        {proposals.map((proposal, index) => {
          const isSelected = selectedId === proposal.id
          const isExpanded = expandedId === proposal.id

          return (
            <motion.div
              key={proposal.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "relative group rounded-xl border transition-all duration-300",
                "bg-gradient-to-br from-white/[0.03] to-white/[0.01] backdrop-blur-sm",
                isSelected
                  ? "border-violet-500/50 ring-2 ring-violet-500/20 shadow-lg shadow-violet-500/10"
                  : "border-white/[0.08] hover:border-white/[0.15]",
              )}
            >
              <div onClick={() => handleCardClick(proposal)} className="cursor-pointer">
                <div className="p-5 pr-12">
                  <h4 className="text-base font-semibold text-white/90 leading-relaxed mb-4 pr-2">
                    {proposal.shortText}
                  </h4>

                  <div className="flex items-center gap-3 mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-white/40" />
                      <span className="text-xs text-white/40 font-medium">Trusted Sources</span>
                    </div>
                    <div className="flex -space-x-2">
                      {proposal.accepted_sources.slice(0, 5).map((source, idx) => (
                        <Avatar key={idx} className="w-6 h-6 border-2 border-[#0A0A0B] ring-1 ring-white/10">
                          <AvatarImage src={getFaviconUrl(source) || "/placeholder.svg"} alt={source} />
                          <AvatarFallback className="bg-white/5 text-white/60 text-[10px]">
                            {source.slice(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                      ))}
                      {proposal.accepted_sources.length > 5 && (
                        <div className="w-6 h-6 rounded-full bg-white/5 border-2 border-[#0A0A0B] ring-1 ring-white/10 flex items-center justify-center">
                          <span className="text-[10px] text-white/60 font-medium">
                            +{proposal.accepted_sources.length - 5}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-white/50">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>Resolves: {formatDate(proposal.end_time_utc)}</span>
                  </div>
                </div>
              </div>

              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3, ease: "easeInOut" }}
                    className="overflow-hidden border-t border-white/[0.08]"
                  >
                    <div className="p-5 space-y-5 bg-white/[0.01]">
                      <div>
                        <h4 className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-2 uppercase tracking-wider">
                          <FileText className="w-3.5 h-3.5" />
                          Topic
                        </h4>
                        <p className="text-sm text-white/80 leading-relaxed">{proposal.topic}</p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-2 uppercase tracking-wider">
                          <FileText className="w-3.5 h-3.5" />
                          Description
                        </h4>
                        <p className="text-sm text-white/80 leading-relaxed">{proposal.description}</p>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-white/50 mb-2 flex items-center gap-2 uppercase tracking-wider">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Resolution Criteria
                        </h4>
                        <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4">
                          <p className="text-sm text-white/85 leading-relaxed mb-3">
                            Market Resolves <span className="text-emerald-400 font-semibold">Yes</span> if:
                          </p>
                          <p className="text-sm text-white/85 leading-relaxed whitespace-pre-line">
                            {highlightYesNo(proposal.criteria)}
                          </p>
                        </div>
                      </div>

                      <div>
                        <h4 className="text-xs font-semibold text-white/50 mb-3 flex items-center gap-2 uppercase tracking-wider">
                          <Shield className="w-3.5 h-3.5" />
                          All Accepted Sources ({proposal.accepted_sources.length})
                        </h4>
                        <div className="grid grid-cols-2 gap-2">
                          {proposal.accepted_sources.map((source, idx) => (
                            <div
                              key={idx}
                              className="flex items-center gap-2 p-2.5 rounded-lg bg-white/[0.02] border border-white/5 hover:bg-white/[0.04] transition-colors"
                            >
                              <Avatar className="w-5 h-5 flex-shrink-0">
                                <AvatarImage src={getFaviconUrl(source) || "/placeholder.svg"} alt={source} />
                                <AvatarFallback className="bg-white/5 text-white/60 text-[10px]">
                                  {source.slice(0, 2).toUpperCase()}
                                </AvatarFallback>
                              </Avatar>
                              <span className="text-xs text-white/70 truncate">{source}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )
        })}
      </div>

      <AnimatePresence>
        {selectedId && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="pt-2"
          >
            <button
              onClick={handleConfirm}
              disabled={isSubmitting}
              className={cn(
                "w-full py-3 px-4 rounded-xl text-white font-semibold text-sm transition-all shadow-lg shadow-violet-500/20",
                isSubmitting
                  ? "bg-violet-500/50 cursor-not-allowed"
                  : "bg-gradient-to-r from-violet-500 to-purple-500 hover:from-violet-600 hover:to-purple-600 cursor-pointer",
              )}
            >
              {isSubmitting ? "Processing..." : "Confirm Selection"}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
