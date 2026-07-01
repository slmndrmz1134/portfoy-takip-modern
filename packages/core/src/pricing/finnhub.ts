import type { RawPrice } from "./types";

/**
 * ABD hisseleri için birincil kaynak — Finnhub (ücretsiz katman: 60 istek/dk).
 * https://finnhub.io/docs/api/quote
 *
 * API anahtarı FINNHUB_API_KEY env değişkeninden okunur; sunucu tarafında
 * (cron/edge function) çağrılmalı, istemciye asla sızmamalı.
 */
export async function fetchFinnhubPrice(symbol: string, apiKey: string): Promise<RawPrice | null> {
  if (!apiKey) return null; // Anahtar yoksa sessizce vazgeç, 0 DEĞİL — çağıran yedek kaynağa düşer.

  try {
    const url = `https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as { c?: number };
    // Finnhub, geçersiz sembolde c:0 döndürebilir — bunu geçerli fiyat SAYMIYORUZ.
    if (!data.c || data.c <= 0) return null;

    return { price: data.c, currency: "USD", source: "finnhub" };
  } catch {
    return null;
  }
}
