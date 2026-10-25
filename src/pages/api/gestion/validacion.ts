import type { APIRoute } from "astro";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import { listValidaciones } from "../../../lib/validacion/validaciones";
import { validacionesParaVista } from "../../../lib/validacion/pantalla";

// Estado de la verificación de identidad para el Consolidado: lo ve quien ve
// el Consolidado; la respuesta completa, solo quien puede verificar.
export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.consolidado);
  if (bloqueo) return bloqueo;
  return handle(async () =>
    json(
      validacionesParaVista(
        await listValidaciones(),
        PAGINAS_GESTION.validacion.includes(locals.rol),
      ),
    ),
  );
};
