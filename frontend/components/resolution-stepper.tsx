"use client"

import { useState } from "react"

import type { StepStatus } from "@/lib/features/resolutionStepperSlice"
import type React from "react"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertTriangle, CheckCircle2, Loader2, Upload, Shield, TrendingUp, XCircle } from "lucide-react"
import { closeStepper, resetStepper } from "@/lib/features/resolutionStepperSlice"
import { useAppSelector, useAppDispatch } from "@/lib/hooks"
import { Spinner } from "@/components/ui/spinner"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ResolutionStepperProps {
  onStartResolving: () => void
  isAiMarket?: boolean
}

export function ResolutionStepper({ onStartResolving, isAiMarket = false }: ResolutionStepperProps) {
  const dispatch = useAppDispatch()
  const { isOpen, currentStep, steps, hasWarnings } = useAppSelector((state) => state.resolutionStepper)
  const [loading, setLoading] = useState(false)

  const pythStepDefinitions = [
    {
      id: 1,
      title: "Publishing Pyth Price Data",
      description:
        "Uploading the signed Pyth price update to Solana. This transaction creates a temporary on-chain account containing the price, timestamp, and guardian signatures.",
      icon: <Upload className="w-5 h-5" />,
    },
    {
      id: 2,
      title: "Verifying Guardian Signatures",
      description:
        "Confirming that the uploaded Pyth price update is fully verified. This step checks that a sufficient number of trusted Pyth guardians have signed the data.",
      icon: <Shield className="w-5 h-5" />,
    },
    {
      id: 3,
      title: "Finalizing Market Resolution",
      description:
        "Executing the final transaction to resolve the market. Your smart contract reads the verified Pyth price update and determines the winning side. Rewards and outcomes are finalized on-chain.",
      icon: <TrendingUp className="w-5 h-5" />,
    },
  ]

  const aiStepDefinitions = [
    {
      id: 1,
      title: "Finalizing Market Resolution",
      description:
        "Executing the transaction to resolve the AI market. The smart contract finalizes the outcome based on the AI oracle's decision and determines the winning side. Rewards and outcomes are finalized on-chain.",
      icon: <TrendingUp className="w-5 h-5" />,
    },
  ]

  const stepDefinitions = isAiMarket ? aiStepDefinitions : pythStepDefinitions

  const allCompleted = steps.every((s) => s.status === "success" || s.status === "warning")
  const hasError = steps.some((s) => s.status === "error")
  const isProcessing = steps.some((s) => s.status === "active")
  const isWarningScreen = steps.every((s) => s.status === "pending")

  const currentView = isWarningScreen ? "warning" : allCompleted ? "complete" : "processing"

  const isResolving = steps.some((s) => s.status === "active")

  const handleClose = () => {
    if (!isResolving) {
      dispatch(closeStepper())
      setTimeout(() => {
        dispatch(resetStepper())
      }, 300)
    }
  }

  const handleStartResolving = async () => {
    setLoading(true)
    await onStartResolving()
    setLoading(false)
  }

  const getStatusIcon = (status: StepStatus, defaultIcon: React.ReactNode) => {
    switch (status) {
      case "active":
        return <Loader2 className="w-5 h-5 animate-spin" />
      case "success":
        return <CheckCircle2 className="w-5 h-5" />
      case "warning":
        return <AlertTriangle className="w-5 h-5" />
      case "error":
        return <XCircle className="w-5 h-5" />
      default:
        return defaultIcon
    }
  }

  const getStatusColors = (status: StepStatus) => {
    switch (status) {
      case "active":
        return {
          border: "border-purple-500/50",
          bg: "bg-gradient-to-br from-purple-500/10 via-transparent to-transparent",
          shadow: "shadow-lg shadow-purple-500/10",
          iconBg: "bg-purple-500/20 border-purple-500/50 text-purple-400",
          text: "text-purple-400",
        }
      case "success":
        return {
          border: "border-green-500/50",
          bg: "bg-gradient-to-br from-green-500/10 via-transparent to-transparent",
          shadow: "",
          iconBg: "bg-green-500/20 border-green-500/50 text-green-400",
          text: "text-green-400",
        }
      case "warning":
        return {
          border: "border-yellow-500/50",
          bg: "bg-gradient-to-br from-yellow-500/10 via-transparent to-transparent",
          shadow: "",
          iconBg: "bg-yellow-500/20 border-yellow-500/50 text-yellow-400",
          text: "text-yellow-400",
        }
      case "error":
        return {
          border: "border-red-500/50",
          bg: "bg-gradient-to-br from-red-500/10 via-transparent to-transparent",
          shadow: "",
          iconBg: "bg-red-500/20 border-red-500/50 text-red-400",
          text: "text-red-400",
        }
      default:
        return {
          border: "border-border/40",
          bg: "",
          shadow: "",
          iconBg: "bg-muted/20 border-border/40 text-muted-foreground",
          text: "text-muted-foreground",
        }
    }
  }

  const getStatusLabel = (status: StepStatus) => {
    switch (status) {
      case "active":
        return "In Progress..."
      case "success":
        return "Completed"
      case "warning":
        return "Warning"
      case "error":
        return "Failed"
      default:
        return null
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto glass border-2 border-purple-500/30">
        {currentView === "warning" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold gradient-text flex items-center gap-3">
                <div className="p-2 rounded-lg bg-yellow-500/20 border border-yellow-500/40">
                  <AlertTriangle className="w-6 h-6 text-yellow-400" />
                </div>
                Important Notice
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground pt-2">
                Please read carefully before proceeding
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-3">
              <div className="glass p-6 rounded-xl border-2 border-yellow-500/30 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent">
                <p className="text-foreground leading-relaxed">
                  Once you start resolving, your transaction will be sent to the blockchain.{" "}<br/>
                  <span className="font-bold text-yellow-400">
                    If you cancel after signing, your funds and network fees will not be refunded.
                  </span>
                </p>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                  Resolution Process
                </h3>
                <div className="space-y-2">
                  {stepDefinitions.map((step) => (
                    <div key={step.id} className="glass p-4 rounded-lg border border-border/40 flex items-start gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/30 mt-0.5">
                        {step.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-purple-400">STEP {step.id}</span>
                          <span className="text-sm font-semibold text-foreground">{step.title}</span>
                        </div>
                        <p className="text-xs text-muted-foreground leading-relaxed">{step.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={handleClose}
                  className="flex-1 h-11 cursor-pointer glass hover:bg-accent bg-transparent"
                >
                  Cancel
                </Button>
                <Button
                  disabled={loading}
                  onClick={handleStartResolving}
                  className="flex-1 h-11 cursor-pointer bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 shadow-lg shadow-purple-500/20"
                >
                  {loading ? (
                    <>
                      <Spinner />
                      Resolving...
                    </>
                  ) : (
                    "Start Resolution"
                  )}
                </Button>
              </div>
            </div>
          </>
        )}

        {currentView === "processing" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold gradient-text">Resolving Market</DialogTitle>
              <DialogDescription className="text-base text-muted-foreground">
                Please confirm each transaction in your wallet
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-6">
              {stepDefinitions.map((step, index) => {
                const stepState = steps[index]
                const colors = getStatusColors(stepState.status)

                return (
                  <div
                    key={step.id}
                    className={cn(
                      "relative p-5 rounded-xl border-2 transition-all duration-300 glass",
                      colors.border,
                      colors.bg,
                      colors.shadow,
                      stepState.status === "pending" && "opacity-60",
                    )}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "flex-shrink-0 w-12 h-12 rounded-xl flex items-center justify-center border-2 transition-all duration-300",
                          colors.iconBg,
                        )}
                      >
                        {getStatusIcon(stepState.status, step.icon)}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={cn("text-xs font-bold uppercase tracking-wider", colors.text)}>
                            Step {step.id}
                          </span>
                          {getStatusLabel(stepState.status) && (
                            <span className={cn("text-xs font-medium", colors.text)}>
                              {getStatusLabel(stepState.status)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-base font-semibold text-foreground mb-2">{step.title}</h3>
                        <p className="text-sm text-muted-foreground leading-relaxed">{step.description}</p>
                        {stepState.message && (
                          <div
                            className={cn(
                              "mt-3 p-3 rounded-lg border text-sm",
                              stepState.status === "warning" && "bg-yellow-500/10 border-yellow-500/30 text-yellow-300",
                              stepState.status === "error" && "bg-red-500/10 border-red-500/30 text-red-300",
                            )}
                          >
                            {stepState.message}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Progress line */}
                    {index < stepDefinitions.length - 1 && (
                      <div className="absolute left-[2.75rem] top-[4.5rem] w-0.5 h-8 -mb-8">
                        <div
                          className={cn(
                            "w-full h-full transition-all duration-500",
                            stepState.status === "success" || stepState.status === "warning"
                              ? "bg-green-500/50"
                              : "bg-border/40",
                          )}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {currentView === "complete" && (
          <>
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold gradient-text flex items-center gap-3">
                <div
                  className={cn(
                    "p-2 rounded-lg border",
                    hasWarnings ? "bg-yellow-500/20 border-yellow-500/40" : "bg-green-500/20 border-green-500/40",
                  )}
                >
                  {hasWarnings ? (
                    <AlertTriangle className="w-6 h-6 text-yellow-400" />
                  ) : (
                    <CheckCircle2 className="w-6 h-6 text-green-400" />
                  )}
                </div>
                {hasWarnings ? "Market Resolved with Warnings" : "Market Successfully Resolved"}
              </DialogTitle>
              <DialogDescription className="text-base text-muted-foreground pt-2">
                {hasWarnings
                  ? "Resolution completed but some steps had warnings"
                  : "All transactions completed successfully"}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-6 py-6">
              <div
                className={cn(
                  "glass p-6 rounded-xl border-2 bg-gradient-to-br via-transparent to-transparent",
                  hasWarnings ? "border-yellow-500/30 from-yellow-500/10" : "border-green-500/30 from-green-500/10",
                )}
              >
                <p className="text-foreground leading-relaxed text-center">
                  {hasWarnings ? (
                    <>
                      The market has been resolved, but some steps completed with warnings. Please review the details
                      below. The resolution is valid, but you may want to verify the outcome.
                    </>
                  ) : (
                    <>
                      {isAiMarket ? (
                        <>
                          The market has been resolved using the AI oracle's decision. All participants can now claim
                          their winnings.
                        </>
                      ) : (
                        <>
                          The market has been resolved using a fully verified Pyth price feed. All participants can now
                          claim their winnings.
                        </>
                      )}
                    </>
                  )}
                </p>
              </div>

              <div className="space-y-2">
                {stepDefinitions.map((step, index) => {
                  const stepState = steps[index]
                  const isSuccess = stepState.status === "success"
                  const isWarning = stepState.status === "warning"

                  return (
                    <div
                      key={step.id}
                      className={cn(
                        "glass p-4 rounded-lg border flex items-start gap-3",
                        isSuccess && "border-green-500/30",
                        isWarning && "border-yellow-500/30",
                      )}
                    >
                      {isSuccess && <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />}
                      {isWarning && <AlertTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />}
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-semibold text-foreground">{step.title}</span>
                        {stepState.message && isWarning && (
                          <p className="text-xs text-yellow-300 mt-1">{stepState.message}</p>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>

              <Button
                onClick={handleClose}
                className={cn(
                  "w-full h-11 cursor-pointer shadow-lg",
                  hasWarnings
                    ? "bg-gradient-to-r from-yellow-600 to-yellow-700 hover:from-yellow-700 hover:to-yellow-800 shadow-yellow-500/20"
                    : "bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 shadow-green-500/20",
                )}
              >
                Done
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
