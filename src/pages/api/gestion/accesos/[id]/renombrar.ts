import type { APIRoute } from "astro";
import { renombrarAcceso } from "../../../../../lib/gestion/accesos";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.accesos);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del acceso.");
    const body = (await request.json()) as { etiqueta: string };
    return json(await renombrarAcceso(id, body.etiqueta ?? ""));
  });
};
