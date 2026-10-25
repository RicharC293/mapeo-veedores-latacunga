import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import { mantenerNombres } from "../../../../lib/validacion/validaciones";

// Conserva el nombre del sistema de las cédulas indicadas aunque difiera del
// oficial; esas personas pasan a contar como verificadas.
export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.validacion);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as { cedulas?: unknown };
    const cedulas = Array.isArray(body.cedulas)
      ? body.cedulas.filter((c): c is string => typeof c === "string")
      : [];
    if (cedulas.length === 0) throw new Error("No hay nombres para mantener.");
    return json({ mantenidas: await mantenerNombres(cedulas) });
  });
};
