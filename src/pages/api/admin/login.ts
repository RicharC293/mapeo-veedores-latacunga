import type { APIRoute } from "astro";
import { supabaseServerClient } from "../../../lib/auth/supabaseServer";

export const POST: APIRoute = async ({ request, cookies, redirect }) => {
  const form = await request.formData();
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");

  const supabase = supabaseServerClient(request, cookies);
  if (!supabase) {
    return redirect("/admin/login?error=Supabase no está configurado.");
  }

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) {
    return redirect(
      `/admin/login?error=${encodeURIComponent("Correo o contraseña incorrectos.")}`,
    );
  }
  return redirect("/gestion");
};
