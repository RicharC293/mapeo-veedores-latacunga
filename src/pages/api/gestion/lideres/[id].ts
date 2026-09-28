import type { APIRoute } from "astro";
import { editarLider, eliminarLider } from "../../../../lib/gestion/lideres";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del líder.");
    const patch = await request.json();
    const lider = await editarLider(id, patch);
    return json(lider);
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del líder.");
    await eliminarLider(id);
    return json({ ok: true });
  });
};
