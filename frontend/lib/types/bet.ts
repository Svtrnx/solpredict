
export type BetData = {
  id: string;
  title: string;
  marketPda: string;
  side: "yes" | "no";
  amount: number;
  currentPrice?: number;
  entryPrice?: number;
  pnl: number;
  pnlAmount?: number;
  endDate?: string;
  status?: "winning" | "losing";
  trend?: "up" | "down";
  result?: "won" | "lost";
  payout?: number;
  resolvedDate?: string;
};

export type BetsKind = "active" | "history";

export type BetsResponse = {
  items: BetData[];
  nextCursor: string | null;
};