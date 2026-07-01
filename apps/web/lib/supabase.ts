import { createSupabaseClient, createSupabaseServiceClient } from "@portfoy/core";

/** İstemci/sunucu bileşenlerinde kullanılan, RLS ile korunan Supabase istemcisi. */
export function getSupabaseClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  );
}

/** Yalnızca sunucu tarafı route handler'larda (cron gibi) kullanılır — RLS'yi bypass eder. */
export function getSupabaseServiceClient() {
  return createSupabaseServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
  );
}
