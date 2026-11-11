import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";
import {
  desmarcarEnviado,
  marcarEnviado,
} from "../../../../../lib/comunicados/comunicados";

// Marca (POST) o desmarca (DELETE) el comunicado como enviado a un celular.
export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del comunicado.");
    const { numero } = (await request.json()) as { numero?: string };
    return json(await marcarEnviado(id, numero ?? "", locals.usuario));
  });
};

export const DELETE: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del comunicado.");
    const { numero } = (await request.json()) as { numero?: string };
    await desmarcarEnviado(id, numero ?? "");
    return json({ ok: true });
  });
};
