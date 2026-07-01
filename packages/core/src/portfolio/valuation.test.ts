import { describe, expect, it } from "vitest";
import { derivePortfolio } from "./holdings";
import { valuePortfolio } from "./valuation";
import type { Transaction } from "../types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 0, userId: "u1", portfolioId: 1, symbol: null, txType: "DEPOSIT",
    quantity: null, price: null, currency: "TRY", fxToTry: 1, cashAmount: null,
    fee: 0, executedAt: "2026-01-01", note: null, ...partial,
  };
}

describe("valuePortfolio", () => {
  it("ABD hissesini güncel kurla TRY'ye çevirip değerler", () => {
    const derived = derivePortfolio([
      tx({ txType: "DEPOSIT", cashAmount: 100000 }),
      tx({ txType: "BUY", symbol: "AAPL", quantity: 10, price: 200, fxToTry: 30 }),
    ]);
    // maliyet: 10*200*30 = 60000, kalan nakit: 40000

    const prices = new Map([["AAPL", { price: 220, currency: "USD", isStale: false }]]);
    const fxRates = new Map([["USD", 32]]); // kur yükseldi

    const result = valuePortfolio(derived, prices, fxRates);

    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].currentPriceTry).toBeCloseTo(220 * 32, 5);
    expect(result.positions[0].marketValueTry).toBeCloseTo(220 * 32 * 10, 5);
    expect(result.positions[0].costBasisTry).toBe(60000);
    expect(result.cashTry).toBeCloseTo(40000, 5);
    expect(result.totalValueTry).toBeCloseTo(220 * 32 * 10 + 40000, 5);
  });

  it("fiyatı olmayan sembolü missingPriceSymbols'e ekler, toplama katmaz", () => {
    const derived = derivePortfolio([
      tx({ txType: "BUY", symbol: "UNKNOWN", quantity: 1, price: 100, fxToTry: 1 }),
    ]);
    const result = valuePortfolio(derived, new Map(), new Map());
    expect(result.missingPriceSymbols).toEqual(["UNKNOWN"]);
    expect(result.positions).toHaveLength(0);
    expect(result.totalValueTry).toBe(derived.cashTry);
  });

  it("TRY cinsinden fiyatlarda (BIST/altın) kur çevrimi atlanır", () => {
    const derived = derivePortfolio([
      tx({ txType: "BUY", symbol: "THYAO", quantity: 100, price: 250, fxToTry: 1 }),
    ]);
    const prices = new Map([["THYAO", { price: 260, currency: "TRY", isStale: false }]]);
    const result = valuePortfolio(derived, prices, new Map());
    expect(result.positions[0].currentPriceTry).toBe(260);
    expect(result.positions[0].marketValueTry).toBe(26000);
  });

  it("tamamen kapanmış pozisyonu (0 adet) listelemez", () => {
    const derived = derivePortfolio([
      tx({ txType: "BUY", symbol: "AAPL", quantity: 5, price: 200, fxToTry: 30 }),
      tx({ txType: "SELL", symbol: "AAPL", quantity: 5, price: 250, fxToTry: 30 }),
    ]);
    const prices = new Map([["AAPL", { price: 260, currency: "USD", isStale: false }]]);
    const result = valuePortfolio(derived, prices, new Map([["USD", 30]]));
    expect(result.positions).toHaveLength(0);
  });
});
