import type { RawPrice } from "./types";

/**
 * TCMB (Türkiye Cumhuriyet Merkez Bankası) resmi günlük kur — birincil FX kaynağı.
 * https://www.tcmb.gov.tr/kurlar/today.xml
 * Ücretsiz, anahtarsız, resmi referans. ~15:30'da güncellenir; hafta sonu/tatilde
 * son iş gününün kuru geçerlidir (TCMB tarafı otomatik yönetir).
 *
 * @param currencyCode ISO kod, örn. "USD", "EUR".
 */
export async function fetchTcmbRate(currencyCode: string): Promise<RawPrice | null> {
  try {
    const res = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;

    const xml = await res.text();
    // Basit regex ile ilgili <Currency Kod="USD">...<BanknoteSelling>...</BanknoteSelling></Currency> bloğunu bul.
    const currencyBlockRegex = new RegExp(
      `<Currency[^>]*Kod="${currencyCode}"[^>]*>([\\s\\S]*?)</Currency>`,
      "i",
    );
    const block = xml.match(currencyBlockRegex)?.[1];
    if (!block) return null;

    const sellingMatch = block.match(/<BanknoteSelling>([\d.,]+)<\/BanknoteSelling>/);
    const rateStr = sellingMatch?.[1];
    if (!rateStr) return null;

    const rate = parseFloat(rateStr.replace(",", "."));
    if (!rate || rate <= 0) return null;

    return { price: rate, currency: "TRY", source: "tcmb" };
  } catch {
    return null;
  }
}

/**
 * Intraday yedek — frankfurter.app (ECB tabanlı, anahtarsız, ücretsiz).
 * TCMB'nin gün içi güncellenmediği durumlarda (piyasa saatleri) kullanılabilir.
 */
export async function fetchFrankfurterRate(currencyCode: string): Promise<RawPrice | null> {
  try {
    const url = `https://api.frankfurter.app/latest?from=${currencyCode}&to=TRY`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;

    const data = (await res.json()) as { rates?: Record<string, number> };
    const rate = data.rates?.TRY;
    if (!rate || rate <= 0) return null;

    return { price: rate, currency: "TRY", source: "frankfurter" };
  } catch {
    return null;
  }
}

/** TCMB → başarısızsa frankfurter yedeği. */
export async function fetchFxRateToTry(currencyCode: string): Promise<RawPrice | null> {
  if (currencyCode === "TRY") return { price: 1, currency: "TRY", source: "identity" };
  const primary = await fetchTcmbRate(currencyCode);
  if (primary) return primary;
  return fetchFrankfurterRate(currencyCode);
}
