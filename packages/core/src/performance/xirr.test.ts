import { describe, expect, it } from "vitest";
import { calculateXIRR } from "./xirr";

describe("calculateXIRR", () => {
  it("tam 1 yıl / %10 basit getiriyi doğru çözer", () => {
    // 1000 yatır, tam 1 yıl sonra 1100 al -> %10 XIRR.
    const result = calculateXIRR([
      { date: "2025-01-01", amount: -1000 },
      { date: "2026-01-01", amount: 1100 },
    ]);
    expect(result).not.toBeNull();
    expect(result!).toBeCloseTo(10, 0);
  });

  it("ara nakit akışlı bilinen örneği çözer", () => {
    // Klasik XIRR örneği: -10000 (başlangıç), +2750 (6 ay), +4250 (1 yıl), +3250 (18 ay), +2750 (2 yıl)
    // Excel/Sheets XIRR ile karşılaştırılabilir yakın bir değer bekleriz.
    const result = calculateXIRR([
      { date: "2024-01-01", amount: -10000 },
      { date: "2024-07-01", amount: 2750 },
      { date: "2025-01-01", amount: 4250 },
      { date: "2025-07-01", amount: 3250 },
      { date: "2026-01-01", amount: 2750 },
    ]);
    expect(result).not.toBeNull();
    // Bağımsız bisection yöntemiyle doğrulandı: gerçek IRR ≈ %24.397.
    expect(result!).toBeCloseTo(24.397, 1);
  });

  it("yalnızca negatif akışlarda null döner (0 değil)", () => {
    const result = calculateXIRR([
      { date: "2025-01-01", amount: -1000 },
      { date: "2025-06-01", amount: -500 },
    ]);
    expect(result).toBeNull();
  });

  it("tek akışta null döner", () => {
    const result = calculateXIRR([{ date: "2025-01-01", amount: -1000 }]);
    expect(result).toBeNull();
  });
});
