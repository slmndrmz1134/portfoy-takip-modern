import { notFound } from "next/navigation";
import Link from "next/link";
import { derivePortfolio, valuePortfolio, calculateTWR, type LivePrice, type ValuationPoint } from "@portfoy/core";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildFxRatesMap, computeXirr } from "@/lib/valuationHelpers";
import { mapDbRowToTransaction } from "@/lib/mapDbRowToTransaction";
import {
  addBuyTransaction,
  addSellTransaction,
  addCashTransaction,
  deletePortfolio,
} from "@/app/actions/portfolio";
import { AppLayout } from "@/app/components/Sidebar";
import { PerformanceChart } from "@/app/components/PerformanceChart";
import { AllocationPieChart, COLORS } from "@/app/components/AllocationPieChart";
import { PeriodSelector } from "@/app/components/PeriodSelector";
import { getPeriodStartDate, type PeriodKey } from "@/lib/periods";

export default async function PortfolioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string; period?: string }>;
}) {
  const { id } = await params;
  const { error, period } = await searchParams;
  const portfolioId = Number(id);
  const selectedPeriod = (period as PeriodKey) || "ALL";

  const supabase = await getServerSupabase();
  const { data: portfolio } = await supabase.from("portfolios").select("*").eq("id", portfolioId).maybeSingle();
  if (!portfolio) notFound();

  const { data: txRows } = await supabase
    .from("transactions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .order("executed_at", { ascending: false });
  const transactions = (txRows ?? []).map(mapDbRowToTransaction);

  const { data: priceRows } = await supabase.from("latest_prices").select("*");
  const prices = new Map<string, LivePrice>(
    (priceRows ?? []).map((p) => [p.symbol, { price: p.price, currency: p.currency, isStale: p.is_stale }]),
  );
  const fxRates = buildFxRatesMap(prices);

  const derived = derivePortfolio(transactions);
  const valued = valuePortfolio(derived, prices, fxRates);
  const xirr = computeXirr(transactions, valued.totalValueTry);

  // Valuations for chart
  const { data: valuationRows } = await supabase
    .from("portfolio_valuations")
    .select("ts, total_value_try, net_cash_flow_try")
    .eq("portfolio_id", portfolioId)
    .order("ts", { ascending: true });

  const allTwrPoints: ValuationPoint[] = (valuationRows ?? []).map((v) => ({
    ts: v.ts,
    value: v.total_value_try,
    netCashFlow: v.net_cash_flow_try,
  }));

  // Filter by period
  const periodStart = getPeriodStartDate(selectedPeriod);
  const filteredPoints = allTwrPoints.filter((p) => new Date(p.ts) >= periodStart);
  const twr = filteredPoints.length >= 2 ? calculateTWR(filteredPoints) : null;

  // Chart data
  const chartData = filteredPoints.map((p) => ({
    label: new Date(p.ts).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" }),
    value: p.value,
  }));

  // Pie chart data for this portfolio
  const pieData = valued.positions
    .sort((a, b) => b.marketValueTry - a.marketValueTry)
    .map((pos, i) => ({
      label: pos.symbol,
      value: pos.marketValueTry,
      color: COLORS[i % COLORS.length],
    }));

  if (valued.cashTry > 0) {
    pieData.push({ label: "Nakit", value: valued.cashTry, color: "#64748b" });
  }

  // Toplam gerçekleşmemiş K/Z
  const totalUnrealizedPL = valued.positions.reduce((s, p) => s + p.unrealizedPLTry, 0);
  const totalRealizedPL = valued.positions.reduce((s, p) => s + p.realizedPLTry, 0);

  return (
    <AppLayout activePage="portfolio">
      {/* Back link */}
      <Link href="/" className="back-link animate-in">
        ← Dashboard
      </Link>

      {/* Page header */}
      <div className="page-header animate-in">
        <h1 className="page-title">{portfolio.name}</h1>
        {portfolio.platform && (
          <p className="page-subtitle">{portfolio.platform}</p>
        )}
      </div>

      {error && (
        <div className="alert alert-danger mb-4 animate-in">
          <span className="alert-icon">⚠</span>
          <span>{decodeURIComponent(error)}</span>
        </div>
      )}

      {/* Stats Cards */}
      <div className="stats-grid animate-in animate-in-delay-1">
        <div className="card">
          <div className="card-title">Toplam Değer</div>
          <div className="stat-value">
            {valued.totalValueTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          </div>
        </div>
        <div className="card">
          <div className="card-title">Nakit Bakiye</div>
          <div className="stat-value">
            {valued.cashTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          </div>
        </div>
        <div className="card">
          <div className="card-title">XIRR (Gerçek Getiri)</div>
          <div className="stat-value" style={{ color: xirr !== null ? (xirr >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-secondary)' }}>
            {xirr !== null ? `%${xirr.toFixed(2)}` : "—"}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
            Para ağırlıklı yıllık getiri
          </div>
        </div>
        <div className="card">
          <div className="card-title">TWR (Strateji Performansı)</div>
          <div className="stat-value" style={{ color: twr !== null ? (twr.twrPercent >= 0 ? 'var(--color-success)' : 'var(--color-danger)') : 'var(--text-secondary)' }}>
            {twr !== null ? `%${twr.twrPercent.toFixed(2)}` : "—"}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: '0.25rem' }}>
            Zaman ağırlıklı kümülatif getiri
          </div>
        </div>
      </div>

      {/* Missing prices alert */}
      {valued.missingPriceSymbols.length > 0 && (
        <div className="alert alert-warning mb-4 animate-in animate-in-delay-2">
          <span className="alert-icon">⚠</span>
          <span>
            Fiyatı henüz alınamamış semboller: <strong>{valued.missingPriceSymbols.join(", ")}</strong>
            {" "}(cron ilk çalıştığında dolacak)
          </span>
        </div>
      )}

      {/* K/Z Summary + Pie Chart */}
      <div className="grid-2 animate-in animate-in-delay-2" style={{ marginBottom: '1.5rem' }}>
        <div className="card">
          <div className="card-title">Kâr / Zarar Özeti</div>
          <div style={{ display: 'flex', gap: '2rem', marginTop: '1rem' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Gerçekleşmemiş K/Z</div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: totalUnrealizedPL >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                marginTop: '0.25rem'
              }}>
                {totalUnrealizedPL >= 0 ? "+" : ""}{totalUnrealizedPL.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)' }}>Gerçekleşen K/Z</div>
              <div style={{
                fontSize: '1.3rem',
                fontWeight: 700,
                color: totalRealizedPL >= 0 ? 'var(--color-success)' : 'var(--color-danger)',
                marginTop: '0.25rem'
              }}>
                {totalRealizedPL >= 0 ? "+" : ""}{totalRealizedPL.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
              </div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="card-title">Varlık Dağılımı</div>
          <AllocationPieChart data={pieData} />
        </div>
      </div>

      {/* Performance Chart with Period Selector */}
      <div className="card animate-in animate-in-delay-3 mb-4" style={{ marginBottom: '1.5rem' }}>
        <div className="card-header">
          <div className="card-title">Performans Grafiği</div>
          <PeriodSelector />
        </div>
        <PerformanceChart data={chartData} />
      </div>

      {/* Positions Table */}
      <div className="section animate-in animate-in-delay-3">
        <div className="section-header">
          <h2 className="section-title">Pozisyonlar</h2>
          <span className="badge badge-info">{valued.positions.length} pozisyon</span>
        </div>

        {valued.positions.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">📋</div>
            <p className="empty-state-text">Henüz pozisyon yok</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sembol</th>
                  <th className="text-right">Adet</th>
                  <th className="text-right">Maliyet (₺)</th>
                  <th className="text-right">Güncel (₺)</th>
                  <th className="text-right">Değer (₺)</th>
                  <th className="text-right">K/Z (₺)</th>
                </tr>
              </thead>
              <tbody>
                {valued.positions.map((pos) => {
                  const plPct = pos.costBasisTry > 0 ? ((pos.unrealizedPLTry / pos.costBasisTry) * 100) : 0;
                  return (
                    <tr key={pos.symbol}>
                      <td>
                        <div className="flex items-center gap-2">
                          <strong>{pos.symbol}</strong>
                          {pos.isStale && <span className="badge badge-stale">gecikmeli</span>}
                        </div>
                      </td>
                      <td className="text-right">{pos.quantity}</td>
                      <td className="text-right text-muted">
                        {pos.costBasisTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right">
                        {pos.currentPriceTry.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}
                      </td>
                      <td className="text-right" style={{ fontWeight: 600 }}>
                        {pos.marketValueTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                      </td>
                      <td className="text-right">
                        <span className={pos.unrealizedPLTry >= 0 ? "text-success" : "text-danger"} style={{ fontWeight: 600 }}>
                          {pos.unrealizedPLTry >= 0 ? "+" : ""}
                          {pos.unrealizedPLTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                        </span>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                          {plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Transaction Forms */}
      <div className="section animate-in animate-in-delay-4" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <h2 className="section-title">İşlem Ekle</h2>
        </div>

        <div className="grid-3">
          {/* BUY Form */}
          <div className="form-card">
            <div className="form-card-title">
              <span style={{ color: 'var(--color-success)' }}>↗</span> Satın Al (BUY)
            </div>
            <form action={addBuyTransaction} className="flex flex-col gap-3">
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <div className="form-group">
                <label className="form-label">Piyasa</label>
                <select name="market" defaultValue="US" className="form-select">
                  <option value="US">ABD Hissesi</option>
                  <option value="BIST">BIST Hissesi</option>
                  <option value="GOLD">Altın</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Sembol</label>
                <input name="symbol" placeholder="ör. AAPL" required className="form-input" />
              </div>
              <div className="form-group">
                <label className="form-label">İsim (opsiyonel)</label>
                <input name="name" placeholder="ör. Apple Inc." className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Adet</label>
                  <input name="quantity" type="number" step="any" placeholder="0" required className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Birim Fiyat</label>
                  <input name="price" type="number" step="any" placeholder="0.00" required className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Komisyon (₺, opsiyonel)</label>
                <input name="fee" type="number" step="any" placeholder="0" className="form-input" />
              </div>
              <button type="submit" className="btn btn-primary w-full mt-2">Satın Al</button>
            </form>
          </div>

          {/* SELL Form */}
          <div className="form-card">
            <div className="form-card-title">
              <span style={{ color: 'var(--color-danger)' }}>↙</span> Sat (SELL)
            </div>
            <form action={addSellTransaction} className="flex flex-col gap-3">
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <div className="form-group">
                <label className="form-label">Sembol</label>
                <input name="symbol" placeholder="ör. AAPL" required className="form-input" />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label className="form-label">Adet</label>
                  <input name="quantity" type="number" step="any" placeholder="0" required className="form-input" />
                </div>
                <div className="form-group">
                  <label className="form-label">Birim Fiyat</label>
                  <input name="price" type="number" step="any" placeholder="0.00" required className="form-input" />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Komisyon (₺, opsiyonel)</label>
                <input name="fee" type="number" step="any" placeholder="0" className="form-input" />
              </div>
              <button type="submit" className="btn btn-danger w-full mt-2">Sat</button>
            </form>
          </div>

          {/* CASH Form */}
          <div className="form-card">
            <div className="form-card-title">
              <span style={{ color: 'var(--color-info)' }}>💰</span> Nakit İşlemi
            </div>
            <form action={addCashTransaction} className="flex flex-col gap-3">
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <div className="form-group">
                <label className="form-label">İşlem Türü</label>
                <select name="txType" defaultValue="DEPOSIT" className="form-select">
                  <option value="DEPOSIT">Para Yatır</option>
                  <option value="WITHDRAW">Para Çek</option>
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Tutar (₺)</label>
                <input name="cashAmount" type="number" step="any" placeholder="0.00" required className="form-input" />
              </div>
              <button type="submit" className="btn btn-secondary w-full mt-2">Uygula</button>
            </form>
          </div>
        </div>
      </div>

      {/* Transaction History */}
      <div className="section" style={{ marginTop: '1.5rem' }}>
        <div className="section-header">
          <h2 className="section-title">İşlem Geçmişi</h2>
          <span className="badge badge-info">{transactions.length} işlem</span>
        </div>

        {transactions.length === 0 ? (
          <div className="card empty-state">
            <div className="empty-state-icon">📝</div>
            <p className="empty-state-text">Henüz işlem yok</p>
          </div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tarih</th>
                  <th>Tip</th>
                  <th>Sembol</th>
                  <th className="text-right">Adet</th>
                  <th className="text-right">Fiyat</th>
                  <th className="text-right">Tutar (₺)</th>
                </tr>
              </thead>
              <tbody>
                {transactions.map((t) => {
                  const txTypeClass =
                    t.txType === "BUY" ? "tx-type-buy" :
                    t.txType === "SELL" ? "tx-type-sell" :
                    t.txType === "DEPOSIT" ? "tx-type-deposit" :
                    "tx-type-withdraw";

                  return (
                    <tr key={t.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {new Date(t.executedAt).toLocaleDateString("tr-TR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </td>
                      <td>
                        <span className={`tx-type ${txTypeClass}`}>{t.txType}</span>
                      </td>
                      <td>{t.symbol ?? "—"}</td>
                      <td className="text-right">{t.quantity ?? "—"}</td>
                      <td className="text-right">
                        {t.price != null ? t.price.toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}
                      </td>
                      <td className="text-right" style={{ fontWeight: 500 }}>
                        {t.cashAmount != null
                          ? t.cashAmount.toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                          : t.quantity != null && t.price != null && t.fxToTry != null
                            ? (t.quantity * t.price * t.fxToTry).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                            : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Danger Zone */}
      <hr className="divider" style={{ margin: '2rem 0' }} />
      <div className="section">
        <div className="section-header">
          <h2 className="section-title" style={{ color: 'var(--color-danger)' }}>Tehlikeli Bölge</h2>
        </div>
        <div className="card" style={{ borderColor: 'rgba(239, 68, 68, 0.2)' }}>
          <div className="flex items-center justify-between">
            <div>
              <div style={{ fontWeight: 600 }}>Portföyü Sil</div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-tertiary)' }}>
                Bu işlem geri alınamaz. Tüm işlemler ve veriler silinecek.
              </div>
            </div>
            <form action={deletePortfolio}>
              <input type="hidden" name="portfolioId" value={portfolioId} />
              <button type="submit" className="btn btn-danger">Portföyü Sil</button>
            </form>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
