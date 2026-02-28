export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string }; meta?: Record<string, unknown> }> {
  const { token, ...fetchOptions } = options || {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // All requests go through the Next.js rewrite proxy (same-origin, no CORS issues).
  const url = `/api/v1${path}`;

  const res = await fetch(url, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
  });

  const text = await res.text();
  if (!text) return { success: false, error: { code: "EMPTY_RESPONSE", message: "Empty response" } };
  try {
    return JSON.parse(text);
  } catch {
    return { success: false, error: { code: "INVALID_JSON", message: text.slice(0, 200) } };
  }
}
