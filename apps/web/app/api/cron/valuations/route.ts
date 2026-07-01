import { NextResponse } from "next/server";
import { derivePortfolio, valuePortfolio, type LivePrice } from "@portfoy/core";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { buildFxRatesMap } from "@/lib/valuationHelpers";
import { mapDbRowToTransaction } from "@/lib/mapDbRowToTransaction";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron — günde birkaç kez çağrılır (bkz. vercel.json). Her portföy için
 * portfolio_valuations satırı yazar. net_cash_flow_try, TWR hesabının kalbidir:
 * bu snapshot'tan bir önceki snapshot'a kadar gerçekleşen DEPOSIT/WITHDRAW toplamı.
 * Fiyat çekiminin aksine burada eksik fiyat olsa da mevcut veriyle en iyi tahmin yazılır
 * (holdings'in TAMAMI fiyatsız kalmadıkça) — TWR zaman serisinin sürekliliği önemli.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const now = new Date().toISOString();

  const { data: priceRows } = await supabase.from("latest_prices").select("*");
  const prices = new Map<string, LivePrice>(
    (priceRows ?? []).map((p) => [p.symbol, { price: p.price, currency: p.currency, isStale: p.is_stale }]),
  );
  const fxRates = buildFxRatesMap(prices);
  const usdTryRate = prices.get("USD")?.price ?? 0;

  const { data: portfolios } = await supabase.from("portfolios").select("id, user_id");

  const results: { portfolioId: number; ok: boolean }[] = [];
  let compositeTotalTry = 0;
  let compositeNetCashFlow = 0;
  const compositeUserId = portfolios?.[0]?.user_id; // tek kullanıcılık sürümde hepsi aynı user

  for (const portfolio of portfolios ?? []) {
    const { data: txRows } = await supabase
      .from("transactions")
      .select("*")
      .eq("portfolio_id", portfolio.id);

    const transactions = (txRows ?? []).map(mapDbRowToTransaction);
    const derived = derivePortfolio(transactions);
    const valued = valuePortfolio(derived, prices, fxRates);

    // Bir önceki snapshot'tan bu yana gerçekleşen net para giriş/çıkışı.
    const { data: lastSnapshot } = await supabase
      .from("portfolio_valuations")
      .select("ts")
      .eq("portfolio_id", portfolio.id)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle();

    const since = lastSnapshot?.ts ?? "1970-01-01T00:00:00Z";
    const netCashFlow = transactions
      .filter((t) => t.executedAt > since)
      .reduce((sum, t) => {
        if (t.txType === "DEPOSIT") return sum + (t.cashAmount ?? 0);
        if (t.txType === "WITHDRAW") return sum - (t.cashAmount ?? 0);
        return sum;
      }, 0);

    const totalValueUsd = usdTryRate > 0 ? valued.totalValueTry / usdTryRate : 0;
    compositeTotalTry += valued.totalValueTry;
    compositeNetCashFlow += netCashFlow;

    const { error } = await supabase.from("portfolio_valuations").insert({
      user_id: portfolio.user_id,
      portfolio_id: portfolio.id,
      ts: now,
      total_value_try: valued.totalValueTry,
      total_value_usd: totalValueUsd,
      net_cash_flow_try: netCashFlow,
      usd_try_rate: usdTryRate,
    });

    results.push({ portfolioId: portfolio.id, ok: !error });
  }

  // Bileşik (tüm portföyler toplamı) snapshot — portfolio_id: null
  if (compositeUserId) {
    await supabase.from("portfolio_valuations").insert({
      user_id: compositeUserId,
      portfolio_id: null,
      ts: now,
      total_value_try: compositeTotalTry,
      total_value_usd: usdTryRate > 0 ? compositeTotalTry / usdTryRate : 0,
      net_cash_flow_try: compositeNetCashFlow,
      usd_try_rate: usdTryRate,
    });
  }

  return NextResponse.json({ ranAt: now, results });
}
