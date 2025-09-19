"use client"

import { useEffect, useState } from "react"

import { usePathname } from 'next/navigation'

import { getWalletOverviewPublic } from "@/lib/services/profle/walletOverviewService"
import ProfileScreen from "@/components/profile/ProfileScreen"

interface UserData {
  address: string
  totalVolume: string
  winRate: number
  winRateChange: string
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
}

export default function UserProfilePage() {
  const pathname = usePathname()
  const parts = pathname.split('/')
  const walletId = parts[2]

  const [user, setUser] = useState<UserData | null>(null)

  useEffect(() => {
      const fetchData = async () => {
        const overviewData = await getWalletOverviewPublic(walletId)
        setUser(overviewData)
      }

      fetchData()
    }, [])

  return (
    <ProfileScreen 
        wallet={user?.address}
        isOwner={true}
        publicData={user}
        privateData={null}
    />
  )
}
