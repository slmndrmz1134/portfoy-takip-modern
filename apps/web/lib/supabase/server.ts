import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Server Component / Server Action içinde çağrılan Supabase istemcisi.
 * Kullanıcının oturum çerezini okur — RLS, o kullanıcının auth.uid()'sine göre çalışır.
 */
export async function getServerSupabase() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Server Component içinden çağrılırsa cookie yazılamaz — middleware zaten
            // session yenilemeyi hallediyor, burada sessizce yutuyoruz.
          }
        },
      },
    },
  );
}
