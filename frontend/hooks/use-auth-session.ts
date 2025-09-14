import { useCallback, useEffect, useState } from "react";
import { getMe } from "@/lib/services/auth/meSerivce";
import type { Me, SessionStatus } from "@/lib/types/auth";

export function useAuthSession() {
  const [user, setUser] = useState<Me | null>(null);
  const [status, setStatus] = useState<SessionStatus>("loading");

  const refresh = useCallback(async () => {
    setStatus("loading");
    try {
      const me = await getMe();
      if (me) {
        setUser(me);                
        setStatus("authenticated");
      } else {
        setUser(null);
        setStatus("unauthenticated");
      }
    } catch {
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  useEffect(() => { void refresh(); }, [refresh]);

  const loading = status === "loading";
  return { user, status, loading, refresh };
}
