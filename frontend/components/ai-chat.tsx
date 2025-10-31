"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import {
  SendIcon,
  LoaderIcon,
  XIcon,
  Landmark,
  Swords,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { aiValidateStart, aiValidateResult } from "@/lib/services/market/marketService"
import { ValidationStatusDisplay } from "./validation-status-display"
import { motion, AnimatePresence } from "framer-motion"
import type { AiValidateResult } from "@/lib/types"
import { ShiningText } from "./ui/shining-text"
import { showToast } from "./shared/show-toast"
import { ColorOrb } from "./ui/color-orb"
import { cn } from "@/lib/utils"

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

interface AIChatProps {
  onPromptSubmit: (prompt: string, category: string) => void
}

const categories = [
  { value: "politics", label: "Politics", icon: Landmark, color: "blue" },
  { value: "war", label: "War", icon: Swords, color: "red" },
  { value: "finance", label: "Finance", icon: TrendingUp, color: "green" },
  { value: "sports", label: "Sports", icon: Trophy, color: "yellow" },
]

const PLACEHOLDERS = [
  "Will Bitcoin reach $200,000 by end of 2025?",
  "Will Man City win English Premier League?",
  "Russia x Ukraine ceasefire in 2025?",
  "Will SolPredict be launched in 2025?",
  "Will Tesla (TSLA) beat quarterly earnings?",
]

export function AIChat({ onPromptSubmit }: AIChatProps) {
  const [aiInputValue, setAiInputValue] = useState("")
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [attachments, setAttachments] = useState<string[]>([])
  const [isTyping, setIsTyping] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [showPlaceholder, setShowPlaceholder] = useState(true)
  const [validationStatus, setValidationStatus] = useState<AiValidateResult | null>(null)
  const [validationHash, setValidationHash] = useState<string | null>(null)
  const pollingAbortControllerRef = useRef<AbortController | null>(null)

  const { textareaRef, adjustHeight } = useAutoResizeTextarea({
    minHeight: 60,
    maxHeight: 200,
  })

  const showPlaceholderText = !inputFocused && !aiInputValue

  useEffect(() => {
    if (!showPlaceholderText) return

    const interval = setInterval(() => {
      setShowPlaceholder(false)
      setTimeout(() => {
        setPlaceholderIndex((prev) => (prev + 1) % PLACEHOLDERS.length)
        setShowPlaceholder(true)
      }, 400)
    }, 5000)

    return () => clearInterval(interval)
  }, [showPlaceholderText])

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
      const EXPIRED_RETRY_DELAY = 2000
      const NORMAL_POLL_DELAY = 1000

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
              showToast("warning", "Validation request expired. Please try again.")
              break
            }
          }

          setValidationStatus(result)
          expiredRetryCount = 0

          if (result.status === "ready") {
            setIsTyping(true)
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
            showToast("warning", `Market rejected: ${result.reason}`)
            break
          }

          if (result.status === "error") {
            setIsTyping(true)
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
          showToast("danger", "Failed to check validation status")
          break
        }
      }
    }

    pollResult()

    return () => {
      abortController.abort()
    }
  }, [validationHash])

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
          category: selectedCategory as "politics" | "war" | "finance" | "sports",
        })

        setIsSending(false)

        if (response.ok && response.hash) {
          setValidationHash(response.hash)
          showToast("success", "Validation started! Checking status...")
        } else {
          setIsTyping(false)
          showToast("danger", "Failed to start validation")
        }
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

  return (
    <div className="w-full max-w-2xl mx-auto relative">
      <div className="relative z-10 space-y-12">
        <div className="relative backdrop-blur-2xl bg-white/[0.02] rounded-2xl border border-white/[0.05] shadow-2xl overflow-hidden">
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
                  {showPlaceholder && showPlaceholderText && (
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

          <div className="w-full flex justify-start items-center text-sm">
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
          </div>
        </div>
      </div>

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
                <ValidationStatusDisplay
                  status={validationStatus}
                  validationHash={validationHash || ""}
                />
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