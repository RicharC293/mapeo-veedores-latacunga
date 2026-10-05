import type { APIRoute } from "astro";
import { getMapData } from "../../../../lib/data";
import { importarMilitantes } from "../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import { recintoDePreferencia } from "../../../../lib/gestion/recintoPreferencia";
import type { TipoMilitancia } from "../../../../lib/gestion/types";

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      responsableLiderId: string;
      recintoCodigo?: number;
      tipoPreasignado?: TipoMilitancia;
      filas: {
        cedula: string;
        nombres: string;
        telefono: string;
        email?: string;
        preferencia?: string;
      }[];
    };

    const data = await getMapData();
    let parroquiaCodigo: number | undefined;
    if (body.recintoCodigo != null) {
      const recinto = data.recintos.find((r) => r.cod === body.recintoCodigo);
      if (!recinto) throw new Error("Recinto no encontrado.");
      parroquiaCodigo = recinto.par;
    }

    const resultado = await importarMilitantes({
      responsableLiderId: body.responsableLiderId,
      recintoCodigo: body.recintoCodigo,
      parroquiaCodigo,
      tipoPreasignado: body.tipoPreasignado,
      // Cada fila con una preferencia reconocible llega con su recinto ya
      // precargado (salvo que se haya elegido un destino para todo el lote).
      filas: body.filas.map((fila) => {
        const recinto = fila.preferencia?.trim()
          ? recintoDePreferencia(
              fila.preferencia,
              data.recintos,
              data.parroquias.features,
            )
          : null;
        return {
          ...fila,
          recintoCodigo: recinto?.cod ?? null,
          parroquiaCodigo: recinto?.par ?? null,
        };
      }),
    });
    return json(resultado, { status: 201 });
  });
};
