"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { FileText, Clock, Link2, Check, AlertCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import type { ReactNode } from "react"

interface AIMarketDetailsProps {
  description?: string
  criteriaMd?: string
  acceptedSources?: string[]
  endDate: string
  status: "open" | "locked" | "settled" | "void"
  isAiMarket?: boolean
}

// Helper function to highlight Yes/No in text
function highlightYesNo(text: string): ReactNode {
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

// Helper function to get favicon URL from a source URL
function getFaviconUrl(url: string): string {
  try {
    const domain = url.replace(/^https?:\/\//, "").split("/")[0]
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
  } catch {
    return ""
  }
}

export function AIMarketDetails({ description, criteriaMd, acceptedSources, endDate, status, isAiMarket = true }: AIMarketDetailsProps) {
  const formatEndDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone
    const offset = -date.getTimezoneOffset() / 60
    const gmtOffset = offset >= 0 ? `GMT+${offset}` : `GMT${offset}`

    return {
      full: date.toLocaleString(undefined, {
        dateStyle: "full",
        timeStyle: "long",
      }),
      timeZone,
      gmtOffset,
    }
  }

  const dateInfo = formatEndDate(endDate)

  const parseCriteria = (markdown?: string) => {
    if (!markdown) return []

    const lines = markdown.split('\n')
    const bullets: string[] = []

    for (const line of lines) {
      const trimmed = line.trim()
      if (trimmed.startsWith('* ') || trimmed.startsWith('- ')) {
        bullets.push(trimmed.substring(2))
      } else if (trimmed.startsWith('*') || trimmed.startsWith('-')) {
        bullets.push(trimmed.substring(1).trim())
      }
    }

    return bullets
  }

  const criteriaItems = parseCriteria(criteriaMd)

  const getSteps = () => {
    if (isAiMarket) {
      return [
        { label: "Market Open", key: "open" },
        { label: "Market Closed", key: "locked" },
        { label: "Awaiting Resolution", key: "awaiting_resolve" },
        { label: "Market Resolved", key: "settled" },
      ]
    } else {
      return [
        { label: "Market Open", key: "open" },
        { label: "Market Closed", key: "locked" },
        { label: "Market Resolved", key: "settled" },
      ]
    }
  }

  const steps = getSteps()

  // Check if market end date has passed
  const hasEnded = new Date(endDate) <= new Date()

  const getCurrentStepIndex = () => {
    if (status === "void") return -1
    if (status === "settled") return steps.length - 1
    if (status === "locked") {
      // For AI markets:
      // - If end date hasn't passed: step 1 (Market Closed)
      // - If end date has passed: step 2 (Awaiting Resolution)
      // For Pyth markets: always step 1 (Market Closed)
      if (isAiMarket && hasEnded) {
        return 2 // Awaiting Resolution
      }
      return 1 // Market Closed
    }
    if (status === "open") return 0
    return 0
  }

  const currentStepIndex = getCurrentStepIndex()

  return (
    <Card className="glass border-2 border-border/50 animate-fade-in animation-delay-250">
      <CardHeader className="pb-3 border-b border-border/30 bg-gradient-to-br from-purple-500/5 via-transparent to-transparent">
        <CardTitle className="flex items-center gap-2 text-lg">
          <span className="font-bold">Market Information</span>
        </CardTitle>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {status !== "void" && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide">Market Status</h3>
            <div className="flex items-center">
              {steps.map((step, index) => {
                const isCompleted = index < currentStepIndex
                const isCurrent = index === currentStepIndex
                const isLast = index === steps.length - 1

                return (
                  <div key={step.key} className={cn("flex items-center", !isLast && "flex-1")}>
                    <div className="flex flex-col items-center gap-1.5">
                      <div
                        className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center transition-all",
                          isCompleted
                            ? "bg-emerald-500/20 border-2 border-emerald-500"
                            : isCurrent
                              ? "bg-purple-500/20 border-2 border-purple-500 ring-2 ring-purple-500/30"
                              : "bg-white/5 border-2 border-border/40"
                        )}
                      >
                        {isCompleted ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <span
                            className={cn(
                              "text-[10px] font-semibold",
                              isCurrent ? "text-purple-400" : "text-muted-foreground/50"
                            )}
                          >
                            {index + 1}
                          </span>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-[10px] text-center leading-tight whitespace-nowrap",
                          isCurrent
                            ? "text-purple-400 font-medium"
                            : isCompleted
                              ? "text-emerald-400/70"
                              : "text-muted-foreground/50"
                        )}
                      >
                        {step.label}
                      </span>
                    </div>
                    {!isLast && (
                      <div
                        className={cn(
                          "h-[2px] flex-1 mx-2 transition-all min-w-[20px]",
                          isCompleted ? "bg-emerald-500/40" : "bg-border/40"
                        )}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {status === "void" && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/30">
            <AlertCircle className="w-4 h-4 text-orange-400 flex-shrink-0" />
            <p className="text-xs text-orange-400 font-medium">This market has been voided</p>
          </div>
        )}
        {description && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Description</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
          </div>
        )}

        {criteriaItems.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Resolution Criteria</h3>
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                The market resolves to{" "}
                <span className="text-emerald-400 font-semibold">Yes</span> if:
              </p>
              <div className="space-y-1.5">
                {criteriaItems.map((item, index) => (
                  <div key={index} className="flex items-start gap-2.5 group">
                    <div className="flex-shrink-0 mt-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-muted-foreground/40 group-hover:bg-muted-foreground/60 transition-colors" />
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">{highlightYesNo(item)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {acceptedSources && acceptedSources.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Trusted Sources</h3>
            <div className="flex flex-wrap gap-2">
              {acceptedSources.map((source, index) => (
                <a
                  key={index}
                  href={source.startsWith("http") ? source : `https://${source}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md glass border border-border/40 hover:border-foreground/30 transition-colors"
                >
                  <Avatar className="w-4 h-4 flex-shrink-0">
                    <AvatarImage src={getFaviconUrl(source) || "/placeholder.svg"} alt={source} />
                    <AvatarFallback className="bg-white/5 text-white/60 text-[8px]">
                      {source.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">
                    {source.replace(/^https?:\/\/(www\.)?/, "").split("/")[0]}
                  </span>
                </a>
              ))}
            </div>
          </div>
        )}

        <div className="pt-3 border-t border-border/30">
          <div className="space-y-2">
            <h3 className="text-xs font-medium text-foreground/90 uppercase tracking-wide">Resolution Timeline</h3>
            <div className="flex items-start gap-2">
              <Clock className="w-3.5 h-3.5 text-foreground/90 mt-0.5 flex-shrink-0" />
              <div className="space-y-1 flex-1">
                <p className="text-sm text-muted-foreground leading-relaxed">{dateInfo.full}</p>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
