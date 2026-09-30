import type { APIRoute } from "astro";
import { editarLider, eliminarLider } from "../../../../lib/gestion/lideres";
import { getMapData } from "../../../../lib/data";
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
    if (patch.cargo === "vocal_junta_parroquial") {
      const data = await getMapData();
      const parroquia = data.parroquias.features.find(
        (f) => f.properties.code === patch.parroquiaCodigo,
      );
      if (!parroquia) throw new Error("Parroquia no encontrada.");
      if (parroquia.properties.urbana) {
        throw new Error(
          "El vocal de junta parroquial debe pertenecer a una parroquia rural.",
        );
      }
    }
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
