"use client"

import { useState, useEffect } from "react"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { getEarnedAchievements, type Achievement } from "@/lib/achievements-data"

const AchievementIcons = () => {
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadAchievements = async () => {
      try {
        const earnedAchievements = await getEarnedAchievements()
        setAchievements(earnedAchievements)
      } catch (error) {
        console.error("Failed to load achievements:", error)
      } finally {
        setLoading(false)
      }
    }

    loadAchievements()
  }, [])

  if (loading) {
    return (
      <div className="flex -space-x-1">
        {[...Array(4)].map((_, i) => (
          <Avatar key={i} className="ring-background ring-2 w-8 h-8 animate-pulse">
            <AvatarFallback className="bg-muted" />
          </Avatar>
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider delayDuration={350}>
      <div className="flex -space-x-1">
        {achievements.map((achievement) => {
          const IconComponent = achievement.icon
          return (
            <Tooltip key={achievement.id}>
              <TooltipTrigger asChild>
                <Avatar className="ring-background ring-2 transition-all duration-300 ease-in-out hover:z-10 hover:-translate-y-1 hover:shadow-md w-8 h-8">
                  <AvatarFallback
                    className={`bg-gradient-to-r ${achievement.gradient} text-white text-xs flex items-center justify-center`}
                  >
                    <IconComponent className="w-4 h-4" />
                  </AvatarFallback>
                </Avatar>
              </TooltipTrigger>
              <TooltipContent>
                <div className="text-center">
                  <div className="font-semibold">{achievement.name}</div>
                  <div className="text-xs text-muted-foreground">{achievement.rarity}</div>
                </div>
              </TooltipContent>
            </Tooltip>
          )
        })}
      </div>
    </TooltipProvider>
  )
}

export default AchievementIcons
