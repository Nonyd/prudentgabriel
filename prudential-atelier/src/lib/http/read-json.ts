export function jsonErrorMessage(error: unknown, fallback: string): string {
  return typeof error === "string" && error.trim() ? error : fallback;
}

/** Parse a fetch body without throwing the opaque "Unexpected end of JSON input". */
export async function readJsonBody(res: Response): Promise<Record<string, unknown>> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(
      res.ok
        ? "The server returned an empty response"
        : `Request failed (${res.status}). Try again or pay by bank transfer.`,
    );
  }
  try {
    return JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw new Error(
      res.ok
        ? "The server returned an invalid response"
        : `Request failed (${res.status}). Try again or pay by bank transfer.`,
    );
  }
}

export async function parseJsonResponse<T>(res: Response, label: string): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    throw new Error(`${label} returned an empty response`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`${label} returned an invalid response`);
  }
}
