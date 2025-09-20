import axios from "axios";
import {BetsKind, BetsResponse } from "@/lib/types/bet";

export async function fetchBets({ wallet, kind, limit = 10, cursor }: { 
	wallet?: string;
	kind: BetsKind; 
	limit?: number; 
	cursor?: string | null
	},
		signal?: AbortSignal
	): Promise<BetsResponse> {
	const params = new URLSearchParams();
	params.set("kind", kind);
	if (wallet) params.set("wallet", wallet);
	if (limit) params.set("limit", String(limit));
	if (cursor) params.set("cursor", cursor);

	const res = await axios(`${process.env.NEXT_PUBLIC_API_URL}/profile/bets?${params.toString()}`, {
		signal
	});
	return res.data;
}