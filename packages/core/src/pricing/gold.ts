import type { RawPrice } from "./types";
import { fetchYahooPrice } from "./yahoo";
import { fetchFxRateToTry } from "./tcmb";

const GRAMS_PER_OUNCE = 31.1034768;

// PortfoyTakip v1'deki (Spring uygulaması) sabit çarpanlar — dürüst bir "yaklaşık" olarak
// korunuyor. Faz 1'de ücretsiz TR sarrafiye API'si bulunursa bunun yerine gerçek prim kullanılacak.
const COIN_MULTIPLIERS: Record<string, number> = {
  ALTIN_CEYREK: 1.64,
  ALTIN_YARIM: 3.28,
  ALTIN_TAM: 6.56,
};

/**
 * Gram (has) altın fiyatını TRY cinsinden HESAPLAR (sabit kaynak yerine):
 *   gram_TRY = (ons_USD / 31.1034768) × USDTRY
 * Bu türetme şeffaf ve doğrulanabilir — mevcut Spring kodundaki sabit çeyrek/yarım/tam
 * çarpanlarının aksine, taban değer gerçek spot fiyattan gelir.
 */
export async function fetchGoldPrice(symbol: string): Promise<RawPrice | null> {
  const ounceUsd = await fetchYahooPrice("GC=F"); // COMEX altın vadeli, ons/USD proxy'si
  if (!ounceUsd) return null;

  if (symbol === "ALTIN_ONS") {
    return { price: ounceUsd.price, currency: "USD", source: "yahoo(GC=F)" };
  }

  const usdTry = await fetchFxRateToTry("USD");
  if (!usdTry) return null;

  const gramTry = (ounceUsd.price / GRAMS_PER_OUNCE) * usdTry.price;

  if (symbol === "ALTIN_GRAM" || symbol === "GOLD_GRAM_TRY") {
    return { price: gramTry, currency: "TRY", source: "computed(XAU*USDTRY)" };
  }

  const multiplier = COIN_MULTIPLIERS[symbol];
  if (multiplier) {
    return {
      price: gramTry * multiplier,
      currency: "TRY",
      source: "computed(gram*approx_premium)", // dürüstçe "yaklaşık" işaretli
    };
  }

  return null;
}
