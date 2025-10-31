import axios from "axios";
import { 
	BetsResponseSchema, 
	BetsKind, 
	BetsResponse, 
	PrepareBetPayload, 
	PrepareBetSchema, 
	PrepareBetResponseSchema,
	RecentBetsResponseSchema,
	type RecentBetsResponse
} from "@/lib/types/bet";

export async function fetchBets(params: {
	wallet?: string
	kind: BetsKind
	limit?: number
	cursor?: string | null
	signal?: AbortSignal
}): Promise<BetsResponse> {
	try{
		const qs = new URLSearchParams()
		qs.set("kind", params.kind)
		if (params.wallet) qs.set("wallet", params.wallet)
		if (params.limit) qs.set("limit", String(params.limit))
		if (params.cursor) qs.set("cursor", params.cursor)
	
		const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/bets?${qs.toString()}`,
			{ withCredentials: true, signal: params.signal }
		)
		console.log(`data query param: qs ${qs}`, data)
		const parsed = BetsResponseSchema.parse(data)
		console.log(`parsed query param: qs ${qs}`, parsed)
		return { ...parsed, nextCursor: parsed.nextCursor ?? null }

	} catch (err: any)
	{
		throw err;
	}
}

export async function prepareBet(p: PrepareBetPayload & { isAiMarket?: boolean }) {
	const payload = PrepareBetSchema.parse(p);

	// Use different endpoint based on market type
	const endpoint = p.isAiMarket
		? `${process.env.NEXT_PUBLIC_API_URL}/markets/ai/bets/tx`   // AI markets: place_bet_multi
		: `${process.env.NEXT_PUBLIC_API_URL}/markets/bets/tx`;      // Pyth markets: place_bet

	const { data } = await axios.post(endpoint, payload, {
		withCredentials: true,
		headers: { "Content-Type": "application/json" },
	});

	return PrepareBetResponseSchema.parse(data);
}

export async function fetchRecentBets(params: {
	marketPda?: string;
	address?: string;
	limit?: number;
	cursor?: number | null;
	signal?: AbortSignal;
}): Promise<RecentBetsResponse> {
	const qs = new URLSearchParams();
	
	if (params.marketPda) qs.set("marketPda", params.marketPda);
	if (params.address)   qs.set("address", params.address);
	if (params.limit)     qs.set("limit", String(params.limit));
	if (params.cursor != null) qs.set("cursor", String(params.cursor));

	const url = `${process.env.NEXT_PUBLIC_API_URL}/markets/bets?${qs.toString()}`;

	const { data } = await axios.get(url, {
		withCredentials: true,
		signal: params.signal,
	});

	return RecentBetsResponseSchema.parse(data);
}