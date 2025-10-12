"use client"

import { useEffect, useState } from "react"

import { usePathname } from "next/navigation"

import { getWalletOverviewPublic } from "@/lib/services/profle/walletOverviewService"
import { useWallet } from "@solana/wallet-adapter-react"
import ProfileScreen from "@/components/profile/ProfileScreen"

interface UserData {
  address: string
  totalVolume: number
  winRate: number
  winRateChange: number
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
  displayAddress?: string
  wallet?: string
}

export default function UserProfilePage() {
  const { publicKey } = useWallet()
  const publicKeyString = publicKey?.toString() ?? null

  const pathname = usePathname()
  const parts = pathname.split("/")
  const walletId = parts[2]

  const [user, setUser] = useState<UserData | null>(null)

  useEffect(() => {
    const fetchData = async () => {
      setUser(null)
      const overviewData = await getWalletOverviewPublic(walletId)
      setUser(overviewData)
    }

    fetchData()
  }, [walletId])

  const isOwner = publicKeyString === user?.address

  return <ProfileScreen wallet={user?.address} isOwner={isOwner} publicData={user} privateData={null} />
}
