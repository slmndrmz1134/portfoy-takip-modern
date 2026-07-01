import { createBrowserClient } from "@supabase/ssr";

/** İstemci bileşenlerinde (formlar, etkileşimli UI) kullanılan tarayıcı Supabase istemcisi. */
export function getBrowserSupabase() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
