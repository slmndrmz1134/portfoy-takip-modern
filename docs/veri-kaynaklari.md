# Veri Kaynakları — Detay ve Güvenilirlik Stratejisi

> Bütçe: **sadece ücretsiz katman.** Öncelikli varlıklar: BIST hisse, ABD hisse, Döviz + Altın.

## Neden Yahoo Finance'ı birincil olmaktan çıkarıyoruz?
Mevcut kod Yahoo'nun **resmi olmayan** (undocumented) `query1/query2.finance.yahoo.com` uçlarını
tarayıcı taklidi header'la kullanıyor. Sorunlar:
- SLA yok; Yahoo istediği zaman bloklar/limitler → `getPrice` sessizce `0.0` döner.
- Hız limiti belirsiz; her sayfa yüklemesinde varlık başına çağrı yapılıyor.
- Tek nokta arıza: Yahoo düşerse her şey (fiyat, kur, altın) düşer.

Yahoo tamamen atılmıyor — **BIST için yedek** olarak kalıyor (`.IS` sembolleri), ama artık
tek kaynak ve senkron sayfa bağımlılığı değil.

---

## Kaynak kaynak seçim ve gerekçe

### 1. ABD hisseleri → Finnhub (birincil)
- **Ücretsiz:** dakikada 60 istek, gerçek zamanlı ABD fiyatı, WebSocket desteği.
- **Neden:** API anahtarlı, kararlı, cömert limit. Cron ile önbelleğe alınca limit rahat yeter.
- **Uç:** `GET /quote?symbol=AAPL&token=...` → `c` (current price).
- **Yedek:** Yahoo `chart` (`regularMarketPrice`).

### 2. BIST hisseleri → İş Yatırım public data (birincil), Yahoo `.IS` (yedek)
- Ücretsiz katmanda BIST'in en zayıf halka olduğu **dürüstçe kabul edilmeli.** Çoğu global ücretsiz
  API (Twelve Data free, Alpha Vantage) BIST'i ya vermez ya "pro" plana koyar.
- **İş Yatırım** web sitesinin arka planda kullandığı public data uçları TR projelerinde yaygın kullanılır,
  15 dk gecikmeli ve ücretsizdir. Yanıt biçimi zamanla değişebildiği için Faz 1'de doğrulanacak.
- **Yedek:** Yahoo `THYAO.IS` → `regularMarketPrice`.
- **Güvenilirlik:** Her iki kaynak da başarısızsa → `prices` tablosundaki son geçerli fiyat (stale).

### 3. Döviz (USDTRY, EURTRY) → TCMB (resmi, birincil)
- **TCMB günlük kur:** `https://www.tcmb.gov.tr/kurlar/today.xml` — resmi, değişmez referans, ücretsiz.
  Yaklaşık 15:30'da yayınlanır; hafta sonu/tatil güncellenmez (son iş günü geçerli).
- **Neden birincil:** Günlük değerleme kapanışını resmi kura sabitlemek → raporlanan getiri
  tekrarlanabilir ve keyfi intraday kurdan bağımsız olur.
- **Intraday yedek:** `frankfurter.app` (ECB verisi, anahtarsız, ücretsiz) veya `exchangerate.host`.
  Gün içi anlık gösterim için; resmi kapanış TCMB'den.

### 4. Altın — gram/has (birincil: hesaplama)
- **Gram has altın (TRY)** = `(XAU_USD_ons / 31.1034768) × USDTRY`.
  - XAU/USD spot: Finnhub `OANDA:XAU_USD` ya da Yahoo `GC=F` (mevcut kodun kullandığı).
  - Bu türetme **şeffaf ve doğrulanabilir** — kullanıcı sayının nasıl çıktığını görebilir.
- **Sarrafiye (çeyrek/yarım/tam):** Sabit çarpan (`1.64` vb.) YANLIŞ; gerçek prim değişkendir.
  - Faz 1'de ücretsiz TR sarrafiye API'si araştırılır (ör. truncgil/haremaltin türevleri).
  - Bulunamazsa: gram değeri + **kullanıcının girebildiği/güncellenebilen prim** olarak gösterilir,
    "yaklaşık" rozetiyle. Sahte kesinlik yerine dürüst yaklaşıklık.

---

## Güvenilirlik mimarisi (kaynaktan bağımsız)

### İlke 1 — "Asla 0 dönme" garantisi
```
fiyatGetir(symbol):
    taze = kaynaktanCek(symbol)           # finnhub/isyatirim/tcmb...
    eğer taze geçerli (>0 ve makul):
        prices tablosuna yaz (as_of=now, source=..., is_stale=false)
        return taze
    değilse:
        son = prices tablosundan son geçerli (symbol)
        return { price: son.price, as_of: son.as_of, is_stale: true }   # 0 DEĞİL
```

### İlke 2 — Fiyatı sayfadan ayır (cron temelli)
- Vercel Cron (`vercel.json` → `crons`) `/api/cron/prices`'ı örn. 15 dk'da bir çağırır.
- Cron, kullanıcıların **tuttuğu tüm sembolleri** toplar, kaynaklardan çeker, `prices`/`fx_rates`'e yazar.
- Web/mobil uygulama **sadece DB'den okur** → sayfa hızlı, API limiti sayfa trafiğiyle şişmez.
- Piyasa kapalıyken çekim seyrekleşir (gereksiz snapshot ve limit tüketimi önlenir).

### İlke 3 — Kaynağı ve tazeliği kaydet
Her `prices` satırında `source` ve `is_stale`. UI'da "veri 42 dk gecikmeli (Yahoo yedek)" gibi
şeffaf rozet. Denetlenebilirlik = güven.

### İlke 4 — Makullük kontrolü (sanity check)
Yeni fiyat, son fiyattan %X'ten fazla saparsa (ör. hisse için tek çekimde %40) şüpheli sayılır,
ikinci kaynakla doğrulanır. Bozuk `0`/uçuk değerlerin snapshot'a girmesini engeller.

---

## Ücretsiz limit özeti (kabaca)
| Kaynak | Ücretsiz limit | Not |
|---|---|---|
| Finnhub | 60 istek/dk | ABD hisse gerçek zamanlı |
| Yahoo (resmi değil) | belirsiz | yedek, önbellekli |
| İş Yatırım | belirsiz/ücretsiz | 15 dk gecikmeli BIST |
| TCMB today.xml | sınırsız (statik dosya) | günlük resmi kur |
| frankfurter.app | anahtarsız, cömert | intraday FX yedek |

Cron 15 dk'da bir + önbellek ile bu limitler tek kullanıcı için fazlasıyla yeterli.
