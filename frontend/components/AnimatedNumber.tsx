"use client"

import { cn } from "@/lib/utils"
import { motion, type SpringOptions, useSpring, useTransform } from "framer-motion"
import { useEffect, useState } from "react"

type AnimatedNumberProps = {
  value: number
  className?: string
  springOptions?: SpringOptions
  startFromZero?: boolean
  decimals?: number
}

export function AnimatedNumber({
  value,
  className,
  springOptions = { stiffness: 100, damping: 10 },
  startFromZero = false,
  decimals,
}: AnimatedNumberProps) {
  const shouldShowDecimals = Math.floor(value) < 1000

  const wholeNumber = Math.floor(value)
  const decimalValue = shouldShowDecimals ? value - wholeNumber : 0

  const [decimalPlaces, setDecimalPlaces] = useState<number>(shouldShowDecimals ? (decimals ?? 0) : 0)

  useEffect(() => {
    if (shouldShowDecimals && decimals === undefined) {
      const valueString = value.toString()
      const decimalPart = valueString.split(".")[1]
      setDecimalPlaces(decimalPart ? decimalPart.length : 0)
    } else if (!shouldShowDecimals) {
      setDecimalPlaces(0)
    }
  }, [value, decimals, shouldShowDecimals])

  const [initialWholeNumber] = useState(startFromZero ? 0 : wholeNumber)
  const [initialDecimalValue] = useState(startFromZero ? 0 : decimalValue)

  const wholeNumberSpring = useSpring(initialWholeNumber, springOptions)
  const decimalSpring = useSpring(initialDecimalValue, {
    ...springOptions,
    stiffness: (springOptions.stiffness ?? 100) * 0.9,
  })

  const wholeDisplayValue = useTransform(wholeNumberSpring, (current: any) => Math.floor(current).toLocaleString("en-US"))

  const decimalDisplayValue = useTransform(decimalSpring, (current: any) => {
    if (decimalPlaces === 0) return ""

    const decimal = current.toFixed(Math.max(2, decimalPlaces)).substring(2, 4)
    return "." + decimal
  })

  useEffect(() => {
    wholeNumberSpring.set(wholeNumber)
    decimalSpring.set(decimalValue)
  }, [wholeNumberSpring, decimalSpring, wholeNumber, decimalValue])

  return (
    <span className={cn("tabular-nums", className)}>
      <motion.span>{wholeDisplayValue}</motion.span>
      {shouldShowDecimals && decimalPlaces > 0 && <motion.span>{decimalDisplayValue}</motion.span>}
    </span>
  )
}

