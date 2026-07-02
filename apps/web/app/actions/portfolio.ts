"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { derivePortfolio, fetchFxRateToTry, type Market } from "@portfoy/core";
import { getServerSupabase } from "@/lib/supabase/server";
import { getSupabaseServiceClient } from "@/lib/supabase";
import { mapDbRowToTransaction } from "@/lib/mapDbRowToTransaction";

async function requireUser() {
  const supabase = await getServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user: user! };
}

export async function createPortfolio(formData: FormData) {
  const { supabase, user } = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const platform = String(formData.get("platform") ?? "").trim() || null;

  if (!name) redirect("/?error=" + encodeURIComponent("Portföy adı boş olamaz"));

  const { error } = await supabase.from("portfolios").insert({ user_id: user.id, name, platform });
  if (error) redirect("/?error=" + encodeURIComponent(error.message));

  revalidatePath("/");
  redirect("/");
}

export async function deletePortfolio(formData: FormData) {
  const { supabase } = await requireUser();
  const portfolioId = Number(formData.get("portfolioId"));

  const { error } = await supabase.from("portfolios").delete().eq("id", portfolioId);
  if (error) redirect("/?error=" + encodeURIComponent(error.message));

  revalidatePath("/");
  redirect("/");
}

/** Currency para birimini piyasa türüne göre belirler — GOLD hariç TRY, US->USD, GOLD->ALTIN_ONS haricinde TRY. */
function currencyForMarket(market: Market, symbol: string): string {
  if (market === "US") return "USD";
  if (market === "GOLD") return symbol === "ALTIN_ONS" ? "USD" : "TRY";
  return "TRY"; // BIST, FX
}

async function resolveFxToTry(currency: string): Promise<number | null> {
  if (currency === "TRY") return 1;
  const rate = await fetchFxRateToTry(currency);
  return rate ? rate.price : null;
}

async function ensureInstrument(
  supabase: Awaited<ReturnType<typeof getServerSupabase>>,
  symbol: string,
  name: string,
  market: Market,
) {
  const { data: existing } = await supabase.from("instruments").select("symbol").eq("symbol", symbol).maybeSingle();
  if (existing) return;

  const currency = currencyForMarket(market, symbol);
  const type = market === "FX" ? "CURRENCY" : market === "GOLD" ? "GOLD" : "STOCK";

  const adminClient = getSupabaseServiceClient();
  const { error } = await adminClient.from("instruments").insert({ symbol, name, market, type, currency });
  if (error) throw new Error(`Enstrüman eklenemedi: ${error.message}`);
}

export async function addBuyTransaction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const portfolioId = Number(formData.get("portfolioId"));
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const name = String(formData.get("name") ?? "").trim() || symbol;
  const market = String(formData.get("market") ?? "US") as Market;
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const fee = Number(formData.get("fee") ?? 0);

  if (!symbol || !quantity || !price) {
    redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent("Sembol/adet/fiyat gerekli"));
  }

  try {
    await ensureInstrument(supabase, symbol, name, market);
  } catch (e) {
    redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent((e as Error).message));
  }

  const currency = currencyForMarket(market, symbol);
  const fxToTry = await resolveFxToTry(currency);
  if (fxToTry === null) {
    redirect(
      `/portfolio/${portfolioId}?error=` +
        encodeURIComponent(`${currency} kuru şu an alınamadı, biraz sonra tekrar dene`),
    );
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    portfolio_id: portfolioId,
    symbol,
    tx_type: "BUY",
    quantity,
    price,
    currency,
    fx_to_try: fxToTry,
    fee,
    executed_at: new Date().toISOString(),
  });
  if (error) redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent(error.message));

  revalidatePath(`/portfolio/${portfolioId}`);
  redirect(`/portfolio/${portfolioId}`);
}

export async function addSellTransaction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const portfolioId = Number(formData.get("portfolioId"));
  const symbol = String(formData.get("symbol") ?? "").trim().toUpperCase();
  const quantity = Number(formData.get("quantity"));
  const price = Number(formData.get("price"));
  const fee = Number(formData.get("fee") ?? 0);

  // Sahip olunandan fazla satışı engelle — mevcut holdings'i transactions'tan türet.
  const { data: existingTxRows } = await supabase
    .from("transactions")
    .select("*")
    .eq("portfolio_id", portfolioId)
    .eq("symbol", symbol);

  const derived = derivePortfolio((existingTxRows ?? []).map(mapDbRowToTransaction));
  const holding = derived.holdings.get(symbol);
  if (!holding || quantity > holding.quantity + 1e-9) {
    redirect(
      `/portfolio/${portfolioId}?error=` +
        encodeURIComponent(`Sahip olduğundan fazla satamazsın (elinde: ${holding?.quantity ?? 0})`),
    );
  }

  const { data: instrument } = await supabase.from("instruments").select("currency").eq("symbol", symbol).maybeSingle();
  const currency = instrument?.currency ?? "TRY";
  const fxToTry = await resolveFxToTry(currency);
  if (fxToTry === null) {
    redirect(
      `/portfolio/${portfolioId}?error=` +
        encodeURIComponent(`${currency} kuru şu an alınamadı, biraz sonra tekrar dene`),
    );
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    portfolio_id: portfolioId,
    symbol,
    tx_type: "SELL",
    quantity,
    price,
    currency,
    fx_to_try: fxToTry,
    fee,
    executed_at: new Date().toISOString(),
  });
  if (error) redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent(error.message));

  revalidatePath(`/portfolio/${portfolioId}`);
  redirect(`/portfolio/${portfolioId}`);
}

export async function addCashTransaction(formData: FormData) {
  const { supabase, user } = await requireUser();

  const portfolioId = Number(formData.get("portfolioId"));
  const txType = String(formData.get("txType")) as "DEPOSIT" | "WITHDRAW";
  const cashAmount = Number(formData.get("cashAmount"));

  if (!cashAmount || cashAmount <= 0) {
    redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent("Tutar geçersiz"));
  }

  const { error } = await supabase.from("transactions").insert({
    user_id: user.id,
    portfolio_id: portfolioId,
    tx_type: txType,
    cash_amount: cashAmount,
    currency: "TRY",
    fx_to_try: 1,
    executed_at: new Date().toISOString(),
  });
  if (error) redirect(`/portfolio/${portfolioId}?error=` + encodeURIComponent(error.message));

  revalidatePath(`/portfolio/${portfolioId}`);
  redirect(`/portfolio/${portfolioId}`);
}
