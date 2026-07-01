import { NextResponse } from "next/server";
import { resolvePrice, type Market } from "@portfoy/core";
import { getSupabaseServiceClient } from "@/lib/supabase";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Vercel Cron tarafından her 15 dakikada bir çağrılır (bkz. vercel.json).
 * Fiyat çekimini SAYFA YÜKLEMESİNDEN AYRIR — uygulama her zaman DB'den okur.
 *
 * Güvenilirlik kuralı: bir sembol için fresh fiyat alınamazsa HİÇBİR ŞEY YAZILMAZ.
 * `prices` tablosundaki son satır (last-known-good) olduğu gibi kalır; tazelik,
 * okuma tarafında `as_of` yaşına bakılarak hesaplanır (bkz. docs/veri-kaynaklari.md).
 * Bu sayede DB'ye asla `0` veya çöp bir değer yazılmaz.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && authHeader !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabase = getSupabaseServiceClient();
  const finnhubApiKey = process.env.FINNHUB_API_KEY ?? "";

  const { data: instruments, error } = await supabase
    .from("instruments")
    .select("symbol, market");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const results: { symbol: string; ok: boolean; source?: string }[] = [];

  for (const instrument of instruments ?? []) {
    const raw = await resolvePrice(instrument.symbol, instrument.market as Market, {
      finnhubApiKey,
    });

    if (!raw) {
      // Fresh fiyat alınamadı — hiçbir satır yazılmıyor. Son bilinen fiyat (last-known-good)
      // okuma tarafında geçerliliğini korur; "is_stale" orada as_of yaşına göre hesaplanır.
      results.push({ symbol: instrument.symbol, ok: false });
      continue;
    }

    const { error: insertError } = await supabase.from("prices").insert({
      symbol: instrument.symbol,
      price: raw.price,
      currency: raw.currency,
      source: raw.source,
      is_stale: false,
      as_of: new Date().toISOString(),
    });

    results.push({ symbol: instrument.symbol, ok: !insertError, source: raw.source });
  }

  return NextResponse.json({ ranAt: new Date().toISOString(), results });
}
