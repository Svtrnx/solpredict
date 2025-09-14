"use client"

import { useState } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Copy, Star, Target, Crown, Calendar } from "lucide-react"
import AchievementIcons from "@/components/ui/achievement-icons"
import { getLevelInfo, getXPProgress } from "@/lib/utils/level-system"
import type { UserData } from "@/lib/types"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"


interface UserProfileCardProps {
  user: UserData
  showLevel?: boolean
  showXPProgress?: boolean
  showFollowButton?: boolean
  followersCount?: number
  isFollowing?: boolean
  onFollowToggle?: () => void
}

export function UserProfileCard({
  user,
  showLevel = true,
  showXPProgress = true,
  showFollowButton = false,
  followersCount = 0,
  isFollowing = false,
  onFollowToggle,
}: UserProfileCardProps) {
  const [copiedAddress, setCopiedAddress] = useState(false)

  const address = user.address || user.wallet || ""
  const displayAddress = user.displayAddress || `${address.slice(0, 6)}...${address.slice(-6)}`

  const copyAddress = () => {
    navigator.clipboard.writeText(address)
    setCopiedAddress(true)
    setTimeout(() => setCopiedAddress(false), 2000)
  }

  const levelInfo = getLevelInfo(user.points)
  const xpProgress = getXPProgress(user.points)

  return (
    <Card className="glass glow relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-purple-500/10 via-transparent to-cyan-500/10"></div>
      <CardContent className="pt-6 relative z-10">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative">
              <Avatar className="w-24 h-24">
                <AvatarImage src={`https://avatar.vercel.sh/${user.address}`} alt="Kelly King" />
                <AvatarFallback>KK</AvatarFallback>
              </Avatar>
              <Badge variant="secondary" className="border-background absolute -bottom-0.5 left-full min-w-5 -translate-x-8 px-2">
                #{user.rank}
              </Badge>
            </div>

          <div className="text-center space-y-3 w-full">
            <div className="flex items-center ml-8 space-x-2 justify-center">
              <span className="font-mono text-sm">{displayAddress}</span>
              <Button variant="ghost" size="sm" onClick={copyAddress} className="h-6 w-6 p-0 hover:bg-white/10">
                {copiedAddress ? <span className="text-xs text-accent">✓</span> : <Copy className="w-3 h-3" />}
              </Button>
            </div>

            {showLevel && (
              <div className="relative">
                <div className="text-center space-y-2">
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
                      hover:ring-purple-500/[0.24] hover:border-white/[0.12]"
                    >
                    <Star className="w-3.5 h-3.5 text-purple-300" />
                      {user.level || levelInfo.level}
                  </Badge>
                </div>
                {user.rank <= 10 && (
                  <div className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse">
                    <Crown className="w-3 h-3 text-white" />
                  </div>
                )}
              </div>
            )}

            <div className="w-full space-y-3">
              {showXPProgress && levelInfo.nextLevel && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">
                      {xpProgress.current.toLocaleString()}/{xpProgress.max.toLocaleString()} XP
                    </span>
                    <span className="text-accent font-medium">→ {levelInfo.nextLevel}</span>
                  </div>
                  <div className="relative">
                    <Progress value={xpProgress.percentage} className="h-3 bg-gray-800/50" />
                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse opacity-50 rounded-full"></div>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-center space-x-2 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-lg p-3 border border-orange-500/30 glow">
                <div className="flex items-center space-x-2">
                  <div className="w-3 h-3 bg-orange-400 rounded-full animate-pulse"></div>
                  <Target className="w-5 h-5 text-orange-400" />
                </div>
                <span className="text-lg font-bold text-orange-400">{user.streak}</span>
                <span className="text-sm text-orange-300">Win Streak</span>
                <div className="text-lg animate-pulse">🔥</div>
              </div>
            </div>

            <div className="flex flex-col items-center space-y-2">
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">Achievements</span>
                <AchievementIcons />
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Calendar className="w-3 h-3" />
                <span>Member since {user.joinDate}</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
