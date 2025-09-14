import axios from "axios"

import type { PythFeedItem } from "@/lib/types/pyth";

const URL =
  "https://hermes.pyth.network/v2/price_feeds?asset_type=crypto&quote_currency=USD"

export async function getPythFeeds(): Promise<PythFeedItem[]> {
	try {
		const response = await axios.get<PythFeedItem[]>(URL);
		console.log(response.data);

	  	return response.data;
	} catch(error: any) {
		console.error("Failed to get hermes.pyth.network/v2/price_feeds?asset_type=crypto&quote_currency=USD:", error);
		throw error;
	}
}
