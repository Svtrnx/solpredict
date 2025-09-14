"use client"

import { useState, useCallback } from "react"
import type { PaginationState, ApiResponse } from "@/lib/types/common"

interface UsePaginationProps {
  initialPage?: number
  itemsPerPage?: number
}

export function usePagination({ initialPage = 1, itemsPerPage = 5 }: UsePaginationProps = {}) {
  const [pagination, setPagination] = useState<PaginationState>({
    currentPage: initialPage,
    totalPages: 1,
    itemsPerPage,
    totalItems: 0,
  })

  const updatePagination = useCallback((response: ApiResponse<any>) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: response.currentPage,
      totalPages: response.totalPages,
      totalItems: response.totalItems,
    }))
  }, [])

  const goToPage = useCallback((page: number) => {
    setPagination((prev) => ({
      ...prev,
      currentPage: page,
    }))
  }, [])

  const getVisiblePages = useCallback(() => {
    const { currentPage, totalPages } = pagination
    const pages: (number | "ellipsis")[] = []

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i)
      }
    } else {
      pages.push(1)

      if (currentPage > 3) {
        pages.push("ellipsis")
      }

      const start = Math.max(2, currentPage - 1)
      const end = Math.min(totalPages - 1, currentPage + 1)

      for (let i = start; i <= end; i++) {
        pages.push(i)
      }

      if (currentPage < totalPages - 2) {
        pages.push("ellipsis")
      }

      pages.push(totalPages)
    }

    return pages
  }, [pagination])

  return {
    pagination,
    updatePagination,
    goToPage,
    getVisiblePages,
  }
}
