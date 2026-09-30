import type { APIRoute } from "astro";
import { eliminarMilitante } from "../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

export const DELETE: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del militante.");
    await eliminarMilitante(id);
    return json({ ok: true });
  });
};
