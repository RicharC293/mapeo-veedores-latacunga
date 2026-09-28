import type { APIRoute } from "astro";
import {
  agregarAListaNegra,
  listListaNegra,
} from "../../../lib/gestion/listaNegra";
import {
  json,
  handle,
  requireApiRole,
} from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION["lista-negra"]);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listListaNegra()));
};

// El alta manual queda reservada al administrador: Gestor solo puede ver y
// eliminar registros que ya existen.
export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, ["administrador"]);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      motivo: string | null;
    };
    const entry = await agregarAListaNegra({ ...body, origen: "manual" });
    return json(entry, { status: 201 });
  });
};
