import type { APIRoute } from "astro";
import { desvincularCoordinador } from "../../../../../lib/gestion/coordinadores";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.coordinadores);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del coordinador.");
    const body = (await request.json().catch(() => ({}))) as {
      motivo?: string;
      listaNegra?: boolean;
    };
    await desvincularCoordinador(
      id,
      body.motivo?.trim() || null,
      body.listaNegra ?? true,
    );
    return json({ ok: true });
  });
};
