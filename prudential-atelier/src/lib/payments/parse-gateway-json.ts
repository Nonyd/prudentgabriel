/** Parse a payment-provider HTTP body. Empty or HTML responses must not throw `res.json()`. */
export async function parseGatewayJson<T>(res: Response, gateway: string): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`${gateway} returned an empty response`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${gateway} returned an invalid response`);
  }
}
