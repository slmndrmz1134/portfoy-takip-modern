/**
 * XIRR — Money-Weighted Return (para ağırlıklı iç verim oranı).
 * "Cebime giren gerçek yıllık getiri" sorusunun cevabı; nakit akışlarının
 * ZAMANLAMASINI da hesaba katar (TWR'nin aksine).
 *
 * Standart tanım: tüm nakit akışlarını (yatırım = negatif, çekiş/güncel değer = pozitif)
 * ve son gün toplam portföy değerini sıfırlayan r oranı:
 *   Σ CF_i / (1 + r)^((t_i - t_0) / 365) = 0
 * Newton-Raphson ile sayısal olarak çözülür.
 */

export interface CashFlow {
  /** ISO timestamp. */
  date: string;
  /** Yatırılan para NEGATİF, alınan para/güncel değer POZİTİF. */
  amount: number;
}

const MAX_ITERATIONS = 100;
const TOLERANCE = 1e-7;

function xnpv(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const years = (new Date(cf.date).getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
    return sum + cf.amount / Math.pow(1 + rate, years);
  }, 0);
}

function xnpvDerivative(rate: number, flows: CashFlow[], t0: number): number {
  return flows.reduce((sum, cf) => {
    const years = (new Date(cf.date).getTime() - t0) / (365 * 24 * 60 * 60 * 1000);
    if (years === 0) return sum;
    return sum - (years * cf.amount) / Math.pow(1 + rate, years + 1);
  }, 0);
}

/**
 * @param cashFlows En az 2 akış gerekir: en az bir negatif (yatırım) ve bir pozitif
 *   (çekiş veya dönem sonu güncel değer). Tarihe göre sıralı olmak ZORUNDA değildir.
 * @param guess Başlangıç tahmini (varsayılan %10).
 * @returns Yüzde olarak yıllık iç verim oranı (örn. 8.3 = %8.3), yakınsamazsa null.
 */
export function calculateXIRR(cashFlows: CashFlow[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;

  const hasPositive = cashFlows.some((cf) => cf.amount > 0);
  const hasNegative = cashFlows.some((cf) => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const t0 = Math.min(...cashFlows.map((cf) => new Date(cf.date).getTime()));

  let rate = guess;
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    const npv = xnpv(rate, cashFlows, t0);
    const derivative = xnpvDerivative(rate, cashFlows, t0);

    if (Math.abs(derivative) < 1e-10) break; // türev sıfıra çok yakın, ıraksama riski

    const newRate = rate - npv / derivative;

    if (Math.abs(newRate - rate) < TOLERANCE) {
      return newRate * 100;
    }
    rate = newRate;

    // Rate -1'e (yani -%100) yakınsa matematiksel olarak anlamsız hale gelir.
    if (rate <= -1) rate = -0.999999;
  }

  // Newton-Raphson yakınsamadıysa null döndür (0 DEĞİL — sessiz yanlış sonuç vermek yerine).
  return null;
}
