import { getMarketsList } from "@/lib/services/market/marketService"
import type { InfiniteData, QueryKey } from "@tanstack/react-query"
import { useInfiniteQuery } from "@tanstack/react-query"
import type { ListMarket } from "@/lib/types/market"

export type MarketsQueryArgs = {
  category?: string
  q?: string
  sort?: "volume" | "participants" | "ending"
  pageSize?: number
  status?: string[]
}

type MarketsPage = { items: ListMarket[]; nextCursor: string | null }

export function useMarketsQuery({
  category = "All",
  q = "",
  sort = "volume",
  pageSize = 15,
  status = [],
}: MarketsQueryArgs) {
  return useInfiniteQuery<MarketsPage, Error, InfiniteData<MarketsPage, string | null>, QueryKey, string | null>({
    queryKey: ["markets", { category, q, sort, pageSize, status }],
    initialPageParam: null,

    queryFn: async ({ pageParam, signal }) => {
      const statusParam = status.length === 0 ? "all" : status.join(",")

      const res = await getMarketsList({
        limit: pageSize,
        cursor: pageParam,
        category: category !== "All" ? category : undefined,
        q: q.trim() || undefined,
        sort,
        status: statusParam,
        signal,
      })
      return { items: res.items ?? [], nextCursor: res.nextCursor ?? null }
    },

    getNextPageParam: (last) => last.nextCursor ?? undefined,

    select: (data) => {
      const seen = new Set<string>()
      const pages = data.pages.map((p) => ({
        items: p.items.filter((m) => {
          const id = String(m.id)
          if (seen.has(id)) return false
          seen.add(id)
          return true
        }),
        nextCursor: p.nextCursor,
      }))
      return { pages, pageParams: data.pageParams }
    },

    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
