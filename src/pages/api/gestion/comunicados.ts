import type { APIRoute } from "astro";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import {
  crearComunicado,
  listComunicados,
  listEnvios,
  type DatosNuevoComunicado,
} from "../../../lib/comunicados/comunicados";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const [comunicados, envios] = await Promise.all([
      listComunicados(),
      listEnvios(),
    ]);
    return json({ comunicados, envios });
  });
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.comunicados);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as Partial<DatosNuevoComunicado>;
    const comunicado = await crearComunicado(
      {
        titulo: body.titulo ?? "",
        mensaje: body.mensaje ?? "",
        enlace: body.enlace ?? "",
        filtros: body.filtros as DatosNuevoComunicado["filtros"],
      },
      locals.usuario,
    );
    return json(comunicado, { status: 201 });
  });
};
