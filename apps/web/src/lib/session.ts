import { getSupabaseBrowserClient } from "./supabase";

// Sair: encerra a sessão do Supabase no browser. Nunca lança — o supabase-js
// devolve { error } em vez de rejeitar, e quem chama decide para onde ir depois.
export async function signOut(): Promise<void> {
  await getSupabaseBrowserClient().auth.signOut();
}
