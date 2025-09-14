import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(amount: number | string, currency = "SOL"): string {
  const num = typeof amount === "string" ? Number.parseFloat(amount) : amount
  return `${num.toFixed(2)} ${currency}`
}

export function formatPercentage(value: number, showSign = false): string {
  const sign = showSign && value > 0 ? "+" : ""
  return `${sign}${value.toFixed(1)}%`
}

export function formatTimeLeft(endDate: string): string {
  const now = new Date()
  const end = new Date(endDate)
  const diff = end.getTime() - now.getTime()

  if (diff <= 0) return "Ended"

  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))

  if (days > 0) return `${days} day${days > 1 ? "s" : ""}`
  if (hours > 0) return `${hours} hour${hours > 1 ? "s" : ""}`

  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
  return `${minutes} minute${minutes > 1 ? "s" : ""}`
}

export function formatAddress(address: string, chars = 4): string {
  if (!address) return ""
  return `${address.slice(0, chars)}...${address.slice(-chars)}`
}
