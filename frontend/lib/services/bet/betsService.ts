import axios from "axios";
import { 
	BetsResponseSchema, 
	BetsKind, 
	BetsResponse, 
	PrepareBetPayload, 
	PrepareBetSchema, 
	PrepareBetResponseSchema, 
	ConfirmBetPayload, 
	ConfirmBetSchema, 
	ConfirmBetResponseSchema
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

export async function prepareBet(p: PrepareBetPayload) {
  const payload = PrepareBetSchema.parse(p);

  const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/markets/bets/prepare`, payload, {
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
  });

  return PrepareBetResponseSchema.parse(data);
}

export async function confirmBet(p: ConfirmBetPayload) {
  const payload = ConfirmBetSchema.parse(p);

  const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/markets/bets/confirm`, payload, {
    withCredentials: true,
    headers: { "Content-Type": "application/json" },
  });

  return ConfirmBetResponseSchema.parse(data);
}