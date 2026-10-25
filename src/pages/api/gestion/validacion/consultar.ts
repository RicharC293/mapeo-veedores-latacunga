import type { APIRoute } from "astro";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import { consultarCedulas } from "../../../../lib/validacion/validaciones";

// Cada llamada consulta pocas cédulas para no pasarse del tiempo máximo de la
// función en el servidor; la pantalla envía las seleccionadas por tandas.
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
    const body = (await request.json()) as { cedulas?: unknown };
    const cedulas = Array.isArray(body.cedulas)
      ? body.cedulas.filter((c): c is string => typeof c === "string")
      : [];
    if (cedulas.length === 0) throw new Error("No hay cédulas para consultar.");
    if (cedulas.length > MAXIMO_POR_LLAMADA) {
      throw new Error(
        `Se consultan como máximo ${MAXIMO_POR_LLAMADA} cédulas por llamada.`,
      );
    }
    // ECUADORAPI_URL solo sirve para probar contra un servicio simulado; en
    // producción se usa la dirección real de la API.
    return json(
      await consultarCedulas(
        cedulas,
        apiKey,
        import.meta.env.ECUADORAPI_URL || undefined,
      ),
    );
  });
};
