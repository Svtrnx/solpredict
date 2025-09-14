"use client"

import { useState, useEffect } from "react"
import { BREAKPOINTS } from "@/lib/constants/breakpoints"

export function useMobile(): boolean {
  const [isMobile, setIsMobile] = useState<boolean>(false)

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${BREAKPOINTS.MOBILE - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < BREAKPOINTS.MOBILE)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < BREAKPOINTS.MOBILE)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return isMobile
}

export const useIsMobile = useMobile
