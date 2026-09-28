import { randomBytes } from "node:crypto";
import { supabaseSecret } from "../supabase";

export interface Acceso {
  id: string;
  token: string;
  rol: "militante" | "gestor";
  etiqueta: string;
  activo: boolean;
  creadoEn: string;
  ultimoUsoEn: string | null;
}

function rowToAcceso(row: Record<string, unknown>): Acceso {
  return {
    id: row.id as string,
    token: row.token as string,
    rol: row.rol as "militante" | "gestor",
    etiqueta: row.etiqueta as string,
    activo: Boolean(row.activo),
    creadoEn: row.creado_en as string,
    ultimoUsoEn: (row.ultimo_uso_en as string | null) ?? null,
  };
}

// Esta tabla solo tiene sentido con Supabase real: la autenticación por
// enlace único no se puede simular con el respaldo JSON local.
function requireSupabase() {
  if (!supabaseSecret) {
    throw new Error(
      "Los accesos por enlace requieren Supabase configurado en este entorno.",
    );
  }
  return supabaseSecret;
}

export async function listAccesos(): Promise<Acceso[]> {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from("accesos")
    .select("*")
    .order("creado_en", { ascending: false });
  if (error) throw new Error(error.message);
  return data.map(rowToAcceso);
}

export async function crearAcceso(input: {
  rol: "militante" | "gestor";
  etiqueta: string;
}): Promise<Acceso> {
  const supabase = requireSupabase();
  const token = randomBytes(16).toString("hex");
  const { data, error } = await supabase
    .from("accesos")
    .insert({ token, rol: input.rol, etiqueta: input.etiqueta.trim() })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return rowToAcceso(data);
}

export async function revocarAcceso(id: string): Promise<void> {
  const supabase = requireSupabase();
  const { error } = await supabase
    .from("accesos")
    .update({ activo: false })
    .eq("id", id);
  if (error) throw new Error(error.message);
}

// Usado por /acceso/[token] (validar antes de poner la cookie) y por el
// middleware en cada request (resolver el rol a partir de la cookie ya
// puesta). No lanza: si Supabase no está configurado o el token no existe,
// devuelve null.
export async function buscarAccesoPorToken(
  token: string,
): Promise<Acceso | null> {
  if (!supabaseSecret) return null;
  const { data, error } = await supabaseSecret
    .from("accesos")
    .select("*")
    .eq("token", token)
    .maybeSingle();
  if (error || !data) return null;
  return rowToAcceso(data);
}

export async function marcarUltimoUso(id: string): Promise<void> {
  if (!supabaseSecret) return;
  await supabaseSecret
    .from("accesos")
    .update({ ultimo_uso_en: new Date().toISOString() })
    .eq("id", id);
}
