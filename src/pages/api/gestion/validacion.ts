import type { APIRoute } from "astro";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import { datosVerificacion } from "../../../lib/validacion/pantalla";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.validacion);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await datosVerificacion()));
};
