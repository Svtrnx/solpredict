"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TrendingUp, Trophy, Plus, BarChart3, ChevronDown } from "lucide-react"
import { WalletConnectButton } from "./wallet-connect-button"
import { useAppSelector } from "@/lib/hooks"
import Image from "next/image";

export function Navbar() {
  const pathname = usePathname()
  const { isConnected } = useAppSelector((state) => state.wallet)

  const navItems = [
    { href: "/markets", label: "Markets", icon: TrendingUp },
    { href: "/dashboard", label: "Dashboard", icon: BarChart3 },
    { href: "/leaderboard", label: "Leaderboard", icon: Trophy },
    { href: "/create", label: "Create Market", icon: Plus },
  ]

  return (
    <nav className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-[95%] max-w-6xl">
      <div className="bg-black/20 backdrop-blur-xl border border-white/5 rounded-2xl px-6 py-3 shadow-2xl shadow-purple-500/20">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-2">
          <div className="relative h-10 w-10">
            <Image
              src="/logo.png"
              alt="SolPredict Logo"
              width={32}
              height={32}
              className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none select-none"
            />
          </div>
            <span className="text-xl font-bold text-white">SolPredict</span>
          </Link>

          <div className="hidden md:flex items-center space-x-8">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

              return (
                <Link key={item.href} href={item.href}>
                  <Button
                    variant="ghost"
                    className={`relative cursor-pointer px-4 py-2 text-sm font-medium transition-all duration-200 bg-transparent hover:bg-white/10 rounded-lg ${
                      isActive ? "text-white bg-white/10" : "text-gray-300 hover:text-white"
                    }`}
                  >
                    {item.label}
                    {/* {item.label === "Markets" && <ChevronDown className="ml-1 h-3 w-3" />} */}
                  </Button>
                </Link>
              )
            })}
          </div>

          <div className="flex items-center">
            <WalletConnectButton
              className={`transition-all duration-200 px-3 py-1.5 md:px-6 md:py-2 rounded-xl font-medium text-sm md:text-base ${
                !isConnected ? "shadow-lg shadow-purple-500/40 backdrop-blur-sm" : ""
              }`}
            />
          </div>
        </div>

        <div className="md:hidden flex items-center justify-between pt-3 mt-3 border-t border-white/10">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = pathname === item.href || (item.href !== "/" && pathname.startsWith(item.href))

            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={`flex flex-col items-center space-y-1 px-3 py-2 h-auto rounded-lg transition-all duration-200 ${
                    isActive ? "text-white bg-white/10" : "text-gray-300 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-xs">{item.label.split(" ")[0]}</span>
                </Button>
              </Link>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
