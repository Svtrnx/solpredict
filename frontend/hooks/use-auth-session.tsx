"use client"

import type React from "react"
import { useEffect, useState, useCallback, useRef, createContext, useContext } from "react"
import { getMe } from "@/lib/services/auth/meSerivce"
import type { Me, SessionStatus } from "@/lib/types/auth"

interface AuthSession {
  user: Me | null
  status: SessionStatus
  loading: boolean
  refresh: () => Promise<void>
}

const AuthSessionContext = createContext<AuthSession | null>(null)

const globalAuthState: {
  user: Me | null
  status: SessionStatus
  promise: Promise<void> | null
} = {
  user: null,
  status: "loading",
  promise: null,
}

const listeners = new Set<() => void>()

function notifyListeners() {
  listeners.forEach((listener) => listener())
}

async function refreshAuthSession(): Promise<void> {
  if (globalAuthState.promise) {
    console.log("Auth request already in progress, reusing existing promise")
    return globalAuthState.promise
  }

  console.log("Starting new auth/me request")
  globalAuthState.status = "loading"
  notifyListeners()

  const promise = (async () => {
    try {
      const me = await getMe()
      if (me) {
        const wasUnauthenticated = globalAuthState.status === "unauthenticated" || globalAuthState.user === null
        const hasRefreshedBalance =
          typeof window !== "undefined" && sessionStorage.getItem("balance_refreshed") === "true"

        globalAuthState.user = me
        globalAuthState.status = "authenticated"

        if (wasUnauthenticated && !hasRefreshedBalance) {
          console.log("First-time authentication detected, will refresh balance in 2 seconds")
          if (typeof window !== "undefined") {
            sessionStorage.setItem("balance_refreshed", "true")
          }

          setTimeout(async () => {
            console.log("Refreshing balance after 2 seconds")
            try {
              const updatedMe = await getMe()
              if (updatedMe) {
                globalAuthState.user = updatedMe
                notifyListeners()
                console.log("Balance refreshed successfully")
              }
            } catch (error) {
              console.error("Failed to refresh balance:", error)
            }
          }, 3200)
        }
      } else {
        globalAuthState.user = null
        globalAuthState.status = "unauthenticated"
        if (typeof window !== "undefined") {
          sessionStorage.removeItem("balance_refreshed")
        }
      }
    } catch (error) {
      console.error("Auth fetch error:", error)
      globalAuthState.user = null
      globalAuthState.status = "unauthenticated"
      if (typeof window !== "undefined") {
        sessionStorage.removeItem("balance_refreshed")
      }
    } finally {
      globalAuthState.promise = null
      notifyListeners()
      console.log("Auth request completed, status:", globalAuthState.status)
    }
  })()

  globalAuthState.promise = promise
  return promise
}

export function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  const [, forceUpdate] = useState({})
  const mountedRef = useRef(false)

  useEffect(() => {
    const listener = () => forceUpdate({})
    listeners.add(listener)

    if (!mountedRef.current) {
      mountedRef.current = true
      console.log("AuthSessionProvider mounted, initiating auth check")
      refreshAuthSession()
    }

    return () => {
      listeners.delete(listener)
    }
  }, [])

  const refresh = useCallback(async () => {
    await refreshAuthSession()
  }, [])

  const value: AuthSession = {
    user: globalAuthState.user,
    status: globalAuthState.status,
    loading: globalAuthState.status === "loading",
    refresh,
  }

  return <AuthSessionContext.Provider value={value}>{children}</AuthSessionContext.Provider>
}

export function useAuthSession(): AuthSession {
  const context = useContext(AuthSessionContext)

  if (!context) {
    throw new Error("useAuthSession must be used within AuthSessionProvider")
  }

  return context
}
