import type { APIRoute } from "astro";
import { crearAcceso, listAccesos } from "../../../lib/gestion/accesos";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.accesos);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listAccesos()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.accesos);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      rol: "militante" | "gestor";
      etiqueta: string;
    };
    const acceso = await crearAcceso(body);
    return json(acceso, { status: 201 });
  });
};
