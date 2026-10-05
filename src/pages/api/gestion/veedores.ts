import type { APIRoute } from "astro";
import { getMapData } from "../../../lib/data";
import { agregarVeedor, listVeedores } from "../../../lib/gestion/veedores";
import { juntaId } from "../../../lib/gestion/juntas";
import {
  json,
  handle,
  requireApiRole,
} from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.veedores);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listVeedores()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION.veedores);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      email?: string;
      responsableLiderId: string | null;
      recintoCodigo: number;
      genero: "F" | "M";
      numero: number;
      tipo: "titular" | "suplente";
    };
    const data = await getMapData();
    const recinto = data.recintos.find((r) => r.cod === body.recintoCodigo);
    if (!recinto) throw new Error("Recinto no encontrado.");

    const id = juntaId(recinto.cod, body.genero, body.numero);
    const veedor = await agregarVeedor({
      cedula: body.cedula,
      nombres: body.nombres,
      telefono: body.telefono,
      email: body.email,
      responsableLiderId: body.responsableLiderId ?? null,
      juntaId: id,
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      tipo: body.tipo,
    });
    return json(veedor, { status: 201 });
  });
};
