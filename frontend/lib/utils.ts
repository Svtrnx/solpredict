import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { TimeLeft } from "./types"

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

export function calculatePayout(amount: number, odds: number): number {
  return amount * odds
}

export function calculatePriceImpact(shares: number, totalShares: number): number {
  return (shares / totalShares) * 100
}

export function calculateWinRate(wins: number, total: number): number {
  if (total === 0) return 0
  return (wins / total) * 100
}

export function getBetUrgency(timeLeft: string): "critical" | "urgent" | "warning" | "normal" {
  const timeStr = timeLeft.toLowerCase()

  if (timeStr.includes("hour")) {
    const hours = Number.parseInt(timeStr)
    if (hours <= 24) return "critical"
    if (hours <= 72) return "urgent"
  }

  if (timeStr.includes("day")) {
    const days = Number.parseInt(timeStr)
    if (days <= 1) return "critical"
    if (days <= 3) return "urgent"
    if (days <= 7) return "warning"
  }

  return "normal"
}

export function getLevelInfo(points: number) {
  if (points >= 10000)
    return { level: "Singularity", color: "from-purple-400 to-pink-600", nextLevel: null, nextThreshold: null }
  if (points >= 5000)
    return { level: "Oracle", color: "from-blue-400 to-purple-600", nextLevel: "Singularity", nextThreshold: 10000 }
  if (points >= 1000)
    return { level: "Prophet", color: "from-green-400 to-blue-600", nextLevel: "Oracle", nextThreshold: 5000 }
  if (points >= 0)
    return { level: "Forecaster", color: "from-yellow-400 to-orange-600", nextLevel: "Prophet", nextThreshold: 1000 }
  return { level: "Observer", color: "from-gray-400 to-gray-600", nextLevel: "Forecaster", nextThreshold: 1000 }
}

export const fmtUsd = (n: number) =>
  n >= 1 ? n.toFixed(2) : n >= 0.01 ? n.toFixed(4) : n.toFixed(6);

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 3 }).format(n);

export const fmtPercent = (p: number, digits = 1) =>
  `${(p * 100).toFixed(digits)}%`;

export const fmtCents = (p: number) => `${(p * 100).toFixed(0)}¢`;

export function diff(endAt: string): TimeLeft {
  const end = new Date(endAt).getTime();
  const now = Date.now();
  const d = Math.max(0, end - now);
  const days = Math.floor(d / 86400000);
  const hours = Math.floor((d % 86400000) / 3600000);
  const minutes = Math.floor((d % 3600000) / 60000);
  const seconds = Math.floor((d % 60000) / 1000);
  return { days, hours, minutes, seconds };
}