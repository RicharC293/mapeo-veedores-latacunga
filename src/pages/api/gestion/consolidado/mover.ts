import type { APIRoute } from "astro";
import { moverPersona } from "../../../../lib/gestion/moverPersona";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import type { Clase } from "../../../../lib/gestion/movimiento";

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.consolidado);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      clase: Clase;
      id: string;
      destino: {
        clase: Clase;
        recintoCodigo: number;
        juntaId?: string | null;
      };
    };
    const clases: Clase[] = ["veedor", "coordinador", "cda"];
    if (
      !clases.includes(body.clase) ||
      !body.id ||
      !body.destino ||
      !clases.includes(body.destino.clase)
    ) {
      throw new Error("Solicitud de movimiento incompleta.");
    }
    const resultado = await moverPersona({
      clase: body.clase,
      id: body.id,
      destino: {
        clase: body.destino.clase,
        recintoCodigo: Number(body.destino.recintoCodigo),
        juntaId: body.destino.juntaId || null,
      },
    });
    return json(resultado);
  });
};
