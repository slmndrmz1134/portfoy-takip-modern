import Link from "next/link";
import { derivePortfolio, valuePortfolio, type LivePrice, calculateTWR, type ValuationPoint } from "@portfoy/core";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildFxRatesMap } from "@/lib/valuationHelpers";
import { createPortfolio } from "@/app/actions/portfolio";
import { mapDbRowToTransaction } from "@/lib/mapDbRowToTransaction";
import { AppLayout } from "@/app/components/Sidebar";
import { AllocationPieChart, COLORS } from "@/app/components/AllocationPieChart";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const supabase = await getServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: portfolioRows } = await supabase
    .from("portfolios")
    .select("*")
    .eq("user_id", user!.id)
    .order("created_at", { ascending: true });

  const { data: priceRows } = await supabase.from("latest_prices").select("*");
  const prices = new Map<string, LivePrice>(
    (priceRows ?? []).map((p) => [p.symbol, { price: p.price, currency: p.currency, isStale: p.is_stale }]),
  );
  const fxRates = buildFxRatesMap(prices);
  const usdTryRate = prices.get("USD")?.price ?? 0;

  // Composite valuations for main chart
  const { data: compositeValuations } = await supabase
    .from("portfolio_valuations")
    .select("ts, total_value_try, net_cash_flow_try")
    .eq("user_id", user!.id)
    .is("portfolio_id", null)
    .order("ts", { ascending: true })
    .limit(90);

  const twrPoints: ValuationPoint[] = (compositeValuations ?? []).map((v) => ({
    ts: v.ts,
    value: v.total_value_try,
    netCashFlow: v.net_cash_flow_try,
  }));
  const compositeTwr = twrPoints.length >= 2 ? calculateTWR(twrPoints) : null;

  let grandTotalTry = 0;
  let totalCashTry = 0;
  const allPositions: { symbol: string; valueTry: number }[] = [];
  const rows: { id: number; name: string; platform: string | null; totalTry: number; missing: string[] }[] = [];

  for (const p of portfolioRows ?? []) {
    const { data: txRows } = await supabase.from("transactions").select("*").eq("portfolio_id", p.id);
    const derived = derivePortfolio((txRows ?? []).map(mapDbRowToTransaction));
    const valued = valuePortfolio(derived, prices, fxRates);
    grandTotalTry += valued.totalValueTry;
    totalCashTry += valued.cashTry;
    rows.push({ id: p.id, name: p.name, platform: p.platform, totalTry: valued.totalValueTry, missing: valued.missingPriceSymbols });

    for (const pos of valued.positions) {
      const existing = allPositions.find((p) => p.symbol === pos.symbol);
      if (existing) {
        existing.valueTry += pos.marketValueTry;
      } else {
        allPositions.push({ symbol: pos.symbol, valueTry: pos.marketValueTry });
      }
    }
  }

  // Pie chart data — top positions by value
  const sortedPositions = [...allPositions].sort((a, b) => b.valueTry - a.valueTry);
  const pieData = sortedPositions.slice(0, 10).map((p, i) => ({
    label: p.symbol,
    value: p.valueTry,
    color: COLORS[i % COLORS.length],
  }));

  // Add cash as a slice if significant
  if (totalCashTry > 0 && grandTotalTry > 0) {
    pieData.push({
      label: "Nakit",
      value: totalCashTry,
      color: "#64748b",
    });
  }

  const grandTotalUsd = usdTryRate > 0 ? grandTotalTry / usdTryRate : 0;

  return (
    <AppLayout activePage="dashboard">
      {/* Page header */}
      <div className="page-header animate-in">
        <h1 className="page-title">Dashboard</h1>
        <p className="page-subtitle">Portföy genel bakış ve performans</p>
      </div>

      {error && (
        <div className="alert alert-danger mb-4 animate-in">
          <span className="alert-icon">⚠</span>
          <span>{decodeURIComponent(error)}</span>
        </div>
      )}

      {/* Hero Card — Total Value */}
      <div className="hero-card card animate-in animate-in-delay-1" style={{ marginBottom: '1.5rem' }}>
        <div className="card-title" style={{ color: 'rgba(255,255,255,0.7)' }}>TOPLAM PORTFÖY DEĞERİ</div>
        <div className="hero-value">
          {grandTotalTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          {grandTotalUsd > 0 && (
            <span className="hero-value-sub">
              ~{grandTotalUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })} $
            </span>
          )}
        </div>
        {compositeTwr && (
          <div className="stat-change positive mt-2" style={{ background: 'rgba(255,255,255,0.15)', color: '#fff' }}>
            TWR: %{compositeTwr.twrPercent.toFixed(2)}
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="stats-grid animate-in animate-in-delay-2">
        <div className="card">
          <div className="card-title">Portföy Sayısı</div>
          <div className="stat-value">{rows.length}</div>
        </div>
        <div className="card">
          <div className="card-title">Toplam Nakit</div>
          <div className="stat-value">
            {totalCashTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          </div>
        </div>
        <div className="card">
          <div className="card-title">Pozisyon Sayısı</div>
          <div className="stat-value">{allPositions.length}</div>
        </div>
        <div className="card">
          <div className="card-title">USD/TRY</div>
          <div className="stat-value">
            {usdTryRate > 0 ? usdTryRate.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}
          </div>
        </div>
      </div>

      {/* Charts Row */}
      {(pieData.length > 0) && (
        <div className="grid-2 animate-in animate-in-delay-3" style={{ marginBottom: '1.5rem' }}>
          <div className="card">
            <div className="card-title">Varlık Dağılımı</div>
            <AllocationPieChart data={pieData} />
          </div>
          <div className="card">
            <div className="card-title">Genel Performans (TWR)</div>
            {compositeTwr ? (
              <div style={{ padding: '2rem 0', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: compositeTwr.twrPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                  %{compositeTwr.twrPercent.toFixed(2)}
                </div>
                <div style={{ color: 'var(--text-secondary)', marginTop: '0.5rem', fontSize: '0.85rem' }}>
                  Zaman Ağırlıklı Getiri
                </div>
                <div style={{ color: 'var(--text-tertiary)', marginTop: '0.25rem', fontSize: '0.8rem' }}>
                  {twrPoints.length} snapshot verisi
                </div>
              </div>
            ) : (
              <div className="empty-state" style={{ padding: '2rem 0' }}>
                <div className="empty-state-icon">📈</div>
                <p className="empty-state-text">Henüz yeterli snapshot verisi yok</p>
                <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                  Cron job çalıştıkça veriler birikecek
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Portfolios Section */}
      <div className="section animate-in animate-in-delay-4">
        <div className="section-header">
          <h2 className="section-title">Portföyler</h2>
        </div>

        {rows.length === 0 ? (
          <div className="empty-state card">
            <div className="empty-state-icon">💼</div>
            <p className="empty-state-text">Henüz portföy oluşturmadın</p>
            <p style={{ color: 'var(--text-tertiary)', fontSize: '0.85rem', marginTop: '0.5rem' }}>
              Aşağıdaki formu kullanarak ilk portföyünü oluşturabilirsin
            </p>
          </div>
        ) : (
          <div className="portfolio-grid">
            {rows.map((r) => (
              <Link key={r.id} href={`/portfolio/${r.id}`} className="portfolio-card">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="portfolio-card-name">{r.name}</div>
                    {r.platform && (
                      <div className="portfolio-card-platform">{r.platform}</div>
                    )}
                  </div>
                  <span style={{ color: 'var(--text-tertiary)', fontSize: '1.2rem' }}>→</span>
                </div>
                <div className="portfolio-card-value">
                  {r.totalTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
                </div>
                {r.missing.length > 0 && (
                  <div className="badge badge-stale mt-2">
                    ⚠ Fiyatı bilinmiyor: {r.missing.join(", ")}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Portfolio Form */}
      <div className="section animate-in animate-in-delay-4" style={{ marginTop: '1.5rem' }}>
        <div className="form-card">
          <div className="form-card-title">
            <span>➕</span> Yeni Portföy Oluştur
          </div>
          <form action={createPortfolio}>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="portfolio-name">Portföy Adı</label>
                <input
                  id="portfolio-name"
                  name="name"
                  className="form-input"
                  placeholder="ör. Ana Portföy"
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="portfolio-platform">Platform (opsiyonel)</label>
                <input
                  id="portfolio-platform"
                  name="platform"
                  className="form-input"
                  placeholder="ör. Midas, Akbank"
                />
              </div>
            </div>
            <div className="form-actions mt-4">
              <button type="submit" className="btn btn-primary">Oluştur</button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  );
}
