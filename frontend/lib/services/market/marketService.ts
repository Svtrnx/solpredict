import axios from "axios";

import { CreateMarketFormData } from "@/lib/types";
import { getMarket } from "@/lib/types";

type RawCreateResp = {
	ok: boolean;
	marketId: string;
	message: string;
	tx?: string;
	createTx?: string;
	placeBetTx?: string;
};

export type CreateMarketResponse = {
	ok: boolean;
	marketId: string;
	tx: string;           
	message: string;
};

interface MarketResponse {
  ok: boolean;
  items: getMarket[];
  nextCursor?: string | null;
}

export async function createMarket(formData: CreateMarketFormData): Promise<CreateMarketResponse> {
	const { data } = await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/markets`,
		formData,
		{ withCredentials: true, headers: { "Content-Type": "application/json" } }
	);

	const raw = data as RawCreateResp;
	const tx = raw.tx ?? raw.createTx;

	if (!tx || typeof tx !== "string") {
		throw new Error("Server didn't return a transaction (expected `tx` or `createTx`).");
	}

	return { ok: raw.ok, marketId: raw.marketId, tx, message: raw.message };
}

export async function confirmMarket(
		create: CreateMarketFormData,
		marketId: string,
		signature: string
	){
	await axios.post(`${process.env.NEXT_PUBLIC_API_URL}/markets/confirm`, { 
			create, 
			txSig: signature, 
			marketId 
		},
		{ withCredentials: true, headers: { "Content-Type": "application/json" } }
	);
}


export async function getMarketsList(): Promise<MarketResponse> {
	try {
		const data = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/markets`,
			{ withCredentials: true }
		);
		const marketsData = await data.data as { ok: boolean; items: getMarket[]; nextCursor?: string };
		return marketsData;
	} catch (error: any) {
		console.error("Failed to get /markets", error);
		return { "ok": false, "items": [], "nextCursor": null };
	}
}
