"use client"

import { useState, useEffect } from "react"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { PythFeedCombobox } from "@/components/pyth-feed-combobox"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

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

const getMinimumDate = () => {
  const now = new Date()
  const twoDaysFromNow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000)
  return toUtcMidnight(twoDaysFromNow)
}

const categories = [{ value: "crypto", label: "Crypto" }]

interface PythoracleSectionProps {
  pythFeeds: PythFeedItem[]
  formData: any
  setFormData: (data: any) => void
  errors: Record<string, string>
  setErrors: (errors: Record<string, string>) => void
  isSubmitting: boolean
  onSubmit: () => void
}

export function PythoracleSection({
  pythFeeds,
  formData,
  setFormData,
  errors,
  setErrors,
  isSubmitting,
  onSubmit,
}: PythoracleSectionProps) {
  const [selectedTemplate, setSelectedTemplate] = useState<MarketTemplate>("priceThreshold")
  const [endDateOpen, setEndDateOpen] = useState(false)

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

      setFormData((prev: any) => ({
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

      setFormData((prev: any) => ({
        ...prev,
        title,
        description,
        resolutionSource: "Pyth Network Oracle",
        category: "Crypto",
      }))
    }
  }

  useEffect(() => {
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

  return (
    <>
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

      <Card className="glass glow">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Market Details</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              onSubmit()
            }}
            className="space-y-6"
          >
            {selectedTemplate !== "custom" && (
              <div className="space-y-6 p-4 bg-primary/5 rounded-lg border border-primary/20">
                <h3 className="text-lg font-semibold flex items-center space-x-2">
                  <Sparkles className="w-5 h-5" />
                  <span>Template Configuration</span>
                </h3>

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
                      <Label>Threshold (USDC)</Label>
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
                      <Label>Lower Bound (USDC)</Label>
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
                      <Label>Upper Bound (USDC)</Label>
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-2">
                <Label className="flex items-center space-x-2">
                  <Tag className="w-4 h-4" />
                  <span>Category</span>
                </Label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => {
                    setFormData((p: any) => ({ ...p, category: value }))
                    if (errors.category) {
                      const newErrors = { ...errors }
                      delete newErrors.category
                      setErrors(newErrors)
                    }
                  }}
                >
                  <SelectTrigger className={`glass h-12 ${errors.category ? "border-destructive glow" : "glow-cyan"}`}>
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
                      onSelect={(date) => {
                        if (!date) return
                        const utc = toUtcMidnight(date)
                        setFormData((prev: any) => ({ ...prev, endDate: utc }))
                        if (errors.endDate && utc > getMinimumDate()) {
                          const { endDate: _, ...rest } = errors
                          setErrors(rest)
                        }
                        setEndDateOpen(false)
                      }}
                      disabled={(date) => {
                        const minDate = getMinimumDate()
                        return date < minDate || date < new Date("1900-01-01")
                      }}
                      initialFocus
                      fromDate={getMinimumDate()}
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
                <p className="text-sm text-muted-foreground">
                  Select a date at least 2 days in the future (time will be set to 12:00 AM UTC)
                </p>
              </div>
            </div>

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
                  <Badge variant="secondary" className="bg-cyan-500/20 text-cyan-500 border border-cyan-500 capitalize">
                    Pyth Oracle
                  </Badge>
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
    </>
  )
}
