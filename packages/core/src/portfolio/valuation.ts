import type { DerivedPortfolio } from "./holdings";

export interface LivePrice {
  price: number;
  currency: string;
  isStale: boolean;
}

export interface PositionValue {
  symbol: string;
  quantity: number;
  currentPriceTry: number;
  marketValueTry: number;
  costBasisTry: number;
  unrealizedPLTry: number;
  realizedPLTry: number;
  isStale: boolean;
}

export interface PortfolioValueResult {
  positions: PositionValue[];
  cashTry: number;
  totalValueTry: number;
  /** Fiyatı bulunamayan (prices tablosunda hiç kaydı olmayan) semboller — UI'da uyarı için. */
  missingPriceSymbols: string[];
}

/**
 * Türetilmiş holdings'i (derivePortfolio çıktısı) güncel fiyatlarla TRY cinsinden değerler.
 * @param prices symbol -> en güncel fiyat (latest_prices view'ından).
 * @param fxRates currency -> TRY kuru (örn. "USD" -> 46.74). Fiyatın kendisi zaten TRY ise gerek yok.
 */
export function valuePortfolio(
  derived: DerivedPortfolio,
  prices: Map<string, LivePrice>,
  fxRates: Map<string, number>,
): PortfolioValueResult {
  const positions: PositionValue[] = [];
  const missingPriceSymbols: string[] = [];
  let totalMarketValueTry = 0;

  for (const [symbol, fifo] of derived.holdings) {
    if (fifo.quantity <= 1e-9) continue; // tamamen satılmış, pozisyon yok

    const live = prices.get(symbol);
    if (!live) {
      missingPriceSymbols.push(symbol);
      continue;
    }

    const fxToTry = live.currency === "TRY" ? 1 : (fxRates.get(live.currency) ?? 0);
    const currentPriceTry = live.price * fxToTry;
    const marketValueTry = currentPriceTry * fifo.quantity;
    const unrealizedPLTry = marketValueTry - fifo.costBasisTry;

    totalMarketValueTry += marketValueTry;

    positions.push({
      symbol,
      quantity: fifo.quantity,
      currentPriceTry,
      marketValueTry,
      costBasisTry: fifo.costBasisTry,
      unrealizedPLTry,
      realizedPLTry: fifo.realizedPLTry,
      isStale: live.isStale,
    });
  }

  return {
    positions,
    cashTry: derived.cashTry,
    totalValueTry: totalMarketValueTry + derived.cashTry,
    missingPriceSymbols,
  };
}
