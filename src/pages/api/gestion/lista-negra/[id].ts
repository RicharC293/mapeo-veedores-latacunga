import type { APIRoute } from "astro";
import {
  editarListaNegra,
  quitarDeListaNegra,
} from "../../../../lib/gestion/listaNegra";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

// Editar un registro manualmente es, en espíritu, lo mismo que crearlo:
// queda reservado al administrador. Gestor solo puede sacar a alguien de la
// lista negra.
export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, ["administrador"]);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del registro.");
    const patch = await request.json();
    const entry = await editarListaNegra(id, patch);
    return json(entry);
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION["lista-negra"]);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del registro.");
    await quitarDeListaNegra(id);
    return json({ ok: true });
  });
};
