import axios from "axios"
import type { Me } from "@/lib/types/auth";

export async function getMe(): Promise<Me | null> {
	try {
		const { data } = await axios.get<{ ok: boolean; user: Me }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
			{ withCredentials: true }
		);

		if (data.ok && data.user)
		{
			return data.user;
		}
		return null;
	} catch (error: any)
	{
		console.error("Failed to get /auth/me", error);
		return null;
	}
}
