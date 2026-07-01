import { describe, expect, it } from "vitest";
import { calculateFifo } from "./costBasis";
import type { Transaction } from "../types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 0,
    userId: "u1",
    portfolioId: 1,
    symbol: "AAPL",
    txType: "BUY",
    quantity: null,
    price: null,
    currency: "USD",
    fxToTry: 1,
    cashAmount: null,
    fee: 0,
    executedAt: "2026-01-01",
    note: null,
    ...partial,
  };
}

describe("calculateFifo", () => {
  it("tek alışta maliyeti doğru hesaplar", () => {
    const result = calculateFifo([
      tx({ txType: "BUY", quantity: 10, price: 100, fxToTry: 1, executedAt: "2026-01-01" }),
    ]);
    expect(result.quantity).toBe(10);
    expect(result.costBasisTry).toBe(1000);
    expect(result.realizedPLTry).toBe(0);
  });

  it("FIFO sırasına göre en eski lottan düşer", () => {
    // 10 adet @100 al, 10 adet @200 al, sonra 12 adet @250 sat.
    // FIFO: ilk 10 adet (maliyet 100) tamamen satılır, 2 adet ikinci lottan (maliyet 200) satılır.
    // Kalan: 8 adet @200 = 1600 maliyet.
    // Realized PL: 10*(250-100) + 2*(250-200) = 1500 + 100 = 1600
    const result = calculateFifo([
      tx({ txType: "BUY", quantity: 10, price: 100, executedAt: "2026-01-01" }),
      tx({ txType: "BUY", quantity: 10, price: 200, executedAt: "2026-02-01" }),
      tx({ txType: "SELL", quantity: 12, price: 250, executedAt: "2026-03-01" }),
    ]);
    expect(result.quantity).toBe(8);
    expect(result.costBasisTry).toBe(1600);
    expect(result.realizedPLTry).toBe(1600);
  });

  it("işlem sırasına bakmaksızın tarihe göre sıralar", () => {
    const result = calculateFifo([
      tx({ txType: "SELL", quantity: 5, price: 150, executedAt: "2026-02-01" }),
      tx({ txType: "BUY", quantity: 5, price: 100, executedAt: "2026-01-01" }),
    ]);
    expect(result.quantity).toBe(0);
    expect(result.realizedPLTry).toBe(250); // 5 * (150 - 100)
  });

  it("kur çevrimini (fxToTry) maliyete uygular", () => {
    // 10 adet @ $100, kur 30 TRY/USD -> maliyet 30000 TRY
    const result = calculateFifo([
      tx({ txType: "BUY", quantity: 10, price: 100, fxToTry: 30, executedAt: "2026-01-01" }),
    ]);
    expect(result.costBasisTry).toBe(30000);
  });
});
