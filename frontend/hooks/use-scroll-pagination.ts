"use client"

import { useEffect, useCallback } from "react"

interface UseScrollPaginationProps {
  hasNextPage: boolean
  isLoading: boolean
  fetchNextPage: () => void
  threshold?: number
}

export function useScrollPagination({
  hasNextPage,
  isLoading,
  fetchNextPage,
  threshold = 300,
}: UseScrollPaginationProps) {
  const handleScroll = useCallback(() => {
    if (isLoading || !hasNextPage) return

    const scrollTop = document.documentElement.scrollTop
    const scrollHeight = document.documentElement.scrollHeight
    const clientHeight = document.documentElement.clientHeight

    if (scrollTop + clientHeight >= scrollHeight - threshold) {
      fetchNextPage()
    }
  }, [isLoading, hasNextPage, fetchNextPage, threshold])

  useEffect(() => {
    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [handleScroll])
}
