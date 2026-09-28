import type { APIRoute } from "astro";
import { revocarAcceso } from "../../../../../lib/gestion/accesos";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.accesos);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del acceso.");
    await revocarAcceso(id);
    return json({ ok: true });
  });
};
