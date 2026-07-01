-- ============================================================
-- Portföy Takip v2 — Supabase (Postgres) Şema Taslağı
-- İşlem defteri (ledger) + fiyat geçmişi + TWR için nakit-akışlı değerleme
-- RLS (Row Level Security) ile her kullanıcı yalnızca kendi verisini görür.
-- ============================================================

-- ── Kullanıcı profili (Supabase Auth'a bağlı) ──
create table if not exists profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'TRY',   -- raporlama para birimi
  created_at  timestamptz not null default now()
);

-- ── Portföyler ──
create table if not exists portfolios (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null,
  platform    text,                              -- Midas, Akbank, vb. (opsiyonel)
  created_at  timestamptz not null default now()
);

-- ── Enstrüman kataloğu (paylaşımlı, herkese okunur) ──
create table if not exists instruments (
  symbol      text primary key,                  -- AAPL, THYAO.IS, USDTRY, XAU_GRAM
  name        text not null,
  market      text not null,                     -- US, BIST, FX, GOLD
  type        text not null,                     -- STOCK, CURRENCY, GOLD
  currency    text not null                      -- fiyatın para birimi: USD, TRY
);

-- ── İşlem defteri: TEK DOĞRULUK KAYNAĞI (değişmez) ──
create table if not exists transactions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  portfolio_id bigint not null references portfolios(id) on delete cascade,
  symbol       text references instruments(symbol),
  tx_type      text not null check (tx_type in ('BUY','SELL','DEPOSIT','WITHDRAW','DIVIDEND','FEE')),
  quantity     numeric,                          -- BUY/SELL için adet
  price        numeric,                          -- işlem anındaki birim fiyat (orijinal para birimi)
  currency     text not null default 'TRY',
  fx_to_try    numeric,                          -- işlem anı kur (para birimi → TRY)
  cash_amount  numeric,                          -- DEPOSIT/WITHDRAW için nakit tutar (TRY)
  fee          numeric default 0,
  executed_at  timestamptz not null default now(),
  note         text
);
create index if not exists idx_tx_user_portfolio on transactions(user_id, portfolio_id, executed_at);

-- ── Fiyat geçmişi: last-known-good, ASLA 0 döndürme ──
create table if not exists prices (
  id         bigint generated always as identity primary key,
  symbol     text not null references instruments(symbol),
  price      numeric not null,
  currency   text not null,
  source     text not null,                      -- finnhub, isyatirim, yahoo, tcmb, computed
  is_stale   boolean not null default false,
  as_of      timestamptz not null default now()
);
create index if not exists idx_prices_symbol_asof on prices(symbol, as_of desc);
-- En güncel fiyatı hızlı okumak için görünüm:
create or replace view latest_prices as
  select distinct on (symbol) symbol, price, currency, source, is_stale, as_of
  from prices order by symbol, as_of desc;

-- ── Döviz kurları (TCMB + intraday) ──
create table if not exists fx_rates (
  id         bigint generated always as identity primary key,
  pair       text not null,                      -- USDTRY, EURTRY
  rate       numeric not null,
  source     text not null,                      -- tcmb, frankfurter
  as_of      timestamptz not null default now()
);
create index if not exists idx_fx_pair_asof on fx_rates(pair, as_of desc);

-- ── Değerleme snapshot'ı: TWR için net_cash_flow KOLONU kritik ──
create table if not exists portfolio_valuations (
  id            bigint generated always as identity primary key,
  user_id       uuid not null references auth.users(id) on delete cascade,
  portfolio_id  bigint references portfolios(id) on delete cascade,  -- null = COMPOSITE (tümü)
  ts            timestamptz not null default now(),
  total_value_try numeric not null,
  total_value_usd numeric not null,
  net_cash_flow_try numeric not null default 0,   -- o periyottaki para giriş(+)/çıkış(-)
  usd_try_rate  numeric not null
);
create index if not exists idx_val_user_portfolio_ts on portfolio_valuations(user_id, portfolio_id, ts);

-- ============================================================
-- RLS POLİTİKALARI
-- ============================================================
alter table profiles              enable row level security;
alter table portfolios            enable row level security;
alter table transactions          enable row level security;
alter table portfolio_valuations  enable row level security;

-- Kullanıcı yalnızca kendi kaydını görür/yazar
create policy "own_profile"      on profiles for all
  using (id = auth.uid()) with check (id = auth.uid());
create policy "own_portfolios"   on portfolios for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_transactions" on transactions for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "own_valuations"   on portfolio_valuations for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Piyasa verisi tabloları: herkese OKUMA, yazma yalnızca service_role (cron)
alter table instruments enable row level security;
alter table prices      enable row level security;
alter table fx_rates    enable row level security;
create policy "read_instruments" on instruments for select using (true);
create policy "read_prices"      on prices      for select using (true);
create policy "read_fx"          on fx_rates    for select using (true);
-- INSERT/UPDATE politikası yok → yalnızca service_role anahtarı (cron) yazabilir.

-- ============================================================
-- NOT: Holdings (varlık adetleri) ayrı tabloda TUTULMAZ; transactions'tan
-- türetilir (SUM(BUY.qty) - SUM(SELL.qty)). Böylece tek doğruluk kaynağı korunur.
-- Cost-basis (FIFO) ve TWR/XIRR hesapları packages/core/performance içinde yapılır.
-- ============================================================
