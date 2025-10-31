import axios from "axios"
import { MeSchema, type Me } from "@/lib/types/auth";

export async function getMe(): Promise<Me | null> {
	try {
		const { data } = await axios.get<{ ok: boolean; user: any }>(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`,
			{ withCredentials: true }
		);

		if (data.ok && data.user)
		{
			const parsed = MeSchema.safeParse(data.user);
			if (parsed.success) {
				return parsed.data;
			} else {
				console.error("Failed to parse /auth/me response:", parsed.error);
				return null;
			}
		}
		return null;
	} catch (error: any)
	{
		console.error("Failed to get /auth/me", error);
		return null;
	}
}
