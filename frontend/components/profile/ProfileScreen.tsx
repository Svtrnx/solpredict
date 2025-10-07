"use client";

import { useMemo, useState } from "react";
import { Copy, Shield, Star, Flame } from "lucide-react";

import { DashboardSkeleton, ProfileActiveBetsSkeleton } from "@/components/ui/dashboard-skeleton";
import { ActiveBetsTab } from "@/components/shared/active-bets-tab";
import { HistoryBetsTab } from "@/components/shared/history-tab";
import AchievementIcons from "@/components/ui/achievement-icons";
import { StatsCard } from "@/components/shared/stats-card";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { useBetsQuery } from "@/hooks/useBetsQuery";
import { getAchievements, type Achievement } from "@/lib/achievements-data";

// -------------------- Types --------------------

export type PublicProfile = {
  address: string;
  totalVolume: string;
  winRate: number;
  winRateChange: string;
  rankChange: number;
  totalBets: number;
  activeBets: number;
  rank: number;
  level: string;
  points: number;
  streak: number;
  joinDate: string;
};

export type PrivateOverview = PublicProfile & {

};

// -------------------- Helpers --------------------

const getRarityColor = (rarity: string) => {
  const colors = {
    Common: "text-gray-400",
    Rare: "text-blue-400",
    Epic: "text-purple-400",
    Legendary: "text-yellow-400",
    Mythic: "text-cyan-400",
  }
  return colors[rarity as keyof typeof colors] || "text-gray-400"
}

const getLevelInfo = (points: number) => {
  if (points >= 15000)
    return { level: "Singularity", color: "from-purple-400 to-pink-600", nextLevel: null as string | null, nextThreshold: null as number | null };
  if (points >= 10000)
    return { level: "Oracle", color: "from-blue-400 to-purple-600", nextLevel: "Singularity", nextThreshold: 10000 };
  if (points >= 5000)
    return { level: "Prophet", color: "from-green-400 to-blue-600", nextLevel: "Oracle", nextThreshold: 5000 };
  if (points >= 1000)
    return { level: "Forecaster", color: "from-yellow-400 to-orange-600", nextLevel: "Prophet", nextThreshold: 1000 };
  return { level: "Observer", color: "from-gray-400 to-gray-600", nextLevel: "Forecaster", nextThreshold: 1000 };
};


  const getStreakStyle = (streak: number) => {
    if (streak >= 10) return "border-orange-500/30 bg-orange-500/5"
    if (streak >= 5) return "border-amber-500/30 bg-amber-500/5"
    return "border-border bg-muted/30"
  }

  const getStreakIconColor = (streak: number) => {
    if (streak >= 10) return "text-orange-500"
    if (streak >= 5) return "text-amber-500"
    return "text-muted-foreground"
  }
// -------------------- Component --------------------

export default function ProfileScreen({
  wallet,
  isOwner,
  publicData,
  privateData,
}: {
  wallet: string | undefined;
  isOwner: boolean;
  publicData: PublicProfile | null;
  privateData: PrivateOverview | null;
}) {
  const user = privateData ?? publicData;
  const activeQ = useBetsQuery({ wallet, kind: "active", pageSize: 10 })
  const historyQ = useBetsQuery({ wallet, kind: "history", pageSize: 10 })

  const activeItems = useMemo(
    () => activeQ.data?.pages.flatMap((p) => p.items) ?? [],
    [activeQ.data]
  )
  const historyItems = useMemo(
    () => historyQ.data?.pages.flatMap((p) => p.items) ?? [],
    [historyQ.data]
  )

  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [activeTab, setActiveTab] = useState<"active" | "history" | "achievements">("active");
  const [copiedAddress, setCopiedAddress] = useState(false);

  function LoadMoreButton({ query }: { query: ReturnType<typeof useBetsQuery> }) {
    if (!query.hasNextPage) return null
    return (
      <div className="flex justify-center mt-4">
        <Button
          disabled={query.isFetchingNextPage}
          onClick={() => query.fetchNextPage()}
          variant="secondary"
          className="min-w-[160px]"
        >
          {query.isFetchingNextPage ? "Loading…" : "Load more"}
        </Button>
      </div>
    )
  }
  const sortedActiveBets = useMemo(() => {
    const getTimeInHours = (endDate?: string | null) => {
      if (!endDate) return Number.MAX_SAFE_INTEGER
      const s = endDate.toLowerCase()

      if (s.endsWith("h")) return parseInt(s) || Number.MAX_SAFE_INTEGER
      if (s.endsWith("d")) return (parseInt(s) || 0) * 24
      if (s.endsWith("w")) return (parseInt(s) || 0) * 24 * 7
      if (s.endsWith("m")) return (parseInt(s) || 0) * 24 * 30

      const t = Date.parse(endDate)
      return Number.isNaN(t) ? Number.MAX_SAFE_INTEGER : (t - Date.now()) / 36e5
    }

    return [...activeItems].sort(
      (a, b) => getTimeInHours(a.endDate) - getTimeInHours(b.endDate)
    )
  }, [activeItems])

  const levelInfo = getLevelInfo(user?.points ?? 0);
  const xpProgress = (() => {
    const points = user?.points ?? 0;
    const info = levelInfo;
    if (!info.nextThreshold) return { current: points, max: points, percentage: 100 };
    const prev = info.nextThreshold === 10000 ? 5000 : info.nextThreshold === 5000 ? 1000 : 0;
    const current = points - prev;
    const max = info.nextThreshold - prev;
    const percentage = max > 0 ? (current / max) * 100 : 100;
    return { current, max, percentage };
  })();

  const copyAddress = () => {
    if (!user?.address) return;
    navigator.clipboard.writeText(user.address);
    setCopiedAddress(true);
    setTimeout(() => setCopiedAddress(false), 2000);
  };

  if (!user) {
    return <DashboardSkeleton />;
  }

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background relative overflow-hidden pt-40 md:pt-24">
        <div className="absolute inset-0 radial-glow"></div>

        <div className="relative z-10 max-w-7xl mx-auto p-6 space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* User Profile Card */}
            <Card className="glass glow relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div>
              <CardContent className="pt-6 relative z-10">
                <div className="flex flex-col items-center space-y-4">
                  <div className="relative">
                    <Avatar className="w-24 h-24">
                      <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt="User" />
                      <AvatarFallback>U</AvatarFallback>
                    </Avatar>
                    <Badge variant="secondary" className="border-background absolute -bottom-0.5 left-full min-w-5 -translate-x-8 px-2">
                      #{user.rank}
                    </Badge>
                  </div>

                  <div className="text-center space-y-3 w-full">
                    <div className="flex items-center ml-8 space-x-2 justify-center">
                      <span className="font-mono text-sm">{user.address}</span>
                      <Button variant="ghost" size="sm" onClick={copyAddress} className="h-6 w-6 p-0 hover:bg-white/10">
                        {copiedAddress ? <span className="text-xs text-accent">✓</span> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>

                    <div className="relative">
                      <Badge
                        className="
                          inline-flex items-center gap-1.5 rounded-full
                          border border-white/20 bg-white/[0.05] backdrop-blur
                          text-white/[0.90]
                          px-2.5 py-1 text-sm font-medium
                          shadow-[0_4px_20px_-8px_rgba(124,58,237,0.35)]
                          ring-1 ring-inset ring-purple-500/20
                          transition-colors duration-200
                          hover:bg-white/[0.055] hover:text-white/[0.93]
                          hover:ring-purple-500/[0.24] hover:border-white/[0.12]">
                        <Star className="w-3.5 h-3.5 text-purple-300" />
                        {user.level}
                      </Badge>
                    </div>

                    <div className="w-full space-y-3">
                        <div className="space-y-2">
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-muted-foreground">
                              {xpProgress.current.toLocaleString()}/{xpProgress.max.toLocaleString()} XP
                            </span>
                            <span className="text-accent font-medium">→ {getLevelInfo(user.points).nextLevel}</span>
                          </div>
                          <div className="relative">
                            <Progress value={xpProgress.percentage} className="h-3 bg-gray-800/50" />
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50 rounded-full"></div>
                          </div>
                        </div>

                      <div
                        className={`
                          flex items-center justify-between text-sm rounded-md px-4 py-2.5 border
                          transition-all duration-300
                          ${getStreakStyle(user.streak)}
                        `}
                      >
                        <span className="text-muted-foreground font-medium">Win Streak</span>
                        <div className="flex items-center gap-2.5">
                          <div className="relative">
                            <Flame className={`w-4 h-4 ${getStreakIconColor(user.streak)} transition-colors`} />
                            {user.streak >= 5 && (
                              <div className={`absolute inset-0 ${getStreakIconColor(user.streak)} opacity-20 blur-sm`}>
                                <Flame className="w-4 h-4" />
                              </div>
                            )}
                          </div>
                          <span className="text-foreground font-bold tabular-nums text-base">{user.streak}</span>
                          {user.streak >= 10 && (
                            <Badge
                              variant="secondary"
                              className="ml-1 px-1.5 py-0 text-[10px] font-bold border-orange-500/30 bg-orange-500/10 text-orange-600"
                            >
                              HOT
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col items-center space-y-2">
                      <div className="flex items-center space-x-2">
                        <span className="text-xs text-muted-foreground">Achievements</span>
                        <AchievementIcons />
                      </div>
                      <p className="text-sm text-muted-foreground">Member since {user.joinDate}</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <StatsCard stats={user} />
          </div>

          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="space-y-6">
            <TabsList className="glass">
              <TabsTrigger className="cursor-pointer" value="active">Active Bets</TabsTrigger>
              <TabsTrigger className="cursor-pointer" value="history">History</TabsTrigger>
              <TabsTrigger className="cursor-pointer" value="achievements">Achievements</TabsTrigger>
            </TabsList>

            <TabsContent value="active" className="space-y-4">
              {activeQ.isLoading && activeItems.length === 0 ? (
                <ProfileActiveBetsSkeleton />
              ) : sortedActiveBets.length === 0 ? (
                // <EmptyState title="No active bets" subtitle="Make your first prediction to see it here." />
                <div>No bets yet</div>
              ) : (
                <>
                  <ActiveBetsTab activeBets={sortedActiveBets} />
                  <LoadMoreButton query={activeQ} />
                </>
              )}
            </TabsContent>

            <TabsContent value="history" className="space-y-4">
              {historyQ.isLoading && historyItems.length === 0 ? (
                <div className="space-y-4">
                  {[...Array(8)].map((_, i) => (
                    <Card key={i} className="glass animate-pulse">
                      <CardContent className="pt-6">
                        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
                          <div className="lg:col-span-2 space-y-2">
                            <div className="h-4 bg-muted rounded w-3/4"></div>
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-muted rounded w-full"></div>
                            <div className="h-3 bg-muted rounded w-2/3"></div>
                          </div>
                          <div className="space-y-2">
                            <div className="h-3 bg-muted rounded w-1/2"></div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <>
                  <HistoryBetsTab historyBets={historyItems} />
                  <LoadMoreButton query={historyQ} />
                </>
              )}
            </TabsContent>

            <TabsContent value="achievements" className="space-y-6">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold gradient-text mb-2">Achievement Gallery</h2>
                <p className="text-muted-foreground">Collect badges and NFTs as you master the art of prediction</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {achievements.map((badge) => {
                    const IconComponent = badge.icon
                    return (
                    <Dialog key={badge.id}>
                      <DialogTrigger asChild>
                      <Card
                        className={`glass transition-all duration-300 cursor-pointer group ${
                        badge.earned
                          ? "glow hover:glow-cyan transform hover:scale-105 hover:shadow-2xl hover:shadow-cyan-500/20"
                          : "opacity-50 hover:opacity-75"
                        }`}
                      >
                        <CardContent className="pt-6 text-center relative">
                        {badge.earned && (
                          <div className="absolute top-2 right-2">
                          <div className="flex items-center space-x-1 bg-gradient-to-r from-purple-500/20 to-pink-500/20 px-2 py-1 rounded-full border border-purple-500/30">
                            <Shield className="w-3 h-3 text-purple-400" />
                            <span className="text-xs text-purple-400 font-medium">NFT</span>
                          </div>
                          </div>
                        )}

                        <div
                          className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center relative ${
                          badge.earned ? `bg-gradient-to-r ${badge.gradient} glow` : "bg-muted"
                          }`}
                        >
                          {badge.earned ? (
                          <IconComponent className="w-10 h-10 text-white relative z-10" />
                          ) : (
                          <IconComponent className="w-10 h-10 text-muted-foreground" />
                          )}
                        </div>

                        <h3 className="font-semibold mb-1 group-hover:text-cyan-400 transition-colors duration-300">
                          {badge.name}
                        </h3>
                        <p className="text-sm text-muted-foreground mb-2">{badge.description}</p>
                        <Badge
                          variant="outline"
                          className={`${
                          badge.earned
                            ? `bg-gradient-to-r ${badge.gradient} text-white border-transparent`
                            : "glass"
                          }`}
                        >
                          <Star className="w-3 h-3 mr-1" />
                          {badge.rarity}
                        </Badge>
                        </CardContent>
                      </Card>
                      </DialogTrigger>

                      <DialogContent className="glass max-w-md mx-auto">
                      <DialogHeader>
                        <DialogTitle className="text-center">
                        <div className="flex flex-col items-center space-y-4">
                          <div
                          className={`w-24 h-24 rounded-full flex items-center justify-center relative ${
                            badge.earned ? `bg-gradient-to-r ${badge.gradient} glow` : "bg-muted"
                          }`}
                          >
                          {badge.earned ? (
                            <IconComponent className="w-12 h-12 text-white" />
                          ) : (
                            <IconComponent className="w-12 h-12 text-muted-foreground" />
                          )}
                          {badge.earned && (
                            <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-white/30 to-transparent animate-pulse"></div>
                          )}
                          </div>
                          <div className="space-y-2">
                          <h3 className="text-xl font-bold">{badge.name}</h3>
                          <Badge
                            variant="outline"
                            className={`${getRarityColor(badge.rarity)} border-current`}
                          >
                            <Star className="w-3 h-3 mr-1" />
                            {badge.rarity}
                          </Badge>
                          </div>
                        </div>
                        </DialogTitle>
                      </DialogHeader>

                      <div className="space-y-4 text-center">
                        <p className="text-muted-foreground">{badge.detailedDescription}</p>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <div className="text-muted-foreground">Unlocked by</div>
                          <div className="font-semibold text-accent">{badge.unlockedBy} of players</div>
                        </div>
                        <div className="space-y-1">
                          <div className="text-muted-foreground">NFT ID</div>
                          <div className="font-mono text-xs bg-muted/50 px-2 py-1 rounded">{badge.nftId}</div>
                        </div>
                        </div>

                        {badge.earned && badge.earnedDate && (
                        <div className="pt-2 border-t border-muted">
                          <div className="text-sm text-muted-foreground">Earned on</div>
                          <div className="font-semibold text-accent">{badge.earnedDate}</div>
                        </div>
                        )}

                        {!badge.earned && (
                        <div className="pt-2 border-t border-muted">
                          <div className="text-sm text-muted-foreground">Status</div>
                          <div className="font-semibold text-yellow-400">Not yet unlocked</div>
                        </div>
                        )}
                      </div>
                      </DialogContent>
                    </Dialog>
                    )
                  })}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </TooltipProvider>
  );
}
