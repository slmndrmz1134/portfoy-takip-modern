import { describe, expect, it } from "vitest";
import { calculateTWR } from "./twr";

describe("calculateTWR", () => {
  it("para akışı olmadan basit büyümeyi doğru hesaplar", () => {
    // 1000 -> 1100, ara akış yok: %10 getiri.
    const result = calculateTWR([
      { ts: "2026-01-01", value: 1000, netCashFlow: 0 },
      { ts: "2026-02-01", value: 1100, netCashFlow: 0 },
    ]);
    expect(result.twrPercent).toBeCloseTo(10, 5);
  });

  it("para yatırmayı 'kâr' gibi göstermez", () => {
    // 1000 değer varken 500 TL yatırılıyor (değer 1500 oluyor, gerçek getiri sıfır).
    const result = calculateTWR([
      { ts: "2026-01-01", value: 1000, netCashFlow: 0 },
      { ts: "2026-01-15", value: 1500, netCashFlow: 500 }, // sadece yatırım, piyasa hareketi yok
    ]);
    expect(result.twrPercent).toBeCloseTo(0, 5);
  });

  it("birden fazla alt-dönemi doğru bileşikler", () => {
    // Dönem 1: 1000 -> 1100 (%10). Ara: 400 yatır (1500). Dönem 2: 1500 -> 1650 (%10).
    // Bileşik: 1.10 * 1.10 - 1 = %21
    const result = calculateTWR([
      { ts: "2026-01-01", value: 1000, netCashFlow: 0 },
      { ts: "2026-02-01", value: 1500, netCashFlow: 400 }, // 1100 + 400 yatırım = 1500
      { ts: "2026-03-01", value: 1650, netCashFlow: 0 },
    ]);
    expect(result.twrPercent).toBeCloseTo(21, 5);
  });

  it("para çekmeyi 'zarar' gibi göstermez", () => {
    // 1000 -> 600 (400 TL çekildi, piyasa hareketi yok): gerçek getiri sıfır.
    const result = calculateTWR([
      { ts: "2026-01-01", value: 1000, netCashFlow: 0 },
      { ts: "2026-01-15", value: 600, netCashFlow: -400 },
    ]);
    expect(result.twrPercent).toBeCloseTo(0, 5);
  });

  it("tek noktada 0 döndürür", () => {
    const result = calculateTWR([{ ts: "2026-01-01", value: 1000, netCashFlow: 0 }]);
    expect(result.twrPercent).toBe(0);
  });
});
