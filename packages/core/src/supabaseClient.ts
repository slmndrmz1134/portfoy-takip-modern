import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Paylaşılan Supabase istemci fabrikası — web ve mobil aynı fonksiyonu kullanır.
 * anonKey: istemci tarafı (RLS ile korunur). serviceRoleKey: yalnızca sunucu/cron
 * tarafında kullanılmalı (RLS'yi bypass eder) — İSTEMCİYE ASLA GÖNDERİLMEMELİ.
 */
export function createSupabaseClient(url: string, key: string): SupabaseClient {
  if (!url || !key) {
    throw new Error("Supabase url/key eksik — env değişkenlerini kontrol edin.");
  }
  return createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
}

export function createSupabaseServiceClient(url: string, serviceRoleKey: string): SupabaseClient {
  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role url/key eksik — cron/server env değişkenlerini kontrol edin.");
  }
  return createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
