import axios from "axios"

interface UserData {
  address: string
  totalVolume: string
  winRate: number
  winRateChange: string
  rankChange: number
  totalBets: number
  activeBets: number
  rank: number
  level: string
  points: number
  streak: number
  joinDate: string
}

export async function getWalletOverview(): Promise<UserData | null> {
	try {
		const data = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/overview`,
			{ withCredentials: true }
		);
		console.log(data.data)
		return data.data;
	} catch (error: any)
	{
		console.error("Failed to get /auth/me:", error);
		return null;
	}
}

export async function getWalletOverviewPublic(walledId: string): Promise<UserData | null> {
	try {
		const data = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/${walledId}`,
			{ withCredentials: true }
		);
		console.log(data.data)
		return data.data;
	} catch (error: any)
	{
		console.error("Failed to get /auth/me:", error);
		return null;
	}
}
