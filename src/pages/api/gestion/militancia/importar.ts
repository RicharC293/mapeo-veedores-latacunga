import type { APIRoute } from "astro";
import { getMapData } from "../../../../lib/data";
import { importarMilitantes } from "../../../../lib/gestion/militancia";
import {
  json,
  handle,
  requireApiRole,
} from "../../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../../lib/auth/roles";
import type { TipoMilitancia } from "../../../../lib/gestion/types";

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      responsableLiderId: string;
      recintoCodigo?: number;
      tipoPreasignado?: TipoMilitancia;
      filas: { cedula: string; nombres: string; telefono: string }[];
    };

    let parroquiaCodigo: number | undefined;
    if (body.recintoCodigo != null) {
      const data = await getMapData();
      const recinto = data.recintos.find((r) => r.cod === body.recintoCodigo);
      if (!recinto) throw new Error("Recinto no encontrado.");
      parroquiaCodigo = recinto.par;
    }

    const resultado = await importarMilitantes({
      responsableLiderId: body.responsableLiderId,
      recintoCodigo: body.recintoCodigo,
      parroquiaCodigo,
      tipoPreasignado: body.tipoPreasignado,
      filas: body.filas,
    });
    return json(resultado, { status: 201 });
  });
};
