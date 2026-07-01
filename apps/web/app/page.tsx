import Link from "next/link";
import { derivePortfolio, valuePortfolio, type LivePrice } from "@portfoy/core";
import { getServerSupabase } from "@/lib/supabase/server";
import { buildFxRatesMap } from "@/lib/valuationHelpers";
import { createPortfolio } from "@/app/actions/portfolio";
import { mapDbRowToTransaction } from "@/lib/mapDbRowToTransaction";

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

  let grandTotalTry = 0;
  const rows: { id: number; name: string; platform: string | null; totalTry: number; missing: string[] }[] = [];

  for (const p of portfolioRows ?? []) {
    const { data: txRows } = await supabase.from("transactions").select("*").eq("portfolio_id", p.id);
    const derived = derivePortfolio((txRows ?? []).map(mapDbRowToTransaction));
    const valued = valuePortfolio(derived, prices, fxRates);
    grandTotalTry += valued.totalValueTry;
    rows.push({ id: p.id, name: p.name, platform: p.platform, totalTry: valued.totalValueTry, missing: valued.missingPriceSymbols });
  }

  return (
    <main>
      <h1>Portföy Takip</h1>
      {error && <p style={{ color: "crimson" }}>{decodeURIComponent(error)}</p>}

      <section style={{ margin: "1.5rem 0" }}>
        <h2>Toplam Değer</h2>
        <p style={{ fontSize: "1.5rem", fontWeight: 700 }}>
          {grandTotalTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺
          {usdTryRate > 0 && (
            <span style={{ fontSize: "1rem", fontWeight: 400, color: "#888" }}>
              {" "}
              (~{(grandTotalTry / usdTryRate).toLocaleString("en-US", { maximumFractionDigits: 0 })} $)
            </span>
          )}
        </p>
      </section>

      <section>
        <h2>Portföyler</h2>
        {rows.length === 0 && <p>Henüz portföy yok.</p>}
        <ul style={{ listStyle: "none", padding: 0 }}>
          {rows.map((r) => (
            <li key={r.id} style={{ padding: "0.75rem 0", borderBottom: "1px solid #333" }}>
              <Link href={`/portfolio/${r.id}`}>
                <strong>{r.name}</strong> {r.platform && <span style={{ color: "#888" }}>({r.platform})</span>}
              </Link>
              <div>{r.totalTry.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} ₺</div>
              {r.missing.length > 0 && (
                <div style={{ color: "orange", fontSize: "0.85rem" }}>
                  Fiyatı bilinmiyor: {r.missing.join(", ")}
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section style={{ marginTop: "2rem" }}>
        <h2>Yeni Portföy</h2>
        <form action={createPortfolio} style={{ display: "flex", gap: 8 }}>
          <input name="name" placeholder="Portföy adı" required />
          <input name="platform" placeholder="Platform (opsiyonel)" />
          <button type="submit">Oluştur</button>
        </form>
      </section>
    </main>
  );
}
