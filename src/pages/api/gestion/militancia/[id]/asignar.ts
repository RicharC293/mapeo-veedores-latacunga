import type { APIRoute } from "astro";
import {
  asignarMilitante,
  type AsignarDestino,
} from "../../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../../lib/auth/roles";

export const POST: APIRoute = async ({ params, request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const id = params.id;
    if (!id) throw new Error("Falta el id del militante.");
    const { confirmarSuplente, ...destino } =
      (await request.json()) as AsignarDestino & {
        confirmarSuplente?: boolean;
      };
    const resultado = await asignarMilitante(
      id,
      destino as AsignarDestino,
      confirmarSuplente === true,
    );
    // 409: el destino ya está ocupado; el cliente muestra el aviso o pide
    // confirmar que la persona quedará como suplente.
    return json(resultado, {
      status: resultado.estado === "asignado" ? 201 : 409,
    });
  });
};
