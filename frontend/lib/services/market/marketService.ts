import axios from "axios";

import { 
	CreateMarketFormData, MarketSchema, MarketResponse, PrepareClaimPayload, PrepareClaimResponseSchema, 
	ResolveIxRequestSchema, MarketResponseSchema, CreateMarketResponse, CreateMarketSchema, 
	RawCreateRespSchema, ResolveIxBundleSchema, ResolveIxBundle, ResolveIxRequest, 
	PrepareClaimSchema, PrepareClaimResponse
} from "@/lib/types";

export type MarketsListParams = {
  limit?: number
  cursor?: string | null
  category?: string
  q?: string
  sort?: "volume" | "participants" | "ending"
  signal?: AbortSignal
  status?: string
}

export async function createMarket(formData: CreateMarketFormData): Promise<CreateMarketResponse> {
	try {
		const payload = CreateMarketSchema.parse(formData)
		const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/markets`,
		payload,
		{ 	
			withCredentials: true, 
			headers: { "Content-Type": "application/json" } 
		}
		)
		const raw = RawCreateRespSchema.parse(data)

		const tx = raw.tx ?? raw.createTx ?? raw.placeBetTx
		if (!tx) throw new Error("Server didn't return a transaction.")

		return { ok: raw.ok, marketPda: raw.marketId, tx, message: raw.message ?? "" }
	} catch (err) {
		console.error("createMarket failed:", err)
		throw err
	}
}

export async function getMarketsList(opts: MarketsListParams = {}): Promise<MarketResponse> {
  try {
    const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/markets`, {
		withCredentials: true,
		signal: opts.signal,
		params: {
			limit: opts.limit,
			cursor: opts.cursor ?? undefined,
			category: opts.category,
			q: opts.q,
			sort: opts.sort,
			status: opts.status,
		},
    })
    return MarketResponseSchema.parse(data)
  } catch (error: any) {
    if (error.name === "ZodError") {
      console.error("Invalid /markets payload:", error.errors)
    } else {
      console.error("Failed to get /markets:", error)
    }
    return { ok: false, items: [], nextCursor: null }
  }
}

export async function getMarket(market_address: string) {
	try {
		const { data } = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/markets/${market_address}`,
			{ withCredentials: true }
		);
		const payload = (data && typeof data === "object" && ("item" in data || "data" in data))
			? (data.item ?? data.data)
			: data;

		const parsed = MarketSchema.parse(payload);
  		return { ...parsed, settler: parsed.settler ?? undefined };
	} catch (error: any) {
		console.error("Failed to get /markets/{market_address}", error);
		throw error
	}
}

export async function resolveMarketIx(req: ResolveIxRequest): Promise<ResolveIxBundle> {
	try {
		const payload = ResolveIxRequestSchema.parse(req);
		const { data } = await axios.post(
			`${process.env.NEXT_PUBLIC_API_URL}/markets/resolve/ix`,
				payload,
			{
				withCredentials: true,
				headers: { "Content-Type": "application/json" },
			}
		);
		const bundle = ResolveIxBundleSchema.parse(data);

		if (!bundle.ok || bundle.instructions.length === 0) {
			throw new Error(bundle.message || "Backend returned no instructions");
		}
		return bundle;
	} catch (error: any) {
		console.error("Failed to get /markets/resolve/ix", error);
		throw error
	}
}

export async function prepareClaimTx(p: PrepareClaimPayload): Promise<PrepareClaimResponse> {
	const payload = PrepareClaimSchema.parse(p);
	try {
		const { data } = await axios.post(
		`${process.env.NEXT_PUBLIC_API_URL}/markets/claim/tx`,
			payload,
		{
			withCredentials: true,
			headers: { "Content-Type": "application/json" },
		}
		);
		return PrepareClaimResponseSchema.parse(data);
	} catch (error: any) {
		console.error("Failed to get /markets/claim/tx", error);
		throw error
	}
}