# Portföy Takip — Modern Sürüm (v2) Planı

> **Amaç:** Mevcut Java/Spring + MySQL + Yahoo Finance portföy takip uygulamasını,
> **güvenilir performans hesabı** sunan modern bir mimariye taşımak.
> Web (Vercel) + Veritabanı/Auth (Supabase) + Android mobil (Expo/React Native).
>
> **Karar özeti (2026-07-01):**
> - Tam geçiş → **Next.js + TypeScript** (Vercel'de barınır)
> - Veritabanı + Auth + Cron → **Supabase (Postgres)**
> - Mobil → **Expo / React Native** (web ile kod paylaşır)
> - Öncelikli varlıklar → **BIST hisseleri, ABD hisseleri, Döviz + Altın**
> - Bütçe → **Sadece ücretsiz API katmanı**

---

## 1. Neden taşıyoruz? (Mevcut kodun güvenilirlik sorunları)

Mevcut Spring uygulaması çalışıyor ama performans sayısına **güvenilemez**. Kaynak koddan tespit edilen 3 kök sorun:

### 🔴 Sorun 1 — Yahoo Finance sessizce `0.0` döndürüyor
`StockService.getPrice()` hata yakaladığında `return 0.0` yapıyor. Yahoo, botsu istekleri
bloklayınca (ki sık olur) fiyat `0` oluyor. Sonuç zinciri:
- Portföy değeri sıfırlanır → `-%100` zarar görünür.
- `@Scheduled(fixedRate = 900000)` her 15 dakikada bu **çöp `0` değeri snapshot tablosuna yazar** →
  performans grafiği kalıcı olarak bozulur (geçmişe çöp nokta girer, geri alınamaz).

**Çözüm ilkesi:** Fiyat çekimi asla `0` dönmemeli. Son bilinen geçerli fiyat (`last-known-good`)
veritabanında `as_of` zaman damgasıyla saklanır; çekim başarısızsa eski fiyat + `stale` bayrağı sunulur.

### 🔴 Sorun 2 — Performans, para giriş/çıkışını görmezden geliyor
`PerformanceService.calculateSourcePerformance()` şunu yapıyor:
`(bugünkü değer − dönemin ilk snapshot değeri) / ilk snapshot`.
Bu **yanlış**: döneme yeni varlık eklersen (para yatırırsan) değer artar ve bu "kâr" gibi görünür.
Gerçek yatırım getirisi para akışından arındırılmalıdır.

**Çözüm ilkesi:** İşlem defteri (ledger) + nakit akışı kolonlu snapshot →
**TWR (Time-Weighted Return)** ve **XIRR (Money-Weighted Return)**. Bkz. Bölüm 5.

### 🔴 Sorun 3 — Altın çarpanları sabit kodlanmış
`gramTry * 1.64` (çeyrek), `* 3.28` (yarım), `* 6.56` (tam) — bunlar piyasa primini yansıtmayan
sabitler. Gerçek çeyrek altın, gram altının üstünde değişken bir primle işlem görür.

**Çözüm ilkesi:** Gram (has) altını spot XAU/USD × USDTRY ile **hesaplarız** (güvenilir taban);
sarrafiye primi için Türk altın API'si kullanılır, yoksa gram bazında gösterip primi ayrı işaretleriz.

### Ek teknik borçlar
- Her sayfa yüklemesinde varlık başına ardışık HTTP çağrısı (fiyat + kur) → yavaş, rate-limit riski.
- Snapshot çekimi `home()` içinde tetikleniyor → sayfa açılışı fiyat API'sine bağımlı.
- Kimlik doğrulama yok (tek kullanıcı, local MySQL, şifresiz root).

---

## 2. Hedef mimari

```
┌─────────────────────────────────────────────────────────────────────┐
│                          KULLANICI                                    │
│         Web (tarayıcı / PWA)            Android (Expo uygulaması)      │
└───────────────┬───────────────────────────────┬─────────────────────┘
                │                                 │
        ┌───────▼────────┐              ┌────────▼─────────┐
        │  Next.js (web) │              │  Expo/RN (mobil) │
        │   Vercel'de    │              │  Android build   │
        └───────┬────────┘              └────────┬─────────┘
                │        supabase-js istemcisi (paylaşılan @portfoy/core)
                └───────────────┬────────────────┘
                                │
                    ┌───────────▼────────────┐
                    │        SUPABASE         │
                    │  Postgres + Auth + RLS  │
                    │  Realtime + pg_cron     │
                    └───────────┬────────────┘
                                │
              ┌─────────────────▼──────────────────┐
              │   Fiyat çekme işi (Vercel Cron VEYA │
              │   Supabase Edge Function)           │
              │   → prices tablosuna yazar          │
              └─────────────────┬──────────────────┘
                                │
         ┌──────────────┬───────┴───────┬──────────────┐
         ▼              ▼               ▼              ▼
      Finnhub       İş Yatırım /     TCMB           XAU spot
     (ABD hisse)    Yahoo (.IS)    (resmi kur)     (gram altın)
                     (BIST)
```

**Katmanlar:**
- **Sunum:** Next.js (App Router, React Server Components) web + Expo (React Native) mobil.
- **Ortak mantık:** `packages/core` — TypeScript. Supabase istemcisi, tipler, TWR/XIRR hesapları,
  para birimi biçimlendirme. Hem web hem mobil aynı paketi kullanır (tek kaynak, tek doğruluk).
- **Backend:** Supabase. Postgres tabloları + Row Level Security (kullanıcı sadece kendi verisini görür)
  + Auth (e-posta/şifre veya Google) + Realtime (fiyat güncellemesi anında UI'ya düşer).
- **Fiyat toplama:** Zamanlanmış iş (Vercel Cron Job). Sayfa yüklemesinden **bağımsız**. Fiyatları
  `prices` tablosuna yazar; uygulama DB'den okur → hızlı, deterministik, rate-limit yemez.

**Neden bu yığın?**
- Vercel yalnızca Node/Python/Go serverless çalıştırır — Java barındırmaz. Next.js Vercel'in doğal çerçevesi.
- Supabase = Postgres + Auth + Realtime + Cron tek pakette; ücretsiz katmanı bu proje için fazlasıyla yeterli.
- Expo, web ile aynı TypeScript + supabase-js'i paylaşır → mobil için ayrı backend/mantık yazmayız.

---

## 3. Monorepo dizin yapısı

```
PortfoyTakip-Modern/
├── PLAN.md                      ← bu dosya
├── docs/
│   ├── veritabani-sema.sql      ← Supabase tablo şeması (taslak)
│   └── veri-kaynaklari.md       ← veri kaynağı detayları + güvenilirlik stratejisi
├── package.json                 ← pnpm/turborepo workspace kökü
├── apps/
│   ├── web/                     ← Next.js (Vercel)
│   │   ├── app/                 ← sayfalar (dashboard, portföy, işlemler)
│   │   ├── app/api/cron/prices/ ← Vercel Cron: fiyat çekme endpoint'i
│   │   └── ...
│   └── mobile/                  ← Expo / React Native (Android)
│       ├── app/                 ← ekranlar
│       └── ...
└── packages/
    └── core/                    ← PAYLAŞILAN mantık
        ├── supabase.ts          ← istemci + tip üretimi
        ├── types.ts
        ├── pricing/             ← fiyat kaynağı adaptörleri (finnhub, tcmb, bist, gold)
        └── performance/         ← TWR, XIRR, cost-basis hesapları
```

---

## 4. Veri kaynakları — ne, neden, güvenilirlik stratejisi

> Detaylı sürüm: `docs/veri-kaynaklari.md`. Özet karar tablosu:

| Varlık türü | Birincil kaynak | Yedek kaynak | Güncellik | Neden |
|---|---|---|---|---|
| **ABD hisse** (AAPL, NVDA) | **Finnhub** (ücretsiz 60/dk) | Yahoo `chart` | ~anlık | Gerçek zamanlı, kararlı, API anahtarlı, cömert limit |
| **BIST hisse** (THYAO, ASELS) | **İş Yatırım** public data | Yahoo `.IS` | 15dk gecikmeli | Ücretsiz katmanda BIST'in en güvenilir TR kaynağı; Yahoo yedek |
| **Döviz** (USDTRY, EURTRY) | **TCMB** resmi kur (günlük) | frankfurter.app / exchangerate.host | Günlük resmi + intraday yedek | TCMB resmi ve değişmez referans; intraday için ücretsiz FX |
| **Altın (gram/has)** | **Hesaplama**: XAU/USD × USDTRY ÷ 31.1035 | metals ücretsiz API | ~anlık | Spot'tan türetmek en şeffaf ve doğrulanabilir yöntem |
| **Altın (çeyrek/yarım/tam)** | TR sarrafiye API'si (varsa) | gram × işaretli prim | ~anlık | Sabit çarpan yerine gerçek prim; yoksa şeffafça "gram + prim" gösterilir |

**Güvenilirliği garanti eden 4 ilke (kaynaktan bağımsız):**
1. **Asla `0` dönme.** Her fiyat `prices` tablosunda `as_of` zamanıyla saklanır. Çekim başarısızsa
   son geçerli fiyat + `is_stale=true` sunulur; UI "veri gecikmeli" rozeti gösterir.
2. **Fiyatı sayfadan ayır.** Cron işi periyodik çeker → DB'ye yazar. Uygulama DB'den okur.
   Sayfa açılışı fiyat API'sine bağımlı değil → hızlı ve tutarlı.
3. **Kaynağı kaydet.** Her fiyat satırında `source` (finnhub/tcmb/isyatirim...) tutulur → hangi
   sayının nereden geldiğini denetleyebiliriz.
4. **Kuru resmi referansa sabitle.** Günlük değerleme kapanışında USDTRY için TCMB kuru kullanılır →
   raporlanan getiri, keyfi intraday kurdan etkilenmez, tekrarlanabilir olur.

---

## 5. Güvenilir hesaplama tasarımı (projenin kalbi)

Performansa güvenmek için "anlık değer farkı" yaklaşımını bırakıp **muhasebe temelli** modele geçiyoruz.

### 5.1. İşlem defteri (ledger) = tek doğruluk kaynağı
Her hareket değişmez bir kayıt olarak `transactions` tablosuna yazılır:
`BUY`, `SELL`, `DEPOSIT` (para yatırma), `WITHDRAW` (çekme), `DIVIDEND`, `FEE`.
**Varlık adetleri (holdings) bu defterden türetilir** — elle tutulmaz. Bu, sayının denetlenebilir olmasını sağlar.

### 5.2. Maliyet esası (cost basis)
Her varlık için lot bazlı takip: **FIFO** (ilk giren ilk çıkar) veya ağırlıklı ortalama.
Gerçekleşmemiş K/Z = güncel değer − kalan lotların maliyeti. Gerçekleşen K/Z = satışta hesaplanır.

### 5.3. Değerleme snapshot'ı (nakit akışı kolonlu)
Cron her gün (ve gün-içi birkaç kez) `portfolio_valuations` satırı yazar:
`portfolio_id, ts, total_value, net_cash_flow` — **net_cash_flow o gün yatırılan/çekilen paradır.**
Bu kolon, getiriyi para akışından arındırmanın anahtarıdır.

### 5.4. TWR — Time-Weighted Return (raporlanan "performans")
Endüstri standardı. Her nakit akışında dönemi böler, alt-dönem getirilerini bileşikler:

```
Alt-dönem getirisi rᵢ = (Vₑ − Vᵦ − Cᵢ) / Vᵦ
TWR = Π(1 + rᵢ) − 1
```
Para yatırma/çekmenin zamanlamasından etkilenmez → "yatırımlarım ne kadar iyi performans gösterdi"
sorusunun **doğru** cevabı. Grafikte gösterilecek ana metrik budur.

### 5.5. XIRR — Money-Weighted Return ("benim gerçek getirim")
Tüm nakit akışlarını ve son değeri sıfırlayan iç verim oranı (Newton-Raphson ile çözülür).
"Cebime giren gerçek yıllık getiri" sorusunun cevabı. TWR'nin yanında ikinci metrik olarak sunulur.

### 5.6. Neden ikisi birden?
- **TWR** → varlık seçimin/stratejin ne kadar iyi (para akışından bağımsız).
- **XIRR** → senin cebine düşen fiili getiri (para akışının zamanlaması dahil).
İkisini birlikte göstermek "performansa güvenilir erişim" isteğini tam karşılar.

---

## 6. Veritabanı şeması (Supabase Postgres — özet)

Tam SQL: `docs/veritabani-sema.sql`. Ana tablolar:

- `profiles` — kullanıcı (Supabase Auth'a bağlı)
- `portfolios` — portföyler (kullanıcıya ait, RLS korumalı)
- `instruments` — enstrüman kataloğu (symbol, market, currency, type)
- `transactions` — **değişmez işlem defteri** (BUY/SELL/DEPOSIT/...)
- `prices` — fiyat geçmişi (`symbol, price, currency, as_of, source, is_stale`) → last-known-good
- `portfolio_valuations` — günlük değerleme + `net_cash_flow` (TWR için)
- `fx_rates` — döviz kurları (TCMB + intraday, `source` ile)

**RLS (Row Level Security):** Her tabloda `user_id = auth.uid()` politikası → kullanıcı yalnızca
kendi verisini okur/yazar. Fiyat/kur tabloları herkese okunur (paylaşımlı piyasa verisi).

---

## 7. Yol haritası (fazlar)

### Faz 0 — Temel (1-2 gün)
- [ ] Supabase projesi oluştur, şemayı + RLS politikalarını uygula (`docs/veritabani-sema.sql`).
- [ ] Turborepo + pnpm workspace iskeleti (`apps/web`, `apps/mobile`, `packages/core`).
- [ ] Supabase Auth (e-posta + Google) kurulumu.

### Faz 1 — Fiyat altyapısı (güvenilirliğin temeli)
- [ ] `packages/core/pricing` adaptörleri: Finnhub, İş Yatırım/Yahoo (BIST), TCMB, gram altın.
- [ ] Vercel Cron endpoint `/api/cron/prices` → tüm tutulan sembolleri çeker, `prices`+`fx_rates`'e yazar.
- [ ] Last-known-good + `is_stale` mantığı. **Hiçbir yolda `0` dönmediğini test et.**

### Faz 2 — İşlem defteri + değerleme
- [ ] `transactions` CRUD (BUY/SELL/DEPOSIT/WITHDRAW).
- [ ] Holdings ve cost-basis (FIFO) türetme fonksiyonları.
- [ ] Günlük `portfolio_valuations` yazan cron (net_cash_flow dahil).

### Faz 3 — Performans motoru
- [ ] `packages/core/performance`: TWR ve XIRR fonksiyonları + birim testleri (bilinen örneklerle doğrula).
- [ ] Dönem seçimi (1G/1H/1A/3A/6A/1Y/YTD/Tümü), gerçekleşen/gerçekleşmemiş K/Z.

### Faz 4 — Web arayüzü (Next.js)
- [ ] Dashboard: toplam değer, TWR, XIRR, günlük değişim, dağılım (pasta), performans grafiği.
- [ ] Portföy detay, işlem ekleme/satma, işlem geçmişi. Realtime fiyat rozeti.

### Faz 5 — Android (Expo)
- [ ] Aynı `packages/core` ile Expo uygulaması: giriş, dashboard, portföy, işlem ekleme.
- [ ] Android build (EAS Build) → APK/AAB, ileride Play Store.

### Faz 6 — Cila
- [ ] Fiyat gecikme/stale uyarıları, hata durumları, boş durum ekranları.
- [ ] Mevcut MySQL verisinin (varsa) Supabase'e taşınması için tek seferlik betik.

---

## 8. Güvenlik ve gizli anahtarlar
- API anahtarları (Finnhub) yalnızca **sunucu tarafında** (Vercel env / Supabase secret) tutulur,
  istemciye sızmaz. Fiyat çekimi cron/edge function içinde yapılır.
- Supabase `service_role` anahtarı sadece cron/sunucuda; istemcide `anon` anahtar + RLS.
- `.env` dosyaları git'e girmez (`.gitignore`).

## 9. Açık noktalar / sonraki kararlar
- BIST için İş Yatırım endpoint'inin güncel yanıt biçimi Faz 1'de doğrulanacak (değişebilir); değişirse
  Yahoo `.IS` birincil, TR alternatifleri yedek yapılır.
- Sarrafiye altın primi için ücretsiz güvenilir TR kaynağı Faz 1'de araştırılacak; bulunamazsa gram bazında
  değer + "prim manuel" seçeneği sunulur.
- Kripto (BTC/ETH) sonraki sürüme bırakıldı — eklenince CoinGecko/Binance ücretsiz ve güvenilir.

---

*Bu plan, mevcut Spring uygulamasının kaynak kodu incelenerek (StockService, PortfolioService,
PerformanceService, entity'ler, controller) hazırlandı. Proje bu klasörde geliştirilmeye devam edecek.*
