"use client"

import React from "react"
import { motion } from "framer-motion"
import { CheckCircle2, AlertCircle, Clock, XCircle } from "lucide-react"
import type { AiValidateResult } from "@/lib/types"
import { MarketProposalCards } from "./market-proposal-cards"

export function formatRejectionReason(reason: string): string {
  const reasonMap: Record<string, string> = {
    "out of category": "Your prompt does not correspond to the selected category",
    "inappropriate content": "Your prompt contains inappropriate content",
    "too vague": "Your prompt is too vague. Please provide more specific details",
    duplicate: "A similar market already exists",
    "invalid format": "Your prompt format is invalid. Please rephrase your question",
  }

  const lowerReason = reason.toLowerCase()
  for (const [key, value] of Object.entries(reasonMap)) {
    if (lowerReason.includes(key)) {
      return value
    }
  }

  return reason.charAt(0).toUpperCase() + reason.slice(1)
}

interface ValidationStatusDisplayProps {
  status: AiValidateResult
  validationHash: string
}

export function ValidationStatusDisplay({ status, validationHash }: ValidationStatusDisplayProps) {
  if (status.status === "pending") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/20 p-5"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent animate-pulse" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center ring-2 ring-blue-500/30">
            <Clock className="w-5 h-5 text-blue-400 animate-pulse" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center gap-2">
              <h4 className="text-base font-semibold text-blue-300">Processing Request</h4>
              <div className="flex gap-1">
                <motion.div
                  className="w-1 h-1 rounded-full bg-blue-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: 0 }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-blue-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: 0.2 }}
                />
                <motion.div
                  className="w-1 h-1 rounded-full bg-blue-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY, delay: 0.4 }}
                />
              </div>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">Validating your market question with AI Oracle</p>
            <div className="pt-2 border-t border-blue-500/10">
              <p className="text-xs text-white/40 font-mono truncate">Query: {status.meta.query}</p>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status.status === "ready") {
    if (status.data.accept && status.data.proposals && status.data.proposals.length > 0) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative overflow-hidden rounded-xl bg-gradient-to-br from-glass-500/10 via-glass-500/5 to-transparent border border-glass-500/20 p-5"
        >
          <div className="absolute inset-0 transparent)]" />
          <div className="relative">
            <MarketProposalCards
              proposals={status.data.proposals}
              validationHash={validationHash}
              onSelect={(proposal) => {
                console.log("Selected proposal:", proposal)
              }}
            />
          </div>
        </motion.div>
      )
    }

    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-glass-500/10 via-glass-500/5 to-transparent border border-glass-500/20 p-5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(34,197,94,0.1),transparent)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-glass-500/20 flex items-center justify-center ring-2 ring-glass-500/30">
            <CheckCircle2 className="w-5 h-5 text-glass-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-base font-semibold text-glass-300">Validation Complete</h4>
            <p className="text-sm text-white/70 leading-relaxed">
              {status.data.accept
                ? "Your market has been validated and accepted"
                : `Market rejected: ${status.data.reason}`}
            </p>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status.status === "rejected") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-yellow-500/10 via-yellow-500/5 to-transparent border border-yellow-500/20 p-5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(234,179,8,0.08),transparent)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-yellow-500/20 flex items-center justify-center ring-2 ring-yellow-500/30">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-base font-semibold text-yellow-300">Market Rejected</h4>
            <p className="text-sm text-white/70 leading-relaxed">{formatRejectionReason(status.reason)}</p>
            <div className="pt-2 flex items-center gap-2 text-xs text-yellow-400/60">
              <div className="w-1 h-1 rounded-full bg-yellow-400/60" />
              <span>Please revise your question and try again</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status.status === "error") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-red-500/10 via-red-500/5 to-transparent border border-red-500/20 p-5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(239,68,68,0.08),transparent)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center ring-2 ring-red-500/30">
            <XCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-base font-semibold text-red-300">Validation Error</h4>
            <p className="text-sm text-white/70 leading-relaxed">{status.error}</p>
            <div className="pt-2 flex items-center gap-2 text-xs text-red-400/60">
              <div className="w-1 h-1 rounded-full bg-red-400/60" />
              <span>Please try again or contact support if the issue persists</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  if (status.status === "expired") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative overflow-hidden rounded-xl bg-gradient-to-br from-gray-500/10 via-gray-500/5 to-transparent border border-gray-500/20 p-5"
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_120%,rgba(107,114,128,0.08),transparent)]" />
        <div className="relative flex items-start gap-4">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gray-500/20 flex items-center justify-center ring-2 ring-gray-500/30">
            <AlertCircle className="w-5 h-5 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0 space-y-2">
            <h4 className="text-base font-semibold text-gray-300">Request Expired</h4>
            <p className="text-sm text-white/70 leading-relaxed">
              The validation request timed out. This can happen during high server load.
            </p>
            <div className="pt-2 flex items-center gap-2 text-xs text-gray-400/60">
              <div className="w-1 h-1 rounded-full bg-gray-400/60" />
              <span>Please submit your question again</span>
            </div>
          </div>
        </div>
      </motion.div>
    )
  }

  return null
}