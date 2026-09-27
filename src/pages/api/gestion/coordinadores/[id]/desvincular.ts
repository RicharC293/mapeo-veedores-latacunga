import type { APIRoute } from "astro";
import { desvincularCoordinador } from "../../../../../lib/gestion/coordinadores";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del coordinador.");
    const body = (await request.json().catch(() => ({}))) as {
      motivo?: string;
    };
    await desvincularCoordinador(id, body.motivo?.trim() || null);
    return json({ ok: true });
  });
