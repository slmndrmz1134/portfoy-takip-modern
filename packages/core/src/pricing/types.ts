/**
 * Tüm fiyat adaptörlerinin ortak sözleşmesi.
 * KURAL: Başarısızlıkta her zaman `null` döner, ASLA `0` değil.
 * `0` bir fiyat kaynağının "bilmiyorum" demesinin yolu OLAMAZ — çağıran taraf
 * (cron job) son bilinen geçerli fiyatı (last-known-good) kullanmalı.
 */
export interface RawPrice {
  price: number;
  currency: string;
  source: string;
}

export type PriceFetcher = (symbol: string) => Promise<RawPrice | null>;
