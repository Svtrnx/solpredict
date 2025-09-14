export type Me = {
  id: string;
  walletAddress: string;
  walletId: string;
  chain: string;
  exp: number;
};


export type SessionStatus = "loading" | "authenticated" | "unauthenticated";
