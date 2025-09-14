import type { BetData } from "@/lib/types/market"
import type { ApiResponse } from "@/lib/types/common"
import { generateActiveBets, generateHistoryBets } from "@/lib/data/mockBets"

export const fetchPaginatedBets = async (
  type: "active" | "history",
  page: number,
  itemsPerPage = 5,
): Promise<ApiResponse<BetData[]>> => {

  const allData = type === "active" ? generateActiveBets(47) : generateHistoryBets(63)
  const totalItems = allData.length
  const totalPages = Math.ceil(totalItems / itemsPerPage)
  const startIndex = (page - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const data = allData.slice(startIndex, endIndex)

  return {
    data,
    totalItems,
    totalPages,
    currentPage: page,
  }
}
