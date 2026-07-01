import { describe, expect, it } from "vitest";
import { derivePortfolio } from "./holdings";
import type { Transaction } from "../types";

function tx(partial: Partial<Transaction>): Transaction {
  return {
    id: 0,
    userId: "u1",
    portfolioId: 1,
    symbol: null,
    txType: "DEPOSIT",
    quantity: null,
    price: null,
    currency: "TRY",
    fxToTry: 1,
    cashAmount: null,
    fee: 0,
    executedAt: "2026-01-01",
    note: null,
    ...partial,
  };
}

describe("derivePortfolio", () => {
  it("para yatırmayı nakit bakiyesine ekler", () => {
    const result = derivePortfolio([tx({ txType: "DEPOSIT", cashAmount: 10000 })]);
    expect(result.cashTry).toBe(10000);
    expect(result.holdings.size).toBe(0);
  });

  it("BUY nakit bakiyesini düşürür ve holding oluşturur", () => {
    const result = derivePortfolio([
      tx({ txType: "DEPOSIT", cashAmount: 10000 }),
      tx({ txType: "BUY", symbol: "AAPL", quantity: 5, price: 200, fxToTry: 30, fee: 10 }),
    ]);
    // maliyet = 5*200*30 + 10 = 30010
    expect(result.cashTry).toBeCloseTo(10000 - 30010, 5);
    const holding = result.holdings.get("AAPL");
    expect(holding?.quantity).toBe(5);
    expect(holding?.costBasisTry).toBe(30000); // FIFO maliyeti fee içermez (fiyat*kur)
  });

  it("SELL nakit bakiyesini artırır ve realized P&L hesaplar", () => {
    const result = derivePortfolio([
      tx({ txType: "DEPOSIT", cashAmount: 10000 }),
      tx({ txType: "BUY", symbol: "AAPL", quantity: 5, price: 200, fxToTry: 30, executedAt: "2026-01-01" }),
      tx({ txType: "SELL", symbol: "AAPL", quantity: 5, price: 250, fxToTry: 30, executedAt: "2026-02-01" }),
    ]);
    // satış geliri = 5*250*30 = 37500
    const expectedCash = 10000 - 5 * 200 * 30 + 5 * 250 * 30;
    expect(result.cashTry).toBeCloseTo(expectedCash, 5);
    expect(result.holdings.get("AAPL")?.quantity).toBe(0);
    expect(result.holdings.get("AAPL")?.realizedPLTry).toBe(5 * (250 - 200) * 30);
  });

  it("WITHDRAW nakit bakiyesini düşürür", () => {
    const result = derivePortfolio([
      tx({ txType: "DEPOSIT", cashAmount: 10000 }),
      tx({ txType: "WITHDRAW", cashAmount: 3000 }),
    ]);
    expect(result.cashTry).toBe(7000);
  });

  it("işlem sırasına bakmaksızın tarihe göre işler", () => {
    const result = derivePortfolio([
      tx({ txType: "WITHDRAW", cashAmount: 1000, executedAt: "2026-03-01" }),
      tx({ txType: "DEPOSIT", cashAmount: 5000, executedAt: "2026-01-01" }),
    ]);
    expect(result.cashTry).toBe(4000);
  });
});
