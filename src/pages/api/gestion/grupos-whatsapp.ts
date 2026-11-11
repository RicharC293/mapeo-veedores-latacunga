import type { APIRoute } from "astro";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import {
  guardarGrupoWhatsapp,
  listGruposWhatsapp,
} from "../../../lib/gestion/gruposWhatsapp";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.consolidado);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listGruposWhatsapp()));
};

// Agrega, cambia o (con enlace vacío) quita el grupo de WhatsApp de un recinto.
export const PUT: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.consolidado);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      recintoCodigo?: number;
      enlace?: string;
    };
    return json(
      await guardarGrupoWhatsapp(
        Number(body.recintoCodigo),
        body.enlace ?? "",
        locals.usuario,
      ),
    );
  });
};
