"use client"

import { useEffect, useCallback } from "react"
import { useAppDispatch } from "@/lib/hooks"
import { useWallet } from "@solana/wallet-adapter-react"
import { useConnection } from "@solana/wallet-adapter-react"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import {
  connectWalletStart,
  connectWalletSuccess,
  connectWalletFailure,
  disconnectWallet as disconnectWalletAction,
  updateBalance,
} from "@/lib/features/wallet/walletSlice"

export function WalletBridge() {
  const dispatch = useAppDispatch()
  const { connection } = useConnection()
  const { connecting, connected, publicKey, wallet } = useWallet()

  useEffect(() => {
    if (connecting) dispatch(connectWalletStart())
  }, [connecting, dispatch])

  const refreshBalance = useCallback(async () => {
    if (!publicKey) return
    try {
      const lamports = await connection.getBalance(publicKey, "confirmed")
      const sol = (lamports / LAMPORTS_PER_SOL).toFixed(4)
      dispatch(updateBalance(Number(sol)))
    } catch (e: any) {
      dispatch(connectWalletFailure(e?.message ?? "Failed to fetch balance"))
    }
  }, [connection, publicKey, dispatch])

  useEffect(() => {
    if (!connected || !publicKey) return
    const address = publicKey.toBase58()
    dispatch(connectWalletSuccess({ address, publicKey: address }))
    refreshBalance()
  }, [connected, publicKey, dispatch, refreshBalance])

  useEffect(() => {
    const adapter = wallet?.adapter
    if (!adapter) return

    const onDisconnect = () => dispatch(disconnectWalletAction())
    const onError = (e: any) =>
      dispatch(connectWalletFailure(e?.message ?? "Wallet error"))

    adapter.on("disconnect", onDisconnect)
    adapter.on("error", onError)

    return () => {
      adapter.off("disconnect", onDisconnect)
      adapter.off("error", onError)
    }
  }, [wallet, dispatch])

  useEffect(() => {
    if (!publicKey) return
    let subId: number
    ;(async () => {
      subId = await connection.onAccountChange(publicKey, () => {
        refreshBalance()
      }, "confirmed")
    })()
    return () => {
      if (subId) connection.removeAccountChangeListener(subId)
    }
  }, [connection, publicKey, refreshBalance])

  return null
}
