import { createServerClient, parseCookieHeader } from "@supabase/ssr";
import type { AstroCookies } from "astro";
import type { Database } from "../database.types";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

// Cliente de Supabase Auth atado a las cookies de la request actual, según
// el patrón oficial de @supabase/ssr para frameworks SSR: Astro no expone
// todas las cookies de una vez, así que se parsean a mano desde el header.
export function supabaseServerClient(request: Request, cookies: AstroCookies) {
  if (!url || !publishableKey) return null;
  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return parseCookieHeader(request.headers.get("cookie") ?? "").map(
          ({ name, value }) => ({ name, value: value ?? "" }),
        );
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookies.set(name, value, options);
        });
      },
    },
  });
}
