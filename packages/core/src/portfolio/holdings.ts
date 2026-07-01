import type { Transaction } from "../types";
import { calculateFifo, type FifoResult } from "../performance/costBasis";

export interface DerivedPortfolio {
  /** Sembol -> FIFO sonucu (adet, maliyet, gerçekleşen K/Z). */
  holdings: Map<string, FifoResult>;
  /** Nakit bakiyesi (TRY) — DEPOSIT/WITHDRAW/BUY/SELL/FEE/DIVIDEND'den türetilir. */
  cashTry: number;
}

/**
 * Portföyün TÜM işlem geçmişinden anlık durumunu türetir.
 * Holdings ve nakit bakiyesi hiçbir yerde elle tutulmaz — bu fonksiyon tek doğruluk
 * kaynağıdır (transactions tablosu). Denetlenebilirlik için: aynı transactions listesi
 * her zaman aynı sonucu üretir.
 */
export function derivePortfolio(transactions: Transaction[]): DerivedPortfolio {
  const bySymbol = new Map<string, Transaction[]>();
  let cashTry = 0;

  const sorted = [...transactions].sort(
    (a, b) => new Date(a.executedAt).getTime() - new Date(b.executedAt).getTime(),
  );

  for (const tx of sorted) {
    const feeTry = tx.fee ?? 0;

    switch (tx.txType) {
      case "DEPOSIT":
        cashTry += tx.cashAmount ?? 0;
        break;
      case "WITHDRAW":
        cashTry -= tx.cashAmount ?? 0;
        break;
      case "DIVIDEND":
        cashTry += (tx.cashAmount ?? 0) - feeTry;
        break;
      case "FEE":
        cashTry -= tx.cashAmount ?? feeTry;
        break;
      case "BUY": {
        const cost = (tx.quantity ?? 0) * (tx.price ?? 0) * (tx.fxToTry ?? 1) + feeTry;
        cashTry -= cost;
        if (tx.symbol) {
          const list = bySymbol.get(tx.symbol) ?? [];
          list.push(tx);
          bySymbol.set(tx.symbol, list);
        }
        break;
      }
      case "SELL": {
        const proceeds = (tx.quantity ?? 0) * (tx.price ?? 0) * (tx.fxToTry ?? 1) - feeTry;
        cashTry += proceeds;
        if (tx.symbol) {
          const list = bySymbol.get(tx.symbol) ?? [];
          list.push(tx);
          bySymbol.set(tx.symbol, list);
        }
        break;
      }
    }
  }

  const holdings = new Map<string, FifoResult>();
  for (const [symbol, txs] of bySymbol) {
    holdings.set(symbol, calculateFifo(txs));
  }

  return { holdings, cashTry };
}
