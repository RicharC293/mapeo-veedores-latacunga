import type { APIRoute } from "astro";
import {
  agregarMilitante,
  listMilitantes,
} from "../../../lib/gestion/militancia";
import { json, handle, requireApiRole } from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";
import { getMapData } from "../../../lib/data";
import { recintoDePreferencia } from "../../../lib/gestion/recintoPreferencia";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listMilitantes()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.militancia);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      email?: string;
      preferencia?: string;
      responsableLiderId: string | null;
    };
    // Si la preferencia corresponde a un único recinto, se precarga.
    let recinto = null;
    if (body.preferencia?.trim()) {
      const data = await getMapData();
      recinto = recintoDePreferencia(
        body.preferencia,
        data.recintos,
        data.parroquias.features,
      );
    }
    const militante = await agregarMilitante({
      ...body,
      recintoCodigo: recinto?.cod ?? null,
      parroquiaCodigo: recinto?.par ?? null,
    });
    return json(militante, { status: 201 });
  });
};
