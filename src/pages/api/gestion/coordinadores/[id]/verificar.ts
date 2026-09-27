import type { APIRoute } from "astro";
import { marcarVerificadoCoordinador } from "../../../../../lib/gestion/coordinadores";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del coordinador.");
    const body = (await request.json()) as { verificado: boolean };
    const coordinador = await marcarVerificadoCoordinador(id, body.verificado);
    return json(coordinador);
  });
