"use client"

import { useEffect, useState } from "react"

import { getWalletOverview } from "@/lib/services/profle/walletOverviewService"
import ProfileScreen from "@/components/profile/ProfileScreen"
import { WalletAuthorizationGuard } from "@/components/wallet-authorization-guard"
import { DashboardSkeleton } from "@/components/ui/dashboard-skeleton"

interface UserData {
  address: string;
  totalVolume: number;
  winRate: number;
  winRateChange: number;
  rankChange: number;
  totalBets: number;
  activeBets: number;
  rank: number;
  level: string;
  points: number;
  streak: number;
  joinDate: string;
  displayAddress?: string;
  wallet?: string;
}

export default function DashboardPage() {
  
  const [user, setUser] = useState<UserData | null>(null)
  
  useEffect(() => {
      const fetchData = async () => {
        const overviewData = await getWalletOverview()
        setUser(overviewData)
      }

      fetchData()
    }, [])

  return (
    <>
    {user ?
    <ProfileScreen 
      wallet={user?.address}
      isOwner={true}
      publicData={user}
      privateData={null}
    />
    :
      // !NEED TO FIX! 
      <WalletAuthorizationGuard>
        <DashboardSkeleton />
      </WalletAuthorizationGuard>
    }
    </>
  )
}
