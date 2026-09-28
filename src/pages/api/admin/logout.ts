import type { APIRoute } from "astro";
import { supabaseServerClient } from "../../../lib/auth/supabaseServer";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const supabase = supabaseServerClient(request, cookies);
  if (supabase) await supabase.auth.signOut();
  return redirect("/");
};
