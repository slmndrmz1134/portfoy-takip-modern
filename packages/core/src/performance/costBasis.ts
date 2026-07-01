import type { Lot, Transaction } from "../types";

export interface FifoResult {
  /** Kalan (satılmamış) lotlar, alış sırasına göre. */
  remainingLots: Lot[];
  /** Elde kalan toplam adet. */
  quantity: number;
  /** Kalan lotların toplam maliyeti (TRY). */
  costBasisTry: number;
  /** Bu sembol için gerçekleşen (satışlardan) toplam kâr/zarar (TRY). */
  realizedPLTry: number;
}

/**
 * Belirli bir sembolün BUY/SELL işlemlerinden FIFO (ilk giren ilk çıkar) maliyet esasını hesaplar.
 * Holdings elle tutulmaz — her zaman transactions'tan türetilir (tek doğruluk kaynağı).
 *
 * @param transactions Yalnızca tek bir sembole ait BUY/SELL kayıtları (herhangi bir sırada olabilir).
 */
export function calculateFifo(transactions: Transaction[]): FifoResult {
  const sorted = [...transactions]
    .filter((tx) => tx.txType === "BUY" || tx.txType === "SELL")
    .sort((a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime());

  const lots: Lot[] = [];
  let realizedPLTry = 0;

  for (const tx of sorted) {
    const qty = tx.quantity ?? 0;
    const unitPriceTry = (tx.price ?? 0) * (tx.fxToTry ?? 1);

    if (tx.txType === "BUY") {
      lots.push({ quantity: qty, unitCostTry: unitPriceTry, acquiredAt: tx.executedAt });
      continue;
    }

    // SELL: FIFO sırayla en eski lotlardan düş.
    let remainingToSell = qty;
    while (remainingToSell > 1e-9 && lots.length > 0) {
      const oldest = lots[0];
      const sellFromThisLot = Math.min(oldest.quantity, remainingToSell);

      realizedPLTry += sellFromThisLot * (unitPriceTry - oldest.unitCostTry);

      oldest.quantity -= sellFromThisLot;
      remainingToSell -= sellFromThisLot;

      if (oldest.quantity <= 1e-9) {
        lots.shift();
      }
    }
    // remainingToSell > 0 kalırsa (elde olandan fazla satış) — veri tutarsızlığıdır,
    // burada sessizce yutulmaz; çağıran taraf transactions'ı doğrulamalı.
  }

  const quantity = lots.reduce((sum, l) => sum + l.quantity, 0);
  const costBasisTry = lots.reduce((sum, l) => sum + l.quantity * l.unitCostTry, 0);

  return { remainingLots: lots, quantity, costBasisTry, realizedPLTry };
}
