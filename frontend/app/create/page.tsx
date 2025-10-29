"use client"

import React, { useState, useEffect } from "react"
import { Brain, Network } from "lucide-react"

import { useWallet } from "@solana/wallet-adapter-react"
import { Connection } from "@solana/web3.js"
import { Button } from "@/components/ui/button"

import { openStepper, setStepStatus, nextStep, setMarketPda } from "@/lib/features/marketCreationStepperSlice"
import { WalletAuthorizationGuard } from "@/components/wallet-authorization-guard"
import { MarketCreationStepper } from "@/components/market-creation-stepper"
import { getPythFeeds, getPythFeed } from "@/lib/services/pyth/feedService"
import { signAndSendBase64TxV2 } from "@/lib/solana/signAndSend"
import { showToast } from "@/components/shared/show-toast"
import type { PythFeedItem } from "@/lib/types/pyth"
import { useAppDispatch, useAppSelector } from "@/lib/hooks"
import { AIoracleSection } from "@/components/ai-oracle-section"
import { PythoracleSection } from "@/components/pyth-oracle-section"

type OracleType = "ai" | "pyth"

const getMinimumDate = () => {
  const now = new Date()
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  const toUtcMidnight = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  return toUtcMidnight(twoDaysFromNow)
}

export default function CreateMarketPage() {
  const dispatch = useAppDispatch()
  const { isAuthorized } = useAppSelector((state) => state.wallet)

  const [oracleType, setOracleType] = useState<OracleType>("ai")
  const [formData, setFormData] = useState({
    marketType: "priceThreshold",
    title: "",
    description: "",
    category: "crypto",
    endDate: undefined as Date | undefined,
    initialLiquidity: "",
    resolutionSource: "",
    feedId: "",
    symbol: "",
    comparator: "",
    threshold: "",
    lowerBound: "",
    upperBound: "",
    initialSide: "",
    aiPrompt: "",
  })

  const [pythFeeds, setPythFeeds] = useState<PythFeedItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    getPythFeeds()
      .then(setPythFeeds)
      .catch((e: any) => console.error("Failed to load Pyth feeds", e))
  }, [])

  const handleAiPromptSubmit = (prompt: string, category: string) => {
    setFormData((prev) => ({ ...prev, aiPrompt: prompt, category }))
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.initialSide) {
      newErrors.initialSide = "Please select Yes or No"
    }

    if (oracleType === "ai") {
      if (!formData.aiPrompt || formData.aiPrompt.trim().length < 10) {
        newErrors.aiPrompt = "Please provide a detailed market description (at least 10 characters)"
      }
    } else {
      // Pyth oracle validation
      if (!formData.feedId) {
        newErrors.feedId = "Please select an feedId"
      }

      if (formData.marketType === "priceThreshold") {
        if (!formData.comparator) {
          newErrors.comparator = "Please select a comparator"
        }
        if (!formData.threshold) {
          newErrors.threshold = "Threshold value is required"
        }
      }

      if (formData.marketType === "priceRange") {
        if (!formData.lowerBound) {
          newErrors.lowerBound = "Lower bound is required"
        }
        if (!formData.upperBound) {
          newErrors.upperBound = "Upper bound is required"
        }
        if (
          formData.lowerBound &&
          formData.upperBound &&
          Number.parseFloat(formData.lowerBound) >= Number.parseFloat(formData.upperBound)
        ) {
          newErrors.upperBound = "Upper bound must be greater than lower bound"
        }
      }
    }

    if (!formData.category) {
      newErrors.category = "Please select a category"
    }

    if (!formData.endDate) {
      newErrors.endDate = "End date is required"
    } else if (formData.endDate <= getMinimumDate()) {
      newErrors.endDate = "End date must be at least 2 days in the future"
    }

    if (!formData.initialLiquidity) {
      newErrors.initialLiquidity = "Initial liquidity is required"
    } else if (Number.parseFloat(formData.initialLiquidity) < 1) {
      newErrors.initialLiquidity = "Minimum liquidity is 1 USDC Predict"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const wallet = useWallet()
  const connection = React.useMemo(() => new Connection("https://api.devnet.solana.com", "processed"), [])

  const handleCreateMarket = async () => {
    try {
      if (!isAuthorized) {
        showToast("danger", "Please connect your wallet first!")
        return
      }

      if (isSubmitting) return
      if (!validateForm()) {
        return
      }
      setIsSubmitting(true)

      if (oracleType === "ai") {
        if (!formData.aiPrompt || !formData.endDate || !formData.initialLiquidity || !formData.category) {
          showToast("danger", "Complete all fields!")
          return
        }
      } else {
        if (formData.feedId.length < 5 || !formData.endDate || !formData.initialLiquidity || !formData.category) {
          showToast("danger", "Complete all fields!")
          return
        }
      }

      dispatch(openStepper())

      try {
        if (oracleType === "pyth") {
          dispatch(setStepStatus({ step: 0, status: "active" }))

          const priceData = await getPythFeed(formData.feedId)
          console.log("price data:", priceData)

          if (priceData <= 0) {
            dispatch(
              setStepStatus({
                step: 0,
                status: "error",
                message: `Price validation failed: Price is ${priceData}, which is not greater than 0. Please check your feed ID.`,
              }),
            )
            return
          }

          dispatch(
            setStepStatus({
              step: 0,
              status: "success",
              message: `Price fetched successfully: ${priceData}`,
            }),
          )
          dispatch(nextStep())
        }

        // const formData_: CreateMarketFormData = {
        //   marketType: oracleType === "ai" ? "custom" : formData.marketType,
        //   category: formData.category,
        //   endDate: formData.endDate,
        //   initialLiquidity: Number(formData.initialLiquidity),
        //   feedId: oracleType === "ai" ? "" : formData.feedId,
        //   symbol: formData.symbol,
        //   comparator: formData.comparator,
        //   threshold: Number(formData.threshold),
        //   lowerBound: Number(formData.lowerBound),
        //   upperBound: Number(formData.upperBound),
        //   initialSide: formData.initialSide,
        // }

        dispatch(setStepStatus({ step: 1, status: "active" }))

        // Get tx, market_pda
        // const resp = await createMarket(formData_)
        // const { tx, marketPda } = resp
        const tx = "AQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABAAcOd/XaI1Y7qCpUXBg1OFwOVLiKLKd3inzU+xTdLXXeOktGmuVvyrW00HxHa7Jq8m7W4SXRWJxYa12N4roGl+mOEEl11H3widnz6DEA+MHrRpsAworTD8xrakz41GSdIzmraEkS8C8DhBH5fz5L5ytjBuDz2C2jYfMnycxbOlrm8YKk2tpqLM1KURtCz5v2r5Wcj26skt41s7a9Xd9Nk9Z/16bRTJQJqN/xtWlfjPDC1C5ZX37xbDaqohdMv6RdKM8f6jWB1k28Xe/E/uhLYq+sVRSFAUxGW9wU2OfEexrmOgIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbd9uHXZaGT2cvhRs7reawctIXtX1s3kTqM9YV+/wCpQv0YfygnEJab7XmNr1oKRr6Gk4Q+pYV5ZNid9qwmfOBRmdv2b8udCbNHN7kwaSlT24xMj+4e4m2pusohXyr7zIyXJY9OJInxuz0QKRSODYMLWhOZ2v8QhASOe9jb6fhZyzdxb3l/PFbRTnAbFvYngPxPcZxCrTLJdolFz3A3kIr4IOBJA+KiwVa5bbm5OvzW6h2FMg4ljwqcHPbHB9o+C8LsPxBiAi+NJF2sGRZJ5lfdQuYUBqjyIJPk0TJwaFkQAQ0MAgUECQYKAQgLBwwDCPxQPezkUO1e"
        const marketPda = "5wkyLt6rivEQZf8K1xhinEbPFjpeQAhNpbqAU1qt3gd8"
        if (!tx || typeof tx !== "string") {
          // console.error("Bad response from server:", resp)
          showToast("danger", "Server didn't return a transaction to sign.")
          dispatch(
            setStepStatus({
              step: 1,
              status: "error",
              message: `Server didn't return a transaction to sign.`,
            }),
          )
          return
        }

        // Sign transaction
        const txResult = await signAndSendBase64TxV2(tx, wallet, connection)

        console.log("sig:", txResult)

        if (txResult.status === "error") {
          dispatch(
            setStepStatus({
              step: 1,
              status: "error",
              message: `Transaction signing failed. ${txResult.message}`,
            }),
          )
          return
        } else if (txResult.status === "warning") {
          if (marketPda) {
            dispatch(setMarketPda(marketPda))
          }
          dispatch(
            setStepStatus({
              step: 1,
              status: "warning",
              message: `Simulation error. ${txResult.message}`,
            }),
          )
          return
        }

        if (marketPda) {
          dispatch(setMarketPda(marketPda))
        }

        dispatch(
          setStepStatus({
            step: 1,
            status: "success",
            message: `Transaction signed successfully: ${txResult.signature}`,
          }),
        )
      } catch (error) {
        console.error("Market creation error:", error)
        dispatch(
          setStepStatus({
            step: 0,
            status: "error",
            message: "An unexpected error occurred. Please try again.",
          }),
        )
      }
    } catch (error: any) {
      console.error(error)
      showToast("danger", error)
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isAuthorized) {
    return (
      <WalletAuthorizationGuard>
        <></>
      </WalletAuthorizationGuard>
    )
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-8">
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold gradient-text">Create Market</h1>
          <p className="text-xl text-muted-foreground">
            Launch your own prediction market and let the community decide
          </p>
        </div>

        <div className="flex items-center justify-center gap-2">
          <Button
            variant={oracleType === "ai" ? "default" : "outline"}
            onClick={() => {
              setOracleType("ai")
              setFormData((prev) => ({ ...prev, resolutionSource: "AI-Powered Resolution" }))
            }}
            className={`px-6 py-2 ${oracleType === "ai" ? "bg-purple-600 hover:bg-purple-700" : ""}`}
          >
            <Brain className="w-4 h-4 mr-2" />
            AI Oracle
          </Button>
          <Button
            variant={oracleType === "pyth" ? "default" : "outline"}
            onClick={() => {
              setOracleType("pyth")
              setFormData((prev) => ({ ...prev, resolutionSource: "Pyth Network Oracle" }))
            }}
            className={`px-6 py-2 ${oracleType === "pyth" ? "bg-cyan-600 hover:bg-cyan-700" : ""}`}
          >
            <Network className="w-4 h-4 mr-2" />
            Pyth Oracle
          </Button>
        </div>

        {oracleType === "ai" && <AIoracleSection onPromptSubmit={handleAiPromptSubmit} />}

        {oracleType === "pyth" && (
          <PythoracleSection
            pythFeeds={pythFeeds}
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            setErrors={setErrors}
            isSubmitting={isSubmitting}
            onSubmit={handleCreateMarket}
          />
        )}
      </div>
      <MarketCreationStepper onStartCreating={handleCreateMarket} />
    </div>
  )
}
