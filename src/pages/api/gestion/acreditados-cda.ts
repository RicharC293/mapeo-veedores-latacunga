import type { APIRoute } from "astro";
import { getMapData } from "../../../lib/data";
import {
  agregarAcreditadoCda,
  listAcreditadosCda,
} from "../../../lib/gestion/acreditadosCda";
import {
  json,
  handle,
  requireApiRole,
} from "../../../lib/gestion/apiHelpers";
import { PAGINAS_GESTION } from "../../../lib/auth/roles";

export const GET: APIRoute = async ({ locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION["acreditados-cda"]);
  if (bloqueo) return bloqueo;
  return handle(async () => json(await listAcreditadosCda()));
};

export const POST: APIRoute = async ({ request, locals }) => {
  const bloqueo = requireApiRole(locals, PAGINAS_GESTION["acreditados-cda"]);
  if (bloqueo) return bloqueo;
  return handle(async () => {
    const body = (await request.json()) as {
      cedula: string;
      nombres: string;
      telefono: string;
      responsable: string;
      recintoCodigo: number;
      tipo: "titular" | "suplente";
    };
    const data = await getMapData();
    const recinto = data.recintos.find((r) => r.cod === body.recintoCodigo);
    if (!recinto) throw new Error("Recinto no encontrado.");
    if (!recinto.cda) throw new Error("Este recinto no es un CDA.");

    const acreditado = await agregarAcreditadoCda({
      cedula: body.cedula,
      nombres: body.nombres,
      telefono: body.telefono,
      responsable: body.responsable ?? "",
      recintoCodigo: recinto.cod,
      parroquiaCodigo: recinto.par,
      tipo: body.tipo,
    });
    return json(acreditado, { status: 201 });
  });
};
