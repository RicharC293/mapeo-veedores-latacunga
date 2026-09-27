import type { APIRoute } from "astro";
import { marcarVerificadoVeedor } from "../../../../../lib/gestion/veedores";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del veedor.");
    const body = (await request.json()) as { verificado: boolean };
    const veedor = await marcarVerificadoVeedor(id, body.verificado);
    return json(veedor);
  });
