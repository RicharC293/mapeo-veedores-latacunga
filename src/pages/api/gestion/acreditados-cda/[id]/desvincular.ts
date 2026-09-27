import type { APIRoute } from "astro";
import { desvincularAcreditadoCda } from "../../../../../lib/gestion/acreditadosCda";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del acreditado CDA.");
    const body = (await request.json().catch(() => ({}))) as {
      motivo?: string;
    };
    await desvincularAcreditadoCda(id, body.motivo?.trim() || null);
    return json({ ok: true });
  });
