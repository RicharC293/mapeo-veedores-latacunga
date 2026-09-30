import type { APIRoute } from "astro";
import {
  asignarMilitante,
  type AsignarDestino,
} from "../../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del militante.");
    const destino = (await request.json()) as AsignarDestino;
    const creado = await asignarMilitante(id, destino);
    return json(creado, { status: 201 });
  });
};
