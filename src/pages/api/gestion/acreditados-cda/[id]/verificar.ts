import type { APIRoute } from "astro";
import { marcarVerificadoAcreditadoCda } from "../../../../../lib/gestion/acreditadosCda";
import { json, handle } from "../../../../../lib/gestion/apiHelpers";

export const POST: APIRoute = async ({ params, request }) =>
  handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del acreditado CDA.");
    const body = (await request.json()) as { verificado: boolean };
    const acreditado = await marcarVerificadoAcreditadoCda(
      id,
      body.verificado,
    );
    return json(acreditado);
  });
