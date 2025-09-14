import axios from "axios"

type SiwsOutput = Readonly<{
  account: Readonly<{ publicKey: number[] }>;
  signedMessage: number[];
  signature: number[];
}>;

export async function getNonce() {
  try {
    const response = await axios.get(`${process.env.NEXT_PUBLIC_API_URL}/auth/nonce`);

    const data = response.data;
    const ttl = Number(data.ttlSec ?? data.ttl_sec ?? 300);
    if (!Number.isFinite(ttl)) throw new Error("Bad ttl from server");
    return { ...data, ttl };

  } catch (error: any)
  {
    console.error("Failed to get nonce:", error);
    throw error;
  }
}

export async function verifySiws(payload: SiwsOutput) {
  try {
    const { data } = await axios.post(
      `${process.env.NEXT_PUBLIC_API_URL}/auth/verify`,
      payload,
      { withCredentials: true, headers: { "Content-Type": "application/json" } }
    );

    const ttl = Number(data.ttlSec ?? data.ttl_sec ?? 300);
    if (!Number.isFinite(ttl)) throw new Error("Bad ttl from server");
    return { ...data, ttl };
  } catch (error)
  {
    console.error("Failed to verify SIWS:", error);
    throw error;
  }
}
