"use client"

import React, { useState, useEffect } from "react"
import { formatInTimeZone } from "date-fns-tz"
import {
  CalendarIcon,
  Plus,
  DollarSign,
  Clock,
  Tag,
  AlertCircle,
  CheckCircle,
  Sparkles,
  TrendingUp,
  BarChart3,
} from "lucide-react"

import { PythFeedCombobox } from "@/components/pyth-feed-combobox"

import { useWallet } from "@solana/wallet-adapter-react"
import { Connection } from "@solana/web3.js"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

import { createMarket, confirmMarket } from "@/lib/services/market/marketService"
import { signAndSendBase64Tx } from "@/lib/solana/signAndSend"
import { getPythFeeds } from "@/lib/services/pyth/feedService"
import { showToast } from "@/components/shared/show-toast"
import type { CreateMarketFormData } from "@/lib/types"
import type { PythFeedItem } from "@/lib/types/pyth"

type MarketTemplate = "priceThreshold" | "priceRange" | "custom"

const comparators = [
  { value: ">=", label: "≥ (greater than or equal)" },
  { value: "<=", label: "≤ (less than or equal)" },
  { value: ">", label: "> (greater than)" },
  { value: "<", label: "< (less than)" },
  { value: "=", label: "= (equal to)" },
]

const toUtcMidnight = (d: Date) => new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))

export default function CreateMarketPage() {
  const [selectedTemplate, setSelectedTemplate] = useState<MarketTemplate>("priceThreshold")
  const [formData, setFormData] = useState({
    marketType: selectedTemplate,
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
  })
  const [pythFeeds, setPythFeeds] = useState<PythFeedItem[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [endDateOpen, setEndDateOpen] = React.useState(false)

  const categories = [{ value: "crypto", label: "Crypto" }]

  useEffect(() => {
    getPythFeeds()
      .then(setPythFeeds)
      .catch((e: any) => console.error("Failed to load Pyth feeds", e))
      // const devTime = new Date(Date.now() + 13 * 60 * 1000)
      // formData.endDate = devTime
  }, [])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.initialSide) {
      newErrors.initialSide = "Please select Yes or No"
    }

    if (selectedTemplate === "custom") {
      if (!formData.title.trim()) {
        newErrors.title = "Market title is required"
      } else if (formData.title.length < 10) {
        newErrors.title = "Title must be at least 10 characters"
      }

      if (!formData.description.trim()) {
        newErrors.description = "Market description is required"
      } else if (formData.description.length < 50) {
        newErrors.description = "Description must be at least 50 characters"
      }

      if (!formData.resolutionSource.trim()) {
        newErrors.resolutionSource = "Resolution source is required"
      }
    } else {
      if (!formData.feedId) {
        newErrors.feedId = "Please select an feedId"
      }

      if (selectedTemplate === "priceThreshold") {
        if (!formData.comparator) {
          newErrors.comparator = "Please select a comparator"
        }
        if (!formData.threshold) {
          newErrors.threshold = "Threshold value is required"
        }
      }

      if (selectedTemplate === "priceRange") {
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
    } else if (formData.endDate <= new Date()) {
      newErrors.endDate = "End date must be in the future"
    }

    if (!formData.initialLiquidity) {
      newErrors.initialLiquidity = "Initial liquidity is required"
    } else if (Number.parseFloat(formData.initialLiquidity) < 1) {
      newErrors.initialLiquidity = "Minimum liquidity is 1 USDC Predict"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const generateTemplateContent = () => {
    const selectedFeed = pythFeeds.find((feed: any) => feed.id === formData.feedId)
    const displaySymbol = selectedFeed?.attributes.display_symbol || formData.feedId

    if (
      selectedTemplate === "priceThreshold" &&
      formData.feedId &&
      formData.comparator &&
      formData.threshold &&
      formData.endDate
    ) {
      const title = `Will ${displaySymbol} ${formData.comparator} $${formData.threshold} by ${formatInTimeZone(formData.endDate!, "UTC", "MMM dd, yyyy 'UTC'")}?`
      const description = `This market will resolve to "Yes" if the price of ${displaySymbol} reaches ${formData.comparator} $${formData.threshold} before ${formatInTimeZone(formData.endDate!, "UTC", "PPP p 'UTC'")}. Resolution will be based on Pyth Network oracle data.`

      setFormData((prev) => ({
        ...prev,
        title,
        description,
        resolutionSource: "Pyth Network Oracle",
        ...(prev.category ? {} : { category: "crypto" }),
      }))
    } else if (
      selectedTemplate === "priceRange" &&
      formData.feedId &&
      formData.lowerBound &&
      formData.upperBound &&
      formData.endDate
    ) {
      const title = `Will ${displaySymbol} stay between $${formData.lowerBound} and $${formData.upperBound} until ${formatInTimeZone(formData.endDate!, "UTC", "MMM dd, yyyy 'UTC'")}?`
      const description = `This market will resolve to "Yes" if the price of ${displaySymbol} remains within the range of $${formData.lowerBound} to $${formData.upperBound} until ${formatInTimeZone(formData.endDate!, "UTC", "PPP p 'UTC'")}. Resolution will be based on Pyth Network oracle data.`

      setFormData((prev) => ({
        ...prev,
        title,
        description,
        resolutionSource: "Pyth Network Oracle",
        category: "Crypto",
      }))
    }
  }

  React.useEffect(() => {
    if (selectedTemplate !== "custom") {
      generateTemplateContent()
    }
  }, [
    selectedTemplate,
    formData.feedId,
    formData.comparator,
    formData.threshold,
    formData.lowerBound,
    formData.upperBound,
    formData.endDate,
  ])

  const wallet = useWallet()
  const connection = React.useMemo(() => new Connection("https://api.devnet.solana.com", "processed"), [])

  const handleSubmit = async (e: React.FormEvent) => {
    try {
      e.preventDefault()
      if (isSubmitting) return;

      if (!validateForm()) {
        return
      }

      setIsSubmitting(true)

      if (formData.feedId.length < 5 || !formData.endDate || !formData.initialLiquidity || !formData.category) {
        showToast("danger", "Complete all fields!")
        return
      }
      const formData_: CreateMarketFormData = {
        marketType: selectedTemplate,
        category: formData.category,
        endDate: formData.endDate,
        initialLiquidity: Number(formData.initialLiquidity),
        feedId: formData.feedId,
        symbol: formData.symbol,
        comparator: formData.comparator,
        threshold: Number(formData.threshold),
        lowerBound: Number(formData.lowerBound),
        upperBound: Number(formData.upperBound),
        initialSide: formData.initialSide,
      }

      const resp = await createMarket(formData_)
      const { tx, marketId } = resp

      if (!tx || typeof tx !== "string") {
        console.error("Bad response from server:", resp)
        showToast("danger", "Server didn't return a transaction to sign.")
        return
      }

      const sig = await signAndSendBase64Tx(tx, wallet, connection)
      showToast("success", `Transaction sent: ${sig}`)

      try {
        await confirmMarket(formData_, marketId, sig)
      } catch (e) {
        console.warn("confirm failed", e)
      }
      showToast("success", `Market ${marketId} created!`)
    } catch (err: any) {
      const msg = String(err?.message ?? err)
      if (/blockhash/i.test(msg)) {
        showToast("danger", "Transaction expired. Please try again.")
      } else {
        showToast("danger", "Failed to create market!")
      }
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }
  return (
    <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
      <div className="absolute inset-0 radial-glow"></div>
      {/* <div className="absolute top-20 left-20 w-96 h-96 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-3000"></div> */}
      <div className="absolute bottom-20 right-20 w-80 h-80 bg-secondary/10 rounded-full blur-3xl animate-pulse delay-1000"></div>

      <div className="relative z-10 max-w-4xl mx-auto p-6 space-y-8">
        {/* Page Header */}
        <div className="text-center space-y-4">
          <h1 className="text-5xl font-bold gradient-text">Create Market</h1>
          <p className="text-xl text-muted-foreground">
            Launch your own prediction market and let the community decide
          </p>
        </div>

        <Card className="glass glow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <BarChart3 className="w-5 h-5" />
              <span>Market Template</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Button
                variant="ghost"
                className={`h-20 cursor-pointer flex-col space-y-2 rounded-xl transition-all duration-200 ${
                  selectedTemplate === "priceThreshold"
                    ? "gradient-bg shadow-lg shadow-gray-600/20 border border-gray/20 scale-[1.02]"
                    : "glass hover:bg-zinc-800/30"
                }`}
                onClick={() => setSelectedTemplate("priceThreshold")}
              >
                <TrendingUp className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-semibold">Price Threshold</div>
                  <div className="text-xs opacity-75">On-chain, Pyth Oracle</div>
                </div>
              </Button>

              <Button
                variant="ghost"
                className={`h-20 cursor-pointer flex-col space-y-2 rounded-xl transition-all duration-200 ${
                  selectedTemplate === "priceRange"
                    ? "gradient-bg shadow-lg shadow-gray-600/20 border border-gray/20 scale-[1.02]"
                    : "glass hover:bg-zinc-800/30"
                }`}
                onClick={() => setSelectedTemplate("priceRange")}
              >
                <BarChart3 className="w-6 h-6" />
                <div className="text-center">
                  <div className="font-semibold">Price Range</div>
                  <div className="text-xs opacity-75">On-chain, Pyth Oracle</div>
                </div>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Form */}
        <Card className="glass glow">
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Plus className="w-5 h-5" />
              <span>Market Details</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {selectedTemplate !== "custom" && (
                <div className="space-y-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Template Configuration</span>
                  </h3>

                  {/* feedId Selection */}
                  <div className="space-y-2">
                    <Label className="flex items-center space-x-2">
                      <TrendingUp className="w-4 h-4" />
                      <span>feedId</span>
                    </Label>
                    <PythFeedCombobox
                      feeds={pythFeeds}
                      value={formData.feedId}
                      onValueChange={(value: any) => {
                        const found = pythFeeds.find((f) => f.id === value)
                        const sym =
                          found?.attributes?.symbol ||
                          found?.attributes?.display_symbol ||
                          found?.attributes?.generic_symbol ||
                          (found?.attributes?.base && found?.attributes?.quote_currency
                            ? `${found.attributes.base}/${found.attributes.quote_currency}`
                            : "")

                        setFormData({ ...formData, feedId: value, symbol: sym })
                      }}
                      placeholder="Select trading pair"
                      error={!!errors.feedId}
                      className="w-full"
                    />
                    {errors.feedId && (
                      <div className="flex items-center space-x-1 text-destructive text-sm">
                        <AlertCircle className="w-4 h-4" />
                        <span>{errors.feedId}</span>
                      </div>
                    )}
                  </div>

                  {selectedTemplate === "priceThreshold" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Comparator</Label>
                        <Select
                          value={formData.comparator}
                          onValueChange={(value) => setFormData({ ...formData, comparator: value })}
                        >
                          <SelectTrigger
                            className={`glass h-12 ${errors.comparator ? "border-destructive glow" : "glow-cyan"}`}
                          >
                            <SelectValue placeholder="Select condition" />
                          </SelectTrigger>
                          <SelectContent className="glass">
                            {comparators.map((comp) => (
                              <SelectItem key={comp.value} value={comp.value}>
                                {comp.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.comparator && (
                          <div className="flex items-center space-x-1 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{errors.comparator}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Threshold ($)</Label>
                        <Input
                          type="number"
                          placeholder="50000"
                          step="0.01"
                          value={formData.threshold}
                          onChange={(e) => setFormData({ ...formData, threshold: e.target.value })}
                          className={`glass h-12 ${errors.threshold ? "border-destructive glow" : "glow-cyan"}`}
                        />
                        {errors.threshold && (
                          <div className="flex items-center space-x-1 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{errors.threshold}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedTemplate === "priceRange" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Lower Bound ($)</Label>
                        <Input
                          type="number"
                          placeholder="40000"
                          step="0.01"
                          value={formData.lowerBound}
                          onChange={(e) => setFormData({ ...formData, lowerBound: e.target.value })}
                          className={`glass h-12 ${errors.lowerBound ? "border-destructive glow" : "glow-cyan"}`}
                        />
                        {errors.lowerBound && (
                          <div className="flex items-center space-x-1 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{errors.lowerBound}</span>
                          </div>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label>Upper Bound ($)</Label>
                        <Input
                          type="number"
                          placeholder="60000"
                          step="0.01"
                          value={formData.upperBound}
                          onChange={(e) => setFormData({ ...formData, upperBound: e.target.value })}
                          className={`glass h-12 ${errors.upperBound ? "border-destructive glow" : "glow-cyan"}`}
                        />
                        {errors.upperBound && (
                          <div className="flex items-center space-x-1 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            <span>{errors.upperBound}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="text-sm text-muted-foreground bg-background/50 p-3 rounded border">
                    <strong>Oracle:</strong> Pyth Network
                    <br />
                    <strong>Resolution Source:</strong> Automatically filled from Pyth price feeds
                  </div>
                </div>
              )}

              {/* Category and End Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <Tag className="w-4 h-4" />
                    <span>Category</span>
                  </Label>
                  <Select
                    value={formData.category}
                    onValueChange={(value) => {
                      setFormData((p) => ({ ...p, category: value }))
                      if (errors.category)
                        setErrors((e) => {
                          const n = { ...e }
                          delete n.category
                          return n
                        })
                    }}
                  >
                    <SelectTrigger
                      className={`glass h-12 ${errors.category ? "border-destructive glow" : "glow-cyan"}`}
                    >
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent className="glass">
                      {categories.map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  {errors.category && (
                    <div className="flex items-center space-x-1 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.category}</span>
                    </div>
                  )}
                  {selectedTemplate !== "custom" && (
                    <p className="text-xs text-muted-foreground">Auto-set to Cryptocurrency for price templates</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center space-x-2">
                    <Clock className="w-4 h-4" />
                    <span>End Date (UTC)</span>
                  </Label>
                  <Popover open={endDateOpen} onOpenChange={setEndDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={`glass h-12 w-full justify-start text-left font-normal ${
                          errors.endDate ? "border-destructive glow" : "glow-cyan"
                        } ${!formData.endDate && "text-muted-foreground"}`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.endDate ? formatInTimeZone(formData.endDate, "UTC", "PPP p 'UTC'") : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-auto p-0 bg-background/95 backdrop-blur-md border border-border/50 shadow-xl rounded-lg"
                      align="start"
                    >
                      <Calendar
                        mode="single"
                        captionLayout="dropdown"
                        selected={formData.endDate}
                        // selected={nowPlus12Min}
                        onSelect={(date) => {
                          if (!date) return
                          const utc = toUtcMidnight(date)
                          setFormData((prev) => ({ ...prev, endDate: utc }))
                          if (errors.endDate && utc > new Date()) {
                            const { endDate: _, ...rest } = errors
                            setErrors(rest)
                          }
                          setEndDateOpen(false)
                        }}
                        disabled={(date) => date <= new Date() || date < new Date("1900-01-01")}
                        initialFocus
                        fromDate={new Date()}
                        toDate={new Date(new Date().getFullYear() + 10, 11, 31)}
                      />
                    </PopoverContent>
                  </Popover>
                  {errors.endDate && (
                    <div className="flex items-center space-x-1 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.endDate}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Select when this market should end and be resolved</p>
                </div>
              </div>

              {/* YES/NO Radio Selection as mandatory field */}
              <div className="space-y-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center space-x-2">
                    <CheckCircle className="w-5 h-5 text-primary" />
                    <span>Market Prediction</span>
                  </h3>
                </div>

                <div className="space-y-3">
                  <Label className="text-sm font-medium text-foreground">What do you predict will happen?</Label>

                  <RadioGroup
                    value={formData.initialSide}
                    onValueChange={(value) => {
                      setFormData({ ...formData, initialSide: value })
                      if (errors.initialSide) {
                        const { initialSide: _, ...rest } = errors
                        setErrors(rest)
                      }
                    }}
                    className="grid grid-cols-2 gap-3"
                  >
                    {/* YES Option - Compact */}
                    <div className="relative">
                      <RadioGroupItem value="Yes" id="yes" className="peer sr-only" />
                      <Label
                        htmlFor="yes"
                        className={`
                          flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer
                          transition-all duration-200 hover:scale-[1.01] group
                          ${
                            formData.initialSide === "Yes"
                              ? "border-emerald-500 bg-emerald-500/20 shadow-md shadow-emerald-500/20"
                              : errors.initialSide
                                ? "border-destructive/50 bg-destructive/5 hover:border-destructive"
                                : "border-border/50 bg-background/50 hover:border-emerald-500/50 hover:bg-emerald-500/10"
                          }
                        `}
                      >
                        <div
                          className={`
                          w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-200
                          ${
                            formData.initialSide === "Yes"
                              ? "bg-emerald-500 text-white"
                              : "bg-emerald-500/20 text-emerald-500 group-hover:bg-emerald-500/30"
                          }
                        `}
                        >
                          <CheckCircle className="w-4 h-4" />
                        </div>
                        <div className="text-center">
                          <span
                            className={`
                            text-lg font-bold transition-colors duration-200
                            ${formData.initialSide === "Yes" ? "text-emerald-500" : "text-foreground group-hover:text-emerald-500"}
                          `}
                          >
                            YES
                          </span>
                          <div className="text-xs text-muted-foreground">Will happen</div>
                        </div>
                      </Label>
                    </div>

                    {/* NO Option - Compact */}
                    <div className="relative">
                      <RadioGroupItem value="No" id="no" className="peer sr-only" />
                      <Label
                        htmlFor="no"
                        className={`
                          flex items-center justify-center p-3 rounded-lg border-2 cursor-pointer
                          transition-all duration-200 hover:scale-[1.01] group
                          ${
                            formData.initialSide === "No"
                              ? "border-rose-500 bg-rose-500/20 shadow-md shadow-rose-500/20"
                              : errors.initialSide
                                ? "border-destructive/50 bg-destructive/5 hover:border-destructive"
                                : "border-border/50 bg-background/50 hover:border-rose-500/50 hover:bg-rose-500/10"
                          }
                        `}
                      >
                        <div
                          className={`
                          w-8 h-8 rounded-full flex items-center justify-center mr-3 transition-all duration-200
                          ${
                            formData.initialSide === "No"
                              ? "bg-rose-500 text-white"
                              : "bg-rose-500/20 text-rose-500 group-hover:bg-rose-500/30"
                          }
                        `}
                        >
                          <AlertCircle className="w-4 h-4" />
                        </div>
                        <div className="text-center">
                          <span
                            className={`
                            text-lg font-bold transition-colors duration-200
                            ${formData.initialSide === "No" ? "text-rose-500" : "text-foreground group-hover:text-rose-500"}
                          `}
                          >
                            NO
                          </span>
                          <div className="text-xs text-muted-foreground">Won't happen</div>
                        </div>
                      </Label>
                    </div>
                  </RadioGroup>

                  {errors.initialSide && (
                    <div className="flex items-center justify-center space-x-2 text-destructive text-sm bg-destructive/10 p-2 rounded-lg border border-destructive/20">
                      <AlertCircle className="w-4 h-4" />
                      <span className="font-medium">{errors.initialSide}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Initial Liquidity and Resolution Source */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label htmlFor="liquidity" className="flex items-center space-x-2">
                    <DollarSign className="w-4 h-4" />
                    <span>Initial Liquidity (USDC Predict)</span>
                  </Label>
                  <Input
                    id="liquidity"
                    type="number"
                    placeholder="10.0"
                    min="1"
                    step="0.1"
                    value={formData.initialLiquidity}
                    onChange={(e) => setFormData({ ...formData, initialLiquidity: e.target.value })}
                    className={`glass h-12 ${errors.initialLiquidity ? "border-destructive glow" : "glow-cyan"}`}
                  />
                  {errors.initialLiquidity && (
                    <div className="flex items-center space-x-1 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.initialLiquidity}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">Minimum 1 USDC Predict required to create a market</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="resolution">Resolution Source</Label>
                  <Input
                    id="resolution"
                    placeholder="e.g., CoinGecko, Official announcement, etc."
                    value={formData.resolutionSource}
                    onChange={(e) => setFormData({ ...formData, resolutionSource: e.target.value })}
                    className={`glass h-12 ${errors.resolutionSource ? "border-destructive glow" : "glow-cyan"} ${selectedTemplate !== "custom" ? "opacity-60" : ""}`}
                    disabled={selectedTemplate !== "custom"}
                  />
                  {errors.resolutionSource && (
                    <div className="flex items-center space-x-1 text-destructive text-sm">
                      <AlertCircle className="w-4 h-4" />
                      <span>{errors.resolutionSource}</span>
                    </div>
                  )}
                  <p className="text-sm text-muted-foreground">
                    {selectedTemplate !== "custom"
                      ? "Auto-filled with Pyth Network Oracle for price templates"
                      : "What source will be used to resolve this market?"}
                  </p>
                </div>
              </div>

              {/* Market Preview */}
              <Card className="glass glow-green">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Sparkles className="w-5 h-5" />
                    <span>Market Preview</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">
                      {formData.title || "Your market question will appear here"}
                    </h3>
                    <p className="text-muted-foreground">
                      {formData.description || "Your market description will appear here"}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {formData.category && (
                      <Badge
                        variant="secondary"
                        className="bg-purple-500/20 text-purple-500 border border-purple-500 capitalize"
                      >
                        {formData.category}
                      </Badge>
                    )}
                    {formData.initialSide && (
                      <Badge
                        variant="secondary"
                        className={`
                          ${
                            formData.initialSide === "Yes"
                              ? "bg-emerald-500/20 text-emerald-500 border border-emerald-500"
                              : "bg-rose-500/20 text-rose-500 border border-rose-500"
                          } capitalize
                        `}
                      >
                        Expected: {formData.initialSide}
                      </Badge>
                    )}
                  </div>
                  {formData.endDate && (
                    <p className="text-sm text-muted-foreground">
                      Ends: {formatInTimeZone(formData.endDate, "UTC", "PPP p 'UTC'")}
                    </p>
                  )}
                </CardContent>
              </Card>

              {/* Submit Button */}
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-14 text-lg bg-primary/40 hover:bg-primary/70 ring-offset-background hover:ring-primary/70 transition-all duration-300 hover:ring-2 hover:ring-offset-2 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                    Creating Market...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-5 h-5 mr-2" />
                    Create Market
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                By creating a market, you agree to our terms of service and resolution policies.
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
