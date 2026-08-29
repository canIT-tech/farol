import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Singleton do cliente Supabase no browser (Auth só; a api valida o JWT por conta própria).
// Fora de coverage/mutação: wrapper de SDK, exercido pelo e2e de login/onboarding.
let client: SupabaseClient | undefined;

export function getSupabaseBrowserClient(): SupabaseClient {
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
    client = createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  }
  return client;
}
