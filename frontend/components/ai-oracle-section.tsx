"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"

import {
  SendIcon,
  LoaderIcon,
  XIcon,
  Landmark,
  Swords,
  TrendingUp,
  Vote,
  Trophy,
  CheckCircle2,
  AlertCircle,
  Clock,
  XCircle,
} from "lucide-react"
import { aiValidateStart, aiValidateResult } from "@/lib/services/market/marketService"
import { motion, AnimatePresence } from "framer-motion"
import type { AiValidateResult } from "@/lib/types"
import { ShiningText } from "./ui/shining-text"
import { showToast } from "./shared/show-toast"
import { ColorOrb } from "./ui/color-orb"
import { cn } from "@/lib/utils"
import { MarketProposalCards } from "./market-proposal-cards"

interface UseAutoResizeTextareaProps {
  minHeight: number
  maxHeight?: number
}

function useAutoResizeTextarea({ minHeight, maxHeight }: UseAutoResizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(
    (reset?: boolean) => {
      const textarea = textareaRef.current
      if (!textarea) return

      if (reset) {
        textarea.style.height = `${minHeight}px`
        return
      }

      textarea.style.height = `${minHeight}px`
      const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Number.POSITIVE_INFINITY))

      textarea.style.height = `${newHeight}px`
    },
    [minHeight, maxHeight],
  )

  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = `${minHeight}px`
    }
  }, [minHeight])

  useEffect(() => {
    const handleResize = () => adjustHeight()
    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [adjustHeight])

  return { textareaRef, adjustHeight }
}

interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  containerClassName?: string
  showRing?: boolean
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, containerClassName, showRing = true, ...props }, ref) => {
    const [isFocused, setIsFocused] = React.useState(false)

    return (
      <div className={cn("relative", containerClassName)}>
        <textarea
          className={cn(
            "flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm",
            "transition-all duration-200 ease-in-out",
            "placeholder:text-muted-foreground",
            "disabled:cursor-not-allowed disabled:opacity-50",
            showRing ? "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0" : "",
            className,
          )}
          ref={ref}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />

        {showRing && isFocused && (
          <motion.span
            className="absolute inset-0 rounded-md pointer-events-none ring-2 ring-offset-0 ring-violet-500/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
        )}
      </div>
    )
  },
)
Textarea.displayName = "Textarea"

interface AIoracleSectionProps {
  onPromptSubmit: (prompt: string, category: string) => void
}

const categories = [
  { value: "politics", label: "Politics", icon: Landmark, color: "blue" },
  { value: "war", label: "War", icon: Swords, color: "red" },
  { value: "finance", label: "Finance", icon: TrendingUp, color: "glass" },
  { value: "election", label: "Election", icon: Vote, color: "purple" },
  { value: "sports", label: "Sports", icon: Trophy, color: "orange" },
]

function formatRejectionReason(reason: string): string {
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

function ValidationStatusDisplay({ status, validationHash }: { status: AiValidateResult, validationHash: string }) {
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

export function AIoracleSection({ onPromptSubmit }: AIoracleSectionProps) {
  const [aiInputValue, setAiInputValue] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [attachments, setAttachments] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [validationStatus, setValidationStatus] = useState<AiValidateResult | null>(null)
  const [validationHash, setValidationHash] = useState<string | null>(null)
  const pollingAbortControllerRef = useRef<AbortController | null>(null)

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  })

  const isActive = inputFocused || aiInputValue || selectedCategory

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  useEffect(() => {
    if (isActive) return

    const interval = setInterval(() => {
      setShowPlaceholder(false)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setShowPlaceholder(true)
      }, 400)
    }, 5000)

    return () => clearInterval(interval)
  }, [isActive])

  useEffect(() => {
    return () => {
      if (pollingAbortControllerRef.current) {
        pollingAbortControllerRef.current.abort()
      }
    }
  }, [])

  useEffect(() => {
    if (!validationHash) return

    const abortController = new AbortController()
    pollingAbortControllerRef.current = abortController

    const pollResult = async () => {
      let expiredRetryCount = 0
      const MAX_EXPIRED_RETRIES = 1
      const EXPIRED_RETRY_DELAY = 2000 // 2 seconds
      const NORMAL_POLL_DELAY = 1000 // 1 second

      while (!abortController.signal.aborted) {
        try {
          const result = await aiValidateResult(validationHash)

          if (abortController.signal.aborted) break

          if (result.status === "expired") {
            if (expiredRetryCount < MAX_EXPIRED_RETRIES) {
              expiredRetryCount++
              console.log(`Expired status received, retry ${expiredRetryCount}/${MAX_EXPIRED_RETRIES}`)

              if (!abortController.signal.aborted) {
                await new Promise((resolve) => setTimeout(resolve, EXPIRED_RETRY_DELAY))
              }
              continue 
            } else {
              setValidationStatus(result)
            //   setValidationHash(null)
              showToast("warning", "Validation request expired. Please try again.")
              break
            }
          }

          setValidationStatus(result)

          expiredRetryCount = 0

          if (result.status === "ready") {
            setIsTyping(true)
            // setValidationHash(null) 
            abortController.abort()

            if (result.data.accept) {
              showToast("success", "Market proposals generated successfully!")
            } else {
              showToast("warning", `Market not accepted: ${result.data.reason || "Unknown reason"}`)
            }

            break
          }

          if (result.status === "rejected") {
            setIsTyping(true) 
            // setValidationHash(null)
            showToast("warning", `Market rejected: ${result.reason}`)
            break
          }

          if (result.status === "error") {
            setIsTyping(true)
            // setValidationHash(null)
            showToast("danger", `Validation error: ${result.error}`)
            break
          }

          if (result.status === "pending") {
            if (!abortController.signal.aborted) {
              await new Promise((resolve) => setTimeout(resolve, NORMAL_POLL_DELAY))
            }
          }
        } catch (error) {
          if (abortController.signal.aborted) break

          console.error("Error polling validation result:", error)
          setIsTyping(false)
          // setValidationHash(null)
          showToast("danger", "Failed to check validation status")
          break
        }
      }
    }

    pollResult()

    return () => {
      abortController.abort()
    }
  }, [validationHash, aiInputValue, selectedCategory, onPromptSubmit])

  const handleAiPromptSubmit = async () => {
    if (aiInputValue.trim()) {
      if (aiInputValue.trim().length < 10) {
        showToast("warning", "Please provide a more detailed market description (at least 10 characters)")
        return
      }

      if (!selectedCategory) {
        showToast("warning", "Please select a category!")
        return
      }

      setIsSending(true)
      setIsTyping(true)
      setValidationStatus(null)
      setValidationHash(null)

      try {
        const response = await aiValidateStart({
          query: aiInputValue,
          category: selectedCategory as "politics" | "war",
        })

        setIsSending(false)

        if (response.ok && response.hash) {
          setValidationHash(response.hash)
          showToast("success", "Validation started! Checking status...")
        } else {
          setIsTyping(false)
          showToast("danger", "Failed to start validation")
        }
        // if (true) {
        //   setValidationHash("c6f9549f754ff0d12b6712d3d2d601e4bcebb5bc7d77f6cd76f31f94296d752f")
        //   showToast("success", "Validation started! Checking status...")
        // } else {
        //   setIsTyping(false)
        //   showToast("danger", "Failed to start validation")
        // }
      } catch (error) {
        console.error("Error starting validation:", error)
        setIsSending(false)
        setIsTyping(false)
        showToast("danger", "Failed to start validation. Please try again.")
      }
    }
  }

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (aiInputValue.trim()) {
        handleAiPromptSubmit()
      }
    }
  }

  const placeholderContainerVariants = {
    initial: {},
    animate: { transition: { staggerChildren: 0.025 } },
    exit: { transition: { staggerChildren: 0.015, staggerDirection: -1 } },
  }

  const letterVariants = {
    initial: {
      opacity: 0,
      filter: "blur(12px)",
      y: 10,
    },
    animate: {
      opacity: 1,
      filter: "blur(0px)",
      y: 0,
      transition: {
        opacity: { duration: 0.25 },
        filter: { duration: 0.4 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
    exit: {
      opacity: 0,
      filter: "blur(12px)",
      y: -10,
      transition: {
        opacity: { duration: 0.2 },
        filter: { duration: 0.3 },
        y: { type: "spring" as const, stiffness: 80, damping: 20 },
      },
    },
  }

  const containerVariants = {
    collapsed: {
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
    expanded: {
      transition: { type: "spring" as const, stiffness: 120, damping: 18 },
    },
  }

  const PLACEHOLDERS = [
    "Will Bitcoin reach $200,000 by end of 2025?",
    "Will Man City win English Premier League?",
    "Russia x Ukraine ceasefire in 2025?",
    "Will SolPredict be launched in 2025?",
    "Will Tesla (TSLA) beat quarterly earnings?",
  ]

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <motion.div
        className="relative z-10 space-y-12"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <motion.div
          className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl overflow-hidden"
          variants={containerVariants}
          initial="collapsed"
          animate={isActive ? "expanded" : "collapsed"}
        >
          <div className="p-4">
            <div className="relative">
              <Textarea
                ref={textareaRef}
                value={aiInputValue}
                onChange={(e) => {
                  setAiInputValue(e.target.value)
                  adjustHeight()
                }}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder=""
                containerClassName="w-full"
                className={cn(
                  "w-full px-4 py-3",
                  "resize-none",
                  "bg-transparent",
                  "border-none",
                  "text-white/90 text-sm",
                  "focus:outline-none",
                  "placeholder:text-white/20",
                  "min-h-[60px]",
                )}
                style={{
                  overflow: "hidden",
                }}
                showRing={false}
              />
              <div className="absolute left-4 top-3 pointer-events-none">
                <AnimatePresence mode="wait">
                  {showPlaceholder && !isActive && (
                    <motion.span
                      key={placeholderIndex}
                      className="text-white/20 select-none text-sm"
                      style={{
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      variants={placeholderContainerVariants}
                      initial="initial"
                      animate="animate"
                      exit="exit"
                    >
                      {PLACEHOLDERS[placeholderIndex].split("").map((char, i) => (
                        <motion.span key={i} variants={letterVariants} style={{ display: "inline-block" }}>
                          {char === " " ? "\u00A0" : char}
                        </motion.span>
                      ))}
                    </motion.span>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          <AnimatePresence>
            {attachments.length > 0 && (
              <motion.div
                className="px-4 pb-3 flex gap-2 flex-wrap"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
              >
                {attachments.map((file, index) => (
                  <motion.div
                    key={index}
                    className="flex items-center gap-2 text-xs bg-white/[0.03] py-1.5 px-3 rounded-lg text-white/70"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <span>{file}</span>
                    <button
                      onClick={() => removeAttachment(index)}
                      className="text-white/40 hover:text-white transition-colors"
                    >
                      <XIcon className="w-3 h-3" />
                    </button>
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          <motion.div
            className="w-full flex justify-start items-center text-sm"
            variants={{
              hidden: {
                opacity: 0,
                y: 20,
                height: 0,
                pointerEvents: "none" as const,
                transition: { type: "spring" as const, stiffness: 120, damping: 18 },
              },
              visible: {
                opacity: 1,
                y: 0,
                height: "auto",
                pointerEvents: "auto" as const,
                transition: { type: "spring" as const, stiffness: 120, damping: 18, delay: 0.08 },
              },
            }}
            initial="hidden"
            animate={isActive ? "visible" : "hidden"}
          >
            <div className="p-4 border-t border-white/[0.05] flex items-center justify-between gap-4 w-full">
              <div className="relative flex-1 min-w-0">
                <div
                  className="flex items-center gap-2 overflow-x-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent hover:scrollbar-thumb-white/20 p-1"
                  style={{
                    scrollbarWidth: "thin",
                    scrollBehavior: "smooth",
                  }}
                >
                  {categories.map((category) => {
                    const Icon = category.icon
                    const isSelected = selectedCategory === category.value
                    return (
                      <motion.button
                        key={category.value}
                        type="button"
                        onClick={() => setSelectedCategory(category.value)}
                        whileTap={{ scale: 0.94 }}
                        className={cn(
                          "p-2 rounded-lg transition-all relative group flex items-center gap-1.5 text-xs flex-shrink-0 cursor-pointer",
                          isSelected
                            ? "bg-white/10 text-white/90 ring-1 ring-white/20"
                            : "text-white/40 hover:text-white/90 hover:bg-white/[0.05]",
                        )}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span className="font-medium whitespace-nowrap">{category.label}</span>
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              <motion.button
                type="button"
                onClick={handleAiPromptSubmit}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.98 }}
                disabled={isSending || !aiInputValue.trim()}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium transition-all cursor-pointer",
                  "flex items-center gap-2 flex-shrink-0",
                  aiInputValue.trim()
                    ? "bg-white text-[#0A0A0B] shadow-lg shadow-white/10"
                    : "bg-white/[0.05] text-white/40",
                )}
              >
                {isSending ? (
                  <LoaderIcon className="w-4 h-4 animate-[spin_2s_linear_infinite]" />
                ) : (
                  <SendIcon className="w-4 h-4" />
                )}
                <span>Send</span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      </motion.div>

      <AnimatePresence>
        {isTyping && (
          <motion.div
            className="mt-6 mx-auto backdrop-blur-2xl bg-white/[0.02] rounded-2xl shadow-lg border border-white/[0.05] overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
          >
            <div className="p-4">
              {validationStatus ? (
                <ValidationStatusDisplay status={validationStatus} validationHash={validationHash ? validationHash : ""} />
              ) : (
                <div className="flex items-center gap-4 p-4">
                  <div className="w-8 h-7 rounded-full bg-white/[0.05] flex items-center justify-center text-center">
                    <ColorOrb dimension="24px" tones={{ base: "oklch(22.64% 0 0)" }} />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 text-sm text-white/70">
                      <ShiningText text={"Starting validation..."} />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
