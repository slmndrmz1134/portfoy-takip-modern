/**
 * Time-Weighted Return (TWR) — para akışından arındırılmış getiri.
 * "Yatırım stratejim ne kadar iyi performans gösterdi" sorusunun doğru cevabı.
 *
 * Girdi: zaman sırasına göre değerleme noktaları. Her nokta o ana kadar
 * gerçekleşen net_cash_flow'u taşır (o noktaya AKAN, bir önceki noktadan bu yana).
 *
 * Formül: her nakit akışı bir alt-dönem sınırıdır.
 *   r_i = (V_end - V_begin - CF_i) / V_begin
 *   TWR = Π(1 + r_i) - 1
 */

export interface ValuationPoint {
  /** ISO timestamp. */
  ts: string;
  /** Dönem sonu toplam değer. */
  value: number;
  /** Bu noktaya kadar (bir önceki noktadan bu yana) gerçekleşen net para girişi(+)/çıkışı(-). */
  netCashFlow: number;
}

export interface TwrResult {
  /** Yüzde olarak toplam TWR (örn. 12.5 = %12.5). */
  twrPercent: number;
  /** Her alt-dönemin getirisi (denetim/grafik amaçlı). */
  subPeriodReturns: number[];
}

/**
 * @param points Zaman sırasına göre sıralanmış değerleme noktaları (ilk nokta = dönem başlangıcı).
 *   points[0].netCashFlow, dönem başlangıcındaki ilk yatırım olarak kabul edilir ve
 *   ilk alt-dönemin r hesabına dahil EDİLMEZ (başlangıç sermayesi V_begin olarak kullanılır).
 */
export function calculateTWR(points: ValuationPoint[]): TwrResult {
  if (points.length < 2) {
    return { twrPercent: 0, subPeriodReturns: [] };
  }

  const subPeriodReturns: number[] = [];
  let compounded = 1;

  for (let i = 1; i < points.length; i++) {
    const begin = points[i - 1].value;
    const end = points[i].value;
    const cashFlow = points[i].netCashFlow;

    if (begin <= 0) {
      // Sıfır/negatif başlangıç değerinden bölme yapılamaz — bu alt-dönemi atla.
      continue;
    }

    const r = (end - begin - cashFlow) / begin;
    subPeriodReturns.push(r);
    compounded *= 1 + r;
  }

  return {
    twrPercent: (compounded - 1) * 100,
    subPeriodReturns,
  };
}
