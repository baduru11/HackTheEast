const API_BASE =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { token?: string }
): Promise<{ success: boolean; data?: T; error?: { code: string; message: string }; meta?: Record<string, unknown> }> {
  const { token, ...fetchOptions } = options || {};

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Authenticated requests go directly to backend (avoids cookie-bloated rewrites).
  // Public requests use the Next.js rewrite proxy.
  const url = token
    ? `${API_BASE}/api/v1${path}`
    : `/api/v1${path}`;

  const res = await fetch(url, {
    ...fetchOptions,
    headers: { ...headers, ...(fetchOptions.headers as Record<string, string>) },
  });

  return res.json();
}
