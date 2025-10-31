"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchRecentBets } from "@/lib/services/bet/betsService";
import { Users, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import type { RecentBet } from "@/lib/types/bet";

function timeAgo(iso: string): string {
  const d = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - d);
  const sec = Math.floor(diff / 1000);
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} h ago`;
  const day = Math.floor(hr / 24);
  return `${day} d ago`;
}

export const RecentBets = ({ marketPda }: { marketPda: string }) => {
  const router = useRouter();
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const [items, setItems] = useState<RecentBet[]>([]);
  const [cursor, setCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const seenIdsRef = useRef<Set<number>>(new Set());

  const mergeUniqueAppend = (prev: RecentBet[], incoming: RecentBet[]) => {
    const seen = seenIdsRef.current;
    const fresh: RecentBet[] = [];
    for (const it of incoming) {
      if (!seen.has(it.cursorId)) {
        seen.add(it.cursorId);
        fresh.push(it);
      }
    }
    return [...prev, ...fresh];
  };

  const mergeUniquePrepend = (prev: RecentBet[], incoming: RecentBet[]) => {
    const seen = seenIdsRef.current;
    const fresh: RecentBet[] = [];
    for (const it of incoming) {
      if (!seen.has(it.cursorId)) {
        seen.add(it.cursorId);
        fresh.push(it);
      }
    }
    return fresh.length ? [...fresh, ...prev] : prev;
  };

  const loadPage = async (next: number | null) => {
    try {
      setLoading(true);
      setErr(null);
      const page = await fetchRecentBets({ marketPda, cursor: next, limit: 20 });

      setItems(prev => {
        if (next === null) {

          const seen = new Set<number>();
          const unique: RecentBet[] = [];
          for (const it of page.items) {
            if (!seen.has(it.cursorId)) {
              seen.add(it.cursorId);
              unique.push(it);
            }
          }
          seenIdsRef.current = seen;
          return unique;
        } else {

          return mergeUniqueAppend(prev, page.items);
        }
      });

      setCursor(page.nextCursor ?? null);
    } catch (e: any) {
      setErr(e?.message ?? "failed to load");
    } finally {
      setLoading(false);
    }
  };

  const pollingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollingInFlight = useRef(false);

  const refreshTop = async () => {
    if (pollingInFlight.current) return;
    if (document.hidden) return;
    pollingInFlight.current = true;
    try {
      const page = await fetchRecentBets({ marketPda, cursor: null, limit: 20 });
      setItems(prev => mergeUniquePrepend(prev, page.items));
    } catch {

    } finally {
      pollingInFlight.current = false;
    }
  };

  const scheduleNextPoll = () => {
    if (pollingTimer.current) clearTimeout(pollingTimer.current);
    pollingTimer.current = setTimeout(async () => {
      await refreshTop();
      scheduleNextPoll();
    }, 60_000);
  };

  const didInitRef = useRef(false);
  useEffect(() => {
    if (didInitRef.current) return;
    didInitRef.current = true;

    seenIdsRef.current.clear();
    setItems([]);
    setCursor(null);
    loadPage(null);
  }, [marketPda]);

  useEffect(() => {
    scheduleNextPoll();
    const onVis = () => {
      if (!document.hidden) refreshTop();
    };
    document.addEventListener("visibilitychange", onVis);

    return () => {
      if (pollingTimer.current) clearTimeout(pollingTimer.current);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  const topFive = useMemo(() => items.slice(0, 5), [items]);

  return (
    <>
      <Card className="glass glow">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <span>Recent Bets</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {err && (
            <div className="text-sm text-red-400 border border-red-500/30 rounded-md p-2">
              {err}
            </div>
          )}

          {items.length === 0 && loading ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Loading recent bets…</p>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No bets placed yet</p>
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {topFive.map((bet) => (
                  <div
                    key={bet.cursorId}
                    className="glass p-3 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
                    onClick={() => router.push(`/profile/${bet.userAddress}`)}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-2">
                        <div className={`w-2 h-2 rounded-full ${bet.side === "yes" ? "bg-green-400" : "bg-red-400"}`} />
                        <span className="font-mono text-xs">
                          {bet.userAddress.slice(0, 6)}...{bet.userAddress.slice(-4)}
                        </span>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${bet.side === "yes" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}
                      >
                        {bet.side.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">{bet.amount.toFixed(2)} USDC</span>
                      <span className="text-muted-foreground">{timeAgo(bet.timestamp)}</span>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="ghost"
                className="w-full mt-4 text-sm text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 cursor-pointer"
                onClick={() => setIsDrawerOpen(true)}
              >
                View all participants
                <ExternalLink className="w-4 h-4 ml-2" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      <Sheet open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-purple-400" />
              <span>All Participants</span>
            </SheetTitle>
            <SheetDescription>{items.length} total bets loaded</SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-2 space-x-2 pl-2">
            {items.map((bet) => (
              <div
                key={bet.cursorId}
                className="glass p-4 rounded-lg hover:bg-accent/10 transition-colors cursor-pointer"
                onClick={() => {
                  setIsDrawerOpen(false);
                  router.push(`/profile/${bet.userAddress}`);
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center space-x-2">
                    <div className={`w-2.5 h-2.5 rounded-full ${bet.side === "yes" ? "bg-green-400" : "bg-red-400"}`} />
                    <span className="font-mono text-sm">
                      {bet.userAddress.slice(0, 8)}...{bet.userAddress.slice(-6)}
                    </span>
                  </div>
                  <Badge
                    variant="outline"
                    className={`text-xs ${bet.side === "yes" ? "border-green-500/30 text-green-400" : "border-red-500/30 text-red-400"}`}
                  >
                    {bet.side.toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold">{bet.amount.toFixed(2)} USDC</span>
                  <span className="text-muted-foreground text-xs">{timeAgo(bet.timestamp)}</span>
                </div>
              </div>
            ))}

            <div className="mt-4 flex items-center gap-2">
              {cursor !== null && (
                <Button variant="outline" onClick={() => loadPage(cursor)} disabled={loading} className="w-full">
                  {loading ? "Loading…" : "Load more"}
                </Button>
              )}
              {cursor === null && items.length > 0 && (
                <span className="text-xs text-muted-foreground mx-auto">No more bets</span>
              )}
            </div>

            {err && <div className="text-xs text-red-400 border border-red-500/30 rounded-md p-2 mt-2">{err}</div>}
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};
