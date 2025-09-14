"use client"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"
import type { PaginationState } from "@/lib/types"

interface PaginationWrapperProps {
  pagination: PaginationState
  onPageChange: (page: number) => void
  type: string
}

export function PaginationWrapper({ pagination, onPageChange, type }: PaginationWrapperProps) {
  if (pagination.totalPages <= 1) return null

  const getVisiblePages = () => {
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
  }

  return (
    <div className="flex flex-col items-center space-y-4 mt-6">
      <div className="text-sm text-muted-foreground">
        Showing {(pagination.currentPage - 1) * pagination.itemsPerPage + 1} to{" "}
        {Math.min(pagination.currentPage * pagination.itemsPerPage, pagination.totalItems)} of {pagination.totalItems}{" "}
        {type}
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              onClick={() => onPageChange(pagination.currentPage - 1)}
              className={pagination.currentPage === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
            />
          </PaginationItem>

          {getVisiblePages().map((page, index) => (
            <PaginationItem key={index}>
              {page === "ellipsis" ? (
                <PaginationEllipsis />
              ) : (
                <PaginationLink
                  onClick={() => onPageChange(page)}
                  isActive={page === pagination.currentPage}
                  className="cursor-pointer"
                >
                  {page}
                </PaginationLink>
              )}
            </PaginationItem>
          ))}

          <PaginationItem>
            <PaginationNext
              onClick={() => onPageChange(pagination.currentPage + 1)}
              className={
                pagination.currentPage === pagination.totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
