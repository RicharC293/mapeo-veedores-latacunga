import type { APIRoute } from "astro";
import { agregarLider, listLideres } from "../../../lib/gestion/lideres";
import { getMapData } from "../../../lib/data";
import {
  json,
  handle,
  requireApiRole,
} from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import type { AmbitoLider, Cargo } from "../../../lib/gestion/types";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listLideres()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.lideres);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string | null;
      nombres: string;
      telefono: string;
      organizacion: string;
      ambito?: AmbitoLider | null;
      parroquiaCodigo: number | null;
      parroquiaCodigos?: number[];
      recintoCodigos: number[];
      cargo: Cargo | null;
    };
    if (body.cargo === "vocal_junta_parroquial") {
      const data = await getMapData();
      const parroquia = data.parroquias.features.find(
        (f) => f.properties.code === body.parroquiaCodigo,
      );
      if (!parroquia) throw new Error("Parroquia no encontrada.");
      if (parroquia.properties.urbana) {
        throw new Error(
          "El vocal de junta parroquial debe pertenecer a una parroquia rural.",
        );
      }
    }
    const lider = await agregarLider({
      ...body,
      ambito: body.ambito ?? null,
      parroquiaCodigos: body.parroquiaCodigos ?? [],
    });
    return json(lider, { status: 201 });
  });
};
