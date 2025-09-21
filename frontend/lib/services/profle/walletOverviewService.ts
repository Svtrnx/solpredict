import axios from "axios"
import { UserDataSchema, UserData } from "@/lib/types";

export async function getWalletOverview(): Promise<UserData | null> {
	try {
		const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/overview`,
			{ withCredentials: true }
		);
		const parsed = UserDataSchema.parse(res.data)

		return parsed
	} catch (error: any) {
		console.error("Failed to get /profile/overview", error);
		return null;
	}
}

export async function getWalletOverviewPublic(walledId: string): Promise<UserData | null> {
	try {
		const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/profile/${walledId}`,
			{ withCredentials: true }
		);
		const parsed = UserDataSchema.parse(res.data)
		return parsed
	} catch (error: any) {
		console.error("Failed to get /profile/walletId", error);
		return null;
	}
}
