import axios from "axios";
import { LeaderboardResponseSchema, LeaderboardPeriod  } from "../types";


export async function getLeaderboard(period: LeaderboardPeriod = "weekly", limit?: number) {
	try{
		const base = `${process.env.NEXT_PUBLIC_API_URL}/leaderboard?period=${period}`;
		const url = typeof limit === "number" ? `${base}&limit=${limit}` : base;
		
		const { data } = await axios.get(url, { withCredentials: true });
		const payload =
		  data && typeof data === "object" && ("item" in data || "data" in data)
			? (data.item ?? data.data)
			: data;

		return LeaderboardResponseSchema.parse(payload);

	} catch (error: any) {
		console.error("Failed to get /leaderboard", error);
		throw error
	}
}
