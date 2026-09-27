import type { APIRoute } from "astro";
import { desvincularVeedor } from "../../../../../lib/gestion/veedores";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del veedor.");
    const body = (await request.json().catch(() => ({}))) as {
      motivo?: string;
    };
    await desvincularVeedor(id, body.motivo?.trim() || null);
    return json({ ok: true });
  });
