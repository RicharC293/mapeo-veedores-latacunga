import type { APIRoute } from "astro";
import { getMapData } from "../../../../lib/data";
import { autocompletarRecintos } from "../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";

export const POST: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const data = await getMapData();
    const resultado = await autocompletarRecintos(
      data.recintos,
      data.parroquias.features,
    );
    return json(resultado);
  });
};
