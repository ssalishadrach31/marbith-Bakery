import { getToken } from "@/lib/auth";

export const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function apiFetch(path: string, options?: RequestInit): Promise<any> {
  const token = getToken();
  const res = await fetch(`${API_BASE}/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });
  if (!res.ok) {
    const e = await res.json().catch(() => ({}));
    const err: any = new Error(e.error ?? `Request failed (${res.status})`);
    err.status = res.status;
    throw err;
  }
  return res.status === 204 ? null : res.json();
}
