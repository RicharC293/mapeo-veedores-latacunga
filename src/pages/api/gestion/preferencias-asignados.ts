import type { APIRoute } from "astro";
import { completarPreferenciasAsignados } from "../../../lib/gestion/preferenciaAsignados";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

// Mantenimiento (solo administrador): completa la preferencia de personas ya
// asignadas que la tienen vacía.
export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.accesos);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      items: { cedula: string; preferencia: string }[];
    };
    return json(await completarPreferenciasAsignados(body.items ?? []));
  });
};
