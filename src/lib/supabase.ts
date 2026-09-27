import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";

// Supabase reemplazó las claves legadas anon/service_role (JWT, empiezan con
// "eyJ") por claves publishable/secret (empiezan con "sb_publishable_" /
// "sb_secret_"). Se obtienen en Settings > API Keys (no en la pestaña
// "API" vieja, que ahora las marca como "legacy"). El cliente supabase-js
// no cambia: createClient(url, clave) funciona igual con cualquiera de los
// dos formatos.
const url = import.meta.env.PUBLIC_SUPABASE_URL;
const publishableKey = import.meta.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = import.meta.env.SUPABASE_SECRET_KEY;

export const supabaseConfigurado = Boolean(url && publishableKey);

// Cliente con la clave publishable: respeta RLS, seguro para lecturas
// públicas del mapa. Se usa en getMapData().
export const supabasePublishable: SupabaseClient<Database> | null =
  url && publishableKey
    ? createClient<Database>(url, publishableKey, {
        auth: { persistSession: false },
      })
    : null;

// Cliente con la clave secret: se salta RLS. Solo se importa desde código
// de servidor (rutas API de Astro, scripts locales) y nunca debe llegar al
// navegador ni usarse con el prefijo PUBLIC_.
export const supabaseSecret: SupabaseClient<Database> | null =
  url && secretKey
    ? createClient<Database>(url, secretKey, {
        auth: { persistSession: false },
      })
    : null;
