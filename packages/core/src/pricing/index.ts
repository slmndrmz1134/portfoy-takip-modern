import type { RawPrice } from "./types";
import { fetchFinnhubPrice } from "./finnhub";
import { fetchBistPrice } from "./bist";
import { fetchFxRateToTry } from "./tcmb";
import { fetchGoldPrice } from "./gold";
import type { Market } from "../types";

export type { RawPrice, PriceFetcher } from "./types";
export { fetchFinnhubPrice } from "./finnhub";
export { fetchYahooPrice } from "./yahoo";
export { fetchBistPrice } from "./bist";
export { fetchTcmbRate, fetchFrankfurterRate, fetchFxRateToTry } from "./tcmb";
export { fetchGoldPrice } from "./gold";

export interface ResolvePriceConfig {
  finnhubApiKey?: string;
}

/**
 * Piyasa/tür bilgisine göre doğru adaptöre yönlendiren tek giriş noktası.
 * KURAL: başarısızlıkta `null` döner — çağıran taraf (cron job) `prices` tablosundaki
 * son bilinen geçerli (last-known-good) değere düşmeli, ASLA 0 yazmamalı.
 */
export async function resolvePrice(
  symbol: string,
  market: Market,
  config: ResolvePriceConfig = {},
): Promise<RawPrice | null> {
  switch (market) {
    case "US":
      return fetchFinnhubPrice(symbol, config.finnhubApiKey ?? "");
    case "BIST":
      return fetchBistPrice(symbol);
    case "FX":
      return fetchFxRateToTry(symbol);
    case "GOLD":
      return fetchGoldPrice(symbol);
    default:
      return null;
  }
}
