import type { APIRoute } from "astro";
import { desvincularAcreditadoCda } from "../../../../../lib/gestion/acreditadosCda";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION["acreditados-cda"]);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del acreditado CDA.");
    const body = (await request.json().catch(() => ({}))) as {
      motivo?: string;
    };
    await desvincularAcreditadoCda(id, body.motivo?.trim() || null);
    return json({ ok: true });
  });
};
