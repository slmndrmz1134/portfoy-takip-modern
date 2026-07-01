import type { RawPrice } from "./types";
import { fetchYahooPrice } from "./yahoo";

/**
 * BIST hisseleri için birincil kaynak — İş Yatırım public data (15 dk gecikmeli, ücretsiz).
 *
 * NOT (Faz 1 doğrulama gerekiyor): İş Yatırım'ın public uç biçimi zamanla değişebilir; bu yüzden
 * `İş Yatırım -> başarısız -> Yahoo .IS` şeklinde katmanlı yedekleme kuruldu. Uç adresi burada
 * teyit edilip güncellenecek — şu an placeholder bırakıldı, yedek (Yahoo) devrede.
 *
 * @param symbol Çıplak BIST kodu, örn. "THYAO" (Yahoo yedeği için otomatik ".IS" eklenir).
 */
export async function fetchBistPrice(symbol: string): Promise<RawPrice | null> {
  const primary = await fetchIsYatirimPrice(symbol);
  if (primary) return primary;

  // Yedek: Yahoo .IS sembolü
  return fetchYahooPrice(`${symbol}.IS`);
}

async function fetchIsYatirimPrice(symbol: string): Promise<RawPrice | null> {
  try {
    // TODO(Faz 1): İş Yatırım'ın güncel public JSON ucunu doğrula ve buraya bağla.
    // Şimdilik uç doğrulanana kadar null döndürür — çağıran otomatik Yahoo'ya düşer.
    void symbol;
    return null;
  } catch {
    return null;
  }
}
