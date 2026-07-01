import type { LivePrice, Transaction } from "@portfoy/core";
import { calculateXIRR, type CashFlow } from "@portfoy/core";

/**
 * Semboller için fiyat haritasından döviz kuru haritası türetir.
 * FX enstrümanlarının sembolü doğrudan para birimi kodu olarak tutulur (ör. "USD"),
 * bu yüzden latest_prices içindeki "USD" satırı zaten USD->TRY kurunu verir.
 */
export function buildFxRatesMap(prices: Map<string, LivePrice>): Map<string, number> {
  const fxRates = new Map<string, number>();
  for (const [symbol, live] of prices) {
    if (live.currency === "TRY" && /^[A-Z]{3}$/.test(symbol)) {
      fxRates.set(symbol, live.price);
    }
  }
  return fxRates;
}

/**
 * Portföyün XIRR'ini (para ağırlıklı gerçek getiri) hesaplar.
 * Yalnızca DIŞARIDAN gelen nakit akışları (DEPOSIT/WITHDRAW) + bugünkü güncel değer
 * kullanılır — BUY/SELL portföy İÇİ hareketlerdir, kullanıcının cebine giren/çıkan
 * parayı temsil etmez, bu yüzden XIRR'e dahil edilmez.
 */
export function computeXirr(transactions: Transaction[], currentValueTry: number): number | null {
  const flows: CashFlow[] = [];

  for (const tx of transactions) {
    if (tx.txType === "DEPOSIT") {
      flows.push({ date: tx.executedAt, amount: -(tx.cashAmount ?? 0) });
    } else if (tx.txType === "WITHDRAW") {
      flows.push({ date: tx.executedAt, amount: tx.cashAmount ?? 0 });
    }
  }

  if (flows.length === 0) return null;

  flows.push({ date: new Date().toISOString(), amount: currentValueTry });
  return calculateXIRR(flows);
}
