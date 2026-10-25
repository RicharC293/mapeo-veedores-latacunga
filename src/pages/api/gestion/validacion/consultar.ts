import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import { consultarPendientes } from "../../../../lib/validacion/validaciones";

// Cada llamada consulta pocas cédulas para no pasarse del tiempo máximo de la
// función en el servidor; la pantalla repite las llamadas hasta el tope que
// eligió el administrador.
const MAXIMO_POR_LLAMADA = 10;

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.validacion);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const apiKey = import.meta.env.ECUADORAPI_KEY;
    if (!apiKey) {
      throw new Error(
        "Falta configurar ECUADORAPI_KEY en el servidor: sin la clave no se consulta nada.",
      );
    }
    const body = (await request.json()) as { limite?: number };
    const limite = Math.min(
      MAXIMO_POR_LLAMADA,
      Math.max(1, Math.floor(Number(body.limite) || 0)),
    );
    // ECUADORAPI_URL solo sirve para probar contra un servicio simulado; en
    // producción se usa la dirección real de la API.
    return json(
      await consultarPendientes(
        limite,
        apiKey,
        import.meta.env.ECUADORAPI_URL || undefined,
      ),
    );
  });
};
