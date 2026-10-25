import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import { deshacerNombres } from "../../../../lib/validacion/validaciones";

// Devuelve el nombre que tenían las cédulas indicadas antes de aplicar el
// nombre oficial.
export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.validacion);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as { cedulas?: unknown };
    const cedulas = Array.isArray(body.cedulas)
      ? body.cedulas.filter((c): c is string => typeof c === "string")
      : [];
    if (cedulas.length === 0) throw new Error("No hay nombres para deshacer.");
    return json({ deshechas: await deshacerNombres(cedulas) });
  });
};
