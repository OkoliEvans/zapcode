import type {
  Merchant,
  Transaction,
  Stats,
  PublicMerchant,
  OnboardingData,
  FxRate,
} from "../types";

const BASE = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

async function req<T>(
  path: string,
  opts: RequestInit = {},
  token?: string,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((opts.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`);
  return data as T;
}

export const api = {
  merchants: {
    me: (token: string) => req<Merchant>("/api/merchants/me", {}, token),
    onboard: (token: string, data: OnboardingData) =>
      req<Merchant>(
        "/api/merchants/onboard",
        { method: "POST", body: JSON.stringify(data) },
        token,
      ),
    update: (token: string, data: Partial<Merchant>) =>
      req<Merchant>(
        "/api/merchants/me",
        { method: "PATCH", body: JSON.stringify(data) },
        token,
      ),
    get: (id: string) => req<PublicMerchant>(`/api/merchants/${id}`),
    qrUrl: (id: string) => `${BASE}/api/merchants/${id}/qr.png`,
  },
  transactions: {
    list: (token: string, limit = 50) =>
      req<Transaction[]>(`/api/transactions?limit=${limit}`, {}, token),
    stats: (token: string) => req<Stats>("/api/transactions/stats", {}, token),
    latest: (token: string) =>
      req<{ latestId: string | null; latestAt: string | null }>(
        "/api/transactions/latest",
        {},
        token,
      ),
  },
  upload: {
    logo: async (token: string, base64: string) => {
      const res = await fetch(`${BASE}/api/wallet/upload-logo`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ image: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Upload failed");
      return data as { url: string };
    },
  },
  rates: {
    get: (from: string, to: string) =>
      req<FxRate & { from: string; to: string }>(
        `/api/rates?from=${from}&to=${to}`,
      ),
  },
  stats: {
    public: () =>
      req<{ merchants: number; payments: number; uniqueSenders: number }>(
        "/api/stats/public",
      ),
  },
};