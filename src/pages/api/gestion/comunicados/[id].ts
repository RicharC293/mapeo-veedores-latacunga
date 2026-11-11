import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import {
  actualizarComunicado,
  eliminarComunicado,
  type DatosNuevoComunicado,
} from "../../../../lib/comunicados/comunicados";

export const PATCH: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del comunicado.");
    const body = (await request.json()) as Partial<DatosNuevoComunicado>;
    const comunicado = await actualizarComunicado(id, {
      titulo: body.titulo ?? "",
      mensaje: body.mensaje ?? "",
      enlace: body.enlace ?? "",
      filtros: body.filtros as DatosNuevoComunicado["filtros"],
    });
    return json(comunicado);
  });
};

export const DELETE: APIRoute = async ({ params, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del comunicado.");
    await eliminarComunicado(id);
    return json({ ok: true });
  });
};
