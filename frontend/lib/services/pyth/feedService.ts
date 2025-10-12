import axios from "axios"

import type { PythFeedItem, HermesLatestResponse} from "@/lib/types/pyth";
import { parsePythLatestPrice } from "@/lib/utils";

let URL =
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

export async function getPythFeed(feed_id: string): Promise<number> {
	let url = "https://hermes.pyth.network/v2/updates/price/latest?ids[]="
	URL = url + `${feed_id}`

	console.log(URL)
	try {
		const response = await axios.get<HermesLatestResponse>(URL);
		console.log(response.data);

	  	const { priceHuman } = parsePythLatestPrice(response.data);
		return Number(priceHuman);
	} catch(error: any) {
		console.error("Failed to get hermes.pyth.network/v2/price_feeds?asset_type=crypto&quote_currency=USD:", error);
		throw error;
	}
}

