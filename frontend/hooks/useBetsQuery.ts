// lib/hooks/useBetsQuery.ts
import { fetchBets } from "@/lib/services/bet/betsService"
import { useInfiniteQuery } from "@tanstack/react-query"
import { BetsKind } from "@/lib/types/bet"

type UseBetsQueryArgs = {
  wallet?: string
  kind: BetsKind
  pageSize?: number
}

export function useBetsQuery({ wallet, kind, pageSize = 10 }: UseBetsQueryArgs)
{
  return useInfiniteQuery({
    queryKey: ["bets", wallet ?? "me", kind, pageSize],
    queryFn: async ({ pageParam, signal }) =>
    {
      return fetchBets({ wallet, kind, limit: 10, cursor: pageParam ?? null, signal })
    },
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    staleTime: 30_000,
    gcTime: 5 * 60_000,
    retry: 1,
    refetchOnWindowFocus: false,
  })
}
