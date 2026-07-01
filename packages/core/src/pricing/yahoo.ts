import type { RawPrice } from "./types";

/**
 * Yahoo Finance (resmi olmayan uç) — genel amaçlı YEDEK kaynak.
 * BIST (.IS sembolleri) ve altın spot (GC=F) için yedek olarak kullanılır.
 * Birincil kaynak DEĞİL: SLA yok, oran limiti belirsiz, tarayıcı taklidi gerektiriyor.
 */
export async function fetchYahooPrice(symbol: string): Promise<RawPrice | null> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const data = await res.json();
    const meta = data?.chart?.result?.[0]?.meta;
    const price = meta?.regularMarketPrice;
    const currency = meta?.currency;

    if (!price || price <= 0) return null;

    return { price, currency: currency || "TRY", source: "yahoo" };
  } catch {
    return null;
  }
}
