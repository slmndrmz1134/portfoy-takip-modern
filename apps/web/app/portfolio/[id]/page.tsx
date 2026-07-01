import { notFound } from "next/navigation";
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

export default async function PortfolioDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const portfolioId = Number(id);

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

  const { data: valuationRows } = await supabase
    .from("portfolio_valuations")
    .select("ts, total_value_try, net_cash_flow_try")
    .eq("portfolio_id", portfolioId)
    .order("ts", { ascending: true });

  const twrPoints: ValuationPoint[] = (valuationRows ?? []).map((v) => ({
    ts: v.ts,
    value: v.total_value_try,
    netCashFlow: v.net_cash_flow_try,
  }));
  const twr = twrPoints.length >= 2 ? calculateTWR(twrPoints) : null;

  return (
    <main>
      <h1>{portfolio.name}</h1>
      {error && <p style={{ color: "crimson" }}>{decodeURIComponent(error)}</p>}

      <section style={{ display: "flex", gap: "2rem", flexWrap: "wrap", margin: "1rem 0" }}>
        <div>
          <div style={{ color: "#888" }}>Toplam Değer</div>
          <div style={{ fontSize: "1.4rem", fontWeight: 700 }}>
            {valued.totalValueTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          </div>
        </div>
        <div>
          <div style={{ color: "#888" }}>Nakit</div>
          <div>{valued.cashTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺</div>
        </div>
        <div>
          <div style={{ color: "#888" }}>XIRR (gerçek getiri)</div>
          <div>{xirr !== null ? `%${xirr.toFixed(2)}` : "yeterli veri yok"}</div>
        </div>
        <div>
          <div style={{ color: "#888" }}>TWR (strateji performansı)</div>
          <div>{twr !== null ? `%${twr.twrPercent.toFixed(2)}` : "henüz snapshot birikmedi"}</div>
        </div>
      </section>

      {valued.missingPriceSymbols.length > 0 && (
        <p style={{ color: "orange" }}>
          Fiyatı henüz alınamamış semboller: {valued.missingPriceSymbols.join(", ")} (cron ilk çalıştığında dolacak)
        </p>
      )}

      <section>
        <h2>Pozisyonlar</h2>
        {valued.positions.length === 0 && <p>Pozisyon yok.</p>}
        {valued.positions.length > 0 && (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th align="left">Sembol</th>
                <th align="right">Adet</th>
                <th align="right">Güncel Fiyat (₺)</th>
                <th align="right">Değer (₺)</th>
                <th align="right">K/Z (₺)</th>
              </tr>
            </thead>
            <tbody>
              {valued.positions.map((pos) => (
                <tr key={pos.symbol} style={{ borderTop: "1px solid #333" }}>
                  <td>
                    {pos.symbol} {pos.isStale && <span style={{ color: "orange", fontSize: "0.8rem" }}>(gecikmeli)</span>}
                  </td>
                  <td align="right">{pos.quantity}</td>
                  <td align="right">{pos.currentPriceTry.toLocaleString("tr-TR")}</td>
                  <td align="right">{pos.marketValueTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</td>
                  <td align="right" style={{ color: pos.unrealizedPLTry >= 0 ? "seagreen" : "crimson" }}>
                    {pos.unrealizedPLTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section style={{ marginTop: "2rem", display: "flex", gap: "2rem", flexWrap: "wrap" }}>
        <form action={addBuyTransaction} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
          <h3>Al (BUY)</h3>
          <input type="hidden" name="portfolioId" value={portfolioId} />
          <select name="market" defaultValue="US">
            <option value="US">ABD hissesi</option>
            <option value="BIST">BIST hissesi</option>
            <option value="GOLD">Altın</option>
          </select>
          <input name="symbol" placeholder="Sembol (ör. AAPL)" required />
          <input name="name" placeholder="İsim (opsiyonel)" />
          <input name="quantity" type="number" step="any" placeholder="Adet" required />
          <input name="price" type="number" step="any" placeholder="Birim fiyat" required />
          <input name="fee" type="number" step="any" placeholder="Komisyon (TRY, opsiyonel)" />
          <button type="submit">Satın al</button>
        </form>

        <form action={addSellTransaction} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
          <h3>Sat (SELL)</h3>
          <input type="hidden" name="portfolioId" value={portfolioId} />
          <input name="symbol" placeholder="Sembol" required />
          <input name="quantity" type="number" step="any" placeholder="Adet" required />
          <input name="price" type="number" step="any" placeholder="Birim fiyat" required />
          <input name="fee" type="number" step="any" placeholder="Komisyon (TRY, opsiyonel)" />
          <button type="submit">Sat</button>
        </form>

        <form action={addCashTransaction} style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 220 }}>
          <h3>Nakit</h3>
          <input type="hidden" name="portfolioId" value={portfolioId} />
          <select name="txType" defaultValue="DEPOSIT">
            <option value="DEPOSIT">Para yatır</option>
            <option value="WITHDRAW">Para çek</option>
          </select>
          <input name="cashAmount" type="number" step="any" placeholder="Tutar (₺)" required />
          <button type="submit">Uygula</button>
        </form>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>İşlem Geçmişi</h2>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.9rem" }}>
          <thead>
            <tr>
              <th align="left">Tarih</th>
              <th align="left">Tip</th>
              <th align="left">Sembol</th>
              <th align="right">Adet</th>
              <th align="right">Fiyat</th>
              <th align="right">Tutar (₺)</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((t) => (
              <tr key={t.id} style={{ borderTop: "1px solid #333" }}>
                <td>{new Date(t.executedAt).toLocaleString("tr-TR")}</td>
                <td>{t.txType}</td>
                <td>{t.symbol ?? "-"}</td>
                <td align="right">{t.quantity ?? "-"}</td>
                <td align="right">{t.price ?? "-"}</td>
                <td align="right">
                  {t.cashAmount != null
                    ? t.cashAmount.toLocaleString("tr-TR")
                    : t.quantity != null && t.price != null && t.fxToTry != null
                      ? (t.quantity * t.price * t.fxToTry).toLocaleString("tr-TR", { maximumFractionDigits: 0 })
                      : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <form action={deletePortfolio} style={{ marginTop: "2rem" }}>
        <input type="hidden" name="portfolioId" value={portfolioId} />
        <button type="submit" style={{ color: "crimson" }}>
          Portföyü sil
        </button>
      </form>
    </main>
  );
}
