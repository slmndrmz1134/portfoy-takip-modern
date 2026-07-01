import "react-native-url-polyfill/auto";
import { createSupabaseClient } from "@portfoy/core";

// Expo, env değişkenlerini EXPO_PUBLIC_ önekiyle istemciye taşır.
export const supabase = createSupabaseClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? "",
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "",
);
