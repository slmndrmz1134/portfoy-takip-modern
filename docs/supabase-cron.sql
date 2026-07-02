-- ============================================================
-- Supabase pg_cron + pg_net Kurulumu
-- Vercel Cron yerine fiyat ve değerleme endpoint'lerini veritabanı üzerinden tetikler.
-- ============================================================

-- 1. pg_net eklentisini etkinleştir (HTTP istekleri atabilmek için)
create extension if not exists pg_net;

-- 2. Mevcut cron işlerini temizle (Eğer daha önce oluşturulduysa)
select cron.unschedule('fetch-prices-cron');
select cron.unschedule('fetch-valuations-cron');

-- 3. Fiyat Güncelleme İşini Zamanla (Hafta içi her gün 10:00 - 18:00 arası saat başı)
-- Kendi Vercel URL'ni ve .env dosyasındaki CRON_SECRET değerini (Authorization: Bearer <SECRET>) kullanmalısın.
select cron.schedule(
  'fetch-prices-cron',
  '0 10-18 * * 1-5', 
  $$
    select net.http_get(
      url:='https://portfoy-takip-modern.vercel.app/api/cron/prices',
      headers:='{"Authorization": "Bearer SENIN_CRON_SECRET_DEGERIN"}'::jsonb
    );
  $$
);

-- 4. Günlük Değerleme İşini Zamanla (Her gün 23:00'da)
select cron.schedule(
  'fetch-valuations-cron',
  '0 23 * * *',
  $$
    select net.http_get(
      url:='https://portfoy-takip-modern.vercel.app/api/cron/valuations',
      headers:='{"Authorization": "Bearer SENIN_CRON_SECRET_DEGERIN"}'::jsonb
    );
  $$
);

-- ============================================================
-- İPUCU: Cron işlerinin çalışıp çalışmadığını kontrol etmek için:
-- select * from cron.job_run_details order by start_time desc limit 10;
-- ============================================================
