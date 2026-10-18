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
import { getMapData } from "../../../../../lib/data";
import {
  existeJunta,
  listJuntasDeRecinto,
} from "../../../../../lib/gestion/juntas";

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
    const d = destino as AsignarDestino;
    // El destino se valida contra los datos del recinto: la parroquia sale del
    // recinto (no de lo que mande la pantalla), un CDA solo va en un recinto
    // CDA y un veedor solo en una mesa que el recinto tenga.
    const data = await getMapData();
    const recinto = data.recintos.find((r) => r.cod === d.recintoCodigo);
    if (!recinto) throw new Error("Recinto no encontrado.");
    d.parroquiaCodigo = recinto.par;
    if (d.tipo === "cda" && !recinto.cda) {
      throw new Error("Ese recinto no es CDA: elige uno que lo sea.");
    }
    if (d.tipo === "veedor") {
      if (d.numero != null) {
        if (!existeJunta(recinto, d.genero, d.numero)) {
          throw new Error(
            `El recinto ${recinto.nombre} no tiene la junta ${d.genero}${d.numero}.`,
          );
        }
      } else {
        // Sin número de junta: se elige sola entre las del género indicado,
        // así que se le pasan sus ids en orden.
        d.juntaIds = listJuntasDeRecinto(recinto)
          .filter((j) => j.genero === d.genero)
          .sort((a, b) => a.numero - b.numero)
          .map((j) => j.id);
      }
    }
    const resultado = await asignarMilitante(id, d, confirmarSuplente === true);
    // 409: el destino ya está ocupado; el cliente muestra el aviso o pide
    // confirmar que la persona quedará como suplente.
    return json(resultado, {
      status: resultado.estado === "asignado" ? 201 : 409,
    });
  });
};
